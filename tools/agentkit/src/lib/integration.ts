// Integration readiness (E3, SOLO LECTURA). Compone los gates existentes en un integration-report.
// NO ejecuta merge/push/deploy, NO sugiere comandos (E4), NO resuelve conflictos, NO escribe archivos.
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { analyzePlan, planIsValid } from "./dag.js";
import { loadVerdict } from "./loaders.js";
import { makeMatcher } from "./ownership.js";
import { loadPoliciesFromDir, evaluatePolicies } from "./policy.js";
import { loadApprovalsFromDir, requiredApproval, checkApprovals } from "./approval.js";
import { diffNames, GitError, isGitAvailable, isGitRepo } from "./git.js";
import type { Task, Verdict, Policy, Approval, IntegrationReport } from "../types/index.js";

const EXTS = new Set([".yaml", ".yml", ".json"]);
const CONTROL = ["tasks/**", "contracts/**", "verdicts/**", ".agent-runs/**", "policies/**", "approvals/**"];

export class IntegrationOperationalError extends Error {}

function loadVerdictsFromDir(dir: string): Verdict[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new IntegrationOperationalError(`directorio de verdicts no encontrado: ${dir}`);
  }
  const out: Verdict[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true }) as { name: string; parentPath?: string; path?: string; isFile: () => boolean }[]) {
    if (!entry.isFile() || entry.name.startsWith(".") || !EXTS.has(path.extname(entry.name).toLowerCase())) continue;
    const base = entry.parentPath ?? entry.path ?? dir;
    const r = loadVerdict(path.join(base, entry.name));
    if (!r.ok) throw new IntegrationOperationalError(`verdict inválido: ${path.join(base, entry.name)} (${r.errors.join("; ")})`);
    out.push(r.data);
  }
  return out;
}

export interface ReportOptions {
  feature: string;
  tasksDir: string;
  verdictsDir?: string;
  policiesDir?: string;
  approvalsDir?: string;
  repo?: string;
  base?: string;
  now: Date;
}

type CheckStatus = "pass" | "fail" | "skipped";
interface MutCheck { name: string; status: CheckStatus; detail?: string }

function closureApproved(verdicts: Verdict[], taskId: string, phase: "closure-audit" | "closure-security"): boolean {
  return verdicts.some((v) => v.task_id === taskId && v.phase === phase && v.verdict === "CIERRE APROBADO");
}

/** Construye el integration-report componiendo los gates. Lanza IntegrationOperationalError en fallos de input. */
export function buildIntegrationReport(opts: ReportOptions): IntegrationReport {
  const checks: MutCheck[] = [];
  const blockers: string[] = [];

  // --- Plan (DAG) ---
  const analysis = analyzePlan(opts.tasksDir); // lanza si el dir no existe
  const planOk = planIsValid(analysis);
  checks.push({ name: "validate-plan", status: planOk ? "pass" : "fail", detail: planOk ? undefined : "el plan no es válido (ciclo/missing/duplicado/task inválida)" });
  if (!planOk) blockers.push("validate-plan: plan inválido");

  const featureTasks: Task[] = analysis.tasks.filter((t) => t.feature === opts.feature);
  if (featureTasks.length === 0) {
    blockers.push(`no hay tasks para el feature "${opts.feature}"`);
  }
  const featureIds = new Set(featureTasks.map((t) => t.id));
  const mergeOrder = analysis.topoOrder.filter((id) => featureIds.has(id));

  // --- Tasks completed ---
  const notCompleted = featureTasks.filter((t) => t.status !== "completed");
  checks.push({ name: "tasks-completed", status: notCompleted.length === 0 && featureTasks.length > 0 ? "pass" : "fail", detail: notCompleted.length ? `no completadas: ${notCompleted.map((t) => `${t.id}=${t.status}`).join(", ")}` : undefined });
  for (const t of notCompleted) blockers.push(`task ${t.id} no está completed (status=${t.status})`);

  // --- Closure verdicts (según gates required) ---
  const taskBlockers = new Map<string, string[]>(featureTasks.map((t) => [t.id, []]));
  const requiresClosure = featureTasks.some((t) => t.gates.audit_f2 === "required" || t.gates.security_f2 === "required");
  let verdicts: Verdict[] = [];
  if (opts.verdictsDir !== undefined) {
    verdicts = loadVerdictsFromDir(opts.verdictsDir);
  }
  if (!requiresClosure) {
    checks.push({ name: "closure-verdicts", status: "skipped", detail: "ningún gate de cierre es required" });
  } else if (opts.verdictsDir === undefined) {
    checks.push({ name: "closure-verdicts", status: "fail", detail: "gates de cierre required pero no se pasó --verdicts" });
    blockers.push("closure-verdicts: faltan verdicts requeridos (--verdicts no provisto)");
  } else {
    let cf = false;
    for (const t of featureTasks) {
      if (t.gates.audit_f2 === "required" && !closureApproved(verdicts, t.id, "closure-audit")) {
        cf = true; taskBlockers.get(t.id)!.push("falta CIERRE APROBADO de audit (closure-audit)");
      }
      if (t.gates.security_f2 === "required" && !closureApproved(verdicts, t.id, "closure-security")) {
        cf = true; taskBlockers.get(t.id)!.push("falta CIERRE APROBADO de security (closure-security)");
      }
    }
    checks.push({ name: "closure-verdicts", status: cf ? "fail" : "pass", detail: cf ? "uno o más cierres requeridos no están CIERRE APROBADO" : undefined });
    if (cf) blockers.push("closure-verdicts: cierres requeridos no aprobados");
  }

  // --- Ownership (solo con --repo) ---
  if (opts.repo === undefined) {
    checks.push({ name: "ownership", status: "skipped", detail: "sin --repo: no se evaluó el diff" });
  } else if (!isGitAvailable() || !isGitRepo(opts.repo)) {
    throw new IntegrationOperationalError(`--repo no es un repo git válido: ${opts.repo}`);
  } else {
    try {
      const files = diffNames({ base: opts.base ?? "main" }, opts.repo);
      const isControl = makeMatcher(CONTROL);
      const impl = files.filter((f) => !isControl(f));
      const ownsMatcher = makeMatcher(featureTasks.flatMap((t) => t.owns));
      const unowned = impl.filter((f) => !ownsMatcher(f));
      checks.push({ name: "ownership", status: unowned.length === 0 ? "pass" : "fail", detail: unowned.length ? `archivos sin owner del feature: ${unowned.join(", ")}` : undefined });
      if (unowned.length) blockers.push(`ownership: ${unowned.length} archivo(s) fuera del owns del feature`);
    } catch (e) {
      if (e instanceof GitError) throw new IntegrationOperationalError(`git: ${e.message}`);
      throw e;
    }
  }

  // --- Policies (solo con --policies) ---
  let activePolicies: Policy[] = [];
  if (opts.policiesDir === undefined) {
    checks.push({ name: "policies", status: "skipped", detail: "sin --policies" });
  } else {
    const loaded = loadPoliciesFromDir(opts.policiesDir);
    if (loaded.invalid.length) throw new IntegrationOperationalError(`policies inválidas en ${opts.policiesDir}`);
    activePolicies = loaded.policies.filter((p) => p.status === "active");
    let pf = false;
    for (const t of featureTasks) {
      const r = evaluatePolicies(t, activePolicies, { candidatePaths: t.owns });
      if (r.blocking > 0) {
        pf = true;
        const ids = r.findings.filter((f) => f.blocking).map((f) => f.policy_id).join(", ");
        taskBlockers.get(t.id)!.push(`policy bloqueante: ${ids}`);
      }
    }
    checks.push({ name: "policies", status: pf ? "fail" : "pass", detail: pf ? "una o más policies bloquean" : undefined });
    if (pf) blockers.push("policies: hay bloqueos");
  }

  // --- Approvals ---
  const anyRequirement = featureTasks.some((t) => requiredApproval(t, activePolicies).level !== "none");
  if (!anyRequirement) {
    checks.push({ name: "approvals", status: "skipped", detail: "ningún task requiere aprobación" });
  } else if (opts.approvalsDir === undefined) {
    checks.push({ name: "approvals", status: "fail", detail: "se requieren approvals pero no se pasó --approvals" });
    blockers.push("approvals: requeridas pero --approvals no provisto");
  } else {
    const loaded = loadApprovalsFromDir(opts.approvalsDir);
    if (loaded.invalid.length) throw new IntegrationOperationalError(`approvals inválidas en ${opts.approvalsDir}`);
    let af = false;
    for (const t of featureTasks) {
      const req = requiredApproval(t, activePolicies);
      if (req.level === "none") continue;
      const res = checkApprovals(t, opts.feature, loaded.approvals, req, opts.now);
      if (!res.ok) {
        af = true;
        taskBlockers.get(t.id)!.push(`approval ${req.level} no satisfecha`);
      }
    }
    checks.push({ name: "approvals", status: af ? "fail" : "pass", detail: af ? "approvals requeridas no satisfechas" : undefined });
    if (af) blockers.push("approvals: requeridas no satisfechas");
  }

  // --- Estado por task ---
  const tasks = featureTasks.map((t) => {
    const tb = taskBlockers.get(t.id) ?? [];
    if (t.status !== "completed") tb.unshift(`status=${t.status} (no completed)`);
    return { id: t.id, status: t.status, ready_for_integration: tb.length === 0, blockers: tb };
  });

  const ready = blockers.length === 0 && !checks.some((c) => c.status === "fail") && featureTasks.length > 0;

  return {
    feature: opts.feature,
    generated_at: opts.now.toISOString(),
    ready,
    merge_order: mergeOrder,
    checks,
    blockers,
    tasks,
  };
}

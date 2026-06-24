// Harness de evals DETERMINISTA. Mide si las capacidades críticas del kit siguen funcionando:
// schemas, ownership, DAG, run logs. Reutiliza las funciones ya implementadas (sin LLM, sin git,
// sin llamadas externas, sin shelling). Los casos negativos cuentan como PASS si el sistema bloquea.
import { existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, validateArtifact } from "./validate.js";
import { classifyDiff } from "./ownership.js";
import { analyzePlan, planIsValid } from "./dag.js";
import { validateRunLog } from "./runlog.js";
import { evaluatePolicies } from "./policy.js";
import { requiredApproval, checkApprovals } from "./approval.js";
import { buildIntegrationReport } from "./integration.js";
import type { Task, Policy, Approval } from "../types/index.js";

const INTEG = (name: string) => path.join(REPO_ROOT, "fixtures", "integration", name);

export const CASES_DIR = path.join(REPO_ROOT, "evals", "cases");

export class EvalOperationalError extends Error {}

export interface CaseResult {
  case_id: string;
  category: string;
  command_or_check: string;
  expected: string;
  actual: string;
  passed: boolean;
  metric: string;
  message: string;
}

export interface MetricResult {
  passed: number;
  total: number;
  rate: number; // 0..1
  critical: boolean;
}

export interface EvalReport {
  results: CaseResult[];
  metrics: Record<string, MetricResult>;
  ok: boolean;
}

interface CaseDef {
  id: string;
  category: string;
  metric: string;
  /** requisitos de fixture; si falta alguno → error operacional */
  requires: string[];
  run: () => { command_or_check: string; expected: string; actual: string; passed: boolean; message: string };
}

const fx = (rel: string) => path.join(CASES_DIR, rel);

// Helpers para casos de policy (deterministas, en memoria — sin git ni IO).
function evalTask(over: Partial<Task> = {}): Task {
  return {
    id: "backend-1", feature: "eval", title: "eval task", lane: "backend", agent: "backend",
    status: "planned", profile: "lite", zones: ["🟢"], risk_level: "low", depends_on: [],
    owns: ["src/eval/x.ts"], contracts: [],
    gates: { audit_f1: "required", security_f1: "required", audit_f2: "optional", security_f2: "optional" },
    evidence_required: ["tests"], acceptance_criteria: ["x"], ...over,
  } as Task;
}
function evalPolicy(over: Partial<Policy>): Policy {
  return { id: "p", title: "p", severity: "HIGH", status: "active", block_condition: "zone_touch",
    approval_required: "none", responsible_agent: "security", ...over } as Policy;
}
const active = (ps: Policy[]) => ps.filter((p) => p.status === "active");

const EVAL_NOW = new Date("2026-06-24T12:00:00Z");
function evalApproval(over: Partial<Approval>): Approval {
  return { approval_id: "APR-1", feature_id: "eval", scope: "s", risk_level: "high",
    approval_type: "formal", requested_by: "dev", approved_by: "lead", decision: "approved",
    timestamp: "2026-06-24T10:00:00Z", ...over } as Approval;
}

const CASE_DEFS: CaseDef[] = [
  {
    id: "task-valid",
    category: "schema",
    metric: "schema_pass_rate",
    requires: ["task-valid.yaml"],
    run: () => {
      const r = validateArtifact("task", fx("task-valid.yaml"));
      return { command_or_check: "validate task", expected: "valid", actual: r.ok ? "valid" : "invalid", passed: r.ok, message: r.ok ? "" : r.errors.join("; ") };
    },
  },
  {
    id: "task-invalid",
    category: "schema",
    metric: "invalid_schema_block_rate",
    requires: ["task-invalid.yaml"],
    run: () => {
      const r = validateArtifact("task", fx("task-invalid.yaml"));
      return { command_or_check: "validate task", expected: "blocked (invalid)", actual: r.ok ? "passed (LEAK)" : "blocked", passed: !r.ok, message: r.ok ? "una task inválida NO fue bloqueada" : "" };
    },
  },
  {
    id: "ownership-pass",
    category: "ownership",
    metric: "ownership_violation_detection_rate",
    requires: [],
    run: () => {
      const { outOfScope } = classifyDiff(["src/invoices/list.ts", "tests/invoices/list.test.ts"], ["src/invoices/**", "tests/invoices/**"]);
      const passed = outOfScope.length === 0;
      return { command_or_check: "classifyDiff (en scope)", expected: "sin violaciones", actual: passed ? "sin violaciones" : `fuera: ${outOfScope.join(",")}`, passed, message: passed ? "" : "falso positivo de ownership" };
    },
  },
  {
    id: "ownership-fail",
    category: "ownership",
    metric: "ownership_violation_detection_rate",
    requires: [],
    run: () => {
      const { outOfScope } = classifyDiff(["src/billing/charge.ts"], ["src/invoices/**"]);
      const passed = outOfScope.includes("src/billing/charge.ts");
      return { command_or_check: "classifyDiff (fuera de scope)", expected: "detecta violación", actual: passed ? "violación detectada" : "no detectada", passed, message: passed ? "" : "no detectó archivo fuera de scope" };
    },
  },
  {
    id: "dag-valid",
    category: "dag",
    metric: "dag_validity_rate",
    requires: ["dag-valid"],
    run: () => {
      const a = analyzePlan(fx("dag-valid"));
      const passed = planIsValid(a) && a.topoOrder.length === 2;
      return { command_or_check: "analyzePlan", expected: "plan válido + orden topológico", actual: passed ? `válido: ${a.topoOrder.join(" → ")}` : "inválido", passed, message: passed ? "" : "plan válido marcado como inválido" };
    },
  },
  {
    id: "dag-cycle",
    category: "dag",
    metric: "cycle_detection_rate",
    requires: ["dag-cycle"],
    run: () => {
      const a = analyzePlan(fx("dag-cycle"));
      const passed = a.cycle !== null;
      return { command_or_check: "analyzePlan", expected: "detecta ciclo", actual: passed ? `ciclo: ${a.cycle!.join(" → ")}` : "sin ciclo", passed, message: passed ? "" : "no detectó el ciclo" };
    },
  },
  {
    id: "dag-missing-dependency",
    category: "dag",
    metric: "missing_dependency_detection_rate",
    requires: ["dag-missing"],
    run: () => {
      const a = analyzePlan(fx("dag-missing"));
      const passed = a.missingDeps.length > 0;
      return { command_or_check: "analyzePlan", expected: "detecta dep faltante", actual: passed ? `faltan: ${a.missingDeps.map((m) => m.missing).join(",")}` : "ninguna", passed, message: passed ? "" : "no detectó la dependencia faltante" };
    },
  },
  {
    id: "run-log-valid",
    category: "runlog",
    metric: "run_log_validation_rate",
    requires: ["run-log-valid.jsonl"],
    run: () => {
      const r = validateRunLog(fx("run-log-valid.jsonl"));
      return { command_or_check: "validateRunLog", expected: "válido", actual: r.ok ? "válido" : "inválido", passed: r.ok, message: r.ok ? "" : r.errors.join("; ") };
    },
  },
  {
    id: "run-log-invalid",
    category: "runlog",
    metric: "run_log_validation_rate",
    requires: ["run-log-invalid.jsonl"],
    run: () => {
      const r = validateRunLog(fx("run-log-invalid.jsonl"));
      return { command_or_check: "validateRunLog", expected: "rechazado", actual: r.ok ? "aceptado (LEAK)" : "rechazado", passed: !r.ok, message: r.ok ? "un run log inválido NO fue rechazado" : "" };
    },
  },
  {
    id: "policy-pass",
    category: "policy",
    metric: "policy_pass_rate",
    requires: [],
    run: () => {
      const t = evalTask({ owns: ["src/feature/x.ts"] });
      const ps = [evalPolicy({ id: "no-env", severity: "CRITICAL", block_condition: "path_match", applies_to: { paths: ["**/.env*"] } })];
      const r = evaluatePolicies(t, active(ps), { candidatePaths: t.owns });
      return { command_or_check: "evaluatePolicies", expected: "sin bloqueo", actual: r.ok ? "ok" : "bloqueado", passed: r.ok, message: r.ok ? "" : "falso bloqueo de policy" };
    },
  },
  {
    id: "policy-draft-ignored",
    category: "policy",
    metric: "policy_pass_rate",
    requires: [],
    run: () => {
      const t = evalTask({ owns: ["src/feature/x.ts"] });
      // policy DRAFT que bloquearía todo si estuviera activa
      const ps = [evalPolicy({ id: "draft", status: "draft", severity: "CRITICAL", block_condition: "path_match", applies_to: { paths: ["**/*"] } })];
      const r = evaluatePolicies(t, active(ps), { candidatePaths: t.owns });
      return { command_or_check: "evaluatePolicies (draft excluida)", expected: "draft ignorada → sin bloqueo", actual: r.ok ? "ok" : "bloqueado", passed: r.ok, message: r.ok ? "" : "una policy draft bloqueó" };
    },
  },
  {
    id: "policy-block-path",
    category: "policy",
    metric: "policy_block_rate",
    requires: [],
    run: () => {
      const t = evalTask({ owns: [".env.production"] });
      const ps = [evalPolicy({ id: "no-env", severity: "CRITICAL", block_condition: "path_match", applies_to: { paths: ["**/.env*"] } })];
      const r = evaluatePolicies(t, active(ps), { candidatePaths: t.owns });
      return { command_or_check: "evaluatePolicies", expected: "bloquea (path)", actual: r.ok ? "no bloqueó (LEAK)" : "bloqueado", passed: !r.ok, message: r.ok ? "no bloqueó un path prohibido" : "" };
    },
  },
  {
    id: "policy-block-missing-evidence",
    category: "policy",
    metric: "policy_block_rate",
    requires: [],
    run: () => {
      const t = evalTask({ evidence_required: ["tests"] });
      const ps = [evalPolicy({ id: "need-secrev", severity: "HIGH", block_condition: "missing_evidence", evidence_required: ["security_review"] })];
      const r = evaluatePolicies(t, active(ps), { candidatePaths: t.owns });
      return { command_or_check: "evaluatePolicies", expected: "bloquea (missing_evidence)", actual: r.ok ? "no bloqueó (LEAK)" : "bloqueado", passed: !r.ok, message: r.ok ? "no detectó evidencia faltante" : "" };
    },
  },
  {
    id: "policy-secret-detected",
    category: "policy",
    metric: "policy_block_rate",
    requires: [],
    run: () => {
      const t = evalTask({ owns: ["src/config.ts"] });
      const ps = [evalPolicy({ id: "no-secrets", severity: "CRITICAL", block_condition: "secret_pattern" })];
      const contents = new Map<string, string>([["src/config.ts", 'const k = "AKIA1234567890ABCDEF";']]);
      const r = evaluatePolicies(t, active(ps), { candidatePaths: t.owns, fileContents: contents });
      return { command_or_check: "evaluatePolicies (secret scan)", expected: "bloquea (secret)", actual: r.ok ? "no detectó (LEAK)" : "bloqueado", passed: !r.ok, message: r.ok ? "no detectó secret-like pattern" : "" };
    },
  },
  {
    id: "approval-pass",
    category: "approval",
    metric: "approval_pass_rate",
    requires: [],
    run: () => {
      const t = evalTask({ risk_level: "critical" });
      const req = requiredApproval(t, []);
      const r = checkApprovals(t, "eval", [evalApproval({ feature_id: "eval", approval_type: "formal" })], req, EVAL_NOW);
      return { command_or_check: "checkApprovals", expected: "approval formal presente → ok", actual: r.ok ? "ok" : "bloqueado", passed: r.ok, message: r.ok ? "" : r.findings.join("; ") };
    },
  },
  {
    id: "approval-missing-blocks",
    category: "approval",
    metric: "approval_enforcement_rate",
    requires: [],
    run: () => {
      const t = evalTask({ risk_level: "critical" });
      const req = requiredApproval(t, []);
      const r = checkApprovals(t, "eval", [], req, EVAL_NOW);
      return { command_or_check: "checkApprovals", expected: "bloquea (sin approval)", actual: r.ok ? "no bloqueó (LEAK)" : "bloqueado", passed: !r.ok, message: r.ok ? "task critical sin approval no fue bloqueado" : "" };
    },
  },
  {
    id: "approval-expired-blocks",
    category: "approval",
    metric: "approval_enforcement_rate",
    requires: [],
    run: () => {
      const t = evalTask({ risk_level: "critical" });
      const req = requiredApproval(t, []);
      const a = evalApproval({ feature_id: "eval", expiration: "2026-02-01T00:00:00Z" });
      const r = checkApprovals(t, "eval", [a], req, EVAL_NOW);
      return { command_or_check: "checkApprovals", expected: "bloquea (expirada)", actual: r.ok ? "no bloqueó (LEAK)" : "bloqueado", passed: !r.ok, message: r.ok ? "approval expirada fue aceptada" : "" };
    },
  },
  {
    id: "approval-rejected-blocks",
    category: "approval",
    metric: "approval_enforcement_rate",
    requires: [],
    run: () => {
      const t = evalTask({ risk_level: "critical" });
      const req = requiredApproval(t, []);
      const a = evalApproval({ feature_id: "eval", decision: "rejected" });
      const r = checkApprovals(t, "eval", [a], req, EVAL_NOW);
      return { command_or_check: "checkApprovals", expected: "bloquea (rejected)", actual: r.ok ? "no bloqueó (LEAK)" : "bloqueado", passed: !r.ok, message: r.ok ? "approval rejected fue aceptada" : "" };
    },
  },
  {
    id: "approval-policy-required-pass",
    category: "approval",
    metric: "approval_pass_rate",
    requires: [],
    run: () => {
      // task 🟢 low risk, pero una policy formal aplica → requiere formal; se provee.
      const t = evalTask({ risk_level: "low", zones: ["🟢"] });
      const ps = [evalPolicy({ id: "p-formal", block_condition: "zone_touch", applies_to: { zones: ["🟢"] }, approval_required: "formal" })];
      const req = requiredApproval(t, active(ps));
      const r = checkApprovals(t, "eval", [evalApproval({ feature_id: "eval", approval_type: "formal" })], req, EVAL_NOW);
      const passed = req.level === "formal" && r.ok;
      return { command_or_check: "requiredApproval+checkApprovals", expected: "policy exige formal → satisfecho", actual: `req=${req.level}, ${r.ok ? "ok" : "bloqueado"}`, passed, message: passed ? "" : "policy formal no derivó requerimiento o no se satisfizo" };
    },
  },
  {
    id: "integration-ready-pass",
    category: "integration",
    metric: "integration_readiness_rate",
    requires: [],
    run: () => {
      const r = buildIntegrationReport({ feature: "demo", tasksDir: INTEG("ready/tasks"), verdictsDir: INTEG("ready/verdicts"), now: EVAL_NOW });
      return { command_or_check: "buildIntegrationReport", expected: "ready", actual: r.ready ? "ready" : "not ready", passed: r.ready, message: r.ready ? "" : r.blockers.join("; ") };
    },
  },
  {
    id: "integration-task-not-completed-blocks",
    category: "integration",
    metric: "integration_readiness_rate",
    requires: [],
    run: () => {
      const r = buildIntegrationReport({ feature: "demo", tasksDir: INTEG("task-not-completed/tasks"), now: EVAL_NOW });
      return { command_or_check: "buildIntegrationReport", expected: "not ready (task no completed)", actual: r.ready ? "ready (LEAK)" : "not ready", passed: !r.ready, message: r.ready ? "no bloqueó task no completed" : "" };
    },
  },
  {
    id: "integration-missing-verdict-blocks",
    category: "integration",
    metric: "integration_readiness_rate",
    requires: [],
    run: () => {
      const r = buildIntegrationReport({ feature: "demo", tasksDir: INTEG("missing-verdict/tasks"), now: EVAL_NOW });
      return { command_or_check: "buildIntegrationReport", expected: "not ready (falta verdict)", actual: r.ready ? "ready (LEAK)" : "not ready", passed: !r.ready, message: r.ready ? "no bloqueó verdict faltante" : "" };
    },
  },
  {
    id: "integration-policy-blocks",
    category: "integration",
    metric: "integration_readiness_rate",
    requires: [],
    run: () => {
      const r = buildIntegrationReport({ feature: "demo", tasksDir: INTEG("policy-blocked/tasks"), policiesDir: INTEG("policy-blocked/policies"), now: EVAL_NOW });
      return { command_or_check: "buildIntegrationReport", expected: "not ready (policy)", actual: r.ready ? "ready (LEAK)" : "not ready", passed: !r.ready, message: r.ready ? "no bloqueó policy" : "" };
    },
  },
  {
    id: "integration-approval-missing-blocks",
    category: "integration",
    metric: "integration_readiness_rate",
    requires: [],
    run: () => {
      const r = buildIntegrationReport({ feature: "demo", tasksDir: INTEG("approval-missing/tasks"), now: EVAL_NOW });
      return { command_or_check: "buildIntegrationReport", expected: "not ready (approval)", actual: r.ready ? "ready (LEAK)" : "not ready", passed: !r.ready, message: r.ready ? "no bloqueó approval faltante" : "" };
    },
  },
];

export const CASE_IDS = CASE_DEFS.map((c) => c.id);

function isWellFormed(r: CaseResult): boolean {
  return (
    typeof r.case_id === "string" && r.case_id.length > 0 &&
    typeof r.category === "string" && r.category.length > 0 &&
    typeof r.command_or_check === "string" &&
    typeof r.expected === "string" &&
    typeof r.actual === "string" &&
    typeof r.passed === "boolean" &&
    typeof r.metric === "string" && r.metric.length > 0 &&
    typeof r.message === "string"
  );
}

/** Corre los evals (o uno solo). Lanza EvalOperationalError si falta un fixture o el case no existe. */
export function runEvals(caseId?: string): EvalReport {
  let defs = CASE_DEFS;
  if (caseId) {
    const found = CASE_DEFS.find((c) => c.id === caseId);
    if (!found) throw new EvalOperationalError(`case desconocido: "${caseId}". Casos: ${CASE_IDS.join(", ")}`);
    defs = [found];
  }

  const results: CaseResult[] = [];
  for (const def of defs) {
    for (const req of def.requires) {
      if (!existsSync(fx(req))) throw new EvalOperationalError(`fixture faltante para ${def.id}: evals/cases/${req}`);
    }
    const out = def.run();
    results.push({ case_id: def.id, category: def.category, metric: def.metric, ...out });
  }

  // Métricas de capacidad (una por grupo de metric).
  const metrics: Record<string, MetricResult> = {};
  const byMetric = new Map<string, CaseResult[]>();
  for (const r of results) {
    if (!byMetric.has(r.metric)) byMetric.set(r.metric, []);
    byMetric.get(r.metric)!.push(r);
  }
  for (const [metric, rs] of byMetric) {
    const passed = rs.filter((r) => r.passed).length;
    metrics[metric] = { passed, total: rs.length, rate: passed / rs.length, critical: true };
  }

  // Métrica transversal: format_compliance_rate sobre todos los resultados.
  const wf = results.filter(isWellFormed).length;
  metrics["format_compliance_rate"] = { passed: wf, total: results.length, rate: results.length ? wf / results.length : 1, critical: true };

  const ok = Object.values(metrics).every((m) => !m.critical || m.rate === 1);
  return { results, metrics, ok };
}

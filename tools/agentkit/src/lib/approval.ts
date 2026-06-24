// Enforcement de approvals HITL (E2). Determina qué aprobación humana se requiere (por risk_level,
// zonas o policies) y verifica que exista un approval record suficiente. NO es control de acceso:
// solo comprueba la presencia de evidencia versionada. Sin firmas, sin RBAC, sin quórum.
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { loadApproval } from "./loaders.js";
import { evaluatePolicies } from "./policy.js";
import type { Approval, Policy, Task } from "../types/index.js";

const APPROVAL_EXTS = new Set([".yaml", ".yml", ".json"]);

export type ApprovalLevel = "none" | "nominal" | "formal";
const LEVEL_RANK: Record<ApprovalLevel, number> = { none: 0, nominal: 1, formal: 2 };

export interface InvalidApproval {
  file: string;
  errors: string[];
}

export function loadApprovalsFromDir(dir: string): { approvals: Approval[]; invalid: InvalidApproval[] } {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`directorio de approvals no encontrado: ${dir}`);
  }
  const files = readdirSync(dir)
    .filter((f) => !f.startsWith(".") && APPROVAL_EXTS.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => path.join(dir, f));
  const approvals: Approval[] = [];
  const invalid: InvalidApproval[] = [];
  for (const file of files) {
    const r = loadApproval(file);
    if (r.ok) approvals.push(r.data);
    else invalid.push({ file, errors: r.errors });
  }
  return { approvals, invalid };
}

export interface Requirement {
  level: ApprovalLevel;
  reasons: string[];
}

/**
 * Determina la aprobación requerida por un task. Combina (toma el máximo):
 *  a) risk_level=critical → formal
 *  b) zonas 🔴/🟠 → formal
 *  c) policies activas que matchean con approval_required nominal|formal
 */
export function requiredApproval(task: Task, activePolicies: Policy[] = []): Requirement {
  const reasons: string[] = [];
  let level: ApprovalLevel = "none";
  const bump = (l: ApprovalLevel, why: string) => {
    if (LEVEL_RANK[l] > LEVEL_RANK[level]) level = l;
    if (l !== "none") reasons.push(why);
  };

  if (task.risk_level === "critical") bump("formal", "risk_level=critical");
  const zones = task.zones as string[];
  if (zones.includes("🔴") || zones.includes("🟠")) bump("formal", `zona ${zones.includes("🔴") ? "🔴" : "🟠"}`);

  if (activePolicies.length > 0) {
    const report = evaluatePolicies(task, activePolicies, { candidatePaths: task.owns });
    for (const f of report.findings) {
      const ar = f.approval_required;
      if (ar === "formal" || ar === "nominal") bump(ar, `policy ${f.policy_id} (approval_required=${ar})`);
    }
  }

  return { level, reasons };
}

/** ¿Esta approval satisface el nivel requerido para este task/feature en el instante `now`? */
export function approvalSatisfies(
  a: Approval,
  required: "nominal" | "formal",
  feature: string,
  taskId: string,
  now: Date,
): { ok: boolean; reason: string } {
  if (a.feature_id !== feature) return { ok: false, reason: `feature distinto (${a.feature_id})` };
  if (a.task_id && a.task_id !== taskId) return { ok: false, reason: `task distinto (${a.task_id})` };
  if (a.decision === "pending") return { ok: false, reason: "decision=pending" };
  if (a.decision === "rejected") return { ok: false, reason: "decision=rejected" };
  // decision === approved
  if (a.expiration && new Date(a.expiration).getTime() < now.getTime()) {
    return { ok: false, reason: `expirada (${a.expiration})` };
  }
  const type: ApprovalLevel = a.approval_type === "formal" ? "formal" : "nominal"; // ausente → nominal
  if (LEVEL_RANK[type] < LEVEL_RANK[required]) {
    return { ok: false, reason: `tipo insuficiente (${type} < ${required})` };
  }
  return { ok: true, reason: "approved" };
}

export interface ApprovalCheckResult {
  ok: boolean;
  required: ApprovalLevel;
  requirement_reasons: string[];
  satisfied_by: string | null;
  findings: string[];
}

/** Verifica que exista una approval suficiente para el task dado. */
export function checkApprovals(
  task: Task,
  feature: string,
  approvals: Approval[],
  requirement: Requirement,
  now: Date,
): ApprovalCheckResult {
  if (requirement.level === "none") {
    return { ok: true, required: "none", requirement_reasons: [], satisfied_by: null, findings: [] };
  }
  const required = requirement.level; // nominal | formal
  const findings: string[] = [];
  for (const a of approvals) {
    const res = approvalSatisfies(a, required, feature, task.id, now);
    if (res.ok) {
      return { ok: true, required, requirement_reasons: requirement.reasons, satisfied_by: a.approval_id, findings: [] };
    }
    findings.push(`${a.approval_id}: ${res.reason}`);
  }
  if (approvals.length === 0) findings.push("no hay approvals para el feature");
  return { ok: false, required, requirement_reasons: requirement.reasons, satisfied_by: null, findings };
}

// Harness de evals DETERMINISTA. Mide si las capacidades críticas del kit siguen funcionando:
// schemas, ownership, DAG, run logs. Reutiliza las funciones ya implementadas (sin LLM, sin git,
// sin llamadas externas, sin shelling). Los casos negativos cuentan como PASS si el sistema bloquea.
import { existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, validateArtifact } from "./validate.js";
import { classifyDiff } from "./ownership.js";
import { analyzePlan, planIsValid } from "./dag.js";
import { validateRunLog } from "./runlog.js";

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

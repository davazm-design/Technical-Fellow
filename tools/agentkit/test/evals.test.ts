import { describe, it, expect } from "vitest";
import { runEvals, EvalOperationalError, CASE_IDS } from "../src/lib/evals.js";

describe("runEvals", () => {
  it("corre todos los casos y pasa (todas las métricas críticas en 100%)", () => {
    const r = runEvals();
    expect(r.results).toHaveLength(CASE_IDS.length);
    expect(r.ok).toBe(true);
    for (const [name, m] of Object.entries(r.metrics)) {
      expect(m.rate, `métrica ${name}`).toBe(1);
    }
  });

  it("incluye las 8 métricas críticas", () => {
    const r = runEvals();
    for (const m of [
      "schema_pass_rate",
      "invalid_schema_block_rate",
      "ownership_violation_detection_rate",
      "dag_validity_rate",
      "missing_dependency_detection_rate",
      "cycle_detection_rate",
      "run_log_validation_rate",
      "format_compliance_rate",
    ]) {
      expect(r.metrics[m], `falta métrica ${m}`).toBeDefined();
    }
  });

  it("--case corre uno solo", () => {
    const r = runEvals("task-valid");
    expect(r.results).toHaveLength(1);
    expect(r.results[0]!.case_id).toBe("task-valid");
    expect(r.ok).toBe(true);
  });

  it("caso negativo cuenta como PASS si el sistema bloquea (task-invalid)", () => {
    const r = runEvals("task-invalid");
    expect(r.results[0]!.passed).toBe(true);
    expect(r.results[0]!.actual).toBe("blocked");
  });

  it("dag-cycle pasa si detecta el ciclo", () => {
    const r = runEvals("dag-cycle");
    expect(r.results[0]!.passed).toBe(true);
    expect(r.results[0]!.actual).toMatch(/ciclo/);
  });

  it("case inexistente lanza EvalOperationalError", () => {
    expect(() => runEvals("no-existe")).toThrow(EvalOperationalError);
  });

  it("cada resultado tiene los campos requeridos", () => {
    const r = runEvals();
    for (const res of r.results) {
      for (const k of ["case_id", "category", "command_or_check", "expected", "actual", "passed", "metric", "message"]) {
        expect(res, `falta ${k}`).toHaveProperty(k);
      }
    }
  });
});

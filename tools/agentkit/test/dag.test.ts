import path from "node:path";
import { describe, it, expect } from "vitest";
import { REPO_ROOT } from "../src/lib/validate.js";
import { analyzePlan, planIsValid, loadTasksFromDir } from "../src/lib/dag.js";

const plan = (name: string) => path.join(REPO_ROOT, "fixtures", "plans", name);

describe("loadTasksFromDir", () => {
  it("carga múltiples tasks de un directorio", () => {
    const { tasks, invalid } = loadTasksFromDir(plan("valid-3"));
    expect(tasks).toHaveLength(3);
    expect(invalid).toHaveLength(0);
  });

  it("lanza si el directorio no existe (operacional)", () => {
    expect(() => loadTasksFromDir(plan("no-existe"))).toThrow(/no encontrado/);
  });
});

describe("analyzePlan — plan válido", () => {
  const a = analyzePlan(plan("valid-3"));
  it("es válido y ordena topológicamente (db-1 antes de backend-1)", () => {
    expect(planIsValid(a)).toBe(true);
    expect(a.topoOrder).toEqual(["db-1", "backend-1", "frontend-1"]);
  });
  it("ready = solo tasks sin deps pendientes", () => {
    expect(a.ready).toEqual(["db-1", "frontend-1"]);
  });
  it("blocked incluye backend-1 esperando db-1", () => {
    expect(a.blocked.map((b) => b.id)).toContain("backend-1");
  });
});

describe("analyzePlan — detección de problemas", () => {
  it("detecta ciclo con ruta legible", () => {
    const a = analyzePlan(plan("cycle"));
    expect(a.cycle).not.toBeNull();
    expect(planIsValid(a)).toBe(false);
    expect(a.cycle!.length).toBeGreaterThanOrEqual(3); // a → b → a
  });

  it("detecta dependencia faltante", () => {
    const a = analyzePlan(plan("missing-dep"));
    expect(a.missingDeps).toEqual([{ task: "backend-1", missing: "db-9" }]);
    expect(planIsValid(a)).toBe(false);
  });

  it("una task inválida bloquea el plan", () => {
    const a = analyzePlan(plan("invalid-task"));
    expect(a.invalid.length).toBeGreaterThan(0);
    expect(planIsValid(a)).toBe(false);
  });

  it("detecta ids duplicados", () => {
    const a = analyzePlan(plan("dup-id"));
    expect(a.duplicateIds).toEqual(["backend-1"]);
    expect(planIsValid(a)).toBe(false);
  });

  it("valid-3 no tiene ids duplicados", () => {
    expect(analyzePlan(plan("valid-3")).duplicateIds).toEqual([]);
  });
});

describe("analyzePlan — ready/blocked por status", () => {
  it("blocked: backend-1 espera db-1 (planned)", () => {
    const a = analyzePlan(plan("blocked"));
    expect(a.ready).toEqual(["db-1"]);
    expect(a.blocked.map((b) => b.id)).toEqual(["backend-1"]);
  });

  it("completed desbloquea: db-1 completed → backend-1 ready", () => {
    const a = analyzePlan(plan("completed-unblocks"));
    expect(a.ready).toEqual(["backend-1"]);
    expect(a.byStatus["completed"]).toBe(1);
  });

  it("completed/rejected no aparecen como ready ni blocked", () => {
    const a = analyzePlan(plan("completed-unblocks"));
    expect(a.ready).not.toContain("db-1"); // db-1 está completed
    expect(a.blocked.map((b) => b.id)).not.toContain("db-1");
  });
});

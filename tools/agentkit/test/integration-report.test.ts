import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { REPO_ROOT, validateArtifact, validateData } from "../src/lib/validate.js";
import { buildIntegrationReport } from "../src/lib/integration.js";

const sc = (name: string) => path.join(REPO_ROOT, "fixtures", "integration", name);
const NOW = new Date("2026-06-24T12:00:00Z");

function report(opts: Parameters<typeof buildIntegrationReport>[0]) {
  return buildIntegrationReport(opts);
}

describe("validate-integration-report (schema)", () => {
  it("valida un report válido", () => {
    expect(validateArtifact("integration-report", path.join(REPO_ROOT, "fixtures/integration-report/valid/ready.json")).ok).toBe(true);
  });
  it("rechaza reports inválidos", () => {
    for (const f of ["bad-check-status.json", "missing-ready.json"]) {
      expect(validateArtifact("integration-report", path.join(REPO_ROOT, "fixtures/integration-report/invalid", f)).ok, f).toBe(false);
    }
  });
});

describe("buildIntegrationReport — ready", () => {
  const r = report({ feature: "demo", tasksDir: sc("ready/tasks"), verdictsDir: sc("ready/verdicts"), now: NOW });
  it("ready=true cuando todo pasa", () => {
    expect(r.ready).toBe(true);
    expect(r.blockers).toEqual([]);
  });
  it("el report producido valida contra su propio schema", () => {
    expect(validateData("integration-report", r).ok).toBe(true);
  });
  it("merge_order viene del DAG", () => {
    expect(r.merge_order).toEqual(["backend-1"]);
  });
  it("checks no usados quedan skipped", () => {
    const byName = Object.fromEntries(r.checks.map((c) => [c.name, c.status]));
    expect(byName["ownership"]).toBe("skipped");
    expect(byName["policies"]).toBe("skipped");
    expect(byName["approvals"]).toBe("skipped");
    expect(byName["closure-verdicts"]).toBe("pass");
  });
});

describe("buildIntegrationReport — not ready", () => {
  it("task no completed → ready=false", () => {
    const r = report({ feature: "demo", tasksDir: sc("task-not-completed/tasks"), now: NOW });
    expect(r.ready).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/no está completed/);
  });
  it("falta verdict required → ready=false", () => {
    const r = report({ feature: "demo", tasksDir: sc("missing-verdict/tasks"), now: NOW });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === "closure-verdicts")!.status).toBe("fail");
  });
  it("cierre rechazado → ready=false", () => {
    const r = report({ feature: "demo", tasksDir: sc("closure-rejected/tasks"), verdictsDir: sc("closure-rejected/verdicts"), now: NOW });
    expect(r.ready).toBe(false);
  });
  it("policy bloquea → ready=false", () => {
    const r = report({ feature: "demo", tasksDir: sc("policy-blocked/tasks"), policiesDir: sc("policy-blocked/policies"), now: NOW });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === "policies")!.status).toBe("fail");
  });
  it("approval requerida y faltante → ready=false", () => {
    const r = report({ feature: "demo", tasksDir: sc("approval-missing/tasks"), now: NOW });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === "approvals")!.status).toBe("fail");
  });
  it("plan inválido (ciclo) → ready=false", () => {
    const r = report({ feature: "demo", tasksDir: sc("plan-invalid/tasks"), now: NOW });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === "validate-plan")!.status).toBe("fail");
  });
});

describe("integration-report es de solo lectura", () => {
  it("no modifica los fixtures (conteo de archivos estable)", () => {
    const dir = sc("ready");
    const before = readdirSync(dir, { recursive: true }).length;
    report({ feature: "demo", tasksDir: sc("ready/tasks"), verdictsDir: sc("ready/verdicts"), now: NOW });
    const after = readdirSync(dir, { recursive: true }).length;
    expect(after).toBe(before);
  });
});

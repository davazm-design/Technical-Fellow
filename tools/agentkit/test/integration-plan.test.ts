import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { REPO_ROOT } from "../src/lib/validate.js";
import { buildIntegrationPlan } from "../src/lib/integration.js";

const sc = (name: string) => path.join(REPO_ROOT, "fixtures", "integration", name);
const NOW = new Date("2026-06-24T12:00:00Z");

describe("buildIntegrationPlan — ready", () => {
  const p = buildIntegrationPlan({ feature: "demo", tasksDir: sc("ready/tasks"), verdictsDir: sc("ready/verdicts"), now: NOW });

  it("genera plan cuando ready=true", () => {
    expect(p.ready).toBe(true);
    expect(p.merge_order).toEqual(["backend-1"]);
  });
  it("incluye comandos como texto (strings), con header y placeholder de branch", () => {
    expect(Array.isArray(p.suggested_commands)).toBe(true);
    expect(p.suggested_commands.every((c) => typeof c === "string")).toBe(true);
    expect(p.suggested_commands[0]).toMatch(/Suggested only — not executed by agentkit/);
    expect(p.suggested_commands.join("\n")).toContain("git merge --no-ff <branch-for-backend-1>");
  });
  it("incluye warnings (incl. branch mapping no modelado)", () => {
    expect(p.warnings.length).toBeGreaterThanOrEqual(5);
    expect(p.warnings.join(" ")).toMatch(/Branch mapping is not yet modeled/);
  });
  it("incluye human checklist", () => {
    expect(p.human_checklist.length).toBeGreaterThanOrEqual(8);
    expect(p.human_checklist.join(" ")).toMatch(/Confirmar CI verde/);
  });
  it("prerequisites refleja los checks del report", () => {
    const names = p.prerequisites.map((x) => x.name);
    expect(names).toContain("validate-plan");
    expect(names).toContain("approvals");
  });
  it("--json shape: produce objeto serializable con las claves esperadas", () => {
    const parsed = JSON.parse(JSON.stringify(p));
    for (const k of ["feature", "ready", "generated_at", "merge_order", "suggested_commands", "prerequisites", "warnings", "blockers", "human_checklist"]) {
      expect(parsed).toHaveProperty(k);
    }
  });
});

describe("buildIntegrationPlan — not ready", () => {
  it("bloquea (ready=false) y expone blockers cuando falta approval", () => {
    const p = buildIntegrationPlan({ feature: "demo", tasksDir: sc("approval-missing/tasks"), now: NOW });
    expect(p.ready).toBe(false);
    expect(p.blockers.length).toBeGreaterThan(0);
  });
  it("bloquea con plan inválido", () => {
    const p = buildIntegrationPlan({ feature: "demo", tasksDir: sc("plan-invalid/tasks"), now: NOW });
    expect(p.ready).toBe(false);
  });
});

describe("integration-plan es de solo lectura", () => {
  it("no modifica los fixtures (conteo de archivos estable)", () => {
    const dir = sc("ready");
    const before = readdirSync(dir, { recursive: true }).length;
    buildIntegrationPlan({ feature: "demo", tasksDir: sc("ready/tasks"), verdictsDir: sc("ready/verdicts"), now: NOW });
    expect(readdirSync(dir, { recursive: true }).length).toBe(before);
  });
  it("los comandos sugeridos NO contienen rutas reales ejecutables (solo placeholders de branch)", () => {
    const p = buildIntegrationPlan({ feature: "demo", tasksDir: sc("ready/tasks"), verdictsDir: sc("ready/verdicts"), now: NOW });
    // toda línea de merge usa placeholder <branch-for-...>, nunca un branch real
    for (const c of p.suggested_commands.filter((x) => x.includes("git merge"))) {
      expect(c).toMatch(/<branch-for-[^>]+>/);
    }
  });
});

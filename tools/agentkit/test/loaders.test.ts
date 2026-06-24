import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { REPO_ROOT } from "../src/lib/validate.js";
import { loadTask, loadOwnership, loadContract, loadVerdict, loadRunEvent } from "../src/lib/loaders.js";

const fx = (rel: string) => path.join(REPO_ROOT, "fixtures", rel);

describe("loaders — input válido devuelve dato tipado", () => {
  it("loadTask desde Markdown con frontmatter", () => {
    const r = loadTask(fx("task/valid/backend-1.md"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.id).toBe("backend-1");
      expect(r.data.lane).toBe("backend");
      expect(Array.isArray(r.data.owns)).toBe(true);
      expect(r.data.owns.length).toBeGreaterThan(0);
    }
  });

  it("loadTask desde YAML", () => {
    const r = loadTask(fx("task/valid/db-1.yaml"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.lane).toBe("db");
  });

  it("loadOwnership / loadContract / loadVerdict desde YAML", () => {
    expect(loadOwnership(fx("ownership/valid/invoices.yaml")).ok).toBe(true);
    expect(loadContract(fx("contract/valid/invoices.yaml")).ok).toBe(true);
    expect(loadVerdict(fx("verdict/valid/plan-aprobado.yaml")).ok).toBe(true);
  });

  it("loadRunEvent desde JSON", () => {
    const r = loadRunEvent(fx("run-event/valid/run-started.json"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.event_type).toBe("run_started");
  });
});

describe("loaders — input inválido devuelve errores accionables", () => {
  it("task con owns faltante → !ok + errores", () => {
    const r = loadTask(fx("task/invalid/missing-owns.yaml"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.data).toBeNull();
      expect(r.errors.length).toBeGreaterThan(0);
    }
  });

  it("markdown sin frontmatter → error de parseo claro", () => {
    const r = loadTask(fx("task/invalid/no-frontmatter.md"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/frontmatter/i);
  });

  it("verdict con enum equivocado para la fase → !ok", () => {
    expect(loadVerdict(fx("verdict/invalid/plan-wrong-enum.yaml")).ok).toBe(false);
  });
});

describe("tipos generados", () => {
  it("existen los 5 archivos generados desde los schemas", () => {
    for (const f of ["task", "ownership", "contract", "verdict", "run-event"]) {
      expect(existsSync(path.join(REPO_ROOT, "tools/agentkit/src/types/generated", `${f}.ts`))).toBe(true);
    }
  });
});

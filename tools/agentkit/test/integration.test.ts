import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diffNames, refExists, isGitAvailable } from "../src/lib/git.js";
import { runCheckDiffOwnership } from "../src/commands/check-diff-ownership.js";
import { runDoctor } from "../src/commands/doctor.js";

function g(dir: string, args: string[]): void {
  execFileSync("git", args, { cwd: dir, stdio: "ignore" });
}

function writeFile(dir: string, rel: string, content: string): void {
  const full = path.join(dir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Construye un repo git efímero: main con un commit base + rama feature con 2 archivos. */
function makeRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentkit-it-"));
  g(dir, ["init"]);
  g(dir, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  g(dir, ["config", "user.email", "t@example.com"]);
  g(dir, ["config", "user.name", "test"]);
  writeFile(dir, "README.md", "base\n");
  g(dir, ["add", "."]);
  g(dir, ["commit", "-m", "base"]);
  g(dir, ["checkout", "-b", "feature"]);
  writeFile(dir, "src/invoices/pricing.ts", "export const x = 1;\n");
  writeFile(dir, "src/billing/out.ts", "export const y = 2;\n");
  g(dir, ["add", "."]);
  g(dir, ["commit", "-m", "work"]);
  return dir;
}

describe.skipIf(!isGitAvailable())("git lib — repo efímero", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeRepo();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("diffNames(base) lista los archivos de la rama vs main", () => {
    const files = diffNames({ base: "main" }, dir).sort();
    expect(files).toEqual(["src/billing/out.ts", "src/invoices/pricing.ts"]);
  });

  it("diffNames(staged) lista el index", () => {
    writeFile(dir, "src/invoices/extra.ts", "export const z = 3;\n");
    g(dir, ["add", "src/invoices/extra.ts"]);
    const files = diffNames({ staged: true }, dir);
    expect(files).toEqual(["src/invoices/extra.ts"]);
  });

  it("refExists(false) para base inexistente", () => {
    expect(refExists("rama-que-no-existe", dir)).toBe(false);
    expect(refExists("main", dir)).toBe(true);
  });

  it("diffNames lanza GitError si la base no resuelve", () => {
    expect(() => diffNames({ base: "no-such-branch" }, dir)).toThrow();
  });
});

describe.skipIf(!isGitAvailable())("check-diff-ownership — end to end", () => {
  let dir: string;
  let cwd: string;
  let out: string[];
  let err: string[];

  beforeEach(() => {
    dir = makeRepo();
    cwd = process.cwd();
    process.chdir(dir);
    out = [];
    err = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => (out.push(String(s)), true));
    vi.spyOn(process.stderr, "write").mockImplementation((s) => (err.push(String(s)), true));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  });

  function writeTask(owns: string[], name = "task.md"): string {
    const fm = [
      "---",
      "id: backend-1",
      "feature: invoices",
      "title: test task",
      "lane: backend",
      "agent: backend",
      "status: in_progress",
      "profile: lite",
      'zones: ["🟢"]',
      "risk_level: low",
      "depends_on: []",
      "owns:",
      ...owns.map((o) => `  - ${o}`),
      "contracts: []",
      "gates:",
      "  audit_f1: required",
      "  security_f1: required",
      "  audit_f2: required",
      "  security_f2: required",
      "evidence_required: [tests]",
      'acceptance_criteria: ["algo verificable"]',
      "---",
      "# task",
      "",
    ].join("\n");
    const p = path.join(dir, name);
    writeFileSync(p, fm);
    return p;
  }

  it("PASS cuando todo el diff está en scope (exit 0)", () => {
    const task = writeTask(["src/**"]);
    const code = runCheckDiffOwnership(["--task", task, "--base", "main"]);
    expect(code).toBe(0);
    expect(out.join("")).toContain("ownership válido");
  });

  it("FAIL cuando un archivo está fuera de scope (exit 1)", () => {
    const task = writeTask(["src/invoices/**"]);
    const code = runCheckDiffOwnership(["--task", task, "--base", "main"]);
    expect(code).toBe(1);
    const o = out.join("");
    expect(o).toContain("ownership violation");
    expect(o).toContain("src/billing/out.ts");
  });

  it("exit 2 si la base branch no existe", () => {
    const task = writeTask(["src/**"]);
    const code = runCheckDiffOwnership(["--task", task, "--base", "no-such-branch"]);
    expect(code).toBe(2);
    expect(err.join("")).toContain("git");
  });

  it("exit 1 si el task es schema-inválido (faltan campos requeridos)", () => {
    const task = path.join(dir, "bad.md");
    writeFileSync(task, "---\nid: backend-1\nlane: backend\nfeature: f\n---\n");
    const code = runCheckDiffOwnership(["--task", task, "--base", "main"]);
    expect(code).toBe(1);
  });

  it("--repo permite correr contra otro repo sin chdir", () => {
    // Volvemos al cwd original; apuntamos al repo efímero con --repo.
    process.chdir(cwd);
    const task = writeTask(["src/**"]);
    const code = runCheckDiffOwnership(["--task", task, "--base", "main", "--repo", dir]);
    expect(code).toBe(0);
    expect(out.join("")).toContain("ownership válido");
  });

  it("ignora artefactos de control (tasks/**) por default → PASS", () => {
    // Un cambio committeado bajo tasks/ no debe violar ownership por default.
    writeFile(dir, "tasks/backend-1.md", "---\nx: 1\n---\n");
    g(dir, ["add", "tasks"]);
    g(dir, ["commit", "-m", "task artifact"]);
    const task = writeTask(["src/**"]);
    const code = runCheckDiffOwnership(["--task", task, "--base", "main"]);
    expect(code).toBe(0);
    expect(out.join("")).toContain("artefacto(s) de control ignorado");
  });

  it("ignora policies/** y approvals/** por default → PASS", () => {
    writeFile(dir, "policies/no-secrets.yaml", "id: x\n");
    writeFile(dir, "approvals/f/a.yaml", "approval_id: x\n");
    g(dir, ["add", "policies", "approvals"]);
    g(dir, ["commit", "-m", "control artifacts"]);
    const task = writeTask(["src/**"]);
    const code = runCheckDiffOwnership(["--task", task, "--base", "main"]);
    expect(code).toBe(0);
    expect(out.join("")).toContain("artefacto(s) de control ignorado");
  });

  it("--strict-artifacts hace que tasks/** viole si no está en owns → FAIL", () => {
    writeFile(dir, "tasks/backend-1.md", "---\nx: 1\n---\n");
    g(dir, ["add", "tasks"]);
    g(dir, ["commit", "-m", "task artifact"]);
    const task = writeTask(["src/**"]);
    const code = runCheckDiffOwnership(["--task", task, "--base", "main", "--strict-artifacts"]);
    expect(code).toBe(1);
    expect(out.join("")).toContain("tasks/backend-1.md");
  });
});

describe("doctor", () => {
  it("devuelve 0 (PASS) en el repo del kit sano", () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => (writes.push(String(s)), true));
    const code = runDoctor();
    vi.restoreAllMocks();
    expect(code).toBe(0);
    expect(writes.join("")).toContain("PASS");
  });
});

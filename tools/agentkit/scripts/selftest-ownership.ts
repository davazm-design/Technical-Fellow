// Self-test de check-diff-ownership a nivel CLI (proceso real, exit codes reales). Construye un repo
// git efímero con una rama feature que toca src/invoices/** y src/billing/**, y verifica que el
// comando devuelva los exit codes esperados. Para CI: prueba el binario end-to-end, no in-process.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTKIT = path.resolve(__dirname, "..");
const TSX = path.join(AGENTKIT, "node_modules", ".bin", "tsx");
const CLI = path.join(AGENTKIT, "src", "cli.ts");

function git(dir: string, args: string[]): void {
  execFileSync("git", args, { cwd: dir, stdio: "ignore" });
}
function write(dir: string, rel: string, content: string): void {
  const full = path.join(dir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Corre la CLI en `cwd` y devuelve el exit code (0 si execFileSync no lanza). */
function runCli(cwd: string, args: string[]): number {
  try {
    execFileSync(TSX, [CLI, ...args], { cwd, stdio: "ignore" });
    return 0;
  } catch (e) {
    const status = (e as { status?: number }).status;
    return typeof status === "number" ? status : 1;
  }
}

function makeRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentkit-selftest-"));
  git(dir, ["init"]);
  git(dir, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  git(dir, ["config", "user.email", "t@example.com"]);
  git(dir, ["config", "user.name", "test"]);
  write(dir, "README.md", "base\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "base"]);
  git(dir, ["checkout", "-b", "feature"]);
  write(dir, "src/invoices/pricing.ts", "export const x = 1;\n");
  write(dir, "src/billing/out.ts", "export const y = 2;\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "work"]);
  return dir;
}

function task(dir: string, name: string, owns: string[]): string {
  const fm = [
    "---",
    "id: backend-1",
    "lane: backend",
    "feature: invoices",
    "profile: lite",
    'zones: ["🟢"]',
    "depends_on: []",
    "owns:",
    ...owns.map((o) => `  - ${o}`),
    "objetivo: selftest",
    "---",
    "",
  ].join("\n");
  const p = path.join(dir, name);
  writeFileSync(p, fm);
  return p;
}

interface Case {
  name: string;
  args: (taskPass: string, taskFail: string) => string[];
  expect: number;
}

const dir = makeRepo();
const taskPass = task(dir, "pass.md", ["src/**"]);
const taskFail = task(dir, "fail.md", ["src/invoices/**"]);

const cases: Case[] = [
  { name: "PASS (owns cubre todo)", args: () => ["check-diff-ownership", "--task", taskPass, "--base", "main"], expect: 0 },
  { name: "FAIL (src/billing fuera de scope)", args: () => ["check-diff-ownership", "--task", taskFail, "--base", "main"], expect: 1 },
  { name: "operacional (base inexistente)", args: () => ["check-diff-ownership", "--task", taskPass, "--base", "ghost"], expect: 2 },
];

let failures = 0;
try {
  for (const c of cases) {
    const code = runCli(dir, c.args(taskPass, taskFail));
    const ok = code === c.expect;
    process.stdout.write(`  ${ok ? "✓" : "✗"} ${c.name}: exit ${code} (esperado ${c.expect})\n`);
    if (!ok) failures++;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures === 0) {
  process.stdout.write("✓ selftest:ownership — exit codes correctos\n");
  process.exit(0);
}
process.stderr.write(`FAIL — ${failures} caso(s) con exit code inesperado\n`);
process.exit(1);

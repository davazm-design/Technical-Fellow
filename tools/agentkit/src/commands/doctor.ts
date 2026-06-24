import { existsSync } from "node:fs";
import path from "node:path";
import { ARTIFACT_TYPES, REPO_ROOT, SCHEMA_DIR } from "../lib/validate.js";
import { isGitAvailable, isGitRepo } from "../lib/git.js";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const AGENTKIT_DIR = path.join(REPO_ROOT, "tools", "agentkit");

function fileCheck(name: string, p: string, detailOk: string): Check {
  const ok = existsSync(p);
  return { name, ok, detail: ok ? detailOk : `falta: ${path.relative(REPO_ROOT, p)}` };
}

function runChecks(): Check[] {
  const checks: Check[] = [
    fileCheck("schemas/", SCHEMA_DIR, "presente"),
    fileCheck("fixtures/", path.join(REPO_ROOT, "fixtures"), "presente"),
    fileCheck("tools/agentkit/", AGENTKIT_DIR, "presente"),
    fileCheck("tooling package.json", path.join(AGENTKIT_DIR, "package.json"), "presente"),
    fileCheck("templates/task.template.md", path.join(REPO_ROOT, "templates", "task.template.md"), "presente"),
  ];

  // Schemas core
  for (const [type, file] of Object.entries(ARTIFACT_TYPES)) {
    checks.push(fileCheck(`schema: ${type}`, path.join(SCHEMA_DIR, file), file));
  }

  // Instalación de dependencias
  checks.push(
    fileCheck("dependencias instaladas (node_modules)", path.join(AGENTKIT_DIR, "node_modules"), "instaladas"),
  );

  // Git
  const gitOk = isGitAvailable();
  checks.push({ name: "git disponible", ok: gitOk, detail: gitOk ? "en PATH" : "git no encontrado en PATH" });
  const repoOk = gitOk && isGitRepo(REPO_ROOT);
  checks.push({ name: "repo git", ok: repoOk, detail: repoOk ? "dentro de un work tree" : "no es un repo git" });

  return checks;
}

/** Ejecuta `agentkit doctor`. Exit 0 si todo sano, 1 si algún check falla. */
export function runDoctor(): number {
  const checks = runChecks();
  let failed = 0;

  process.stdout.write("agentkit doctor — diagnóstico del kit\n\n");
  for (const c of checks) {
    const mark = c.ok ? "✓" : "✗";
    process.stdout.write(`  ${mark} ${c.name.padEnd(38)} ${c.detail}\n`);
    if (!c.ok) failed++;
  }

  process.stdout.write("\n");
  if (failed === 0) {
    process.stdout.write(`PASS — ${checks.length} checks OK\n`);
    return 0;
  }
  process.stdout.write(`FAIL — ${failed}/${checks.length} checks fallaron\n`);
  return 1;
}

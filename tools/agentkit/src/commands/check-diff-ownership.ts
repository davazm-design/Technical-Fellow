import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadTask } from "../lib/loaders.js";
import { classifyDiff, makeMatcher } from "../lib/ownership.js";
import { diffNames, GitError, isGitAvailable, isGitRepo } from "../lib/git.js";

const USAGE =
  "uso: agentkit check-diff-ownership --task <file> [--base <branch> | --staged] [--repo <path>] [--strict-artifacts]\n" +
  "  --base <branch>      compara <branch>...HEAD (default: main)\n" +
  "  --staged             compara el index (git diff --cached); ignora --base\n" +
  "  --repo <path>        repo objetivo donde correr el diff (default: cwd)\n" +
  "  --strict-artifacts   NO ignores tasks/contracts/verdicts/.agent-runs (por default se ignoran)\n";

/**
 * Artefactos de control que NO son código de implementación. Por default se excluyen del diff: el
 * propio task/contract/verdict no debe producir una violación de ownership. Con --strict-artifacts
 * se incluyen (y entonces deben estar en `owns` para no violar).
 */
const CONTROL_ARTIFACTS = ["tasks/**", "contracts/**", "verdicts/**", ".agent-runs/**"];

/** Ejecuta check-diff-ownership. Exit: 0 ok, 1 violación/schema, 2 operacional. */
export function runCheckDiffOwnership(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        task: { type: "string" },
        base: { type: "string", default: "main" },
        staged: { type: "boolean", default: false },
        repo: { type: "string" },
        "strict-artifacts": { type: "boolean", default: false },
      },
      allowPositionals: false,
    });
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n\n${USAGE}`);
    return 2;
  }

  const { task, base, staged, repo } = parsed.values;
  const strictArtifacts = parsed.values["strict-artifacts"];

  if (!task) {
    process.stderr.write(USAGE);
    return 2;
  }
  if (!existsSync(task)) {
    process.stderr.write(`archivo de task no encontrado: ${task}\n`);
    return 2;
  }
  if (repo !== undefined && !existsSync(repo)) {
    process.stderr.write(`repo objetivo no encontrado: ${repo}\n`);
    return 2;
  }

  // Gate de schema vía loader tipado: cubre "task sin owns", "owns vacío", "patrón vacío"
  // (required / minItems / minLength). En éxito, `owns` viene tipado como string[] no vacío.
  const loaded = loadTask(task);
  if (!loaded.ok) {
    process.stderr.write(`✗ task inválido (no se puede chequear ownership): ${task}\n`);
    for (const err of loaded.errors) process.stderr.write(`    - ${err}\n`);
    return 1;
  }
  const owns: string[] = loaded.data.owns;

  // Pre-requisitos operacionales de git (en el repo objetivo).
  if (!isGitAvailable()) {
    process.stderr.write("git no está disponible en el PATH (error operacional)\n");
    return 2;
  }
  if (!isGitRepo(repo)) {
    process.stderr.write(`no se está dentro de un repo git${repo ? `: ${repo}` : ""} (error operacional)\n`);
    return 2;
  }

  let files: string[];
  try {
    files = diffNames({ staged, base }, repo);
  } catch (e) {
    if (e instanceof GitError) {
      process.stderr.write(`error operacional de git: ${e.message}\n`);
      return 2;
    }
    throw e;
  }

  // Ignora artefactos de control salvo --strict-artifacts.
  const isControl = makeMatcher(CONTROL_ARTIFACTS);
  const ignored = strictArtifacts ? [] : files.filter((f) => isControl(f));
  const considered = strictArtifacts ? files : files.filter((f) => !isControl(f));

  const mode = staged ? "staged (index)" : `${base}...HEAD`;
  const { inScope, outOfScope } = classifyDiff(considered, owns);

  const ignoredNote =
    ignored.length > 0
      ? `ℹ ${ignored.length} artefacto(s) de control ignorado(s) (usa --strict-artifacts para incluirlos)\n`
      : "";

  if (considered.length === 0) {
    process.stdout.write(ignoredNote);
    process.stdout.write(`✓ ownership válido\n✓ 0 archivos de implementación modificados (${mode}); nada que verificar\n`);
    return 0;
  }

  if (outOfScope.length === 0) {
    process.stdout.write(ignoredNote);
    process.stdout.write("✓ ownership válido\n");
    process.stdout.write(`✓ ${inScope.length} archivo(s) modificado(s) están dentro del scope declarado (${mode})\n`);
    return 0;
  }

  // Violación.
  process.stdout.write(ignoredNote);
  process.stdout.write("✗ ownership violation\n\n");
  process.stdout.write(`Archivo(s) modificado(s) fuera de scope (${mode}):\n`);
  for (const f of outOfScope) process.stdout.write(`- ${f}\n`);
  process.stdout.write("\nOwnership declarado:\n");
  for (const p of owns) process.stdout.write(`- ${p}\n`);
  process.stdout.write(
    "\nSugerencia:\nAgrega el path al `owns` del task, o separa el cambio en otra task (CANON §9: ownership disjunto).\n",
  );
  return 1;
}

import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadArtifact, validateArtifact } from "../lib/validate.js";
import { classifyDiff } from "../lib/ownership.js";
import { diffNames, GitError, isGitAvailable, isGitRepo } from "../lib/git.js";

const USAGE =
  "uso: agentkit check-diff-ownership --task <file> [--base <branch> | --staged]\n" +
  "  --base <branch>   compara <branch>...HEAD (default: main)\n" +
  "  --staged          compara el index (git diff --cached); ignora --base\n";

interface Owned {
  owns?: unknown;
}

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
      },
      allowPositionals: false,
    });
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n\n${USAGE}`);
    return 2;
  }

  const { task, base, staged } = parsed.values;

  if (!task) {
    process.stderr.write(USAGE);
    return 2;
  }
  if (!existsSync(task)) {
    process.stderr.write(`archivo de task no encontrado: ${task}\n`);
    return 2;
  }

  // Gate de schema: cubre "task sin owns", "owns vacío", "patrón vacío" (minLength/minItems).
  const validation = validateArtifact("task", task);
  if (!validation.ok) {
    process.stderr.write(`✗ task inválido (no se puede chequear ownership): ${task}\n`);
    for (const err of validation.errors) process.stderr.write(`    - ${err}\n`);
    return 1;
  }

  const data = loadArtifact(task) as Owned;
  const owns = Array.isArray(data.owns) ? (data.owns as string[]) : [];
  if (owns.length === 0) {
    process.stderr.write("✗ el task no declara `owns` (ownership obligatorio, CANON §9)\n");
    return 1;
  }

  // Pre-requisitos operacionales de git.
  if (!isGitAvailable()) {
    process.stderr.write("git no está disponible en el PATH (error operacional)\n");
    return 2;
  }
  if (!isGitRepo()) {
    process.stderr.write("no se está dentro de un repo git (error operacional)\n");
    return 2;
  }

  let files: string[];
  try {
    files = diffNames({ staged, base });
  } catch (e) {
    if (e instanceof GitError) {
      process.stderr.write(`error operacional de git: ${e.message}\n`);
      return 2;
    }
    throw e;
  }

  const mode = staged ? "staged (index)" : `${base}...HEAD`;
  const { inScope, outOfScope } = classifyDiff(files, owns);

  if (files.length === 0) {
    process.stdout.write(`✓ ownership válido\n✓ 0 archivos modificados (${mode}); nada que verificar\n`);
    return 0;
  }

  if (outOfScope.length === 0) {
    process.stdout.write("✓ ownership válido\n");
    process.stdout.write(`✓ ${inScope.length} archivo(s) modificado(s) están dentro del scope declarado (${mode})\n`);
    return 0;
  }

  // Violación.
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

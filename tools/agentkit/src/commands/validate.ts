import { existsSync } from "node:fs";
import { ARTIFACT_TYPES, isArtifactType, validateArtifact, type ArtifactType } from "../lib/validate.js";

const TYPES = Object.keys(ARTIFACT_TYPES).join(" | ");

/** Ejecuta `agentkit validate <type> <file>`. Devuelve el exit code. */
export function runValidate(argv: string[]): number {
  const [type, file] = argv;

  if (!type || !file) {
    process.stderr.write(`uso: agentkit validate <${TYPES}> <archivo>\n`);
    return 2;
  }
  if (!isArtifactType(type)) {
    process.stderr.write(`tipo desconocido "${type}". Tipos válidos: ${TYPES}\n`);
    return 2;
  }
  if (!existsSync(file)) {
    process.stderr.write(`archivo no encontrado: ${file}\n`);
    return 2;
  }

  const result = validateArtifact(type as ArtifactType, file);
  if (result.ok) {
    process.stdout.write(`✓ ${type} válido: ${file}\n`);
    return 0;
  }

  process.stderr.write(`✗ ${type} inválido: ${file}\n`);
  for (const err of result.errors) {
    process.stderr.write(`    - ${err}\n`);
  }
  return 1;
}

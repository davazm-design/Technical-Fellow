// Gate de fixtures a nivel CLI (para CI y uso local): cada fixture válido DEBE validar y cada
// inválido DEBE fallar. Falla con exit 1 si hay cualquier discrepancia. Complementa la suite vitest.
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { ARTIFACT_TYPES, REPO_ROOT, validateArtifact, type ArtifactType } from "../src/lib/validate.js";

const FIXTURES = path.join(REPO_ROOT, "fixtures");
const types = Object.keys(ARTIFACT_TYPES) as ArtifactType[];

function filesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .map((f) => path.join(dir, f));
}

let failures = 0;
let checked = 0;

for (const type of types) {
  for (const file of filesIn(path.join(FIXTURES, type, "valid"))) {
    checked++;
    const r = validateArtifact(type, file);
    if (!r.ok) {
      failures++;
      process.stderr.write(`✗ fixture VÁLIDO no validó: ${path.relative(REPO_ROOT, file)}\n`);
      for (const e of r.errors) process.stderr.write(`    - ${e}\n`);
    }
  }
  for (const file of filesIn(path.join(FIXTURES, type, "invalid"))) {
    checked++;
    const r = validateArtifact(type, file);
    if (r.ok) {
      failures++;
      process.stderr.write(`✗ fixture INVÁLIDO pasó (debió fallar): ${path.relative(REPO_ROOT, file)}\n`);
    }
  }
}

if (failures === 0) {
  process.stdout.write(`✓ validate:fixtures — ${checked} fixtures OK (válidos validan, inválidos fallan)\n`);
  process.exit(0);
}
process.stderr.write(`\nFAIL — ${failures}/${checked} fixtures con comportamiento incorrecto\n`);
process.exit(1);

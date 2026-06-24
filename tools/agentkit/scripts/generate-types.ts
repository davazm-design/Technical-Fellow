import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.resolve(__dirname, "../../../schemas");
const OUT_DIR = path.resolve(__dirname, "../src/types/generated");

const BANNER =
  "/* eslint-disable */\n" +
  "// Archivo generado automáticamente desde schemas/. NO editar a mano.\n" +
  "// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).";

const TARGETS = [
  { schema: "task.schema.json", out: "task.ts" },
  { schema: "ownership.schema.json", out: "ownership.ts" },
  { schema: "contract.schema.json", out: "contract.ts" },
  { schema: "verdict.schema.json", out: "verdict.ts" },
  { schema: "run-event.schema.json", out: "run-event.ts" },
  { schema: "policy.schema.json", out: "policy.ts" },
  { schema: "approval.schema.json", out: "approval.ts" },
];

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const { schema, out } of TARGETS) {
    const ts = await compileFromFile(path.join(SCHEMA_DIR, schema), {
      bannerComment: BANNER,
      additionalProperties: false,
      declareExternallyReferenced: true,
      enableConstEnums: false,
    });
    writeFileSync(path.join(OUT_DIR, out), ts);
    process.stdout.write(`✓ ${schema} → src/types/generated/${out}\n`);
  }
  process.stdout.write(`\nTipos generados en ${path.relative(process.cwd(), OUT_DIR)}\n`);
}

main().catch((e) => {
  process.stderr.write(`error generando tipos: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});

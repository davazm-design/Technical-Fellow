import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** tools/agentkit/src/lib -> repo root */
export const REPO_ROOT = path.resolve(__dirname, "../../../..");
export const SCHEMA_DIR = path.join(REPO_ROOT, "schemas");

/** Tipos de artefacto validables y su schema asociado. */
export const ARTIFACT_TYPES = {
  task: "task.schema.json",
  ownership: "ownership.schema.json",
  contract: "contract.schema.json",
  verdict: "verdict.schema.json",
  "run-event": "run-event.schema.json",
} as const;

export type ArtifactType = keyof typeof ARTIFACT_TYPES;

export interface ValidationResult {
  ok: boolean;
  type: ArtifactType;
  file: string;
  /** Mensajes accionables, ya formateados (vacío si ok). */
  errors: string[];
}

const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);

const validators = new Map<ArtifactType, ValidateFunction>();

function getValidator(type: ArtifactType): ValidateFunction {
  const cached = validators.get(type);
  if (cached) return cached;
  const schemaPath = path.join(SCHEMA_DIR, ARTIFACT_TYPES[type]);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
  const validate = ajv.compile(schema);
  validators.set(type, validate);
  return validate;
}

/** Extrae el frontmatter YAML (--- ... ---) del inicio de un markdown. */
export function parseFrontmatter(raw: string): unknown {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/);
  if (!match) {
    throw new Error(
      "no se encontró frontmatter YAML (bloque '---' al inicio del archivo). " +
        "Un task canónico empieza con '---' seguido de sus campos meta y otro '---'.",
    );
  }
  return parseYaml(match[1]!);
}

/** Carga un artefacto desde disco según su extensión. */
export function loadArtifact(file: string): unknown {
  const raw = readFileSync(file, "utf8");
  const ext = path.extname(file).toLowerCase();
  if (ext === ".json") return JSON.parse(raw);
  if (ext === ".md" || ext === ".markdown") return parseFrontmatter(raw);
  // .yaml / .yml / otros: YAML (superset de JSON)
  return parseYaml(raw);
}

function formatError(err: ErrorObject): string {
  const where = err.instancePath || "(raíz)";
  let msg = `${where} ${err.message ?? "es inválido"}`;
  if (err.keyword === "additionalProperties" && err.params["additionalProperty"]) {
    msg += `: campo no permitido "${err.params["additionalProperty"]}" (¿typo?)`;
  } else if (err.keyword === "enum" && Array.isArray(err.params["allowedValues"])) {
    msg += `: valores permitidos = ${JSON.stringify(err.params["allowedValues"])}`;
  } else if (err.keyword === "required" && err.params["missingProperty"]) {
    msg += `: falta el campo "${err.params["missingProperty"]}"`;
  }
  return msg;
}

/** Valida un objeto ya parseado contra el schema del tipo dado. */
export function validateData(type: ArtifactType, data: unknown, file = "(memoria)"): ValidationResult {
  const validate = getValidator(type);
  const ok = validate(data) as boolean;
  const errors = ok ? [] : (validate.errors ?? []).map(formatError);
  return { ok, type, file, errors };
}

/** Carga y valida un artefacto desde disco. Los errores de parseo se reportan como inválidos. */
export function validateArtifact(type: ArtifactType, file: string): ValidationResult {
  let data: unknown;
  try {
    data = loadArtifact(file);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, type, file, errors: [`no se pudo parsear el archivo: ${reason}`] };
  }
  return validateData(type, data, file);
}

export function isArtifactType(s: string): s is ArtifactType {
  return Object.prototype.hasOwnProperty.call(ARTIFACT_TYPES, s);
}

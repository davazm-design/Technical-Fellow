// Run logs en formato JSONL: una línea = un objeto que valida contra run-event.schema.json.
// Append-only (sin reescribir ni borrar). Sin secretos/PII (el schema es cerrado: additionalProperties:false).
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { validateData } from "./validate.js";

export interface RunLogResult {
  ok: boolean;
  file: string;
  /** nº de eventos válidos */
  valid: number;
  /** errores formateados "línea N: <motivo>" */
  errors: string[];
}

/** Valida un run log JSONL completo: cada línea no vacía debe ser un run-event válido. */
export function validateRunLog(file: string): RunLogResult {
  const raw = readFileSync(file, "utf8");
  const lines = raw.split("\n");
  const errors: string[] = [];
  let valid = 0;

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return; // líneas en blanco se ignoran
    const lineNo = i + 1;
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch (e) {
      errors.push(`línea ${lineNo}: JSON inválido (${e instanceof Error ? e.message : String(e)})`);
      return;
    }
    const res = validateData("run-event", obj, `${file}:${lineNo}`);
    if (res.ok) valid++;
    else for (const err of res.errors) errors.push(`línea ${lineNo}: ${err}`);
  });

  return { ok: errors.length === 0, file, valid, errors };
}

export interface AppendResult {
  ok: boolean;
  errors: string[];
}

/** Valida un evento y lo añade (append-only) como una línea JSONL al log. NO sobrescribe. */
export function appendRunEvent(logFile: string, eventFile: string): AppendResult {
  if (!existsSync(eventFile)) return { ok: false, errors: [`evento no encontrado: ${eventFile}`] };
  let event: unknown;
  try {
    event = JSON.parse(readFileSync(eventFile, "utf8"));
  } catch (e) {
    return { ok: false, errors: [`evento JSON inválido: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const res = validateData("run-event", event, eventFile);
  if (!res.ok) return { ok: false, errors: res.errors };

  appendFileSync(logFile, JSON.stringify(event) + "\n");
  return { ok: true, errors: [] };
}

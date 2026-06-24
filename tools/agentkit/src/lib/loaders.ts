// Loaders centralizados: cargan (YAML / JSON / Markdown con frontmatter), validan contra el JSON
// Schema y devuelven el tipo TS GENERADO. Reutilizan loadArtifact + validateData de validate.ts
// (no duplican la lógica de parseo ni de validación).
import { loadArtifact, validateData, type ArtifactType } from "./validate.js";
import type { Task, OwnershipMap, ContractManifest, Verdict, RunEvent, Policy, Approval } from "../types/index.js";

export type LoadResult<T> =
  | { ok: true; data: T; file: string }
  | { ok: false; data: null; file: string; errors: string[] };

function load<T>(type: ArtifactType, file: string): LoadResult<T> {
  let raw: unknown;
  try {
    raw = loadArtifact(file);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, data: null, file, errors: [`no se pudo parsear el archivo: ${reason}`] };
  }
  const res = validateData(type, raw, file);
  if (!res.ok) return { ok: false, data: null, file, errors: res.errors };
  return { ok: true, data: raw as T, file };
}

export const loadTask = (file: string): LoadResult<Task> => load<Task>("task", file);
export const loadOwnership = (file: string): LoadResult<OwnershipMap> => load<OwnershipMap>("ownership", file);
export const loadContract = (file: string): LoadResult<ContractManifest> => load<ContractManifest>("contract", file);
export const loadVerdict = (file: string): LoadResult<Verdict> => load<Verdict>("verdict", file);
export const loadRunEvent = (file: string): LoadResult<RunEvent> => load<RunEvent>("run-event", file);
export const loadPolicy = (file: string): LoadResult<Policy> => load<Policy>("policy", file);
export const loadApproval = (file: string): LoadResult<Approval> => load<Approval>("approval", file);

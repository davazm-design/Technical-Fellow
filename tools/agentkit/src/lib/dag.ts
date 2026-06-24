// Orquestador mínimo: carga tasks de un directorio, las valida y construye el DAG de depends_on.
// SOLO lectura/validación/planificación. No ejecuta, no escribe código, no commitea, no mergea.
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { loadTask } from "./loaders.js";
import type { Task } from "../types/index.js";

const TASK_EXTS = new Set([".md", ".markdown", ".yaml", ".yml", ".json"]);

export interface InvalidTask {
  file: string;
  errors: string[];
}

export interface BlockedTask {
  id: string;
  reason: string;
}

export interface PlanAnalysis {
  /** tasks válidas cargadas (puede haber ids duplicados aquí; ver duplicateIds) */
  tasks: Task[];
  /** archivos que no validaron contra task.schema */
  invalid: InvalidTask[];
  /** ids declarados más de una vez */
  duplicateIds: string[];
  /** dependencias referenciadas que no existen como task */
  missingDeps: { task: string; missing: string }[];
  /** ruta de un ciclo si existe (ej. ["a","b","a"]) o null */
  cycle: string[] | null;
  /** orden topológico (válido solo si no hay ciclo/duplicado/missing) */
  topoOrder: string[];
  /** ids listas para ejecutar */
  ready: string[];
  /** tasks bloqueadas con motivo */
  blocked: BlockedTask[];
  /** conteo por status */
  byStatus: Record<string, number>;
}

/** Lee y valida todas las tasks de un directorio. Lanza si el dir no existe (operacional). */
export function loadTasksFromDir(dir: string): { tasks: Task[]; invalid: InvalidTask[] } {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`directorio de tasks no encontrado: ${dir}`);
  }
  const files = readdirSync(dir)
    .filter((f) => !f.startsWith(".") && TASK_EXTS.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => path.join(dir, f));

  const tasks: Task[] = [];
  const invalid: InvalidTask[] = [];
  for (const file of files) {
    const r = loadTask(file);
    if (r.ok) tasks.push(r.data);
    else invalid.push({ file, errors: r.errors });
  }
  return { tasks, invalid };
}

/** Detección de ciclo por DFS; devuelve la primera ruta de ciclo encontrada o null. */
function findCycle(ids: string[], deps: Map<string, string[]>): string[] | null {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>(ids.map((id) => [id, WHITE]));
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of deps.get(node) ?? []) {
      if (!color.has(dep)) continue; // dep faltante: lo maneja missingDeps
      const c = color.get(dep);
      if (c === GRAY) {
        // ciclo: desde dep hasta node + dep
        const from = stack.indexOf(dep);
        return [...stack.slice(from), dep];
      }
      if (c === WHITE) {
        const found = dfs(dep);
        if (found) return found;
      }
    }
    color.set(node, BLACK);
    stack.pop();
    return null;
  }

  for (const id of ids) {
    if (color.get(id) === WHITE) {
      const found = dfs(id);
      if (found) return found;
    }
  }
  return null;
}

/** Orden topológico (Kahn) considerando solo deps existentes. Determinista (orden alfabético). */
function topoSort(ids: string[], deps: Map<string, string[]>): string[] {
  const idSet = new Set(ids);
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const succ = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const id of ids) {
    for (const dep of deps.get(id) ?? []) {
      if (!idSet.has(dep)) continue; // dep faltante no cuenta
      indeg.set(id, (indeg.get(id) ?? 0) + 1);
      succ.get(dep)!.push(id);
    }
  }
  const queue = ids.filter((id) => (indeg.get(id) ?? 0) === 0).sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const s of (succ.get(node) ?? []).sort()) {
      indeg.set(s, (indeg.get(s) ?? 0) - 1);
      if (indeg.get(s) === 0) {
        queue.push(s);
        queue.sort();
      }
    }
  }
  return order; // si order.length < ids.length hay ciclo (topoOrder no es de fiar)
}

/** Analiza un plan completo a partir del directorio de tasks. */
export function analyzePlan(dir: string): PlanAnalysis {
  const { tasks, invalid } = loadTasksFromDir(dir);

  // ids duplicados
  const seen = new Map<string, number>();
  for (const t of tasks) seen.set(t.id, (seen.get(t.id) ?? 0) + 1);
  const duplicateIds = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id).sort();

  const ids = tasks.map((t) => t.id);
  const idSet = new Set(ids);
  const deps = new Map<string, string[]>(tasks.map((t) => [t.id, t.depends_on]));

  // dependencias faltantes
  const missingDeps: { task: string; missing: string }[] = [];
  for (const t of tasks) {
    for (const d of t.depends_on) {
      if (!idSet.has(d)) missingDeps.push({ task: t.id, missing: d });
    }
  }

  const cycle = findCycle(ids, deps);
  const topoOrder = cycle ? [] : topoSort(ids, deps);

  // ready / blocked por status + deps
  const completed = new Set(tasks.filter((t) => t.status === "completed").map((t) => t.id));
  const ready: string[] = [];
  const blocked: BlockedTask[] = [];
  const byStatus: Record<string, number> = {};
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    if (t.status === "completed" || t.status === "rejected") continue;
    if (t.status === "blocked") {
      blocked.push({ id: t.id, reason: "status=blocked" });
      continue;
    }
    // draft | planned
    const unmet = t.depends_on.filter((d) => !completed.has(d));
    if (unmet.length === 0) ready.push(t.id);
    else blocked.push({ id: t.id, reason: `espera deps: ${unmet.join(", ")}` });
  }

  return {
    tasks,
    invalid,
    duplicateIds,
    missingDeps,
    cycle,
    topoOrder,
    ready: ready.sort(),
    blocked,
    byStatus,
  };
}

/** El plan es estructuralmente válido (sin invalid/duplicado/missing/ciclo). */
export function planIsValid(a: PlanAnalysis): boolean {
  return (
    a.invalid.length === 0 &&
    a.duplicateIds.length === 0 &&
    a.missingDeps.length === 0 &&
    a.cycle === null
  );
}

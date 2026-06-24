/* eslint-disable */
// Archivo generado automáticamente desde schemas/. NO editar a mano.
// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).

/**
 * Handoff durable de una tarea (CANON §2.1, §9). Fuente ÚNICA de ownership: el campo owns: es la verdad; ownership.md se deriva. Estos campos viven en el frontmatter YAML (--- ... ---) al inicio de tasks/<id>.md.
 */
export interface Task {
  /**
   * Identificador estable de la tarea. Convención <lane>-<n> (backend-1) o pre-step nombrado (shared-user-context).
   */
  id: string;
  /**
   * Lane de paralelismo (CANON §1).
   */
  lane: "db" | "backend" | "frontend";
  /**
   * Slug del feature al que pertenece la tarea.
   */
  feature: string;
  /**
   * Ruta al contrato congelado del que depende (CANON §8).
   */
  contract?: string;
  /**
   * Perfil de rigor (docs/PROFILES.md).
   */
  profile: "lite" | "full";
  /**
   * Zonas de protección que toca la tarea (CANON §6). 🔴 hace la tarea inválida y no se declara aquí. 🟠/🟡 ⇒ NO paralelizable.
   *
   * @minItems 1
   */
  zones: ["🟢" | "🟠" | "🟡", ...("🟢" | "🟠" | "🟡")[]];
  /**
   * IDs de tareas de las que depende. Define el orden de merge topológico. [] si independiente.
   */
  depends_on: string[];
  /**
   * Ruta del worktree efímero (CANON §2.5).
   */
  worktree?: string;
  /**
   * Rama de la tarea, ej. backend/backend-1.
   */
  branch?: string;
  /**
   * OWNERSHIP EXCLUSIVO. Ningún otro task paralelo toca estos archivos (CANON §9). Fuente única para el ownership map.
   *
   * @minItems 1
   */
  owns: [string, ...string[]];
  /**
   * Una frase: qué entrega esta tarea.
   */
  objetivo: string;
}

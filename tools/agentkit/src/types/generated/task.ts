/* eslint-disable */
// Archivo generado automáticamente desde schemas/. NO editar a mano.
// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).

export type GateValue = "required" | "optional" | "skipped";

/**
 * Handoff durable de una tarea (CANON §2.1, §9). Fuente ÚNICA de ownership: el campo owns: es la verdad; ownership.md se deriva. Estos campos viven en el frontmatter YAML (--- ... ---) al inicio de tasks/<id>.md; el cuerpo Markdown queda libre para contexto, plan y notas. NO incluye campos de runtime/event-log (run_id, model, tokens, cost, timestamps, verdicto real, etc.): esos pertenecen al log de ejecución, no al contrato del task.
 */
export interface Task {
  /**
   * Identificador estable. Convención <lane>-<n> (backend-1) o pre-step nombrado (shared-user-context).
   */
  id: string;
  /**
   * Slug del feature.
   */
  feature: string;
  /**
   * Título humano corto de la tarea.
   */
  title: string;
  /**
   * Lane de paralelismo (CANON §1).
   */
  lane: "db" | "backend" | "frontend";
  /**
   * Rol responsable de ejecutar la tarea (slash command).
   */
  agent:
    | "architect"
    | "audit"
    | "backend"
    | "db"
    | "deploy"
    | "frontend"
    | "git"
    | "integrator"
    | "orchestrator"
    | "responsive"
    | "security";
  /**
   * Estado del ciclo de vida del task.
   */
  status: "draft" | "planned" | "in_progress" | "blocked" | "completed" | "rejected";
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
   * Nivel de riesgo de la tarea.
   */
  risk_level: "low" | "medium" | "high" | "critical";
  /**
   * IDs de tareas de las que depende. Define el orden de merge topológico. [] si independiente.
   */
  depends_on: string[];
  /**
   * OWNERSHIP EXCLUSIVO (CANON §9). Ningún otro task paralelo toca estos archivos. Fuente única del ownership map. Soporta globs (src/invoices/**).
   *
   * @minItems 1
   */
  owns: [string, ...string[]];
  /**
   * Rutas a los contratos congelados de los que depende la tarea (CANON §8). [] si no depende de ninguno.
   */
  contracts: string[];
  /**
   * Gates de validación de la tarea. required: debe correr y pasar. optional: corre si aplica, no bloquea. skipped: omitido explícitamente.
   */
  gates: {
    audit_f1: GateValue;
    security_f1: GateValue;
    audit_f2: GateValue;
    security_f2: GateValue;
  };
  /**
   * Tipos de evidencia que el cierre debe aportar. Ej.: tests, typecheck, ownership_check, security_review, screenshots, migration_test.
   *
   * @minItems 1
   */
  evidence_required: [string, ...string[]];
  /**
   * Criterios de aceptación verificables (sin juicio subjetivo).
   *
   * @minItems 1
   */
  acceptance_criteria: [string, ...string[]];
  /**
   * Notas opcionales (también puede ir en el cuerpo Markdown).
   */
  notes?: string;
}

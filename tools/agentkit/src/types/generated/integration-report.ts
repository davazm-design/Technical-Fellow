/* eslint-disable */
// Archivo generado automáticamente desde schemas/. NO editar a mano.
// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).

/**
 * Foto de readiness de un feature (E3, SOLO LECTURA). Compone los gates existentes (validate-plan, tasks completed, verdicts de cierre, ownership, policies, approvals) en un veredicto ready/not-ready. NO ejecuta merge, NO sugiere comandos (E4), NO contiene resultado de merge, hashes, resolución de conflictos ni estado post-merge.
 */
export interface IntegrationReport {
  feature: string;
  generated_at: string;
  ready: boolean;
  /**
   * Orden topológico sugerido por el DAG (solo informativo; NO ejecuta merges).
   */
  merge_order: string[];
  checks: {
    name: string;
    status: "pass" | "fail" | "skipped";
    detail?: string;
  }[];
  blockers: string[];
  tasks: {
    id: string;
    status: string;
    ready_for_integration: boolean;
    blockers: string[];
  }[];
}

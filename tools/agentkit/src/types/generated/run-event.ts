/* eslint-disable */
// Archivo generado automáticamente desde schemas/. NO editar a mano.
// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).

/**
 * Evento estructurado de una ejecución (CANON §10, Fase 6). Un run log es un archivo JSONL: una línea = un objeto que valida contra este schema. Sin secretos ni PII.
 */
export interface RunEvent {
  /**
   * Identificador de la ejecución. Agrupa todos los eventos de un mismo run.
   */
  run_id: string;
  timestamp: string;
  event_type:
    | "run_started"
    | "agent_invoked"
    | "artifact_created"
    | "validation_passed"
    | "validation_failed"
    | "gate_blocked"
    | "human_approval_requested"
    | "human_approval_granted"
    | "task_completed"
    | "integration_started"
    | "integration_failed"
    | "integration_completed";
  severity?: "debug" | "info" | "warning" | "error" | "critical";
  agent_id?: string;
  task_id?: string;
  feature_id?: string;
  input_refs?: string[];
  output_refs?: string[];
  evidence_refs?: string[];
  /**
   * Modelo usado, si aplica.
   */
  model?: string;
  tokens?: {
    input?: number;
    output?: number;
  };
  cost_usd?: number;
  duration_ms?: number;
}

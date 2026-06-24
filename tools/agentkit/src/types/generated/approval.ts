/* eslint-disable */
// Archivo generado automáticamente desde schemas/. NO editar a mano.
// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).

/**
 * Registro auditable y versionado de una decisión humana (E2). NO es control de acceso real, ni firma, ni RBAC, ni quórum: es EVIDENCIA. Distingue aprobación formal de confirmación nominal. Vive en approvals/<feature>/<approval_id>.yaml.
 */
export type Approval = {
  [k: string]: unknown;
} & {
  /**
   * Identificador estable.
   */
  approval_id: string;
  feature_id: string;
  /**
   * Si está, la approval aplica solo a esa task; si no, aplica a todo el feature.
   */
  task_id?: string;
  /**
   * Qué se aprueba (descripción humana).
   */
  scope: string;
  risk_level: "low" | "medium" | "high" | "critical";
  /**
   * formal satisface formal y nominal; nominal satisface solo nominal. Si se omite, se trata como nominal (conservador).
   */
  approval_type?: "nominal" | "formal";
  requested_by: string;
  /**
   * Requerido cuando decision=approved.
   */
  approved_by?: string;
  approver_role?: string;
  decision: "pending" | "approved" | "rejected";
  reason?: string;
  timestamp: string;
  /**
   * Si está y ya pasó, la approval no satisface.
   */
  expiration?: string;
  policy_ids?: string[];
  evidence_refs?: string[];
  notes?: string;
};

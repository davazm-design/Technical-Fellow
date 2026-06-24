/* eslint-disable */
// Archivo generado automáticamente desde schemas/. NO editar a mano.
// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).

/**
 * Regla de gobernanza declarativa y evaluable (E1). Cross-cutting: aplica por globs, zonas o risk_level y puede exigir evidencia o aprobación. NO es un motor de reglas: una policy = una condición de bloqueo. Severidad reusa la del verdict (CRITICAL/HIGH/MEDIUM/LOW). Sin DSL, sin auto-remediation, sin hooks de runtime, sin supresiones.
 */
export type Policy = {
  [k: string]: unknown;
} & {
  /**
   * Identificador estable de la policy.
   */
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  /**
   * Solo las active se evalúan por default.
   */
  status: "active" | "draft";
  /**
   * Ámbito de aplicación. Vacío = no acota por sí mismo (la condición decide).
   */
  applies_to?: {
    /**
     * Globs (picomatch).
     */
    paths?: string[];
    zones?: ("🔴" | "🟠" | "🟡" | "🟢")[];
    risk_levels?: ("low" | "medium" | "high" | "critical")[];
  };
  /**
   * Condición única que dispara la policy.
   */
  block_condition: "path_match" | "zone_touch" | "risk_at_least" | "missing_evidence" | "secret_pattern";
  /**
   * Evidencia exigida (para block_condition=missing_evidence). Ej.: tests, security_review.
   */
  evidence_required?: string[];
  /**
   * Regex extra para block_condition=secret_pattern. Si se omite, se usan heurísticas básicas internas (best-effort).
   */
  secret_patterns?: string[];
  approval_required: "none" | "nominal" | "formal";
  responsible_agent:
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
   * Acción requerida / explicación humana.
   */
  message?: string;
};

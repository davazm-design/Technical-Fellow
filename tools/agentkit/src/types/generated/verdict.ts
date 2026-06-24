/* eslint-disable */
// Archivo generado automáticamente desde schemas/. NO editar a mano.
// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).

/**
 * Veredicto estructurado de Auditor o Security sobre una tarea (CANON §2.3, §2.4). Variante discriminada por phase: cada fase tiene su propio vocabulario de estados, fiel al CANON. Sustituye el bloque de prosa embebido en tasks/<id>.md por un artefacto parseable.
 */
export type Verdict = {
  [k: string]: unknown;
} & {
  task_id: string;
  feature: string;
  /**
   * plan: auditoría de plan (F1). security: security de plan (F1). closure-audit / closure-security: auditoría/security de cierre (F2).
   */
  phase: "plan" | "security" | "closure-audit" | "closure-security";
  agent: "audit" | "security";
  /**
   * Estado del veredicto. El valor permitido depende de phase (ver allOf).
   */
  verdict: string;
  timestamp?: string;
  findings?: {
    id?: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
    evidence?: string;
  }[];
  /**
   * Referencias archivo:línea o comandos que corroboran el veredicto (regla de honestidad, CANON §3).
   */
  evidence?: string[];
  /**
   * Lista verificable cuando el veredicto es *CON CONDICIONES* / WARNINGS.
   */
  conditions?: string[];
  action_required?: string;
};

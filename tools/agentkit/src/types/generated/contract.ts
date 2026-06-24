/* eslint-disable */
// Archivo generado automáticamente desde schemas/. NO editar a mano.
// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).

/**
 * Manifiesto del Contrato Compartido de un feature (CANON §8). NO re-valida el OpenAPI ni los tipos TS — declara qué artefactos componen el contrato, su versión y si está congelado. El api.yaml se valida como OpenAPI 3.1 por su propio tooling.
 */
export type ContractManifest = {
  [k: string]: unknown;
} & {
  feature: string;
  /**
   * Versión semántica del contrato.
   */
  version: string;
  /**
   * draft: en construcción. frozen: congelado, inmutable durante la fase paralela (CANON §8).
   */
  status: "draft" | "frozen";
  /**
   * Timestamp del congelamiento (requerido conceptualmente cuando status=frozen).
   */
  frozen_at?: string;
  /**
   * Los tres componentes del contrato (data + api + types).
   */
  artifacts: {
    /**
     * Ruta al contrato OpenAPI (api.contract.yaml).
     */
    api: string;
    /**
     * Ruta a los tipos compartidos (types.contract.ts).
     */
    types: string;
    /**
     * Ruta al modelo de datos (data.contract.md).
     */
    data: string;
  };
};

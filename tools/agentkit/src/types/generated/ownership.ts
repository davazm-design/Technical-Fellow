/* eslint-disable */
// Archivo generado automáticamente desde schemas/. NO editar a mano.
// Regenerar con: npm run generate:types  (fuente canónica = los JSON Schema).

/**
 * Mapa de ownership de un feature (CANON §9). VISTA DERIVADA del owns: de cada task; el orchestrator/agentkit la compone. Incluye el checklist duro de archivos de integración (PASO 2.5, BS-6).
 */
export interface OwnershipMap {
  /**
   * Slug del feature.
   */
  feature: string;
  /**
   * Tareas del feature con su ownership declarado.
   *
   * @minItems 1
   */
  tasks: [
    {
      id: string;
      lane: "db" | "backend" | "frontend";
      /**
       * @minItems 1
       */
      owns: [string, ...string[]];
      depends_on: string[];
      profile?: "lite" | "full";
    },
    ...{
      id: string;
      lane: "db" | "backend" | "frontend";
      /**
       * @minItems 1
       */
      owns: [string, ...string[]];
      depends_on: string[];
      profile?: "lite" | "full";
    }[]
  ];
  /**
   * Checklist duro de archivos compartidos (CANON §9, orchestrator PASO 2.5). Cada archivo compartido DEBE tener disposición explícita; nunca implícito ni en una tarea paralela.
   */
  integration_files?: {
    path: string;
    /**
     * pre-step-frozen: construido secuencial antes. integration-owned: lo cablea el integrator, no está en ningún owns:. sequential: una sola tarea lo edita en orden.
     */
    disposition: "pre-step-frozen" | "integration-owned" | "sequential";
    detail?: string;
  }[];
}

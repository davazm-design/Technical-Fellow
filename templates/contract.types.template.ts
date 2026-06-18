// types.contract.ts — feature <feature-slug>
//
// Tipos compartidos (DTOs) producidos por /architect en modo contract-first.
// EL PUENTE FÍSICO entre lanes: el backend y el frontend importan ESTOS tipos, no el código del otro.
// Congelado durante la fase paralela (zona 🟠). Cambiarlo = parar y re-sincronizar (CANON §8).
//
// Mantener en sync con api.contract.yaml. Sin dependencias de runtime — sólo tipos.

/** Entidad tal como viaja por la API (no necesariamente igual a la fila de DB). */
export interface Resource {
  id: string;            // uuid
  status: string;
  created_at: string;    // ISO date-time
}

/** Body de creación. additionalProperties:false ↔ Zod .strict() en el boundary. */
export interface CreateResource {
  name: string;
}

export type ResourceList = Resource[];

/** Forma estándar de error de la API (sin stack traces, sin PII). */
export interface ApiError {
  code: string;          // ej. "RESOURCE_ALREADY_EXISTS"
  message: string;       // mensaje seguro para el cliente
}

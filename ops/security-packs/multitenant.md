# Domain pack: multitenant

Checklist que `/security` añade cuando `kit.config.yaml domain_packs.enabled` incluye `multitenant`.
No modifica el agente — se carga en runtime. Generalizado del lente DBA+multi-tenant de admisioncrm.

## Plan (Función 1) y ejecución (Función 2)

**Aislamiento**
- [ ] Toda query tenant-scoped pasa por el helper de aislamiento del proyecto (ej. `withTenantContext`
      / `SET LOCAL app.tenant_id` / RLS). Cero acceso directo a tablas tenant sin contexto.
- [ ] Ninguna query lee de múltiples tenants salvo acción explícita de super-admin con auditoría
      reforzada.
- [ ] FKs intra-tenant (no cross-tenant).

**Schema**
- [ ] Si el modelo es shared-DB + RLS: cada tabla tenant tiene policy con `USING` **y** `WITH CHECK`
      (cubre SELECT/INSERT/UPDATE/DELETE, no sólo lectura).
- [ ] Índices incluyen la columna de tenant donde el filtrado lo requiere.
- [ ] `current_setting('app.tenant_id')` (o equivalente) leído del mismo namespace que se setea.

**Verificación empírica (Función 2)**
- [ ] Test de aislamiento real: tenant A no puede leer/escribir datos de tenant B (no sólo mock).
- [ ] `grep` de bypass: acceso directo a tabla tenant sin pasar por el helper → hallazgo HIGH.

## Severidad
Cualquier vía de cross-tenant leak (lectura o escritura) es **CRITICAL** y bloquea el cierre.

# Ownership map — feature <feature-slug>

> Lo produce `/orchestrator`. Garantiza que las tareas paralelas tienen archivos DISJUNTOS.
> Verificable: ninguna ruta aparece en dos tareas que corren en paralelo (sin relación depends_on).

| Task id | Lane | Archivos que posee (owns) | depends_on | Perfil |
|---------|------|---------------------------|------------|--------|
| db-1 | db | migrations/00NN_*.sql | [] | full |
| backend-1 | backend | src/routes/x.ts, tests/routes/x.test.ts | [db-1] | lite |
| frontend-1 | frontend | web/src/pages/X.tsx, web/src/api/x.ts | [] | lite |

## Archivos de integración y su disposición (CHECKLIST DURO — orchestrator PASO 2.5)

Todo archivo compartido que el feature toque DEBE listarse aquí con su disposición (nunca implícito,
nunca en una tarea paralela). Ver `orchestrator.md` PASO 2.5 y `blind_spots.md` BS-6.

| Archivo compartido | Disposición | Detalle |
|--------------------|-------------|---------|
| src/lib/user-context.ts | pre-step frozen | construido secuencial antes; tareas con `depends_on: [shared-user-context]` |
| src/server.ts | integration-owned | lo cablea el /integrator; NO está en ningún `owns:` |
| migrations/00NN.sql | secuencial (lane db) | una sola tarea db lo edita; backend depende de ella |

## Verificación de disjunción (debe pasar antes de abrir worktrees)

```bash
# Extrae todos los owns de tareas SIN relación depends_on entre sí y confirma 0 duplicados:
# (pseudo) sort owns_de_tareas_paralelas | uniq -d   →  debe ser vacío
```

## Grafo de dependencias (orden de merge del Integrator)

```
db-1 ──► backend-1
frontend-1   (independiente; mockea API desde el contrato)
```

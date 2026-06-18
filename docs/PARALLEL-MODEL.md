# Modelo de construcción paralela

Este documento define **cómo** los agentes construyen en paralelo sin colisionar. Es la pieza nueva
respecto a admisioncrm (que era estrictamente secuencial). Léelo entero antes de correr el primer
feature paralelo.

---

## 1. El problema que resuelve

Construir front + back + db "al mismo tiempo" suena bien hasta que dos agentes tocan el mismo archivo,
o el frontend asume un shape de API que el backend implementó distinto. El paralelismo ingenuo produce
merge conflicts y bugs de integración. Este modelo lo evita con tres reglas duras:

1. **Contract-first** — el contrato se define y congela ANTES de paralelizar.
2. **Ownership disjunto** — dos tareas paralelas nunca tocan el mismo archivo.
3. **Aislamiento por worktree** — cada tarea trabaja en su propia copia del árbol.

---

## 2. Lanes y tareas

- **Lane** = dimensión horizontal de construcción: `db`, `backend`, `frontend`. Corren en paralelo
  entre sí.
- **Tarea (slice)** = unidad de trabajo dentro de un lane, con ownership de archivos exclusivo. Hasta
  1–3 tareas concurrentes por lane.

```
LANE db            LANE backend         LANE frontend
├─ task db-1       ├─ task be-1         ├─ task fe-1
├─ task db-2       ├─ task be-2         ├─ task fe-2
└─ task db-3       └─ task be-3         └─ task fe-3
```

Máximo teórico: 3 lanes × 3 tareas = 9 tracks. En la práctica el límite real es (a) el ownership
disjunto disponible y (b) el tope de concurrencia de la herramienta. Empieza con 2–3 tracks.

---

## 3. El Contrato Compartido (la pieza clave)

Lo produce `/architect` en modo contract-first, antes de abrir los lanes. Vive en
`contracts/<feature>/` y es **inmutable durante la fase paralela**.

```
contracts/<feature>/
├── data.contract.md       entidades, columnas, tipos, FKs, índices   → lo implementa el lane db
├── api.contract.yaml      OpenAPI: endpoints, request/response, errores → back implementa, front consume
├── types.contract.ts      tipos TS compartidos (DTOs)                 → import-able por back y front
└── ownership.md           qué archivos posee cada tarea (disjunción verificable)
```

**Cómo desacopla los lanes:**

- El **frontend** importa `types.contract.ts` y mockea la API desde `api.contract.yaml`. No necesita
  el backend real para avanzar.
- El **backend** implementa `api.contract.yaml` y mockea la DB. No necesita el frontend.
- La **db** implementa `data.contract.md`. No necesita ni back ni front.

Cuando los tres respetan el contrato, integran a la primera. El contrato es el único punto de
acoplamiento, y se acordó antes de empezar.

---

## 4. Flujo completo de un feature

```
1. /orchestrator "<objetivo>"
   └─► descompone en tasks/*.md, asigna lanes, verifica ownership disjunto, construye grafo deps,
       asigna perfil (lite/full) por tarea.

2. /architect <feature> --contract-first
   └─► produce contracts/<feature>/{data,api,types,ownership}. Humano revisa y CONGELA.

3. [PARALELO] por cada tarea, en su worktree:
   git worktree add ../wt-<task-id> -b <lane>/<task-id>
   cd ../wt-<task-id>
   /architect <task>      → plan de la tarea (contra el contrato)
   /audit ∥ /security     → veredictos en tasks/<id>.md
   [gate: lite=feature-level | full=slice-level]
   /backend | /frontend | /db   → ejecuta en el worktree
   /audit ∥ /security     → cierre
   /git                   → commit + push rama + PR

4. /integrator
   └─► merge topológico (db → backend → frontend), suite + typecheck + E2E tras cada merge,
       consolida decisions/<task>.md en ledgers globales, reporta pendientes al humano.
```

---

## 5. Aislamiento con git worktrees

Cada tarea corre en un worktree propio → aislamiento físico, cero colisión de árbol de trabajo.

```bash
# El orchestrator (o el humano) abre un worktree por tarea:
git worktree add ../wt-be-1 -b backend/be-1
git worktree add ../wt-fe-1 -b frontend/fe-1
git worktree add ../wt-db-1 -b db/db-1
# ... cada agente trabaja en su worktree, en su rama.
# Al terminar y cerrar, el integrator mergea las ramas en orden.
git worktree remove ../wt-be-1   # cleanup tras merge
```

Claude Code soporta worktree isolation nativo en subagentes/workflows; también funciona con sesiones
de terminal separadas si prefieres conducirlo tú.

---

## 6. Orden de integración (merge topológico)

Las dependencias fluyen db → backend → frontend. El Integrator mergea en ese orden y corre la suite
completa **después de cada merge**, no sólo al final. Así un bug de integración aparece atribuible al
merge que lo introdujo (principio heredado: "tests verdes en mocks no garantizan integración real").

```
merge db/*      → suite + typecheck            (schema real disponible)
merge backend/* → suite + typecheck            (backend contra schema real)
merge frontend/*→ suite + typecheck + E2E real (front contra backend real)
```

Si un merge rompe la suite: el Integrator NO continúa; reporta el conflicto/regresión y escala.

---

## 7. Reglas anti-colisión (resumen operativo)

| Riesgo | Mecanismo |
|---|---|
| Dos tareas tocan el mismo archivo | Ownership disjunto verificado por `/orchestrator` (CANON §9) |
| Front y back divergen en la interfaz | Contract-first congelado (CANON §8) |
| Colisión en el árbol de trabajo | Un git worktree por tarea (§5) |
| Colisión en ledgers de memoria | `decisions/<task-id>.md` por tarea; consolida el Integrator (CANON §10) |
| Cambio de schema/ADR/contrato en paralelo | Zonas 🟠/🟡 son secuenciales (CANON §6) |
| Bug de integración latente | Suite + E2E tras cada merge (§6) |

---

## 8. Roadmap de validación del modelo

El modelo está diseñado pero **no validado empíricamente** todavía. Orden sugerido:

1. **Smoke secuencial** — correr `/orchestrator` sobre un feature pequeño y verificar que la
   descomposición produce ownership disjunto real (un grep lo confirma). Sin paralelizar aún.
2. **2 tracks** — correr 2 tareas de lanes distintos en worktrees separados; integrar. Primer
   paralelismo real.
3. **3 lanes** — front + back + db de un feature CRUD simple end-to-end.
4. **Piloto** — una app nueva pequeña (dashboard interno o MVP CRUD con auth) de cero con el kit.
5. **Deploy** — añadir `/deploy` (Docker + Terraform) y cerrar end-to-end.

Cada paso valida una regla dura antes de subir la complejidad. No saltes pasos: el riesgo mayor
(colisión de merge + ledgers) aparece en el paso 2.

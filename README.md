# parallel-dev-kit

Kit reutilizable para construir aplicaciones (CRM, SaaS, dashboards, MVPs, herramientas internas)
con **agentes de IA trabajando en paralelo**, sobre una capa de **gobernanza** que evita que el
paralelismo degenere en caos.

Es la generalización del sistema de gobernanza forjado en `admisioncrm`: separación estricta
propuesta/validación/ejecución, contrato de verdad, zonas de protección y memoria de blind-spots.
Aquí ese motor de calidad se **envuelve** con una capa de orquestación que descompone el trabajo,
lo aísla en worktrees y lo integra al final.

---

## La idea en una imagen

```
   CONTRATO COMPARTIDO   (se define PRIMERO, secuencial, 1 solo track)
   = schema DB + contrato de API + tipos compartidos
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   LANE: DB          LANE: BACKEND      LANE: FRONTEND     ← los 3 en paralelo,
   (1–3 tareas)      (1–3 tareas)       (1–3 tareas)         cada uno contra el contrato
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                   INTEGRATOR: conecta los 3 + corre la suite + E2E real
```

**Por qué funciona:** front/back/db no se esperan entre sí porque programan **contra el contrato**,
no contra el código del otro. El frontend mockea la API desde el contrato; el backend implementa el
contrato; la DB implementa el modelo de datos. Cuando los tres terminan, el Integrator los cablea.
Sin contract-first esto NO es paralelizable.

Detalle completo: [`docs/PARALLEL-MODEL.md`](docs/PARALLEL-MODEL.md).

---

## Los agentes

| Slash command | Rol | Nuevo / Heredado |
|---|---|---|
| `/init` | Materializa el esqueleto de un proyecto nuevo desde `kit.config.yaml` (una vez) | **Nuevo** |
| `/orchestrator` | Descompone un objetivo en lanes + tareas con ownership disjunto; agenda paralelo | **Nuevo** |
| `/architect` | Propone el plan **y** produce el Contrato Compartido (modo contract-first) | Heredado + extendido |
| `/audit` | Audita plan (F1) y ejecución (F2): gobernanza, contrato de verdad | Heredado |
| `/security` | Revisa plan/ejecución desde lente Security (+ domain pack opcional: DBA, compliance) | Heredado + generalizado |
| `/backend` `/frontend` `/db` | Builders especializados que ejecutan en su worktree; cierran git con tu autorización | Heredado (era `/coder`) |
| `/git` | Commit atómico + push + PR + **merge gateado** (autorización nominal del PR; tarea suelta) | Heredado + extendido |
| `/integrator` | Merge topológico de N ramas + verde post-merge + E2E + promoción a main con tu OK | **Nuevo** |
| `/responsive` | Valida responsividad empírica (móvil/tablet) con harness Playwright multi-viewport; opt-in | **Nuevo** |
| `/deploy` | Docker + Terraform, portable AWS/Azure/GCP; prod sólo con tu OK nominal | **Nuevo** |

Núcleo de ejecución compartido por los builders: [`docs/BUILDER-CORE.md`](docs/BUILDER-CORE.md).
Constitución del sistema: [`CANON.md`](CANON.md).

---

## Cómo se usa (flujo de un feature)

0. **Configura el proyecto** una vez: copia `kit.config.example.yaml` → `kit.config.yaml` y declara
   stack, zonas y domain packs. Para un proyecto nuevo: `/init` materializa el esqueleto
   (package.json, src/web/migrations, CI, Dockerfile, `CLAUDE.md` con las zonas).
1. `/orchestrator "<objetivo del feature>"` → produce `tasks/*.md` (una tarea por slice) y el grafo
   de dependencias. Verifica que el ownership de archivos sea disjunto.
2. `/architect <feature> --contract-first` → produce `contracts/<feature>/` (data + api + types).
   **Se congela antes de abrir los lanes.**
3. Por cada tarea, en su worktree: `/architect` (plan) → `/audit ∥ /security` → gate → builder
   (`/backend`|`/frontend`|`/db`) → `/audit ∥ /security`. En **lite** el gate es a nivel feature; en
   **full**, por slice.
4. **Cierre git (con tu autorización):** tras CIERRE APROBADO de ambos validadores y tu OK explícito,
   el builder hace commit + push + PR. Si es **tarea suelta**, con tu OK nominal del PR también
   mergea. Si es **feature paralelo**, el merge lo difiere al integrator.
5. `/integrator` → mergea las ramas en orden topológico, corre suite completa + E2E, consolida
   memoria, y **promueve a main con tu autorización nominal**.
6. `/deploy <dev|staging|prod>` → build Docker + Terraform. dev/staging gateado por smoke test;
   **prod sólo con tu autorización nominal por-deploy**.

---

## Configuración por proyecto

Todo lo específico de una app vive en `kit.config.yaml` (no en los agentes):

- **stack** — lenguaje, framework backend/frontend, base de datos, comandos de validación.
- **zones** — qué paths son 🔴/🟠/🟡/🟢 en *este* proyecto.
- **profiles** — `lite` vs `full` y qué gates aplica cada uno.
- **domain_packs** — checklists extra opcionales (ej. `multitenant`, `compliance-lfpdppp`, `pii`).
  El kit base trae Security genérico; los packs añaden rigor de dominio sin tocar los agentes.

Así el mismo kit construye un dashboard interno simple (lite, sin packs) y un SaaS multi-tenant con
datos sensibles (full, con packs), sin reescribir agentes.

---

## Portabilidad cloud

El kit está sesgado a **minimizar lock-in** (Docker + Postgres puro + framework agnóstico +
Terraform). Verdad cruda: "sin fricción" total entre AWS/Azure/GCP es parcialmente un mito; lo que
sí se logra es portar el núcleo sin reescribir lógica. Ver [`docs/CLOUD-PORTABILITY.md`](docs/CLOUD-PORTABILITY.md).

---

## Estado

`v0.1` — scaffolding. Los agentes nuevos (`/orchestrator`, `/integrator`) y el modelo paralelo están
definidos; falta validarlos con un feature piloto real (ver `docs/PARALLEL-MODEL.md` §Roadmap).

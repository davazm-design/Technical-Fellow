# agentkit

CLI y validadores mecánicos del `parallel-dev-kit` — la **traducción ejecutable del CANON**. Convierte
reglas en prosa (ownership, estados, contratos) en gates verificables con exit codes para humanos y CI.

> **¿Operando el kit por primera vez?** Empieza por la **guía operativa consolidada**:
> [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — quickstart, flujo completo de un feature, comandos por
> categoría, troubleshooting, y qué hace / qué NO hace el sistema. Este README es la referencia
> detallada por comando.

**Qué hace (implementado):** schemas canónicos + tipos generados + loaders + CLI + CI · `validate-*` ·
`doctor` · `check-diff-ownership` · run logs JSONL · DAG de solo lectura (`graph`/`status`/`next`/
`validate-plan`) · `eval` · policies (`evaluate-policies`) · approvals (`check-approvals`) ·
`integration-report` · `integration-plan` sugerido.

**Qué NO hace:** auto-merge · push · deploy · checkout/pull automático · resolución de conflictos ·
RBAC · firmas · control de acceso real · dashboard · GitHub Checks · LLM judge. `agentkit` nunca
ejecuta git destructivo; `integration-plan` imprime comandos como **texto**, no los ejecuta; un
**approval es evidencia auditable, no autorización real**; el **secret scanning es heurístico** (no
garantiza ausencia de secretos). Detalle en [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Instalación

```bash
cd tools/agentkit
npm install
```

Stack: TypeScript ESM + Node 20 + Vitest + Ajv (JSON Schema draft 2020-12). La CLI se ejecuta con
`tsx` (sin build step).

## Uso

Invocación: `npm run -s agentkit -- <comando>` (o, instalado, `agentkit <comando>`).

### validate — valida un artefacto contra su JSON Schema

```bash
agentkit validate task        tasks/backend-1.md
agentkit validate-task        tasks/backend-1.md          # alias
agentkit validate-ownership   contracts/invoices/ownership.yaml
agentkit validate-contract    contracts/invoices/manifest.yaml
agentkit validate-verdict     verdicts/backend-1/plan.yaml
agentkit validate-run-event   runs/2026-06-24/event.json
```

Acepta `.md` (frontmatter YAML), `.yaml`/`.yml` y `.json`. Schemas en `schemas/` (ver su README).

#### Contrato de task (frontmatter canónico)

Campos requeridos (`schemas/task.schema.json`): `id`, `feature`, `title`, `lane`, `agent`, `status`,
`profile`, `zones`, `risk_level`, `depends_on`, `owns`, `contracts`, `gates`, `evidence_required`,
`acceptance_criteria`. Opcional: `notes`. Enums clave:

- `status`: `draft | planned | in_progress | blocked | completed | rejected`
- `risk_level`: `low | medium | high | critical`
- `gates`: objeto con `audit_f1`/`security_f1`/`audit_f2`/`security_f2`, cada uno `required | optional | skipped`
- `evidence_required`: array de strings (`tests`, `typecheck`, `ownership_check`, `security_review`, `screenshots`, `migration_test`, …)
- `contracts`: array de rutas (plural)

**Fuera del task** (pertenecen al runtime/event-log, no al contrato): `run_id`, `model`, `tokens`,
`cost`, `latency`, `started_at`, `completed_at`, `actual_verdict`, `commands_executed`, `files_changed`,
`approval_record`. El cuerpo Markdown queda libre para contexto, non-goals, plan y notas.

### doctor — diagnóstico del kit

```bash
agentkit doctor
```

Verifica: `schemas/`, `fixtures/`, `tools/agentkit/`, su `package.json`, `templates/task.template.md`,
los 5 schemas core, dependencias instaladas (`node_modules`), git disponible y que estés en un repo.
Sale 0 si todo OK, 1 si algo falla.

### check-diff-ownership — enforcement de ownership contra el diff real

Cruza el `owns:` del task contra los archivos que git reporta como modificados.

```bash
# Modo principal: cambios de la rama vs base branch (default --base main)
agentkit check-diff-ownership --task tasks/backend-1.md --base main

# Modo secundario: cambios en el index (pre-commit local)
agentkit check-diff-ownership --task tasks/backend-1.md --staged

# Contra otro repo, sin cd:
agentkit check-diff-ownership --repo ../pilot-repo --task ../pilot-repo/tasks/backend-1.md --base main
```

- `--base <branch>` → `git diff --name-only <branch>...HEAD` (el diff "estilo PR": lo que la rama
  introdujo desde que divergió de la base). Default: `main`.
- `--staged` → `git diff --name-only --cached` (ignora `--base`).
- `--repo <path>` → repo objetivo donde correr el diff. Default: `cwd`.
- **Artefactos de control ignorados por default:** `tasks/**`, `contracts/**`, `verdicts/**`,
  `.agent-runs/**`. El checker valida el **diff de implementación**; el propio task/contract/verdict no
  debe producir una violación de ownership. Se reporta cuántos se ignoraron.
- `--strict-artifacts` → NO ignores esos paths (entonces deben estar en `owns:` o cuentan como violación).

**Salida PASS:**
```
✓ ownership válido
✓ 4 archivo(s) modificado(s) están dentro del scope declarado (main...HEAD)
```

**Salida FAIL:**
```
✗ ownership violation

Archivo(s) modificado(s) fuera de scope (main...HEAD):
- src/billing/pricing.ts

Ownership declarado:
- src/invoices/**
- tests/invoices/**

Sugerencia:
Agrega el path al `owns` del task, o separa el cambio en otra task (CANON §9: ownership disjunto).
```

### run logs JSONL (trazabilidad — Bloque D1)

Un run log es un archivo **JSONL**: una línea = un evento que valida contra `schemas/run-event.schema.json`
(CANON §10). Append-only; sin secretos ni PII (el schema es cerrado).

```bash
agentkit validate-run-event runs/2026-06-24/event.json     # un evento suelto
agentkit validate-run-log   runs/2026-06-24/run.jsonl       # log completo (valida cada línea)
agentkit append-run-event   --log runs/.../run.jsonl --event event.json   # valida y añade 1 línea
```

- `event_type` ∈ `run_started, agent_invoked, artifact_created, validation_passed, validation_failed,
  gate_blocked, task_completed, run_completed` (+ `human_approval_*`, `integration_*` reservados).
- Campos: `run_id`, `timestamp`, `event_type` (requeridos); `severity`, `agent_id`, `task_id`,
  `feature_id`, `input_refs`, `output_refs`, `evidence_refs`, `message` (opcionales). `tokens`, `cost_usd`,
  `duration_ms` opcionales y fuera de uso por ahora.
- `append-run-event` **valida antes de escribir**: un evento inválido NO se añade (exit 1).
- `validate-run-log` reporta errores con número de línea; ignora líneas en blanco.

### orquestador mínimo DAG (Bloque D2)

Orquestador **de solo lectura**: carga las tasks de un directorio, las valida contra
`task.schema.json` y analiza el grafo de `depends_on`. **No ejecuta builders, no escribe código, no
commitea, no mergea.** El directorio debe contener solo archivos de task (`.md`/`.yaml`/`.json`).

```bash
agentkit graph         --tasks tasks/ [--json]   # tasks, deps, orden topológico, bloqueos
agentkit status        --tasks tasks/ [--json]   # resumen: total/valid/invalid/ready/blocked/ciclos/…
agentkit next          --tasks tasks/ [--json]   # solo tasks listas para ejecutar
agentkit validate-plan --tasks tasks/            # valida todo el plan (schema + DAG)
```

Detecta: orden topológico, **ciclos** (con ruta legible `a → b → a`), **dependencias faltantes**,
**ids duplicados**, tasks **bloqueadas** y tasks **listas**. Una task que no valida **bloquea el plan**.

`next` solo devuelve tasks con `status` ∈ {`draft`,`planned`} cuyas `depends_on` están **todas
`completed`**; nunca `blocked`/`rejected`/`completed`. Si el plan es estructuralmente inválido
(ciclo/missing/duplicado/task inválida), `next` falla (exit 1) en vez de adivinar.

### evals deterministas (Bloque D3)

`agentkit eval` mide si las **capacidades críticas** del kit siguen funcionando: schemas, ownership,
DAG y run logs. Es **determinista** (sin LLM, sin git, sin llamadas externas): reutiliza las funciones
ya implementadas sobre fixtures dedicados en `evals/cases/`.

```bash
agentkit eval                      # corre los 9 casos; PASS sólo si todas las métricas críticas = 100%
agentkit eval --case dag-cycle     # un caso
agentkit eval --json               # salida estructurada estable (para CI)
```

**Casos:** `task-valid`, `task-invalid`, `ownership-pass`, `ownership-fail`, `dag-valid`, `dag-cycle`,
`dag-missing-dependency`, `run-log-valid`, `run-log-invalid`. Un caso **negativo** cuenta como PASS si
el sistema **bloquea correctamente** (p.ej. `task-invalid` pasa cuando la task inválida es rechazada).

**Métricas (todas críticas):** `schema_pass_rate`, `invalid_schema_block_rate`,
`ownership_violation_detection_rate`, `dag_validity_rate`, `missing_dependency_detection_rate`,
`cycle_detection_rate`, `run_log_validation_rate`, `format_compliance_rate`. Cada una es un *rate*
sobre sus casos; el comando sale 1 si alguna < 100%.

Cada resultado incluye `case_id, category, command_or_check, expected, actual, passed, metric, message`.
Por default **no** se guardan resultados; redirige `--json` a `evals/results/` si los quieres persistir.

**tests vs evals:** los **tests** (`npm test`, vitest) verifican la *implementación* (unidades, ramas,
integración interna). Los **evals** verifican que las *capacidades de producto* del kit (validar, detectar
violaciones, ordenar el DAG, validar logs) se comportan correctamente de extremo a extremo — incluyendo
que los casos negativos se bloqueen. Ambos corren en `npm run ci`.

### security policies (Bloque E1)

Policies **declarativas** (`policies/*.yaml`, schema `policy.schema.json`): una policy = **una**
condición de bloqueo. No hay motor de reglas, ni approvals (E2), ni integrator (E3+). Severidad reusa
la del verdict (`CRITICAL/HIGH/MEDIUM/LOW`).

```bash
agentkit validate-policy policies/no-secrets.yaml
agentkit evaluate-policies --task tasks/backend-1.md --policies policies/ [--repo <path>] [--threshold HIGH]
```

**Crear una policy** (campos: `id`, `title`, `severity`, `status`, `block_condition`, `approval_required`,
`responsible_agent`; opcionales `applies_to`, `evidence_required`, `secret_patterns`, `message`):

```yaml
id: no-secrets
title: Sin secretos en el diff
severity: CRITICAL
status: active            # solo las 'active' se evalúan; 'draft' se ignora por default
block_condition: secret_pattern   # path_match | zone_touch | risk_at_least | missing_evidence | secret_pattern
approval_required: formal
responsible_agent: security
```

**Evaluación** (`evaluate-policies`):
- carga y valida el task (task inválido → exit 1); carga las policies (dir inexistente o policy inválida → exit 2).
- ignora `status: draft`; evalúa solo `active`.
- bloqueo: **secretos/zona prohibida = bloqueo duro siempre**; el resto bloquea si `severity ≥ --threshold` (default `HIGH`).
- `severity` (bloqueo) y `approval_required` (evidencia humana) son **gates independientes**: una approval válida NO desbloquea una policy bloqueante. Para "requiere aprobación pero no prohíbe", usa `severity` < threshold + `approval_required`. Ver [`docs/OPERATIONS.md` §7](docs/OPERATIONS.md).
- `path_match` cruza `applies_to.paths` (globs) contra `owns` (+ diff si `--repo`). `secret_pattern` solo escanea
  contenido con `--repo`; **es heurístico/best-effort y NUNCA afirma ausencia de secretos**.
- exit `0` sin bloqueo · `1` policy bloqueante · `2` operacional.

**E1 NO incluye** approvals formales (E2) ni integrator (E3+); `policies/**` y `approvals/**` se ignoran
por default en `check-diff-ownership`.

### approval records HITL (Bloque E2)

Un **approval record** es **evidencia auditable versionada** de una decisión humana. **NO es** control
de acceso, ni firma, ni RBAC, ni quórum: solo registra que alguien aprobó (o no) algo, de forma
revisable en git. Vive en `approvals/<feature>/<approval_id>.yaml` (schema `approval.schema.json`).
`approvals/**` se ignora por default en `check-diff-ownership`.

```bash
agentkit validate-approval approvals/invoices/APR-001.yaml
agentkit check-approvals --feature invoices --approvals approvals/invoices/ --task tasks/db-1.md \
  [--policies policies/] [--now 2026-06-24T12:00:00Z] [--json]
```

**Qué dispara una aprobación requerida** (`check-approvals` toma el máximo):
- `risk_level: critical` → **formal**
- `zones` contiene 🔴 o 🟠 → **formal**
- una policy activa que aplica con `approval_required: formal|nominal` (si pasas `--policies`)

**nominal vs formal:** `formal` satisface formal y nominal; `nominal` satisface solo nominal;
`pending`/`rejected`/expirada no satisfacen nada. Un approval sin `approval_type` se trata como
`nominal` (conservador). `--now` permite tests deterministas de expiración.

**Una approval satisface** si: `feature_id` coincide, (`task_id` ausente o == el task), `decision:
approved`, no expirada, y su tipo ≥ el requerido. Exit `0` suficiente · `1` faltante/pending/rejected/
expirada · `2` operacional (dir inexistente, schema inválido de task/approval/policy).

**E2 NO incluye** integrator (E3+), merge/deploy, control de acceso real, firmas ni RBAC. Un approval
es evidencia: distingue la aprobación formal de la confirmación conversacional, nada más.

### integration readiness (Bloque E3)

`integration-report` determina si un feature está **listo para integrarse**, componiendo los gates
existentes en un reporte. Es **SOLO LECTURA**: no ejecuta merge/push/deploy, no sugiere comandos de
merge (eso es E4), no resuelve conflictos, no escribe archivos.

```bash
agentkit validate-integration-report report.json
agentkit integration-report --feature invoices --tasks tasks/ \
  [--verdicts verdicts/] [--policies policies/] [--approvals approvals/] \
  [--repo <path>] [--base main] [--now <iso>] [--json]
```

**Un feature está `ready` si** (todos los checks sin `fail` y sin blockers):
- **validate-plan** pasa (DAG sin ciclo/missing/duplicado/task inválida);
- **tasks-completed**: todas las tasks del feature están `status: completed`;
- **closure-verdicts**: por cada task, `audit_f2`/`security_f2: required` ⇒ existe un verdict con
  `phase: closure-audit`/`closure-security` y `verdict: "CIERRE APROBADO"` (reusa `verdict.schema`;
  `CIERRE CON CONDICIONES`/`CIERRE RECHAZADO` no satisfacen; gate `skipped`/`optional` no exige);
- **ownership** (solo con `--repo`): todo archivo de implementación del diff está en el `owns` de alguna
  task del feature (sin `--repo` ⇒ `skipped`);
- **policies** (solo con `--policies`): `evaluate-policies` no bloquea (sin `--policies` ⇒ `skipped`);
- **approvals**: si alguna task requiere aprobación (risk critical / 🔴🟠 / policy), debe existir una
  approval suficiente (`--approvals`); si se requiere y no se pasa `--approvals` ⇒ `fail`.

Cada check es `pass | fail | skipped`. Exit `0` ready · `1` not ready (con blockers claros) · `2`
operacional (input inválido, dir/verdict/policy/approval inválido). `--now` fija el instante para
expiración de approvals (determinista).

**E3 vs E4:** E3 solo **dice si está listo** (readiness). E4 (`integration-plan`) propone un **plan de
merge sugerido** (orden + comandos como texto, nunca ejecutados). Ninguno ejecuta merge.

### integration plan sugerido (Bloque E4)

`integration-plan` genera, **a partir del `integration-report`**, un plan de integración **para revisión
humana**. Reutiliza `buildIntegrationReport` (no duplica readiness). **No crea schema nuevo** (el plan es
representación derivada). **SOLO LECTURA**: no ejecuta git, no hace merge/push/checkout/pull/deploy, no
resuelve conflictos, no modifica ramas ni archivos.

```bash
agentkit integration-plan --feature invoices --tasks tasks/ \
  [--verdicts verdicts/] [--policies policies/] [--approvals approvals/] \
  [--repo <path>] [--base main] [--now <iso>] [--json]
```

- Si `ready=false` → exit **1** + blockers (NO genera plan de merge).
- Si `ready=true` → imprime: **Prerequisites** (checks), **Suggested merge order** (DAG), **Suggested
  commands**, **Warnings**, **Human checklist** → exit **0**.
- Input/operacional inválido → exit **2**.

**Suggested commands** son *strings de texto*, encabezados por `# Suggested only — not executed by
agentkit`, y usan **placeholders** de branch (`git merge --no-ff <branch-for-backend-1>`) porque el
**branch mapping aún no está modelado** — reemplázalos manualmente. `--json` entrega
`{ feature, ready, generated_at, merge_order, suggested_commands, prerequisites, warnings, blockers,
human_checklist }` (solo el plan sugerido; sin resultado de ejecución, hashes, post-merge ni deploy).

**E4 NO ejecuta nada.** Imprimir el plan no integra el feature: el humano revisa, confirma CI verde y
corre los comandos manualmente si procede. E5 (docs operativa consolidada) queda pendiente.

## Exit codes (consistentes en toda la CLI)

| Code | Significado |
|------|-------------|
| `0`  | validación correcta |
| `1`  | violación de ownership o artefacto inválido |
| `2`  | error operacional (uso incorrecto, git ausente, base inexistente, archivo no encontrado) |

## Tests

```bash
npm test          # vitest run
npm run typecheck # tsc --noEmit
```

## Tipos generados (fuente canónica = los JSON Schema)

Los tipos TS se **generan desde `schemas/`** con `json-schema-to-typescript`; no se escriben a mano,
para que no diverjan del schema.

```bash
npm run generate:types
```

- Salida: `src/types/generated/*.ts` (uno por schema). **Archivos generados — NO editar a mano**
  (llevan el banner correspondiente). Si cambias un schema, regenera y commitea.
- Import único: `import type { Task, OwnershipMap, ContractManifest, Verdict, RunEvent } from "../types/index.js"`.
- El barrel `src/types/index.ts` sí es manual (sólo re-exporta).

## Loaders / parsers

`src/lib/loaders.ts` centraliza carga + validación + tipado. Cada loader carga el archivo
(YAML / JSON / Markdown con frontmatter), valida contra el schema y devuelve el tipo generado:

```ts
import { loadTask } from "../lib/loaders.js";
const r = loadTask("tasks/backend-1.md");
if (r.ok) r.data.owns;          // string[] tipado
else      r.errors;             // mensajes accionables
```

Loaders: `loadTask`, `loadOwnership`, `loadContract`, `loadVerdict`, `loadRunEvent`. Reutilizan
`loadArtifact` + `validateData` de `validate.ts` (no duplican parseo ni validación). `check-diff-ownership`
ya usa `loadTask`.

## CI

El workflow `.github/workflows/agentkit.yml` corre en `push` a `main` y en cada `pull_request`. Pasos
(equivalentes locales entre paréntesis):

| Paso CI | Local | Falla si… |
|---|---|---|
| Install | `npm ci` | deps no instalables |
| Drift de tipos | `npm run generate:types` + `git diff --exit-code -- src/types/generated` | los tipos generados no coinciden con los schemas |
| Typecheck | `npm run typecheck` | error de tipos |
| Tests | `npm test` | test falla / fixture válido no valida / inválido pasa / check-diff no da el exit esperado |
| Doctor | `npm run -s agentkit -- doctor` | falta schema/fixture/instalación/git |
| Fixtures (CLI) | `npm run validate:fixtures` | un fixture válido no valida o uno inválido pasa |
| Self-test ownership | `npm run selftest:ownership` | exit codes de check-diff incorrectos |

Atajo local que replica el CI (sin el drift gate): `npm run ci`.

**Cómo interpretar fallos típicos:**
- *"tipos desincronizados"* → corre `npm run generate:types` y commitea `src/types/generated/`.
- *Doctor FAIL* → mira qué check (✗) falló; suele ser `node_modules` (corre `npm ci`) o un schema movido.
- *validate:fixtures FAIL* → un schema cambió y un fixture quedó obsoleto: ajusta el fixture o el schema.
- *selftest:ownership FAIL* → regresión en `check-diff-ownership` o en los helpers de git.

## Punto de parada recomendado

Tras Bloque D (event logs + orquestador DAG + evals) hay un **punto de parada antes de Bloque E**
(seguridad/policy engine, approvals formales, integrator ejecutable). No avanzar a Bloque E sin
aprobación explícita; el sistema ya es local, verificable y trazable de extremo a extremo.

## Limitaciones conocidas (Bloques B–C)

- `check-diff-ownership` detecta archivos tocados **fuera** del scope, no la **sub-declaración** de un
  archivo de integración que nadie listó y que aún no está en el diff (CANON §9 / blind_spots BS-6:
  ningún check mecánico puede inferirlo).
- **No** cruza zonas críticas (🟠/🟡) contra un permiso por-archivo: el `task.schema` aún no modela un
  permiso `critical` por path. Queda diferido (requeriría leer `kit.config.yaml`); se evaluará en un
  bloque posterior. Hoy `zones` es informativo a nivel task.
- Glob matching vía `picomatch` (dependencia de runtime, zero-dep transitivo): se eligió en vez de
  implementar `**`/`*`/charclasses a mano por corrección.

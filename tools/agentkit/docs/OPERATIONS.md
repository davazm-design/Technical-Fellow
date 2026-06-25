# agentkit — Guía operativa (A→E)

Guía para entender, instalar, ejecutar y operar el kit completo **sin depender de memoria de chat**.
Para la referencia detallada por comando, ver [`../README.md`](../README.md). La constitución del sistema
multiagente vive en [`../../../CANON.md`](../../../CANON.md); este documento cubre la **capa ejecutable**
(`tools/agentkit/`), que es la traducción mecánica del CANON.

> **Working directory:** todos los comandos se ejecutan desde `tools/agentkit/`. Las rutas a artefactos
> son relativas a ahí (p.ej. `../../fixtures/...` apunta a la raíz del repo). Invocación:
> `npm run -s agentkit -- <comando>`.

---

## 1. Estado actual implementado

El kit hoy incluye, **todo local, verificable y no destructivo**:

- **schemas canónicos** (JSON Schema 2020-12) — fuente de verdad de cada artefacto.
- **tipos TS generados** desde los schemas (`generate:types`), con drift-gate en CI.
- **loaders** tipados (cargan YAML/JSON/Markdown-frontmatter + validan).
- **CLI** con exit codes consistentes.
- **CI** (`npm run ci` + GitHub Actions).
- **validate-\*** para los 8 tipos de artefacto.
- **doctor** — diagnóstico del kit.
- **check-diff-ownership** — ownership contra el diff real de git.
- **run logs JSONL** — trazabilidad append-only.
- **DAG / orquestador de solo lectura** — `graph`/`status`/`next`/`validate-plan`.
- **evals deterministas** — `eval` (capacidades críticas).
- **policies** — reglas de gobernanza declarativas (`evaluate-policies`).
- **approvals** — registros HITL versionados (`check-approvals`).
- **integration-report** — readiness de un feature (solo lectura).
- **integration-plan** — plan de merge **sugerido** (comandos como texto, no ejecutados).

## Lo que NO hace (explícito)

- **auto-merge** · **push** · **deploy** · **checkout automático** · **pull automático**
- **resolución de conflictos** · **modificación de ramas**
- **RBAC** · **firmas criptográficas** · **control de acceso real**
- **dashboard** · **GitHub Checks avanzados** · **almacenamiento externo**
- **LLM judge** (no por default; no implementado)

`agentkit` nunca ejecuta git destructivo. La única escritura es `append-run-event` (append-only,
validado antes de escribir). `integration-plan` imprime comandos como **texto**; no los ejecuta.

---

## 2. Quickstart

```bash
cd tools/agentkit
npm ci                 # instala dependencias (Node 20)
npm run ci             # typecheck + tests + doctor + fixtures + selftest + eval
npm run -s agentkit -- doctor

# Validar artefactos
npm run -s agentkit -- validate-task        ../../fixtures/task/valid/backend-1.md
npm run -s agentkit -- validate-policy      ../../fixtures/policy/valid/path-match.yaml
npm run -s agentkit -- validate-approval    ../../fixtures/approval/valid/formal-approved.yaml

# Ownership (necesita un repo git; --repo para apuntar a otro)
npm run -s agentkit -- check-diff-ownership --task ../../fixtures/task/valid/backend-1.md --base main

# Gobernanza
npm run -s agentkit -- evaluate-policies --task <task> --policies ../../fixtures/policy/valid
npm run -s agentkit -- check-approvals   --feature invoices --approvals <dir> --task <task> --now 2026-06-24T12:00:00Z

# Planificación / integración (solo lectura)
npm run -s agentkit -- validate-plan       --tasks ../../fixtures/plans/valid-3
npm run -s agentkit -- integration-report  --feature demo --tasks ../../fixtures/integration/ready/tasks --verdicts ../../fixtures/integration/ready/verdicts --now 2026-06-24T12:00:00Z
npm run -s agentkit -- integration-plan    --feature demo --tasks ../../fixtures/integration/ready/tasks --verdicts ../../fixtures/integration/ready/verdicts --now 2026-06-24T12:00:00Z

# Evals
npm run -s agentkit -- eval
```

---

## 3. Flujo operativo completo de una feature

1. **Crear task** con frontmatter canónico (ver §9 y `templates/task.template.md`).
2. **Validar task:** `agentkit validate-task tasks/<id>.md`.
3. **Crear contratos / verdicts** si aplica (`contracts/<feature>/`, `verdicts/<id>/`).
4. **Implementar** dentro del `owns:` del task.
5. **Ownership:** `agentkit check-diff-ownership --task tasks/<id>.md --base main` (o `--staged`).
6. **Policies:** `agentkit evaluate-policies --task tasks/<id>.md --policies policies/`.
7. **Approvals** si aplican: crear `approvals/<feature>/<id>.yaml`; `agentkit check-approvals …`.
8. **Plan/DAG:** `agentkit validate-plan --tasks tasks/`.
9. **Readiness:** `agentkit integration-report --feature <f> --tasks tasks/ --verdicts verdicts/ [--policies …] [--approvals …]`.
10. **Plan sugerido:** `agentkit integration-plan …` (mismos flags).
11. **El humano revisa** el plan y **decide si ejecuta** los comandos manualmente. agentkit no integra.

---

## 4. Artefactos y ubicación

| Ruta | Contenido | ¿Ignorado por check-diff? |
|---|---|---|
| `tasks/` | tasks (frontmatter canónico) | sí (control) |
| `contracts/` | contratos congelados (data/api/types + manifest) | sí |
| `verdicts/` | veredictos de audit/security (plan y cierre) | sí |
| `policies/` | policies de gobernanza | sí |
| `approvals/` | approval records HITL (`<feature>/<id>.yaml`) | sí |
| `.agent-runs/` | run logs JSONL | sí |
| `evals/` | `cases/` (golden) + `results/` (vacío por default) | n/a |
| `fixtures/` | fixtures válidos/inválidos por tipo | n/a |
| `schemas/` | JSON Schemas (fuente canónica) | n/a |
| `tools/agentkit/` | CLI + libs + tests | n/a |

`tasks/contracts/verdicts/policies/approvals/.agent-runs` son **artefactos de control**: `check-diff-ownership`
los ignora por default (valida el diff de implementación). Usa `--strict-artifacts` para incluirlos.

---

## 5. Comandos por categoría

**Validación:** `validate-task`, `validate-policy`, `validate-approval`, `validate-run-log`,
`validate-integration-report` (+ `validate-contract`, `validate-verdict`, `validate-ownership`, `validate-run-event`).
**Ownership:** `check-diff-ownership`.
**Policies:** `evaluate-policies`.
**Approvals:** `check-approvals`.
**Planificación:** `validate-plan`, `graph`, `status`, `next`.
**Trazabilidad:** `append-run-event`, `validate-run-log`.
**Integración (solo lectura):** `integration-report`, `integration-plan`.
**Evals:** `eval`.
**Diagnóstico:** `doctor`.

---

## 6. Exit codes (patrón general)

| Code | Significado | Ejemplo |
|---|---|---|
| `0` | OK / sin bloqueo | task válido; ownership en scope; feature ready |
| `1` | bloqueo esperado o validación fallida | ownership violation; policy blocked; approval missing; not ready; schema inválido |
| `2` | error operacional | dir/archivo inexistente; git ausente; base branch inexistente; `--now`/`--threshold` inválido |

Diseñado para CI: un `1` significa "el sistema bloqueó algo correctamente o el artefacto es inválido";
un `2` significa "no se pudo evaluar" (arreglar el input/entorno).

---

## 7. Limitaciones conocidas

- **secret scanning es heurístico** (best-effort): falsos negativos posibles; **nunca afirma ausencia** de secretos.
- **approvals son YAML editables**: evidencia auditable versionada, **no** autorización/control de acceso real; su integridad depende de git y la revisión humana.
- **ownership en integration-report** usa *union de owns vs diff* (detecta archivos sin owner del feature); no re-verifica disjunción entre tasks.
- **sub-declaración (BS-6)**: ningún check mecánico detecta un archivo de integración que nadie declaró y que aún no está en el diff. Límite estructural (CANON §9).
- **branch mapping no modelado**: `integration-plan` usa placeholders `<branch-for-<id>>`; reemplázalos manualmente.
- **`--now`** permite determinismo (expiración de approvals, `generated_at`); sin él se usa la hora real.
- **three-dot diff** (`<base>...HEAD`) no ve cambios sin commitear; usa `--staged` para el index.
- **binario `agentkit` robusto** diferido: se invoca vía `npm run -s agentkit --` (tsx, sin build).
- **integration-plan** no tiene schema propio (es objeto derivado del report).

---

## 8. Estado implementado vs diseñado

### Implemented now

schemas canónicos · tipos generados (drift-gated) · loaders · CLI · CI · `validate-*` · `doctor` ·
`check-diff-ownership` (`--repo`/`--staged`/`--strict-artifacts`) · run logs JSONL (`validate-run-log`,
`append-run-event`) · DAG de solo lectura (`graph`/`status`/`next`/`validate-plan`) · evals (`eval`) ·
policies (`evaluate-policies`, secret-scan heurístico) · approvals (`check-approvals`) ·
`integration-report` · `integration-plan` sugerido.

### Designed but not implemented

RBAC · firmas criptográficas · dashboard · GitHub Checks avanzados · almacenamiento externo de run logs ·
secret scanning robusto · tracking de model/cost/latency · LLM judge · auto-remediation · merge automático ·
deploy automático.

---

## 9. Ejemplos mínimos

**Task canónico** (`tasks/backend-1.md`):
```yaml
---
id: backend-1
feature: invoices
title: Endpoint POST /invoices
lane: backend
agent: backend
status: planned
profile: lite
zones: ["🟢"]
risk_level: low
depends_on: [db-1]
owns: ["src/routes/invoices.ts", "tests/routes/invoices.test.ts"]
contracts: ["contracts/invoices/"]
gates: { audit_f1: required, security_f1: required, audit_f2: required, security_f2: required }
evidence_required: [tests, typecheck, ownership_check]
acceptance_criteria: ["POST /invoices responde 201 con el recurso"]
---
# cuerpo libre: contexto, non-goals, plan
```

**Policy simple** (`policies/no-secrets.yaml`):
```yaml
id: no-secrets
title: Sin secretos en el diff
severity: CRITICAL
status: active
block_condition: secret_pattern
approval_required: formal
responsible_agent: security
```

**Approval formal** (`approvals/invoices/APR-001.yaml`):
```yaml
approval_id: APR-001
feature_id: invoices
scope: "Migración de schema (zona 🟠)"
risk_level: high
approval_type: formal
requested_by: dev@example.com
approved_by: lead@example.com
decision: approved
timestamp: "2026-06-24T10:00:00Z"
expiration: "2026-12-31T00:00:00Z"
```

**Run event** (línea de `.agent-runs/<run>.jsonl`):
```json
{"run_id":"run-01","timestamp":"2026-06-24T10:00:00Z","event_type":"run_started","severity":"info","feature_id":"invoices"}
```

**integration-report** (resumen): `✓ READY` con checks `validate-plan/tasks-completed/closure-verdicts =
pass` y `ownership/policies/approvals = skipped` cuando no se pasan; `merge_order: [db-1, backend-1]`.

**integration-plan output** (resumen, ready): secciones *Prerequisites*, *Suggested merge order*,
*Suggested commands* (texto, header `# Suggested only — not executed by agentkit`, `git merge --no-ff
<branch-for-backend-1>`), *Warnings*, *Human checklist*. Exit 0. Si NOT READY: lista *Blockers* y exit 1.

---

## 10. Runbook de troubleshooting

| Síntoma | Significa | Investigar | Acción |
|---|---|---|---|
| **task no valida** (exit 1) | falta campo / enum inválido / campo espurio | `validate-task tasks/<id>.md` (lee los `-` con el motivo) | corrige el frontmatter contra `schemas/task.schema.json` |
| **ownership violation** (exit 1) | un archivo del diff está fuera del `owns:` | `check-diff-ownership --task … --base main` | añade el path al `owns:` o sepáralo en otra task |
| **policy blocked** (exit 1) | una policy active disparó y bloquea | `evaluate-policies --task … --policies policies/` | resuelve la causa (p.ej. quita el secreto) o ajusta la policy |
| **approval missing/expired** (exit 1) | falta approval suficiente / venció | `check-approvals --feature … --approvals … --now <iso>` | crea/renueva el approval (`decision: approved`, tipo ≥ requerido) |
| **plan invalid** (exit 1) | ciclo / dep faltante / id duplicado / task inválida | `validate-plan --tasks tasks/` (o `graph`) | rompe el ciclo / corrige `depends_on` / dedup ids |
| **missing verdict** (integration not ready) | gate `*_f2: required` sin `CIERRE APROBADO` | `integration-report … --verdicts verdicts/` | añade el verdict de cierre aprobado o ajusta el gate |
| **integration not ready** (exit 1) | algún check fail / blockers | `integration-report … --json` | resuelve cada blocker listado |
| **eval failing** (exit 1) | una capacidad crítica regresó | `eval --case <id>` | arregla la regresión que el caso señala |
| **drift de tipos** (CI rojo) | `src/types/generated` no coincide con schemas | `npm run generate:types && git diff` | `generate:types` y commitea los tipos |
| **doctor FAIL** | falta schema/fixture/instalación/git | `agentkit doctor` (mira el ✗) | `npm ci` / restaura lo que falte |

---

## 11. Roadmap posterior a E5 (no implementado)

Pasos posibles, **sin compromiso ni implementación**:

- `push` remoto cuando el usuario lo apruebe explícitamente.
- limpieza de ramas `feature/*` antiguas.
- publicar package / binario `agentkit` robusto.
- segundo piloto real con un proyecto externo.
- GitHub Checks · secret scanning robusto · dashboards.
- RBAC / firmas de approvals · almacenamiento externo de run logs.
- hardening del integrator (atribución de blockers por-task, schema de integration-plan).

---
# Frontmatter YAML (canónico, parseable). Valida con: agentkit validate-task <este-archivo>
# Esquema: schemas/task.schema.json. NO incluye campos de runtime/event-log (run_id, model,
# tokens, cost, timestamps, verdicto real): esos viven en el log de ejecución, no en el task.
id: <lane>-<n>                     # ej. backend-1 (o pre-step nombrado: shared-x)
feature: <feature-slug>
title: <título humano corto>
lane: <db | backend | frontend>
agent: <backend | frontend | db | architect | audit | security | integrator | deploy | responsive | git | orchestrator>
status: <draft | planned | in_progress | blocked | completed | rejected>
profile: <lite | full>
zones: ["🟢"]                       # 🟠/🟡 ⇒ protocolo de excepción y NO paralelizable
risk_level: <low | medium | high | critical>
depends_on: []                     # [<task-id>, ...] → orden de merge topológico
owns:                              # OWNERSHIP EXCLUSIVO — fuente ÚNICA; ownership.md se deriva
  - <path/al/archivo-1>
  - <path/glob/**>
contracts: []                      # ["contracts/<feature>/"] congelados de los que depende (CANON §8)
gates:                             # required | optional | skipped
  audit_f1: required
  security_f1: required
  audit_f2: required
  security_f2: required
evidence_required:                 # tests | typecheck | ownership_check | security_review | screenshots | migration_test
  - tests
  - typecheck
acceptance_criteria:               # verificables, sin juicio subjetivo
  - <CA 1>
# notes: opcional (o usa el cuerpo Markdown)
---

# TASK <id> — <title>

> Handoff durable de una tarea. Los **campos meta** viven en el frontmatter (parseable); este cuerpo
> es prosa libre: contexto, non-goals, plan y notas humanas. El estado del pipeline vive AQUÍ, no en
> la conversación, para que la tarea corra en su propio worktree/sesión.
>
> Convención operativa: rama `<lane>/<id>`, worktree `../wt-<id>`.

## Estado del pipeline  (lo escriben los agentes en orden; NO la conversación)

- [ ] architect   →  (pega aquí el veredicto/plan o un link)
- [ ] audit (F1)  →  VEREDICTO DE PLAN: ___          (artefacto: verdicts/<id>/plan.yaml)
- [ ] security(F1)→  VEREDICTO DE SEGURIDAD: ___      (artefacto: verdicts/<id>/security.yaml)
- [ ] gate humano →  (lite: heredado del feature | full: confirmación aquí)
- [ ] builder     →  LISTO PARA AUDITORÍA DE CIERRE
- [ ] audit (F2)  →  VEREDICTO DE CIERRE: ___          (artefacto: verdicts/<id>/closure-audit.yaml)
- [ ] security(F2)→  VEREDICTO DE SEGURIDAD (CIERRE): ___
- [ ] git         →  rama <lane>/<id>, PR #___
- [ ] integrado   →  merged por /integrator en <commit>

## Notas / deuda
- ...

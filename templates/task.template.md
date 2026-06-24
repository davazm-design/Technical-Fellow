---
# Frontmatter YAML (canónico, parseable). Valida con: agentkit validate task <este-archivo>
# Esquema: schemas/task.schema.json
id: <lane>-<n>                     # ej. backend-1, frontend-2, db-1 (o pre-step nombrado: shared-x)
lane: <db | backend | frontend>
feature: <feature-slug>
contract: contracts/<feature>/     # contrato del que depende (congelado, CANON §8)
profile: <lite | full>
zones: ["🟢"]                       # array. 🟠/🟡 ⇒ requiere protocolo de excepción y NO es paralelizable
depends_on: []                     # [<task-id>, ...] → define el orden de merge topológico
worktree: ../wt-<id>
branch: <lane>/<id>
owns:                              # OWNERSHIP EXCLUSIVO — fuente ÚNICA; ownership.md se deriva de aquí
  - <path/al/archivo-1>
  - <path/al/archivo-2>
objetivo: |
  Una frase. Qué entrega esta tarea.
---

# TASK <id>

> Handoff durable de una tarea. El estado del pipeline vive AQUÍ (no en la conversación), para que la
> tarea corra en su propio worktree/sesión. Los **campos meta** viven en el frontmatter de arriba
> (parseable); el cuerpo de abajo es prosa libre que escriben los agentes.

## Estado del pipeline  (lo escriben los agentes en orden; NO la conversación)

- [ ] architect   →  (pega aquí el veredicto/plan o un link)
- [ ] audit (F1)  →  VEREDICTO DE PLAN: ___          (artefacto: verdicts/<id>/plan.yaml)
- [ ] security(F1)→  VEREDICTO DE SEGURIDAD: ___      (artefacto: verdicts/<id>/security.yaml)
- [ ] gate humano →  (lite: heredado del feature | full: confirmación aquí)
- [ ] builder     →  LISTO PARA AUDITORÍA DE CIERRE
- [ ] audit (F2)  →  VEREDICTO DE CIERRE: ___          (artefacto: verdicts/<id>/closure-audit.yaml)
- [ ] security(F2)→  VEREDICTO DE SEGURIDAD (CIERRE): ___
- [ ] git         →  rama <branch>, PR #___
- [ ] integrado   →  merged por /integrator en <commit>

## Notas / deuda
- ...

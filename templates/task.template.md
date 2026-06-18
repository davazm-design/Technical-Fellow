# TASK <id>

> Handoff durable de una tarea. Reemplaza "debe existir en el hilo" — el estado del pipeline vive
> AQUÍ, no en la conversación, para que la tarea corra en su propio worktree/sesión.

meta:
  id: <lane>-<n>            # ej. backend-1, frontend-2, db-1
  lane: <db | backend | frontend>
  feature: <feature-slug>
  contract: contracts/<feature>/   # contrato del que depende (congelado)
  profile: <lite | full>
  zones: <🟢 | 🟠 | 🟡>     # si 🟠/🟡 → requiere protocolo de excepción y NO es paralelizable
  depends_on: [<task-id>, ...]     # o []  → define el orden de merge topológico
  worktree: ../wt-<id>
  branch: <lane>/<id>

owns:                        # OWNERSHIP EXCLUSIVO — ningún otro task paralelo toca estos archivos
  - <path/al/archivo-1>
  - <path/al/archivo-2>

objetivo: |
  Una frase. Qué entrega esta tarea.

## Estado del pipeline  (lo escriben los agentes en orden; NO la conversación)

- [ ] architect   →  (pega aquí el veredicto/plan o un link)
- [ ] audit (F1)  →  VEREDICTO DE PLAN: ___
- [ ] security(F1)→  VEREDICTO DE SEGURIDAD: ___
- [ ] gate humano →  (lite: heredado del feature | full: confirmación aquí)
- [ ] builder     →  LISTO PARA AUDITORÍA DE CIERRE
- [ ] audit (F2)  →  VEREDICTO DE CIERRE: ___
- [ ] security(F2)→  VEREDICTO DE SEGURIDAD (CIERRE): ___
- [ ] git         →  rama <branch>, PR #___
- [ ] integrado   →  merged por /integrator en <commit>

## Notas / deuda
- ...

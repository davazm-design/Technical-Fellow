# schemas/ — contrato máquina del parallel-dev-kit

Estos JSON Schemas (draft 2020-12) son la **traducción mecánica del CANON**: convierten reglas en
prosa en gates verificables. Igual que los slash commands son la traducción operativa del CANON, estos
schemas son su traducción ejecutable. **Si un schema contradice al CANON, el CANON prevalece y el
schema debe corregirse.**

Se validan con `agentkit validate <tipo> <archivo>` (ver `tools/agentkit/`). Cada schema tiene
fixtures válidos e inválidos en `fixtures/<tipo>/{valid,invalid}/`.

## Artefactos

| Schema | Artefacto | CANON | Fuente de verdad |
|---|---|---|---|
| `task.schema.json` | Task (frontmatter YAML de `tasks/<id>.md`) | §2.1, §9 | **Sí** — el `owns:` es la verdad de ownership |
| `ownership.schema.json` | Mapa de ownership del feature | §9, PASO 2.5 | **Derivado** de los tasks (vista validada) |
| `contract.schema.json` | Manifiesto del Contrato Compartido | §8 | Manifiesto; los artefactos (api/types/data) viven aparte |
| `verdict.schema.json` | Veredicto de Auditor/Security | §2.3, §2.4, §3 | Reemplaza el bloque de prosa del task |
| `run-event.schema.json` | Evento de ejecución (línea JSONL) | §10 | Append-only log |

## Decisiones de diseño (trade-offs)

1. **Task = frontmatter YAML real.** El formato canónico anterior era pseudo-YAML embebido en prosa, no
   parseable. Se migró a un bloque `---` al inicio del `.md` (humano + parseable). El cuerpo markdown
   (pipeline, notas) queda libre. Decisión confirmada con el operador.

2. **Ownership derivado, no duplicado.** El `owns:` de cada task es la fuente única; `ownership.md` es
   una vista. Esto mata el drift entre dos declaraciones del mismo archivo (riesgo raíz). El schema de
   ownership describe la *forma* de esa vista derivada, incluyendo el checklist duro de archivos de
   integración (CANON §9 / BS-6).

3. **Contract = manifiesto, no re-validación.** No re-validamos OpenAPI ni los tipos TS aquí (cada uno
   tiene su tooling). El schema declara qué artefactos componen el contrato, su versión y si está
   `frozen` (y exige `frozen_at` cuando lo está). Congelar sin sello no es auditable.

4. **Verdict discriminado por fase.** Las tres fases del CANON usan vocabularios distintos
   (plan: `APROBADO…`; security: `PASS…`; cierre: `CIERRE…`). Se modela con `allOf` + `if/then` sobre
   `phase`, manteniendo los enums **literalmente** como el CANON los define (incluido el español).

5. **`additionalProperties: false` en task/ownership/contract.** Atrapa typos y campos espurios (un
   `assignee:` mal puesto falla en vez de pasar silenciosamente). RunEvent también es cerrado para que
   el log no acumule campos no documentados.

6. **IDs.** Patrón `^[a-z0-9]+(-[a-z0-9]+)*$`: cubre la convención `<lane>-<n>` (backend-1) y los
   pre-steps nombrados (`shared-user-context`). `lane` sí es enum estricto (`db|backend|frontend`).

## Limitaciones conocidas (honestas)

- El schema valida **forma**, no semántica global. No detecta, por sí solo, que dos tasks paralelos
  declaren el mismo archivo (eso es el cruce de ownership → Bloque B, `check-diff-ownership`) ni la
  **sub-declaración** de un archivo de integración no listado (CANON §9 / BS-6: ningún check mecánico
  puede inferir un archivo que nadie nombró y que aún no está en el diff).
- `contract.schema.json` no garantiza que las rutas en `artifacts` existan en disco (eso es trabajo del
  `doctor`, Bloque B).

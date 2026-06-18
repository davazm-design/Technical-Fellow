# Memoria operativa

Ledgers append-only que dan contexto histórico al sistema. **NO son fuente de verdad** — ante
conflicto con el repo real, el repo prevalece (CANON §10, §11).

| Archivo | Quién escribe | Qué registra |
|---|---|---|
| `decisions/<task-id>.md` | builders, /git (por tarea) | cambios cerrados con éxito, hashes, PRs — **un archivo por tarea** para evitar colisión de merge entre tareas paralelas |
| `decisions.md` | /integrator (consolida) | ledger global; el Integrator fusiona los `decisions/<task>.md` al cerrar el feature |
| `vetoes.md` | Auditor, Security | planes/ejecuciones rechazadas, con severidad |
| `contradictions.md` | Auditor, Security | sobreventa del builder (afirmación ≠ evidencia) |
| `blind_spots.md` | Auditor, Security | omisiones propias detectadas post-hoc. **Lectura obligatoria al inicio de cada Función 1.** |

## Por qué `decisions/` es un directorio (no un archivo)

En el modelo paralelo, varias tareas escriben "decisión cerrada" a la vez. Si todas apuntaran a un
solo `decisions.md`, colisionarían en el merge. Cada tarea escribe a `decisions/<task-id>.md`; el
`/integrator` los consolida secuencialmente al ensamblar el feature. Fuera de la ventana paralela, la
memoria vuelve a ser de un solo escritor.

## Regla de contenido (no negociable)
Sin PII, sin secretos, sin datos de clientes reales. Sólo descripciones técnicas de patrones,
referencias archivo:línea, y lecciones. Sanitiza `|`→`\|`, dedup.

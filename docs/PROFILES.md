# Perfiles de rigor: `lite` vs `full`

El sistema de gobernanza tiene overhead. Para producto crítico (datos sensibles, multi-tenant) ese
overhead se paga con gusto. Para un MVP o un dashboard interno, te mata el throughput. Por eso el
rigor es **modulable por perfil**, declarado por el `/orchestrator` en cada tarea (`profile:` en
`tasks/<id>.md`) y justificado.

| Dimensión | `lite` | `full` |
|---|---|---|
| Gate humano | A nivel **feature** (apruebas el Contrato una vez; slices 🟢 corren sin gate individual) | A nivel **slice** (cada tarea requiere aprobación humana tras audit+security) |
| `/audit` modo adversarial periódico | Off | On (cada N tareas) |
| Mecanismos diferidos (re-auditoría de contratos, meta-auditoría) | Off | On |
| Threat model | Sólo si toca auth/datos/endpoints | Siempre que toque 🟠/🟡 o cualquier superficie nueva |
| Domain packs (compliance, multitenant) | Opcionales | Obligatorios si declarados en `kit.config.yaml` |
| Niveles de test exigidos | 1–3 | 1–4 (incluye integración operativa) |
| Memoria | `decisions/<task>.md` por tarea | igual + `vetoes`/`contradictions`/`blind_spots` |

## Reglas duras (aplican en AMBOS perfiles, no negociables)

Estas nunca se relajan, ni en `lite`:

- Separación propuesta/ejecución/validación. Nadie cierra su propio trabajo.
- Zonas 🔴 jamás se tocan. Zonas 🟠/🟡 requieren protocolo de excepción.
- Contrato de verdad: evidencia, no intención. Prohibido "Resuelto" sin comando que lo pruebe.
- Ownership de archivos disjunto entre tareas paralelas.
- Scan anti-secretos antes de cualquier commit.

## Quién elige el perfil

El `/orchestrator` asigna el perfil por tarea y lo justifica. Regla por defecto:

- Toca 🟠/🟡, auth, PII, o un domain pack obligatorio → `full`.
- Todo lo demás (CRUD 🟢, UI, dashboards) → `lite`.

El humano puede forzar `full` siempre; forzar `lite` sobre algo que el orchestrator marcó `full`
requiere justificación explícita (queda en el task file).

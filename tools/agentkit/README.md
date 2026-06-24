# agentkit

CLI y validadores mecánicos del `parallel-dev-kit` — la **traducción ejecutable del CANON**. Convierte
reglas en prosa (ownership, estados, contratos) en gates verificables con exit codes para humanos y CI.

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
```

- `--base <branch>` → `git diff --name-only <branch>...HEAD` (el diff "estilo PR": lo que la rama
  introdujo desde que divergió de la base). Default: `main`.
- `--staged` → `git diff --name-only --cached` (ignora `--base`).

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

Tras este bloque (CI + tipos + loaders) el siguiente paso recomendado es **validar el sistema con un
feature piloto real** antes de avanzar a event logs / orquestador (Bloque D).

## Limitaciones conocidas (Bloques B–C)

- `check-diff-ownership` detecta archivos tocados **fuera** del scope, no la **sub-declaración** de un
  archivo de integración que nadie listó y que aún no está en el diff (CANON §9 / blind_spots BS-6:
  ningún check mecánico puede inferirlo).
- **No** cruza zonas críticas (🟠/🟡) contra un permiso por-archivo: el `task.schema` aún no modela un
  permiso `critical` por path. Queda diferido (requeriría leer `kit.config.yaml`); se evaluará en un
  bloque posterior. Hoy `zones` es informativo a nivel task.
- Glob matching vía `picomatch` (dependencia de runtime, zero-dep transitivo): se eligió en vez de
  implementar `**`/`*`/charclasses a mano por corrección.

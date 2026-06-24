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

## Limitaciones conocidas (Bloque B)

- `check-diff-ownership` detecta archivos tocados **fuera** del scope, no la **sub-declaración** de un
  archivo de integración que nadie listó y que aún no está en el diff (CANON §9 / blind_spots BS-6:
  ningún check mecánico puede inferirlo).
- **No** cruza zonas críticas (🟠/🟡) contra un permiso por-archivo: el `task.schema` aún no modela un
  permiso `critical` por path. Queda diferido (requeriría leer `kit.config.yaml`); se evaluará en un
  bloque posterior. Hoy `zones` es informativo a nivel task.
- Glob matching vía `picomatch` (dependencia de runtime, zero-dep transitivo): se eligió en vez de
  implementar `**`/`*`/charclasses a mano por corrección.

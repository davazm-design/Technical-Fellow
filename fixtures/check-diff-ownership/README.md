# Fixtures de check-diff-ownership

`check-diff-ownership` cruza el `owns:` de un task contra un **diff de git real**, así que el
veredicto PASS/FAIL depende del estado del repo, no sólo del archivo. Estos fixtures son los **tasks**
que modelan cada escenario; la verificación contra un diff real (rama efímera + commits) vive en
`tools/agentkit/test/integration.test.ts`, que construye el repo de prueba de forma determinista.

- `passing.md` — owns amplio (`src/**`, `tests/**`): cualquier cambio bajo esos paths queda en scope.
- `failing.md` — owns estrecho (`src/invoices/**`): un cambio en `src/billing/**` cae fuera de scope.

Escenario de referencia (replicado en el test): la rama toca `src/invoices/pricing.ts` y
`src/billing/out.ts`. Contra `passing.md` → PASS; contra `failing.md` → FAIL por `src/billing/out.ts`.

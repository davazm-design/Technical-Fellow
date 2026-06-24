---
id: backend-1
lane: backend
feature: invoices
contract: contracts/invoices/
profile: lite
zones: ["🟢"]
depends_on: [db-1]
worktree: ../wt-backend-1
branch: backend/backend-1
owns:
  - src/routes/invoices.ts
  - tests/routes/invoices.test.ts
objetivo: |
  Implementar el endpoint POST /invoices contra el contrato congelado.
---
# TASK backend-1

> Ejemplo VÁLIDO: task con frontmatter YAML real. El cuerpo markdown es libre.

## Estado del pipeline
- [ ] architect → ___
- [ ] audit (F1) → ___

---
id: backend-1
feature: invoices
title: Endpoint POST /invoices
lane: backend
agent: backend
status: planned
profile: lite
zones: ["🟢"]
risk_level: low
depends_on: [db-1]
owns:
  - src/routes/invoices.ts
  - tests/routes/invoices.test.ts
contracts: ["contracts/invoices/"]
gates:
  audit_f1: required
  security_f1: required
  audit_f2: required
  security_f2: required
evidence_required:
  - tests
  - typecheck
  - ownership_check
acceptance_criteria:
  - POST /invoices crea una factura y responde 201 con el recurso.
  - El body se valida en el boundary (additionalProperties:false).
notes: Ejemplo VÁLIDO con frontmatter YAML real; el cuerpo es libre.
---
# TASK backend-1 — Endpoint POST /invoices

> Cuerpo markdown libre: contexto, non-goals, plan.

## Estado del pipeline
- [ ] architect → ___
- [ ] audit (F1) → ___

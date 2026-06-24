---
id: backend-1
lane: backend
feature: invoices
contract: contracts/invoices/
profile: lite
zones: ["🟢"]
depends_on: []
owns:
  - src/invoices/**
  - tests/invoices/**
objetivo: Task con ownership estrecho; un cambio en src/billing/** cae fuera de scope.
---
# TASK backend-1 (fixture FAILING para check-diff-ownership)

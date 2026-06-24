---
id: backend-1
feature: invoices
title: Ownership estrecho (fixture FAILING)
lane: backend
agent: backend
status: in_progress
profile: lite
zones: ["🟢"]
risk_level: low
depends_on: []
owns:
  - src/invoices/**
  - tests/invoices/**
contracts: ["contracts/invoices/"]
gates:
  audit_f1: required
  security_f1: required
  audit_f2: required
  security_f2: required
evidence_required: [tests, ownership_check]
acceptance_criteria: ["un cambio en src/billing/** cae fuera de scope"]
---
# TASK backend-1 (fixture FAILING para check-diff-ownership)

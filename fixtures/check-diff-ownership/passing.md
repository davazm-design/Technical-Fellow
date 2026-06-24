---
id: backend-1
feature: invoices
title: Ownership amplio (fixture PASSING)
lane: backend
agent: backend
status: in_progress
profile: lite
zones: ["🟢"]
risk_level: low
depends_on: []
owns:
  - src/**
  - tests/**
contracts: ["contracts/invoices/"]
gates:
  audit_f1: required
  security_f1: required
  audit_f2: required
  security_f2: required
evidence_required: [tests, ownership_check]
acceptance_criteria: ["todo cambio bajo src/ y tests/ queda en scope"]
---
# TASK backend-1 (fixture PASSING para check-diff-ownership)

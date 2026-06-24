// Punto único de import de los tipos del kit. Re-exporta los tipos GENERADOS desde los JSON Schema
// (fuente canónica). No edites src/types/generated/ a mano; corre `npm run generate:types`.
export type { Task } from "./generated/task.js";
export type { OwnershipMap } from "./generated/ownership.js";
export type { ContractManifest } from "./generated/contract.js";
export type { Verdict } from "./generated/verdict.js";
export type { RunEvent } from "./generated/run-event.js";
export type { Policy } from "./generated/policy.js";
export type { Approval } from "./generated/approval.js";
export type { IntegrationReport } from "./generated/integration-report.js";

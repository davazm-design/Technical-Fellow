import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadTask } from "../lib/loaders.js";
import { loadPoliciesFromDir } from "../lib/policy.js";
import { loadApprovalsFromDir, requiredApproval, checkApprovals } from "../lib/approval.js";

const USAGE =
  "uso: agentkit check-approvals --feature <id> --approvals <dir> --task <file> [--policies <dir>] [--now <iso>] [--json]\n";

/** agentkit check-approvals. Exit: 0 suficientes, 1 faltantes/pending/rejected/expired, 2 operacional. */
export function runCheckApprovals(argv: string[]): number {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        feature: { type: "string" },
        approvals: { type: "string" },
        task: { type: "string" },
        policies: { type: "string" },
        now: { type: "string" },
        json: { type: "boolean", default: false },
      },
      allowPositionals: false,
    }));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n\n${USAGE}`);
    return 2;
  }

  const { feature, approvals, task, policies, now, json } = values;
  if (!feature || !approvals || !task) {
    process.stderr.write(USAGE);
    return 2;
  }

  // --now determinista (default: ahora).
  let nowDate: Date;
  if (now !== undefined) {
    nowDate = new Date(now);
    if (Number.isNaN(nowDate.getTime())) {
      process.stderr.write(`--now inválido (ISO date): ${now}\n`);
      return 2;
    }
  } else {
    nowDate = new Date();
  }

  if (!existsSync(task)) {
    process.stderr.write(`task no encontrado: ${task}\n`);
    return 2;
  }
  // task inválido = operacional (E2: schema inválido de task/approval/policy → exit 2).
  const loadedTask = loadTask(task);
  if (!loadedTask.ok) {
    process.stderr.write(`error operacional: task inválido: ${task}\n`);
    for (const e of loadedTask.errors) process.stderr.write(`    - ${e}\n`);
    return 2;
  }
  const t = loadedTask.data;

  // Approvals (dir inexistente / approval inválida → operacional).
  let loadedApprovals;
  try {
    loadedApprovals = loadApprovalsFromDir(approvals);
  } catch (e) {
    process.stderr.write(`error operacional: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  if (loadedApprovals.invalid.length > 0) {
    process.stderr.write("error operacional: approvals inválidas:\n");
    for (const inv of loadedApprovals.invalid) {
      process.stderr.write(`  ✗ ${inv.file}\n`);
      for (const e of inv.errors) process.stderr.write(`      - ${e}\n`);
    }
    return 2;
  }

  // Policies opcionales para derivar requerimiento.
  let activePolicies: import("../types/index.js").Policy[] = [];
  if (policies !== undefined) {
    let loadedPolicies;
    try {
      loadedPolicies = loadPoliciesFromDir(policies);
    } catch (e) {
      process.stderr.write(`error operacional: ${e instanceof Error ? e.message : String(e)}\n`);
      return 2;
    }
    if (loadedPolicies.invalid.length > 0) {
      process.stderr.write("error operacional: policies inválidas:\n");
      for (const inv of loadedPolicies.invalid) process.stderr.write(`  ✗ ${inv.file}\n`);
      return 2;
    }
    activePolicies = loadedPolicies.policies.filter((p) => p.status === "active");
  }

  const requirement = requiredApproval(t, activePolicies);
  const result = checkApprovals(t, feature, loadedApprovals.approvals, requirement, nowDate);

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return result.ok ? 0 : 1;
  }

  if (requirement.level === "none") {
    process.stdout.write("✓ approvals OK\n✓ no se requiere aprobación humana para este task\n");
    return 0;
  }

  if (result.ok) {
    process.stdout.write("✓ approvals OK\n");
    process.stdout.write(`✓ requerido: ${result.required} (${result.requirement_reasons.join("; ")})\n`);
    process.stdout.write(`✓ satisfecho por: ${result.satisfied_by}\n`);
    return 0;
  }

  process.stdout.write("✗ approval requerido no satisfecho\n");
  process.stdout.write(`\nRequerido: ${result.required}\nMotivo: ${result.requirement_reasons.join("; ")}\n`);
  process.stdout.write(`Feature: ${feature}  Task: ${t.id}\n`);
  if (result.findings.length) {
    process.stdout.write("Approvals revisadas:\n");
    for (const f of result.findings) process.stdout.write(`  - ${f}\n`);
  }
  process.stdout.write(`\nAcción requerida: obtén una approval ${result.required} (decision=approved, no expirada) para este feature.\n`);
  return 1;
}

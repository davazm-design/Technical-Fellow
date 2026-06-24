import { parseArgs } from "node:util";
import { buildIntegrationReport } from "../lib/integration.js";

const USAGE =
  "uso: agentkit integration-report --feature <id> --tasks <dir> [--verdicts <dir>] [--policies <dir>]\n" +
  "       [--approvals <dir>] [--repo <path>] [--base <branch>] [--now <iso>] [--json]\n";

/** agentkit integration-report. SOLO LECTURA. Exit: 0 ready, 1 not ready, 2 operacional. */
export function runIntegrationReport(argv: string[]): number {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        feature: { type: "string" },
        tasks: { type: "string" },
        verdicts: { type: "string" },
        policies: { type: "string" },
        approvals: { type: "string" },
        repo: { type: "string" },
        base: { type: "string", default: "main" },
        now: { type: "string" },
        json: { type: "boolean", default: false },
      },
      allowPositionals: false,
    }));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n\n${USAGE}`);
    return 2;
  }

  const { feature, tasks, verdicts, policies, approvals, repo, base, now, json } = values;
  if (!feature || !tasks) {
    process.stderr.write(USAGE);
    return 2;
  }
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

  let report;
  try {
    report = buildIntegrationReport({
      feature,
      tasksDir: tasks,
      verdictsDir: verdicts,
      policiesDir: policies,
      approvalsDir: approvals,
      repo,
      base,
      now: nowDate,
    });
  } catch (e) {
    process.stderr.write(`error operacional: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }

  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return report.ready ? 0 : 1;
  }

  process.stdout.write(`integration-report — feature ${report.feature}\n`);
  process.stdout.write(`${report.ready ? "✓ READY" : "✗ NOT READY"}\n\n`);
  process.stdout.write("Checks:\n");
  for (const c of report.checks) {
    const mark = c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "·";
    process.stdout.write(`  ${mark} ${c.name.padEnd(20)} ${c.status}${c.detail ? ` — ${c.detail}` : ""}\n`);
  }
  process.stdout.write(`\nOrden de merge sugerido (DAG): ${report.merge_order.join(" → ") || "(vacío)"}\n`);
  process.stdout.write("\nTasks:\n");
  for (const t of report.tasks) {
    process.stdout.write(`  ${t.ready_for_integration ? "✓" : "✗"} ${t.id} [${t.status}]\n`);
    for (const b of t.blockers) process.stdout.write(`      - ${b}\n`);
  }
  if (report.blockers.length) {
    process.stdout.write("\nBlockers:\n");
    for (const b of report.blockers) process.stdout.write(`  - ${b}\n`);
  }
  return report.ready ? 0 : 1;
}

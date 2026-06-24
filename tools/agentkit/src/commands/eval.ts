import { parseArgs } from "node:util";
import { runEvals, EvalOperationalError } from "../lib/evals.js";

/** agentkit eval [--case <id>] [--json]. Exit: 0 todas las métricas críticas pasan, 1 falla, 2 operacional. */
export function runEvalCommand(argv: string[]): number {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { case: { type: "string" }, json: { type: "boolean", default: false } },
      allowPositionals: false,
    }));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }

  let report;
  try {
    report = runEvals(values.case);
  } catch (e) {
    if (e instanceof EvalOperationalError) {
      process.stderr.write(`error operacional: ${e.message}\n`);
      return 2;
    }
    throw e;
  }

  if (values.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return report.ok ? 0 : 1;
  }

  process.stdout.write("agentkit eval — capacidades críticas del kit\n\n");
  for (const r of report.results) {
    const mark = r.passed ? "✓" : "✗";
    process.stdout.write(`  ${mark} ${r.case_id.padEnd(24)} [${r.category}] ${r.expected} → ${r.actual}\n`);
    if (!r.passed && r.message) process.stdout.write(`      ${r.message}\n`);
  }
  process.stdout.write("\nMétricas:\n");
  for (const [name, m] of Object.entries(report.metrics)) {
    const mark = m.rate === 1 ? "✓" : "✗";
    process.stdout.write(`  ${mark} ${name.padEnd(34)} ${m.passed}/${m.total} (${(m.rate * 100).toFixed(0)}%)\n`);
  }
  process.stdout.write(`\n${report.ok ? "PASS" : "FAIL"} — ${report.results.length} caso(s)\n`);
  return report.ok ? 0 : 1;
}

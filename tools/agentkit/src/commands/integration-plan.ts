import { parseArgs } from "node:util";
import { buildIntegrationPlan } from "../lib/integration.js";

const USAGE =
  "uso: agentkit integration-plan --feature <id> --tasks <dir> [--verdicts <dir>] [--policies <dir>]\n" +
  "       [--approvals <dir>] [--repo <path>] [--base <branch>] [--now <iso>] [--json]\n";

/** agentkit integration-plan. SOLO LECTURA (comandos como texto). Exit: 0 ready, 1 not ready, 2 operacional. */
export function runIntegrationPlan(argv: string[]): number {
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

  let plan;
  try {
    plan = buildIntegrationPlan({
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
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    return plan.ready ? 0 : 1;
  }

  process.stdout.write(`# Integration Plan: ${plan.feature}\n\n`);
  process.stdout.write(`Status: ${plan.ready ? "READY" : "NOT READY"}\n\n`);

  process.stdout.write("## Prerequisites\n");
  for (const p of plan.prerequisites) {
    const mark = p.status === "pass" ? "✓" : p.status === "fail" ? "✗" : "·";
    process.stdout.write(`- ${mark} ${p.name}: ${p.status}\n`);
  }

  // Si NO está ready: mostrar blockers y salir 1 (sin plan de merge).
  if (!plan.ready) {
    process.stdout.write("\n## Blockers\n");
    for (const b of plan.blockers) process.stdout.write(`- ${b}\n`);
    process.stdout.write("\nNOT READY: resuelve los blockers antes de integrar. No se generó plan de merge.\n");
    return 1;
  }

  process.stdout.write("\n## Suggested merge order\n");
  plan.merge_order.forEach((id, i) => process.stdout.write(`${i + 1}. ${id}\n`));

  process.stdout.write("\n## Suggested commands\n");
  process.stdout.write("IMPORTANTE: estos comandos son sugerencias. agentkit NO los ejecutó.\n\n");
  for (const c of plan.suggested_commands) process.stdout.write(`    ${c}\n`);

  process.stdout.write("\n## Warnings\n");
  for (const w of plan.warnings) process.stdout.write(`- ${w}\n`);

  process.stdout.write("\n## Human checklist\n");
  for (const h of plan.human_checklist) process.stdout.write(`- [ ] ${h}\n`);

  return 0;
}

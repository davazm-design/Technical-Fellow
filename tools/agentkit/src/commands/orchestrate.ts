import { parseArgs } from "node:util";
import { analyzePlan, planIsValid, type PlanAnalysis } from "../lib/dag.js";

interface Parsed {
  tasksDir?: string;
  json: boolean;
}

function parse(argv: string[]): Parsed | null {
  try {
    const { values } = parseArgs({
      args: argv,
      options: { tasks: { type: "string" }, json: { type: "boolean", default: false } },
      allowPositionals: false,
    });
    if (!values.tasks) return null;
    return { tasksDir: values.tasks, json: values.json ?? false };
  } catch {
    return null;
  }
}

/** Corre el análisis; devuelve [analysis, exitOnOperationalError]. */
function analyze(dir: string): { a: PlanAnalysis } | { errCode: number } {
  try {
    return { a: analyzePlan(dir) };
  } catch (e) {
    process.stderr.write(`error operacional: ${e instanceof Error ? e.message : String(e)}\n`);
    return { errCode: 2 };
  }
}

/** Imprime los problemas estructurales del plan. Devuelve true si imprimió alguno. */
function printProblems(a: PlanAnalysis): boolean {
  let any = false;
  for (const inv of a.invalid) {
    any = true;
    process.stdout.write(`✗ task inválida: ${inv.file}\n`);
    for (const e of inv.errors) process.stdout.write(`    - ${e}\n`);
  }
  if (a.duplicateIds.length) {
    any = true;
    process.stdout.write(`✗ ids duplicados: ${a.duplicateIds.join(", ")}\n`);
  }
  for (const m of a.missingDeps) {
    any = true;
    process.stdout.write(`✗ dependencia faltante: ${m.task} depende de "${m.missing}" (no existe)\n`);
  }
  if (a.cycle) {
    any = true;
    process.stdout.write(`✗ ciclo detectado: ${a.cycle.join(" → ")}\n`);
  }
  return any;
}

// ---- agentkit graph --tasks <dir> [--json] ----
export function runGraph(argv: string[]): number {
  const p = parse(argv);
  if (!p?.tasksDir) {
    process.stderr.write("uso: agentkit graph --tasks <dir> [--json]\n");
    return 2;
  }
  const res = analyze(p.tasksDir);
  if ("errCode" in res) return res.errCode;
  const a = res.a;

  if (p.json) {
    process.stdout.write(JSON.stringify(a, null, 2) + "\n");
    return planIsValid(a) ? 0 : 1;
  }

  process.stdout.write(`Plan: ${p.tasksDir}\n\n`);
  process.stdout.write("Tasks y dependencias:\n");
  for (const t of [...a.tasks].sort((x, y) => x.id.localeCompare(y.id))) {
    const deps = t.depends_on.length ? `← ${t.depends_on.join(", ")}` : "(sin deps)";
    process.stdout.write(`  ${t.id} [${t.lane}/${t.status}] ${deps}\n`);
  }
  const problems = printProblems(a);
  if (!a.cycle) {
    process.stdout.write(`\nOrden topológico: ${a.topoOrder.join(" → ") || "(vacío)"}\n`);
  }
  if (a.blocked.length) {
    process.stdout.write("\nBloqueadas:\n");
    for (const b of a.blocked) process.stdout.write(`  ${b.id}: ${b.reason}\n`);
  }
  return problems ? 1 : 0;
}

// ---- agentkit status --tasks <dir> [--json] ----
export function runStatus(argv: string[]): number {
  const p = parse(argv);
  if (!p?.tasksDir) {
    process.stderr.write("uso: agentkit status --tasks <dir> [--json]\n");
    return 2;
  }
  const res = analyze(p.tasksDir);
  if ("errCode" in res) return res.errCode;
  const a = res.a;

  const summary = {
    total: a.tasks.length + a.invalid.length,
    valid: a.tasks.length,
    invalid: a.invalid.length,
    ready: a.ready.length,
    blocked: a.blocked.length,
    completed: a.byStatus["completed"] ?? 0,
    rejected: a.byStatus["rejected"] ?? 0,
    duplicate_ids: a.duplicateIds.length,
    missing_dependencies: a.missingDeps.length,
    cycles: a.cycle ? 1 : 0,
  };

  if (p.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return planIsValid(a) ? 0 : 1;
  }

  process.stdout.write(`Status del plan: ${p.tasksDir}\n`);
  for (const [k, v] of Object.entries(summary)) {
    process.stdout.write(`  ${k.padEnd(22)} ${v}\n`);
  }
  return planIsValid(a) ? 0 : 1;
}

// ---- agentkit next --tasks <dir> [--json] ----
export function runNext(argv: string[]): number {
  const p = parse(argv);
  if (!p?.tasksDir) {
    process.stderr.write("uso: agentkit next --tasks <dir> [--json]\n");
    return 2;
  }
  const res = analyze(p.tasksDir);
  if ("errCode" in res) return res.errCode;
  const a = res.a;

  // Si el plan es estructuralmente inválido, no se puede calcular "next" con fiabilidad.
  if (!planIsValid(a)) {
    process.stderr.write("✗ plan inválido: no se puede calcular `next`.\n");
    printProblems(a);
    return 1;
  }

  if (p.json) {
    process.stdout.write(JSON.stringify({ ready: a.ready }, null, 2) + "\n");
    return 0;
  }
  if (a.ready.length === 0) {
    process.stdout.write("(sin tasks listas para ejecutar)\n");
    return 0;
  }
  process.stdout.write("Listas para ejecutar:\n");
  for (const id of a.ready) process.stdout.write(`  ${id}\n`);
  return 0;
}

// ---- agentkit validate-plan --tasks <dir> ----
export function runValidatePlan(argv: string[]): number {
  const p = parse(argv);
  if (!p?.tasksDir) {
    process.stderr.write("uso: agentkit validate-plan --tasks <dir> [--json]\n");
    return 2;
  }
  const res = analyze(p.tasksDir);
  if ("errCode" in res) return res.errCode;
  const a = res.a;

  if (planIsValid(a)) {
    process.stdout.write(`✓ plan válido: ${a.tasks.length} task(s), orden topológico verificado\n`);
    return 0;
  }
  process.stdout.write(`✗ plan inválido: ${p.tasksDir}\n`);
  printProblems(a);
  return 1;
}

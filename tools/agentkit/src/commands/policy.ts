import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadTask } from "../lib/loaders.js";
import { loadPoliciesFromDir, evaluatePolicies, type Severity } from "../lib/policy.js";
import { diffNames, GitError, isGitAvailable, isGitRepo, repoRoot } from "../lib/git.js";

const USAGE =
  "uso: agentkit evaluate-policies --task <file> --policies <dir> [--repo <path>] [--threshold CRITICAL|HIGH|MEDIUM|LOW]\n";

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/** agentkit evaluate-policies. Exit: 0 sin bloqueo, 1 policy blocking, 2 operacional. */
export function runEvaluatePolicies(argv: string[]): number {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        task: { type: "string" },
        policies: { type: "string" },
        repo: { type: "string" },
        threshold: { type: "string", default: "HIGH" },
      },
      allowPositionals: false,
    }));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n\n${USAGE}`);
    return 2;
  }

  const { task, policies, repo, threshold } = values;
  if (!task || !policies) {
    process.stderr.write(USAGE);
    return 2;
  }
  if (!SEVERITIES.includes(threshold as Severity)) {
    process.stderr.write(`--threshold inválido: ${threshold}. Usa: ${SEVERITIES.join(", ")}\n`);
    return 2;
  }
  if (!existsSync(task)) {
    process.stderr.write(`task no encontrado: ${task}\n`);
    return 2;
  }

  // Task inválido bloquea (no se puede evaluar con fiabilidad).
  const loaded = loadTask(task);
  if (!loaded.ok) {
    process.stderr.write(`✗ task inválido (no se pueden evaluar policies): ${task}\n`);
    for (const e of loaded.errors) process.stderr.write(`    - ${e}\n`);
    return 1;
  }
  const t = loaded.data;

  // Cargar policies (ruleset). Dir inexistente o policy inválida = operacional.
  let loadedPolicies;
  try {
    loadedPolicies = loadPoliciesFromDir(policies);
  } catch (e) {
    process.stderr.write(`error operacional: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  if (loadedPolicies.invalid.length > 0) {
    process.stderr.write("error operacional: hay policies inválidas (corrige el ruleset):\n");
    for (const inv of loadedPolicies.invalid) {
      process.stderr.write(`  ✗ ${inv.file}\n`);
      for (const e of inv.errors) process.stderr.write(`      - ${e}\n`);
    }
    return 2;
  }

  const active = loadedPolicies.policies.filter((p) => p.status === "active");
  const draftCount = loadedPolicies.policies.length - active.length;

  // candidatePaths = owns ∪ diff (si --repo); fileContents para secret scan (solo con --repo).
  const candidatePaths = new Set<string>(t.owns);
  const fileContents = new Map<string, string>();
  const notes: string[] = [];
  if (repo !== undefined) {
    if (!existsSync(repo)) {
      process.stderr.write(`repo objetivo no encontrado: ${repo}\n`);
      return 2;
    }
    if (!isGitAvailable() || !isGitRepo(repo)) {
      process.stderr.write(`--repo no es un repo git válido: ${repo} (operacional)\n`);
      return 2;
    }
    try {
      const root = repoRoot(repo);
      for (const f of diffNames({ base: "main" }, repo)) {
        candidatePaths.add(f);
        const full = path.join(root, f);
        if (existsSync(full)) {
          try {
            fileContents.set(f, readFileSync(full, "utf8"));
          } catch {
            /* binario/ilegible: se omite del scan */
          }
        }
      }
    } catch (e) {
      if (e instanceof GitError) notes.push(`diff no disponible (${e.message}); se usó solo owns.`);
      else throw e;
    }
  }

  const report = evaluatePolicies(t, active, {
    candidatePaths: [...candidatePaths],
    fileContents,
    threshold: threshold as Severity,
  });
  report.notes.unshift(...notes);

  // Salida.
  if (report.ok) {
    process.stdout.write("✓ policies OK\n");
    process.stdout.write(`✓ ${active.length} policies evaluadas${draftCount ? ` (${draftCount} draft ignorada(s))` : ""}\n`);
    process.stdout.write(`✓ ${report.findings.length} finding(s), 0 bloqueantes\n`);
    for (const n of report.notes) process.stdout.write(`  ℹ ${n}\n`);
    // findings no bloqueantes (warnings) informativos
    for (const f of report.findings) process.stdout.write(`  • [${f.severity}] ${f.policy_id}: ${f.reason}\n`);
    return 0;
  }

  process.stdout.write("✗ policy blocked\n");
  for (const f of report.findings.filter((x) => x.blocking)) {
    process.stdout.write(`\nPolicy: ${f.policy_id}\nSeverity: ${f.severity}\nCondición: ${f.block_condition}\nReason: ${f.reason}\n`);
    if (f.approval_required !== "none") process.stdout.write(`Approval requerido: ${f.approval_required}\n`);
    process.stdout.write(`Required action: ${f.required_action}\n`);
  }
  for (const n of report.notes) process.stdout.write(`  ℹ ${n}\n`);
  return 1;
}

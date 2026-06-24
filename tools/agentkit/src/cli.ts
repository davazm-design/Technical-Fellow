#!/usr/bin/env -S npx tsx
import { ARTIFACT_TYPES } from "./lib/validate.js";
import { runValidate } from "./commands/validate.js";
import { runDoctor } from "./commands/doctor.js";
import { runCheckDiffOwnership } from "./commands/check-diff-ownership.js";
import { runValidateRunLog, runAppendRunEvent } from "./commands/run-log.js";
import { runGraph, runStatus, runNext, runValidatePlan } from "./commands/orchestrate.js";
import { runEvalCommand } from "./commands/eval.js";
import { runEvaluatePolicies } from "./commands/policy.js";

const HELP = `agentkit — validadores mecánicos del parallel-dev-kit

uso:
  agentkit validate <tipo> <archivo>          valida un artefacto contra su JSON Schema
  agentkit validate-<tipo> <archivo>          alias por tipo (ej. validate-task)
  agentkit doctor                             diagnóstico del kit
  agentkit check-diff-ownership --task <f>    compara el diff de git contra el owns: del task
                 [--base <branch> | --staged] [--repo <path>] [--strict-artifacts]
  agentkit validate-run-log <file.jsonl>      valida un run log JSONL (un run-event por línea)
  agentkit append-run-event --log <f> --event <e.json>   añade (append-only) un evento validado
  agentkit graph --tasks <dir> [--json]       DAG: tasks, deps, orden topológico, bloqueos
  agentkit status --tasks <dir> [--json]      resumen del plan (ready/blocked/ciclos/…)
  agentkit next --tasks <dir> [--json]        tasks listas para ejecutar
  agentkit validate-plan --tasks <dir>        valida todo el plan (schema + DAG)
  agentkit eval [--case <id>] [--json]        evals deterministas de capacidades críticas
  agentkit validate-policy <file>             valida una policy contra su schema
  agentkit evaluate-policies --task <f> --policies <dir> [--repo <p>] [--threshold LVL]

tipos: ${Object.keys(ARTIFACT_TYPES).join(", ")}

exit codes:
  0  validación correcta
  1  violación de ownership o artefacto inválido
  2  error operacional (uso incorrecto, git ausente, base inexistente, archivo no encontrado)
`;

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(HELP);
    return cmd ? 0 : 2;
  }

  if (cmd === "validate") return runValidate(rest);
  if (cmd === "doctor") return runDoctor();
  if (cmd === "check-diff-ownership") return runCheckDiffOwnership(rest);
  if (cmd === "validate-run-log") return runValidateRunLog(rest);
  if (cmd === "append-run-event") return runAppendRunEvent(rest);
  if (cmd === "graph") return runGraph(rest);
  if (cmd === "status") return runStatus(rest);
  if (cmd === "next") return runNext(rest);
  if (cmd === "validate-plan") return runValidatePlan(rest);
  if (cmd === "eval") return runEvalCommand(rest);
  if (cmd === "evaluate-policies") return runEvaluatePolicies(rest);

  // Aliases validate-<tipo> (incluye validate-run-event). Va DESPUÉS de validate-run-log/validate-plan.
  if (cmd.startsWith("validate-")) {
    const type = cmd.slice("validate-".length);
    return runValidate([type, ...rest]);
  }

  process.stderr.write(`comando desconocido: "${cmd}"\n\n${HELP}`);
  return 2;
}

process.exit(main(process.argv.slice(2)));

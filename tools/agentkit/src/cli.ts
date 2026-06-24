#!/usr/bin/env -S npx tsx
import { ARTIFACT_TYPES } from "./lib/validate.js";
import { runValidate } from "./commands/validate.js";
import { runDoctor } from "./commands/doctor.js";
import { runCheckDiffOwnership } from "./commands/check-diff-ownership.js";

const HELP = `agentkit — validadores mecánicos del parallel-dev-kit

uso:
  agentkit validate <tipo> <archivo>          valida un artefacto contra su JSON Schema
  agentkit validate-<tipo> <archivo>          alias por tipo (ej. validate-task)
  agentkit doctor                             diagnóstico del kit (schemas, fixtures, git, instalación)
  agentkit check-diff-ownership --task <f>    compara el diff de git contra el owns: del task
                 [--base <branch> | --staged]

tipos: ${Object.keys(ARTIFACT_TYPES).join(", ")}

exit codes:
  0  validación correcta
  1  violación de ownership o artefacto inválido
  2  error operacional (uso incorrecto, git ausente, base inexistente, archivo no encontrado)

ejemplos:
  agentkit validate task tasks/backend-1.md
  agentkit validate-verdict verdicts/backend-1/plan.yaml
  agentkit doctor
  agentkit check-diff-ownership --task tasks/backend-1.md --base main
  agentkit check-diff-ownership --task tasks/backend-1.md --staged
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

  // Aliases: validate-task, validate-ownership, validate-contract, validate-verdict, validate-run-event
  if (cmd.startsWith("validate-")) {
    const type = cmd.slice("validate-".length);
    return runValidate([type, ...rest]);
  }

  process.stderr.write(`comando desconocido: "${cmd}"\n\n${HELP}`);
  return 2;
}

process.exit(main(process.argv.slice(2)));

#!/usr/bin/env -S npx tsx
import { ARTIFACT_TYPES } from "./lib/validate.js";
import { runValidate } from "./commands/validate.js";

const HELP = `agentkit — validadores mecánicos del parallel-dev-kit

uso:
  agentkit validate <tipo> <archivo>     valida un artefacto contra su JSON Schema
  agentkit validate-<tipo> <archivo>     alias por tipo (ej. validate-task)

tipos: ${Object.keys(ARTIFACT_TYPES).join(", ")}

ejemplos:
  agentkit validate task tasks/backend-1.md
  agentkit validate-verdict verdicts/backend-1/plan.yaml
`;

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(HELP);
    return cmd ? 0 : 2;
  }

  if (cmd === "validate") {
    return runValidate(rest);
  }

  // Aliases: validate-task, validate-ownership, validate-contract, ...
  if (cmd.startsWith("validate-")) {
    const type = cmd.slice("validate-".length);
    return runValidate([type, ...rest]);
  }

  process.stderr.write(`comando desconocido: "${cmd}"\n\n${HELP}`);
  return 2;
}

process.exit(main(process.argv.slice(2)));

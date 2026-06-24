import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { validateRunLog, appendRunEvent } from "../lib/runlog.js";

/** agentkit validate-run-log <file.jsonl>. Exit: 0 ok, 1 inválido, 2 operacional. */
export function runValidateRunLog(argv: string[]): number {
  const [file] = argv;
  if (!file) {
    process.stderr.write("uso: agentkit validate-run-log <file.jsonl>\n");
    return 2;
  }
  if (!existsSync(file)) {
    process.stderr.write(`run log no encontrado: ${file}\n`);
    return 2;
  }
  const res = validateRunLog(file);
  if (res.ok) {
    process.stdout.write(`✓ run log válido: ${file} (${res.valid} evento(s))\n`);
    return 0;
  }
  process.stderr.write(`✗ run log inválido: ${file}\n`);
  for (const err of res.errors) process.stderr.write(`    - ${err}\n`);
  return 1;
}

/** agentkit append-run-event --log <file> --event <event.json>. Append-only. */
export function runAppendRunEvent(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: { log: { type: "string" }, event: { type: "string" } },
      allowPositionals: false,
    });
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  const { log, event } = parsed.values;
  if (!log || !event) {
    process.stderr.write("uso: agentkit append-run-event --log <file.jsonl> --event <event.json>\n");
    return 2;
  }
  const res = appendRunEvent(log, event);
  if (res.ok) {
    process.stdout.write(`✓ evento añadido a ${log}\n`);
    return 0;
  }
  // Evento no encontrado = operacional (2); evento inválido = 1.
  const notFound = res.errors.some((e) => e.includes("no encontrado"));
  process.stderr.write(`✗ no se añadió el evento:\n`);
  for (const err of res.errors) process.stderr.write(`    - ${err}\n`);
  return notFound ? 2 : 1;
}

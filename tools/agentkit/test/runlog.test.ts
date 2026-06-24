import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { REPO_ROOT } from "../src/lib/validate.js";
import { validateRunLog, appendRunEvent } from "../src/lib/runlog.js";

const fx = (rel: string) => path.join(REPO_ROOT, "fixtures", rel);

describe("validateRunLog", () => {
  it("acepta un run log JSONL válido y cuenta los eventos", () => {
    const r = validateRunLog(fx("run-log/valid/feature-run.jsonl"));
    expect(r.ok).toBe(true);
    expect(r.valid).toBe(7);
    expect(r.errors).toEqual([]);
  });

  it("rechaza event_type inválido con nº de línea", () => {
    const r = validateRunLog(fx("run-log/invalid/bad-event-type.jsonl"));
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/línea 2/);
  });

  it("rechaza run_id faltante", () => {
    const r = validateRunLog(fx("run-log/invalid/missing-run-id.jsonl"));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/run_id/);
  });

  it("reporta JSON malformado por línea", () => {
    const r = validateRunLog(fx("run-log/invalid/malformed-json.jsonl"));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/JSON inválido/);
  });
});

describe("appendRunEvent (append-only)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "agentkit-runlog-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("añade un evento válido y el log resultante valida", () => {
    const log = path.join(dir, "run.jsonl");
    const r = appendRunEvent(log, fx("run-event/valid/run-started.json"));
    expect(r.ok).toBe(true);
    expect(existsSync(log)).toBe(true);

    // segundo append → 2 líneas
    appendRunEvent(log, fx("run-event/valid/gate-blocked.json"));
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(2);
    expect(validateRunLog(log).ok).toBe(true);
  });

  it("rechaza (y NO añade) un evento inválido", () => {
    const log = path.join(dir, "run.jsonl");
    const bad = path.join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify({ event_type: "nope" }));
    const r = appendRunEvent(log, bad);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(existsSync(log)).toBe(false); // no se creó el log
  });
});

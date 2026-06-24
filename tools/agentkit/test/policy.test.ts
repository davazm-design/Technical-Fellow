import path from "node:path";
import { describe, it, expect } from "vitest";
import { REPO_ROOT, validateArtifact } from "../src/lib/validate.js";
import { loadPoliciesFromDir, evaluatePolicies, scanForSecrets } from "../src/lib/policy.js";
import type { Task, Policy } from "../src/types/index.js";

const polFx = (rel: string) => path.join(REPO_ROOT, "fixtures", "policy", rel);

function task(over: Partial<Task> = {}): Task {
  return {
    id: "backend-1", feature: "t", title: "t", lane: "backend", agent: "backend", status: "planned",
    profile: "lite", zones: ["🟢"], risk_level: "low", depends_on: [], owns: ["src/x.ts"], contracts: [],
    gates: { audit_f1: "required", security_f1: "required", audit_f2: "optional", security_f2: "optional" },
    evidence_required: ["tests"], acceptance_criteria: ["x"], ...over,
  } as Task;
}
function policy(over: Partial<Policy>): Policy {
  return { id: "p", title: "p", severity: "HIGH", status: "active", block_condition: "zone_touch",
    approval_required: "none", responsible_agent: "security", ...over } as Policy;
}
const active = (ps: Policy[]) => ps.filter((p) => p.status === "active");

describe("validate-policy (schema)", () => {
  it("valida policies válidas", () => {
    for (const f of ["path-match.yaml", "zone-touch.yaml", "risk-at-least.yaml", "missing-evidence.yaml", "secret-pattern.yaml", "draft-noop.yaml"]) {
      expect(validateArtifact("policy", polFx(`valid/${f}`)).ok, f).toBe(true);
    }
  });
  it("rechaza policies inválidas", () => {
    for (const f of ["bad-severity.yaml", "bad-approval.yaml", "missing-id.yaml", "path-match-without-paths.yaml"]) {
      expect(validateArtifact("policy", polFx(`invalid/${f}`)).ok, f).toBe(false);
    }
  });
});

describe("loadPoliciesFromDir", () => {
  it("carga el set válido sin inválidas", () => {
    const r = loadPoliciesFromDir(polFx("valid"));
    expect(r.invalid).toHaveLength(0);
    expect(r.policies.length).toBe(6);
  });
});

describe("evaluatePolicies — condiciones", () => {
  it("draft no bloquea por default (se filtra antes)", () => {
    const ps = [policy({ status: "draft", severity: "CRITICAL", block_condition: "path_match", applies_to: { paths: ["**/*"] } })];
    const r = evaluatePolicies(task(), active(ps), { candidatePaths: ["src/x.ts"] });
    expect(r.ok).toBe(true);
  });

  it("path_match bloquea", () => {
    const ps = [policy({ severity: "CRITICAL", block_condition: "path_match", applies_to: { paths: ["**/.env*"] } })];
    const r = evaluatePolicies(task({ owns: [".env"] }), ps, { candidatePaths: [".env"] });
    expect(r.ok).toBe(false);
    expect(r.findings[0]!.blocking).toBe(true);
  });

  it("zone_touch bloquea", () => {
    const ps = [policy({ severity: "HIGH", block_condition: "zone_touch", applies_to: { zones: ["🟠"] } })];
    const r = evaluatePolicies(task({ zones: ["🟠"] }), ps, { candidatePaths: ["src/x.ts"] });
    expect(r.ok).toBe(false);
  });

  it("risk_at_least bloquea (high ≥ high)", () => {
    const ps = [policy({ severity: "HIGH", block_condition: "risk_at_least", applies_to: { risk_levels: ["high"] } })];
    const r = evaluatePolicies(task({ risk_level: "high" }), ps, { candidatePaths: ["src/x.ts"] });
    expect(r.ok).toBe(false);
  });

  it("risk_at_least NO dispara si el riesgo es menor", () => {
    const ps = [policy({ severity: "HIGH", block_condition: "risk_at_least", applies_to: { risk_levels: ["high"] } })];
    const r = evaluatePolicies(task({ risk_level: "low" }), ps, { candidatePaths: ["src/x.ts"] });
    expect(r.ok).toBe(true);
  });

  it("missing_evidence bloquea", () => {
    const ps = [policy({ severity: "HIGH", block_condition: "missing_evidence", evidence_required: ["security_review"] })];
    const r = evaluatePolicies(task({ evidence_required: ["tests"] }), ps, { candidatePaths: ["src/x.ts"] });
    expect(r.ok).toBe(false);
  });

  it("umbral: una policy MEDIUM no bloquea con threshold HIGH (default)", () => {
    const ps = [policy({ severity: "MEDIUM", block_condition: "zone_touch", applies_to: { zones: ["🟢"] } })];
    const r = evaluatePolicies(task(), ps, { candidatePaths: ["src/x.ts"] });
    expect(r.findings).toHaveLength(1); // matchea
    expect(r.findings[0]!.blocking).toBe(false); // pero no bloquea
    expect(r.ok).toBe(true);
  });

  it("secret_pattern bloquea siempre si hay match (hard block)", () => {
    const ps = [policy({ severity: "LOW", block_condition: "secret_pattern" })];
    const contents = new Map([["src/c.ts", 'token = "AKIA1234567890ABCDEF"']]);
    const r = evaluatePolicies(task(), ps, { candidatePaths: ["src/c.ts"], fileContents: contents });
    expect(r.ok).toBe(false);
    expect(r.findings[0]!.blocking).toBe(true);
  });

  it("secret_pattern sin contenido NO afirma ausencia (nota, no bloqueo)", () => {
    const ps = [policy({ severity: "CRITICAL", block_condition: "secret_pattern" })];
    const r = evaluatePolicies(task(), ps, { candidatePaths: ["src/x.ts"] });
    expect(r.ok).toBe(true);
    expect(r.notes.join(" ")).toMatch(/no ejecutado|no afirma/i);
  });
});

describe("scanForSecrets (heurístico)", () => {
  it("detecta AWS key y private key", () => {
    expect(scanForSecrets("x AKIA1234567890ABCDEF y").length).toBeGreaterThan(0);
    expect(scanForSecrets("-----BEGIN RSA PRIVATE KEY-----").length).toBeGreaterThan(0);
  });
  it("no detecta en texto benigno", () => {
    expect(scanForSecrets("const a = 1; // hola")).toHaveLength(0);
  });
});

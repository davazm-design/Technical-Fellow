import path from "node:path";
import { describe, it, expect } from "vitest";
import { REPO_ROOT, validateArtifact } from "../src/lib/validate.js";
import { requiredApproval, checkApprovals, approvalSatisfies, loadApprovalsFromDir } from "../src/lib/approval.js";
import type { Task, Approval, Policy } from "../src/types/index.js";

const aFx = (rel: string) => path.join(REPO_ROOT, "fixtures", "approval", rel);
const NOW = new Date("2026-06-24T12:00:00Z");

function task(over: Partial<Task> = {}): Task {
  return {
    id: "backend-1", feature: "invoices", title: "t", lane: "backend", agent: "backend", status: "planned",
    profile: "lite", zones: ["🟢"], risk_level: "low", depends_on: [], owns: ["src/x.ts"], contracts: [],
    gates: { audit_f1: "required", security_f1: "required", audit_f2: "optional", security_f2: "optional" },
    evidence_required: ["tests"], acceptance_criteria: ["x"], ...over,
  } as Task;
}
function appr(over: Partial<Approval>): Approval {
  return { approval_id: "A1", feature_id: "invoices", scope: "s", risk_level: "high", approval_type: "formal",
    requested_by: "d", approved_by: "l", decision: "approved", timestamp: "2026-06-24T10:00:00Z", ...over } as Approval;
}
const policy = (over: Partial<Policy>): Policy => ({ id: "p", title: "p", severity: "HIGH", status: "active",
  block_condition: "zone_touch", approval_required: "none", responsible_agent: "security", ...over } as Policy);

describe("validate-approval (schema)", () => {
  it("valida approvals válidas", () => {
    for (const f of ["formal-approved", "nominal-approved", "pending", "rejected", "expired", "wrong-feature"]) {
      expect(validateArtifact("approval", aFx(`valid/${f}.yaml`)).ok, f).toBe(true);
    }
  });
  it("rechaza approvals inválidas (decision, approved-sin-approver, sin feature)", () => {
    for (const f of ["bad-decision", "approved-without-approver", "missing-feature"]) {
      expect(validateArtifact("approval", aFx(`invalid/${f}.yaml`)).ok, f).toBe(false);
    }
  });
  it("loadApprovalsFromDir carga el set válido sin inválidas", () => {
    const r = loadApprovalsFromDir(aFx("valid"));
    expect(r.invalid).toHaveLength(0);
    expect(r.approvals.length).toBe(6);
  });
});

describe("requiredApproval — qué dispara aprobación", () => {
  it("risk_level critical → formal", () => {
    expect(requiredApproval(task({ risk_level: "critical" })).level).toBe("formal");
  });
  it("zona 🟠 → formal", () => {
    expect(requiredApproval(task({ zones: ["🟠"] })).level).toBe("formal");
  });
  it("task 🟢 low sin policies → none", () => {
    expect(requiredApproval(task()).level).toBe("none");
  });
  it("policy approval_required formal que matchea → formal", () => {
    const ps = [policy({ block_condition: "zone_touch", applies_to: { zones: ["🟢"] }, approval_required: "formal" })];
    expect(requiredApproval(task(), ps).level).toBe("formal");
  });
});

describe("approvalSatisfies — nominal vs formal", () => {
  it("formal satisface formal", () => {
    expect(approvalSatisfies(appr({ approval_type: "formal" }), "formal", "invoices", "backend-1", NOW).ok).toBe(true);
  });
  it("formal satisface nominal", () => {
    expect(approvalSatisfies(appr({ approval_type: "formal" }), "nominal", "invoices", "backend-1", NOW).ok).toBe(true);
  });
  it("nominal NO satisface formal", () => {
    expect(approvalSatisfies(appr({ approval_type: "nominal" }), "formal", "invoices", "backend-1", NOW).ok).toBe(false);
  });
  it("pending y rejected no satisfacen", () => {
    expect(approvalSatisfies(appr({ decision: "pending" }), "formal", "invoices", "backend-1", NOW).ok).toBe(false);
    expect(approvalSatisfies(appr({ decision: "rejected" }), "formal", "invoices", "backend-1", NOW).ok).toBe(false);
  });
  it("expirada no satisface", () => {
    expect(approvalSatisfies(appr({ expiration: "2026-02-01T00:00:00Z" }), "formal", "invoices", "backend-1", NOW).ok).toBe(false);
  });
  it("feature distinto no satisface", () => {
    expect(approvalSatisfies(appr({ feature_id: "payments" }), "formal", "invoices", "backend-1", NOW).ok).toBe(false);
  });
});

describe("checkApprovals — integración", () => {
  const t = task({ risk_level: "critical" });
  const req = requiredApproval(t);

  it("pasa con una formal approved no expirada del feature", () => {
    expect(checkApprovals(t, "invoices", [appr({})], req, NOW).ok).toBe(true);
  });
  it("bloquea si no hay approvals", () => {
    expect(checkApprovals(t, "invoices", [], req, NOW).ok).toBe(false);
  });
  it("bloquea con solo pending", () => {
    expect(checkApprovals(t, "invoices", [appr({ decision: "pending" })], req, NOW).ok).toBe(false);
  });
  it("bloquea con solo expirada", () => {
    expect(checkApprovals(t, "invoices", [appr({ expiration: "2026-02-01T00:00:00Z" })], req, NOW).ok).toBe(false);
  });
  it("requirement none → pasa sin approvals", () => {
    const low = task();
    expect(checkApprovals(low, "invoices", [], requiredApproval(low), NOW).ok).toBe(true);
  });
});

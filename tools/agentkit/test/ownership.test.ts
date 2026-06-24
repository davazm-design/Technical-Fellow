import { describe, it, expect } from "vitest";
import { classifyDiff, makeMatcher } from "../src/lib/ownership.js";

describe("makeMatcher — matching de paths contra owns", () => {
  it("matchea un literal exacto", () => {
    const m = makeMatcher(["src/routes/invoices.ts"]);
    expect(m("src/routes/invoices.ts")).toBe(true);
    expect(m("src/routes/payments.ts")).toBe(false);
  });

  it("glob ** matchea recursivamente bajo el directorio", () => {
    const m = makeMatcher(["src/invoices/**"]);
    expect(m("src/invoices/pricing.ts")).toBe(true);
    expect(m("src/invoices/sub/deep.ts")).toBe(true);
    expect(m("src/billing/pricing.ts")).toBe(false);
  });

  it("soporta varios patrones (cualquiera que matchee → en scope)", () => {
    const m = makeMatcher(["src/invoices/**", "tests/invoices/**"]);
    expect(m("src/invoices/x.ts")).toBe(true);
    expect(m("tests/invoices/x.test.ts")).toBe(true);
    expect(m("src/other/x.ts")).toBe(false);
  });

  it("normaliza separadores Windows y prefijo ./", () => {
    const m = makeMatcher(["src/invoices/**"]);
    expect(m("src\\invoices\\x.ts")).toBe(true);
    expect(m("./src/invoices/x.ts")).toBe(true);
  });

  it("owns vacío no matchea nada", () => {
    const m = makeMatcher([]);
    expect(m("cualquier/cosa.ts")).toBe(false);
  });

  it("glob *.sql de un solo nivel", () => {
    const m = makeMatcher(["migrations/*.sql"]);
    expect(m("migrations/0007.sql")).toBe(true);
    expect(m("migrations/sub/0007.sql")).toBe(false);
  });
});

describe("classifyDiff — separa dentro/fuera de scope", () => {
  it("todos dentro de scope", () => {
    const r = classifyDiff(["src/invoices/a.ts", "tests/invoices/a.test.ts"], ["src/invoices/**", "tests/invoices/**"]);
    expect(r.outOfScope).toEqual([]);
    expect(r.inScope).toHaveLength(2);
  });

  it("detecta archivo fuera de scope", () => {
    const r = classifyDiff(["src/invoices/a.ts", "src/billing/pricing.ts"], ["src/invoices/**"]);
    expect(r.inScope).toEqual(["src/invoices/a.ts"]);
    expect(r.outOfScope).toEqual(["src/billing/pricing.ts"]);
  });

  it("owns vacío → todo fuera de scope", () => {
    const r = classifyDiff(["a.ts", "b.ts"], []);
    expect(r.inScope).toEqual([]);
    expect(r.outOfScope).toEqual(["a.ts", "b.ts"]);
  });
});

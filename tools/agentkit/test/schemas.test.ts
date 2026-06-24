import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { ARTIFACT_TYPES, REPO_ROOT, validateArtifact, type ArtifactType } from "../src/lib/validate.js";

const FIXTURES_DIR = path.join(REPO_ROOT, "fixtures");
const types = Object.keys(ARTIFACT_TYPES) as ArtifactType[];

function filesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .map((f) => path.join(dir, f));
}

describe("fixtures cubren todos los tipos de artefacto", () => {
  for (const type of types) {
    it(`${type}: tiene ≥1 fixture válido y ≥2 inválidos`, () => {
      const valid = filesIn(path.join(FIXTURES_DIR, type, "valid"));
      const invalid = filesIn(path.join(FIXTURES_DIR, type, "invalid"));
      expect(valid.length, `faltan fixtures válidos para ${type}`).toBeGreaterThanOrEqual(1);
      expect(invalid.length, `faltan fixtures inválidos para ${type}`).toBeGreaterThanOrEqual(2);
    });
  }
});

describe("fixtures válidos pasan", () => {
  for (const type of types) {
    for (const file of filesIn(path.join(FIXTURES_DIR, type, "valid"))) {
      it(`${type}/valid/${path.basename(file)}`, () => {
        const res = validateArtifact(type, file);
        expect(res.errors).toEqual([]);
        expect(res.ok).toBe(true);
      });
    }
  }
});

describe("fixtures inválidos fallan con razón clara", () => {
  for (const type of types) {
    for (const file of filesIn(path.join(FIXTURES_DIR, type, "invalid"))) {
      it(`${type}/invalid/${path.basename(file)}`, () => {
        const res = validateArtifact(type, file);
        expect(res.ok).toBe(false);
        expect(res.errors.length).toBeGreaterThan(0);
        // cada error es un string no vacío y accionable
        for (const e of res.errors) expect(e.trim().length).toBeGreaterThan(0);
      });
    }
  }
});

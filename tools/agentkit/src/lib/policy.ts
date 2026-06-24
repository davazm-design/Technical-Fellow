// Evaluación declarativa de policies (E1). Pura y determinista: no toca git ni red.
// Una policy = una condición de bloqueo. Sin motor de reglas, sin auto-remediation, sin supresiones.
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { loadPolicy } from "./loaders.js";
import { makeMatcher } from "./ownership.js";
import type { Policy, Task } from "../types/index.js";

const POLICY_EXTS = new Set([".yaml", ".yml", ".json"]);

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
const SEV_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

// Heurísticas básicas de secretos (best-effort). NUNCA garantizan ausencia de secretos.
const DEFAULT_SECRET_PATTERNS: { rule: string; re: RegExp }[] = [
  { rule: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { rule: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: "generic-secret-assignment", re: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{12,}/i },
];

export interface InvalidPolicy {
  file: string;
  errors: string[];
}

export function loadPoliciesFromDir(dir: string): { policies: Policy[]; invalid: InvalidPolicy[] } {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`directorio de policies no encontrado: ${dir}`);
  }
  const files = readdirSync(dir)
    .filter((f) => !f.startsWith(".") && POLICY_EXTS.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => path.join(dir, f));
  const policies: Policy[] = [];
  const invalid: InvalidPolicy[] = [];
  for (const file of files) {
    const r = loadPolicy(file);
    if (r.ok) policies.push(r.data);
    else invalid.push({ file, errors: r.errors });
  }
  return { policies, invalid };
}

/** Escaneo heurístico best-effort. Devuelve los nombres de regla que matchearon. */
export function scanForSecrets(content: string, extraPatterns: string[] = []): string[] {
  const hits = new Set<string>();
  for (const { rule, re } of DEFAULT_SECRET_PATTERNS) {
    if (re.test(content)) hits.add(rule);
  }
  extraPatterns.forEach((p, i) => {
    try {
      if (new RegExp(p).test(content)) hits.add(`custom-${i}`);
    } catch {
      /* regex inválida en la policy: se ignora (no bloquea por error de patrón) */
    }
  });
  return [...hits];
}

export interface PolicyFinding {
  policy_id: string;
  title: string;
  severity: Severity;
  block_condition: string;
  blocking: boolean;
  approval_required: string;
  reason: string;
  required_action: string;
}

export interface PolicyReport {
  evaluated: number;
  findings: PolicyFinding[];
  blocking: number;
  notes: string[];
  ok: boolean;
}

export interface EvalContext {
  /** rutas candidatas (owns ∪ diff) para path_match */
  candidatePaths: string[];
  /** contenido de archivos para secret_pattern (path → contenido); ausente = no se escaneó */
  fileContents?: Map<string, string>;
  /** umbral de bloqueo por severidad (default HIGH) */
  threshold?: Severity;
}

function defaultAction(p: Policy, cond: string): string {
  if (p.message) return p.message;
  switch (cond) {
    case "secret_pattern":
      return "elimina el secreto del diff y rota la credencial.";
    case "missing_evidence":
      return "añade la evidencia requerida a evidence_required del task.";
    case "zone_touch":
      return "aplica el protocolo de excepción (CANON §7) y obtén la aprobación correspondiente.";
    default:
      return "revisa el cambio con el agente responsable.";
  }
}

/** Evalúa policies ACTIVE contra un task. Las draft se ignoran (lo decide el caller). */
export function evaluatePolicies(task: Task, policies: Policy[], ctx: EvalContext): PolicyReport {
  const threshold = ctx.threshold ?? "HIGH";
  const findings: PolicyFinding[] = [];
  const notes: string[] = [];

  for (const p of policies) {
    const sev = p.severity as Severity;
    let matched = false;
    let reason = "";

    switch (p.block_condition) {
      case "path_match": {
        const globs = p.applies_to?.paths ?? [];
        const m = makeMatcher(globs);
        const hit = ctx.candidatePaths.find((f) => m(f));
        if (hit) {
          matched = true;
          reason = `path "${hit}" coincide con ${JSON.stringify(globs)}`;
        }
        break;
      }
      case "zone_touch": {
        const pz = new Set(p.applies_to?.zones ?? []);
        const hit = (task.zones as string[]).find((z) => pz.has(z as never));
        if (hit) {
          matched = true;
          reason = `el task toca la zona ${hit}`;
        }
        break;
      }
      case "risk_at_least": {
        const levels = p.applies_to?.risk_levels ?? [];
        const minRank = Math.min(...levels.map((l) => RISK_RANK[l] ?? 99));
        if ((RISK_RANK[task.risk_level] ?? 0) >= minRank && levels.length > 0) {
          matched = true;
          reason = `risk_level=${task.risk_level} ≥ umbral de la policy (${levels.join("|")})`;
        }
        break;
      }
      case "missing_evidence": {
        const req = p.evidence_required ?? [];
        const have = new Set(task.evidence_required);
        const missing = req.filter((e) => !have.has(e));
        if (missing.length > 0) {
          matched = true;
          reason = `falta evidencia: ${missing.join(", ")}`;
        }
        break;
      }
      case "secret_pattern": {
        if (!ctx.fileContents || ctx.fileContents.size === 0) {
          notes.push(`policy "${p.id}": secret scan NO ejecutado (sin contenido/--repo); no se afirma ausencia de secretos.`);
          break;
        }
        const extra = p.secret_patterns ?? [];
        const hitFiles: string[] = [];
        for (const [file, content] of ctx.fileContents) {
          if (scanForSecrets(content, extra).length > 0) hitFiles.push(file);
        }
        if (hitFiles.length > 0) {
          matched = true;
          reason = `patrón secret-like detectado (heurístico) en: ${hitFiles.join(", ")}`;
        } else {
          notes.push(`policy "${p.id}": no secret-like pattern detected by basic heuristic (best-effort, no garantiza ausencia).`);
        }
        break;
      }
    }

    if (!matched) continue;

    // Bloqueo: secretos = duro siempre; el resto bloquea si severity >= threshold.
    const blocking = p.block_condition === "secret_pattern" || SEV_RANK[sev] >= SEV_RANK[threshold];
    findings.push({
      policy_id: p.id,
      title: p.title,
      severity: sev,
      block_condition: p.block_condition,
      blocking,
      approval_required: p.approval_required,
      reason,
      required_action: defaultAction(p, p.block_condition),
    });
  }

  const blocking = findings.filter((f) => f.blocking).length;
  return { evaluated: policies.length, findings, blocking, notes, ok: blocking === 0 };
}

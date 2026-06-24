import { execFileSync } from "node:child_process";

/** Error operacional (git ausente, base inexistente, etc.) → exit code 2. */
export class GitError extends Error {}

function git(args: string[], cwd?: string): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new GitError(msg);
  }
}

/** ¿Está git disponible en el PATH? */
export function isGitAvailable(): boolean {
  try {
    git(["--version"]);
    return true;
  } catch {
    return false;
  }
}

/** Raíz del repo (toplevel). Lanza GitError si no estamos en un repo. */
export function repoRoot(cwd?: string): string {
  return git(["rev-parse", "--show-toplevel"], cwd).trim();
}

/** ¿cwd está dentro de un work tree de git? */
export function isGitRepo(cwd?: string): boolean {
  try {
    return git(["rev-parse", "--is-inside-work-tree"], cwd).trim() === "true";
  } catch {
    return false;
  }
}

/** ¿Resuelve <ref> a un commit? (para validar la base branch). */
export function refExists(ref: string, cwd?: string): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

export interface DiffOptions {
  /** Modo staged: git diff --name-only --cached. Ignora `base`. */
  staged?: boolean;
  /** Base branch para el modo principal: git diff --name-only <base>...HEAD. */
  base?: string;
}

/**
 * Lista los archivos modificados (relativos a la raíz del repo).
 * - base mode (default): cambios introducidos por la rama desde su divergencia con <base> (three-dot).
 * - staged mode: cambios en el index (pre-commit local).
 */
export function diffNames(opts: DiffOptions, cwd?: string): string[] {
  const root = repoRoot(cwd);
  let args: string[];

  if (opts.staged) {
    args = ["diff", "--name-only", "--cached"];
  } else {
    const base = opts.base ?? "main";
    if (!refExists(base, root)) {
      throw new GitError(`no se pudo resolver la base branch "${base}" (¿existe la rama?).`);
    }
    args = ["diff", "--name-only", `${base}...HEAD`];
  }

  return git(args, root)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

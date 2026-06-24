import picomatch from "picomatch";

/**
 * Matching de paths contra patrones `owns:`. Un archivo está EN SCOPE si coincide con
 * al menos un patrón. Soporta literales (`src/routes/x.ts`) y globs (`src/invoices/**`).
 * Se usa picomatch (zero-dep, de-facto matcher de globby/micromatch) en vez de implementar
 * glob a mano: `**`, `*`, charclasses y extglobs son sutiles y propensos a bugs.
 */
export function makeMatcher(patterns: string[]): (file: string) => boolean {
  // dot:true → matchear archivos como .env-like si se declaran; basename:false → match de ruta completa.
  const isMatch = picomatch(patterns, { dot: true });
  return (file: string) => isMatch(normalize(file));
}

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

export interface ScopeResult {
  inScope: string[];
  outOfScope: string[];
}

/** Clasifica los archivos modificados en dentro/fuera del scope declarado por `owns`. */
export function classifyDiff(files: string[], owns: string[]): ScopeResult {
  const match = makeMatcher(owns);
  const inScope: string[] = [];
  const outOfScope: string[] = [];
  for (const f of files) {
    (match(f) ? inScope : outOfScope).push(f);
  }
  return { inScope, outOfScope };
}

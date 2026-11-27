import { gzipSync } from 'node:zlib';

/**
 * Startup budget helpers (SPEC 18: first meaningful screen < 1 s from cache).
 * Pure functions over file contents so they can be tested without a build.
 */

/** Relative JS files a chunk imports statically (not `import()` calls). */
export function staticImports(code: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\bimport\s*(?:[\w*${}\s,]+?\s*from\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g,
    /\bexport\s*(?:\*|\{[^}]*\})\s*from\s*["'](\.{1,2}\/[^"']+\.js)["']/g,
  ];
  for (const re of patterns) {
    for (const m of code.matchAll(re)) if (m[1]) found.add(m[1]);
  }
  return [...found];
}

/** Script and modulepreload paths referenced by index.html. */
export function entryScripts(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) {
    if (m[1]) out.add(m[1]);
  }
  for (const m of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)) {
    if (m[1]) out.add(m[1]);
  }
  return [...out];
}

/**
 * All chunks loaded before the app can render: the entry scripts and,
 * transitively, their static imports. `read` returns a chunk's code by its
 * path relative to the assets directory.
 */
export function initialChunks(
  entries: readonly string[],
  read: (file: string) => string,
): string[] {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const dep of staticImports(read(file))) {
      queue.push(dep.replace(/^\.\//, ''));
    }
  }
  return [...seen];
}

export const gzipSize = (content: string | Uint8Array): number => gzipSync(content).length;

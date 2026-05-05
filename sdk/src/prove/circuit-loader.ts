import type { CompiledCircuit } from "@noir-lang/noir_js";

/**
 * Load a compiled Noir circuit from various source formats.
 *
 * - If it's already a `CompiledCircuit` (has a `bytecode` property), return as-is.
 * - If `Uint8Array`, decode as UTF-8 JSON.
 * - If a string starting with `http://` or `https://`, or if running in a browser
 *   (`typeof window !== 'undefined'`), use `fetch()`.
 * - Otherwise treat as a Node.js file path and read with `fs/promises`.
 */
export async function loadCircuit(
  source: string | Uint8Array | CompiledCircuit,
): Promise<CompiledCircuit> {
  // Already a CompiledCircuit object
  if (
    typeof source === "object" &&
    source !== null &&
    !(source instanceof Uint8Array) &&
    "bytecode" in source
  ) {
    return source as CompiledCircuit;
  }

  // Uint8Array — decode as UTF-8 JSON
  if (source instanceof Uint8Array) {
    const text = new TextDecoder().decode(source);
    return JSON.parse(text) as CompiledCircuit;
  }

  // String source
  const isUrl =
    source.startsWith("http://") || source.startsWith("https://");
  const isBrowser = globalThis.window !== undefined;

  if (isUrl || isBrowser) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch circuit artifact at ${source}: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as CompiledCircuit;
  }

  // Node.js file path
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(source, "utf-8");
  return JSON.parse(content) as CompiledCircuit;
}

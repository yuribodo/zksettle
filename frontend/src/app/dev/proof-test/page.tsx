"use client";

import { useState } from "react";

import { useProofGeneration } from "@/hooks/use-proof-generation";
import { PROOF_FIXTURE } from "@/lib/proof-fixture";

function formatBytes(buf: Uint8Array): string {
  return Array.from(buf.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .concat(`… (${buf.length} bytes)`);
}

export default function ProofTestPage() {
  const { generate, proof, isGenerating, error, durationMs } = useProofGeneration();
  const [history, setHistory] = useState<number[]>([]);

  async function handleGenerate() {
    try {
      const result = await generate(PROOF_FIXTURE);
      setHistory((h) => [...h, result.durationMs]);
    } catch {
      // surfaced via `error`
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8 font-mono text-sm">
      <h1 className="mb-2 text-xl">Proof generation smoke test</h1>
      <p className="mb-6 text-neutral-400">
        Runs <code>useProofGeneration()</code> against the fixture inputs from
        <code> circuits/Prover.toml</code>. Watch DevTools → Performance to
        confirm the main thread stays interactive while proving.
      </p>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="rounded bg-white px-4 py-2 text-black disabled:opacity-50"
      >
        {isGenerating ? "Generating…" : "Generate proof"}
      </button>

      {error && (
        <pre className="mt-6 whitespace-pre-wrap rounded border border-red-500/40 bg-red-500/10 p-4 text-red-300">
          {error.message}
        </pre>
      )}

      {proof && (
        <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
          <dt className="text-neutral-400">Duration</dt>
          <dd>{durationMs?.toFixed(0)} ms</dd>
          <dt className="text-neutral-400">Proof</dt>
          <dd className="break-all">{formatBytes(proof.proof)}</dd>
          <dt className="text-neutral-400">Public inputs</dt>
          <dd>{proof.publicInputs.length} fields</dd>
        </dl>
      )}

      {history.length > 0 && (
        <p className="mt-6 text-neutral-400">
          Run history (ms): {history.map((t) => t.toFixed(0)).join(", ")}
        </p>
      )}
    </main>
  );
}

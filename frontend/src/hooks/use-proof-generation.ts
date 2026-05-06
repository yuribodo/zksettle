"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import {
  Noir,
  type CompiledCircuit,
  type InputMap,
} from "@noir-lang/noir_js";

import type { ProofInputs, ProofResult } from "@/types/proof";

const ARTIFACT_URL = "/circuits/zksettle_slice.json";

/**
 * Translate camelCase TypeScript inputs to the snake_case Noir parameter
 * names declared in `circuits/src/main.nr`. The order of the keys does not
 * matter to `noir_js` — it resolves them by name from the ABI.
 */
function toNoirInputs(inputs: ProofInputs): InputMap {
  return {
    merkle_root: inputs.merkleRoot,
    nullifier: inputs.nullifier,
    mint_lo: inputs.mintLo,
    mint_hi: inputs.mintHi,
    epoch: inputs.epoch,
    recipient_lo: inputs.recipientLo,
    recipient_hi: inputs.recipientHi,
    amount: inputs.amount,
    sanctions_root: inputs.sanctionsRoot,
    jurisdiction_root: inputs.jurisdictionRoot,
    timestamp: inputs.timestamp,
    wallet: inputs.wallet,
    path: inputs.path,
    path_indices: inputs.pathIndices,
    private_key: inputs.privateKey,
    sanctions_path: inputs.sanctionsPath,
    sanctions_path_indices: inputs.sanctionsPathIndices,
    sanctions_leaf_value: inputs.sanctionsLeafValue,
    jurisdiction: inputs.jurisdiction,
    jurisdiction_path: inputs.jurisdictionPath,
    jurisdiction_path_indices: inputs.jurisdictionPathIndices,
    credential_expiry: inputs.credentialExpiry,
  } satisfies InputMap;
}

interface ProverHandles {
  noir: Noir;
  backend: UltraHonkBackend;
  api: Barretenberg;
}

interface UseProofGenerationResult {
  generate: (inputs: ProofInputs) => Promise<ProofResult>;
  /** Get the Barretenberg API instance (initializes prover if needed). */
  ensureApi: () => Promise<Barretenberg>;
  proof: ProofResult | null;
  isGenerating: boolean;
  error: Error | null;
  /** Last successful generation time. Cleared on a new generate() call. */
  durationMs: number | null;
}

/**
 * Generate compliance proofs in the browser. The heavy lifting (witness
 * solving, UltraHonk proving, CRS download) happens inside `@aztec/bb.js`,
 * which spawns its own internal worker pool — this hook intentionally does
 * not wrap a separate Web Worker. That avoids a Turbopack `import.meta.url`
 * issue with the Noir wasm-bindgen init code, and matches the canonical
 * pattern in `noir-lang/noir-examples`.
 */
export function useProofGeneration(): UseProofGenerationResult {
  const proverRef = useRef<ProverHandles | null>(null);
  const proverInitRef = useRef<Promise<ProverHandles> | null>(null);

  const [proof, setProof] = useState<ProofResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    return () => {
      proverRef.current?.api.destroy().catch(() => {
        // best-effort cleanup; swallow during unmount
      });
      proverRef.current = null;
      proverInitRef.current = null;
    };
  }, []);

  const ensureProver = useCallback((): Promise<ProverHandles> => {
    if (proverRef.current) {
      return Promise.resolve(proverRef.current);
    }
    // Coalesce concurrent callers (e.g. a double-click during the ~20s cold
    // start) onto the same in-flight init promise. Without this, both calls
    // would each spawn a Barretenberg worker pool and the loser's `api`
    // would leak — `destroy()` is never called on the orphaned instance.
    if (!proverInitRef.current) {
      proverInitRef.current = (async () => {
        try {
          const res = await fetch(ARTIFACT_URL);
          if (!res.ok) {
            throw new Error(
              `Failed to fetch circuit artifact at ${ARTIFACT_URL}: ${res.status} ${res.statusText}`,
            );
          }
          const circuit = (await res.json()) as CompiledCircuit;
          const threads =
            typeof navigator !== "undefined" && navigator.hardwareConcurrency
              ? Math.min(navigator.hardwareConcurrency, 8)
              : 4;
          const api = await Barretenberg.new({ threads });
          const noir = new Noir(circuit);
          const backend = new UltraHonkBackend(circuit.bytecode, api);
          const handles: ProverHandles = { noir, backend, api };
          proverRef.current = handles;
          return handles;
        } catch (err) {
          // Reset so a later retry can attempt init again.
          proverInitRef.current = null;
          throw err;
        }
      })();
    }
    return proverInitRef.current;
  }, []);

  const ensureApi = useCallback(async (): Promise<Barretenberg> => {
    const { api } = await ensureProver();
    return api;
  }, [ensureProver]);

  const generate = useCallback(
    async (inputs: ProofInputs): Promise<ProofResult> => {
      if (typeof window === "undefined") {
        throw new Error("useProofGeneration() requires a browser");
      }
      setIsGenerating(true);
      setError(null);
      setProof(null);
      const start = performance.now();
      try {
        const { noir, backend } = await ensureProver();
        const { witness } = await noir.execute(toNoirInputs(inputs));
        const { proof: proofBytes, publicInputs } = await backend.generateProof(witness);
        const result: ProofResult = {
          proof: proofBytes,
          publicInputs,
          durationMs: performance.now() - start,
        };
        setProof(result);
        return result;
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        throw wrapped;
      } finally {
        setIsGenerating(false);
      }
    },
    [ensureProver],
  );

  return {
    generate,
    ensureApi,
    proof,
    isGenerating,
    error,
    durationMs: proof?.durationMs ?? null,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Noir,
  type CompiledCircuit,
  type InputMap,
} from "@noir-lang/noir_js";

import { proveGroth16 } from "@/lib/api/endpoints";
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
}

interface UseProofGenerationResult {
  generate: (inputs: ProofInputs) => Promise<ProofResult>;
  proof: ProofResult | null;
  isGenerating: boolean;
  error: Error | null;
  /** Last successful generation time. Cleared on a new generate() call. */
  durationMs: number | null;
}

/**
 * Generate compliance proofs. Witness solving runs in the browser via
 * `@noir-lang/noir_js` (the ACIR is fetched from `/circuits/...` and reused
 * across regenerations); proving itself is delegated to the server-side
 * Sunspot/Groth16 endpoint so the bundle format matches the on-chain
 * `gnark_verifier_solana`. Heavy `@aztec/bb.js` (Barretenberg + UltraHonk
 * backend) was removed entirely as part of the same migration.
 */
export function useProofGeneration(): UseProofGenerationResult {
  const proverRef = useRef<ProverHandles | null>(null);
  const proverInitRef = useRef<Promise<ProverHandles> | null>(null);

  const [proof, setProof] = useState<ProofResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    return () => {
      proverRef.current = null;
      proverInitRef.current = null;
    };
  }, []);

  const ensureProver = useCallback((): Promise<ProverHandles> => {
    if (proverRef.current) {
      return Promise.resolve(proverRef.current);
    }
    // Coalesce concurrent callers (e.g. a double-click) onto the same
    // in-flight init promise so we fetch the ACIR once and reuse the Noir
    // executor across regenerations.
    proverInitRef.current ??= (async () => {
        try {
          const res = await fetch(ARTIFACT_URL);
          if (!res.ok) {
            throw new Error(
              `Failed to fetch circuit artifact at ${ARTIFACT_URL}: ${res.status} ${res.statusText}`,
            );
          }
          const circuit = (await res.json()) as CompiledCircuit;
          const noir = new Noir(circuit);
          const handles: ProverHandles = { noir };
          proverRef.current = handles;
          return handles;
        } catch (err) {
          // Reset so a later retry can attempt init again.
          proverInitRef.current = null;
          throw err;
        }
      })();
    return proverInitRef.current;
  }, []);

  const generate = useCallback(
    async (inputs: ProofInputs): Promise<ProofResult> => {
      if (globalThis.window === undefined) {
        throw new TypeError("useProofGeneration() requires a browser");
      }
      setIsGenerating(true);
      setError(null);
      setProof(null);
      const start = performance.now();
      try {
        const { noir } = await ensureProver();
        // Browser still solves the witness via @noir-lang/noir_js — only
        // proving moves to the server. The `witness` Uint8Array is the same
        // gzipped Noir witness format that `sunspot prove` consumes.
        const { witness } = await noir.execute(toNoirInputs(inputs));
        const { proof: proofBytes, publicInputs } = await proveGroth16(witness);
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
    proof,
    isGenerating,
    error,
    durationMs: proof?.durationMs ?? null,
  };
}

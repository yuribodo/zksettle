"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ProofInputs,
  ProofResult,
  ProofWorkerRequest,
  ProofWorkerResponse,
} from "@/types/proof";

interface UseProofGenerationResult {
  generate: (inputs: ProofInputs) => Promise<ProofResult>;
  proof: ProofResult | null;
  isGenerating: boolean;
  error: Error | null;
  /** Last successful generation time. Cleared on a new generate() call. */
  durationMs: number | null;
}

/**
 * Generate Groth16 / UltraHonk compliance proofs in a Web Worker so the UI
 * thread does not block during the (1–10s) proving phase.
 *
 * The worker is spawned lazily on the first `generate()` call and kept warm
 * for subsequent calls. Concurrent generate() calls reject the previous one.
 */
export function useProofGeneration(): UseProofGenerationResult {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<{
    id: string;
    resolve: (r: ProofResult) => void;
    reject: (e: Error) => void;
  } | null>(null);

  const [proof, setProof] = useState<ProofResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const generate = useCallback((inputs: ProofInputs): Promise<ProofResult> => {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("useProofGeneration() requires a browser"));
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/proof-worker.ts", import.meta.url),
        { type: "module", name: "zksettle-proof-worker" },
      );
      workerRef.current.addEventListener("message", (event: MessageEvent<ProofWorkerResponse>) => {
        const pending = pendingRef.current;
        if (!pending || pending.id !== event.data.id) {
          return;
        }
        pendingRef.current = null;
        setIsGenerating(false);
        if (event.data.type === "result") {
          setProof(event.data.result);
          setError(null);
          pending.resolve(event.data.result);
        } else {
          const err = new Error(event.data.message);
          setError(err);
          pending.reject(err);
        }
      });
      workerRef.current.addEventListener("error", (event) => {
        const pending = pendingRef.current;
        const err = new Error(event.message || "Worker crashed");
        pendingRef.current = null;
        setIsGenerating(false);
        setError(err);
        pending?.reject(err);
      });
    }

    if (pendingRef.current) {
      pendingRef.current.reject(new Error("Superseded by a newer generate() call"));
    }

    setIsGenerating(true);
    setError(null);
    setProof(null);

    return new Promise<ProofResult>((resolve, reject) => {
      const id = crypto.randomUUID();
      pendingRef.current = { id, resolve, reject };
      const artifactUrl = new URL(
        "/circuits/zksettle_slice.json",
        window.location.origin,
      ).toString();
      const request: ProofWorkerRequest = {
        id,
        type: "generate",
        inputs,
        artifactUrl,
      };
      workerRef.current!.postMessage(request);
    });
  }, []);

  return {
    generate,
    proof,
    isGenerating,
    error,
    durationMs: proof?.durationMs ?? null,
  };
}

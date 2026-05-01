/// <reference lib="webworker" />

import { Noir, type CompiledCircuit, type InputMap } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";

import type {
  ProofInputs,
  ProofWorkerRequest,
  ProofWorkerResponse,
} from "@/types/proof";

let circuitPromise: Promise<CompiledCircuit> | null = null;

function loadCircuit(url: string): Promise<CompiledCircuit> {
  if (!circuitPromise) {
    circuitPromise = fetch(url).then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `Failed to fetch circuit artifact at ${url}: ${res.status} ${res.statusText}`,
        );
      }
      return (await res.json()) as CompiledCircuit;
    });
  }
  return circuitPromise;
}

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

self.addEventListener("message", async (event: MessageEvent<ProofWorkerRequest>) => {
  const { id, type } = event.data;
  if (type !== "generate") {
    return;
  }

  const start = performance.now();
  try {
    const circuit = await loadCircuit(event.data.artifactUrl);
    const noir = new Noir(circuit);
    const backend = new UltraHonkBackend(circuit.bytecode);

    const { witness } = await noir.execute(toNoirInputs(event.data.inputs));
    const { proof, publicInputs } = await backend.generateProof(witness);

    const response: ProofWorkerResponse = {
      id,
      type: "result",
      result: {
        proof,
        publicInputs,
        durationMs: performance.now() - start,
      },
    };
    self.postMessage(response, { transfer: [proof.buffer] });
  } catch (err) {
    const response: ProofWorkerResponse = {
      id,
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
});

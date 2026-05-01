/**
 * Inputs for the Noir compliance circuit.
 *
 * Field names are camelCase mirrors of the snake_case parameters declared in
 * `circuits/src/main.nr`. The worker translates back to snake_case before
 * calling `noir.execute()`.
 *
 * Public-input order is load-bearing — see the table in
 * `circuits/src/main.nr` and `frontend/public/circuits/README.md`.
 *
 * All Field values must be strings (decimal or `0x`-prefixed hex). Path
 * indices are `0` or `1` (Noir `u1`).
 */
export interface ProofInputs {
  // Public inputs (indices 0–10)
  merkleRoot: string;
  nullifier: string;
  mintLo: string;
  mintHi: string;
  epoch: string;
  recipientLo: string;
  recipientHi: string;
  amount: string;
  sanctionsRoot: string;
  jurisdictionRoot: string;
  timestamp: string;
  // Private inputs
  wallet: string;
  path: string[];
  pathIndices: number[];
  privateKey: string;
  sanctionsPath: string[];
  sanctionsPathIndices: number[];
  sanctionsLeafValue: string;
  jurisdiction: string;
  jurisdictionPath: string[];
  jurisdictionPathIndices: number[];
  credentialExpiry: string;
}

export interface ProofResult {
  /** UltraHonk proof bytes. */
  proof: Uint8Array;
  /** Public inputs in the order declared by the circuit (length 11). */
  publicInputs: string[];
  /** Wall-clock proof generation time, measured in the worker. */
  durationMs: number;
}

/**
 * Messages posted from the main thread to the worker.
 */
export type ProofWorkerRequest = {
  id: string;
  type: "generate";
  inputs: ProofInputs;
  /**
   * Absolute URL of the compiled circuit artifact. The main thread resolves
   * this from `window.location.origin` because Turbopack workers run with a
   * `blob:` base URL that can't anchor relative fetches.
   */
  artifactUrl: string;
};

/**
 * Messages posted from the worker back to the main thread.
 */
export type ProofWorkerResponse =
  | {
      id: string;
      type: "result";
      result: ProofResult;
    }
  | {
      id: string;
      type: "error";
      message: string;
    };

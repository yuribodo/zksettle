import { EXPIRED_PROOF_ERROR } from "./proof-bytes";

export type DemoStepStatus = "ok" | "fail";

export interface DemoStep {
  readonly label: string;
  readonly durationMs: number;
  readonly status: DemoStepStatus;
  readonly error?: string;
}

/**
 * Ordered terminal lines rendered by the landing-page demo console on the
 * happy path. Each `durationMs` is a real setTimeout delay (no animation
 * tweening) so the total wall-clock elapses at exactly 4,710 ms — the same
 * figure surfaced in the final `duration: 4.71s` summary line.
 */
export const DEMO_STEPS: readonly DemoStep[] = [
  { label: "[1/4] Loading credential ......... ok", durationMs: 320, status: "ok" },
  { label: "[2/4] Building Merkle path ....... ok", durationMs: 540, status: "ok" },
  { label: "[3/4] Computing Poseidon hashes .. ok", durationMs: 1180, status: "ok" },
  { label: "[4/4] Generating Groth16 proof ... ok", durationMs: 2670, status: "ok" },
];

/**
 * Expired-credential variant: steps 1–2 succeed, step 3 fails with the
 * canonical `EXPIRED_PROOF_ERROR` text. Step 4 is never reached; the terminal
 * halts after the failing Poseidon line (rendered in `--danger-text`).
 */
export const EXPIRED_DEMO_STEPS: readonly DemoStep[] = [
  { label: "[1/4] Loading credential ......... ok", durationMs: 320, status: "ok" },
  { label: "[2/4] Building Merkle path ....... ok", durationMs: 540, status: "ok" },
  {
    label: "[3/4] Computing Poseidon hashes .. fail",
    durationMs: 980,
    status: "fail",
    error: EXPIRED_PROOF_ERROR,
  },
];

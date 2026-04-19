import { describe, expect, it } from "vitest";
import {
  DEMO_STEPS,
  EXPIRED_DEMO_STEPS,
  type DemoStep,
} from "./demo-script";
import {
  DEVNET_TX_HASH,
  EXPIRED_BLOCK,
  EXPIRED_PROOF_ERROR,
  NULLIFIER,
  SOLSCAN_URL,
  VALID_PROOF,
} from "./proof-bytes";

function totalDuration(steps: readonly DemoStep[]): number {
  return steps.reduce((acc, step) => acc + step.durationMs, 0);
}

describe("proof-bytes", () => {
  it("VALID_PROOF encodes exactly 256 bytes of hex", () => {
    expect(VALID_PROOF.startsWith("0x")).toBe(true);
    const hex = VALID_PROOF.slice(2);
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex.length).toBe(512);
    expect(hex.length / 2).toBe(256);
  });

  it("NULLIFIER is a 32-byte hex value", () => {
    expect(NULLIFIER.startsWith("0x")).toBe(true);
    const hex = NULLIFIER.slice(2);
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex.length).toBe(64);
  });

  it("EXPIRED_PROOF_ERROR embeds the en-US formatted expired block", () => {
    expect(EXPIRED_PROOF_ERROR).toBe(
      "proof rejected · credential expired (block 287,901,433)",
    );
    expect(EXPIRED_BLOCK).toBe(287_901_433);
  });

  it("SOLSCAN_URL points at the placeholder devnet tx hash", () => {
    expect(SOLSCAN_URL).toBe(
      `https://solscan.io/tx/${DEVNET_TX_HASH}?cluster=devnet`,
    );
  });
});

describe("DEMO_STEPS", () => {
  it("has four sequential steps that cover the canonical proving stages", () => {
    expect(DEMO_STEPS).toHaveLength(4);
    expect(DEMO_STEPS[0]!.label).toContain("[1/4]");
    expect(DEMO_STEPS[1]!.label).toContain("Merkle");
    expect(DEMO_STEPS[2]!.label).toContain("Poseidon");
    expect(DEMO_STEPS[3]!.label).toContain("Groth16");
    expect(DEMO_STEPS.every((step) => step.status === "ok")).toBe(true);
  });

  it("total wall-clock is exactly 4,710 ms", () => {
    expect(totalDuration(DEMO_STEPS)).toBe(4710);
  });
});

describe("EXPIRED_DEMO_STEPS", () => {
  it("halts after step 3 with a failure carrying the expired-proof error", () => {
    expect(EXPIRED_DEMO_STEPS).toHaveLength(3);
    const failing = EXPIRED_DEMO_STEPS[2]!;
    expect(failing.status).toBe("fail");
    expect(failing.error).toBe(EXPIRED_PROOF_ERROR);
    expect(failing.label).toContain("[3/4]");
    expect(failing.label).toContain("fail");
  });

  it("preserves the first two ok steps from the happy path", () => {
    expect(EXPIRED_DEMO_STEPS[0]).toEqual(DEMO_STEPS[0]);
    expect(EXPIRED_DEMO_STEPS[1]).toEqual(DEMO_STEPS[1]);
  });
});

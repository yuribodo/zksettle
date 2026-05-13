import { describe, expect, it } from "vitest";

import { computeNullifier, type NullifierInputs } from "./nullifier";

// Regression vectors pin the `@zkpassport/poseidon2` (`poseidon2Hash`) output
// for fixed seven-field inputs. Drift here means either the dependency
// changed its parameters/IV/sponge layout or `computeNullifier`'s field
// ordering changed — either way the on-chain `nullifier_hash` binding to
// `Issuer.nullifiers` (`programs/zksettle/src/state/issuer.rs`) would silently
// fork and orphan every pre-existing nullifier.
//
// Outputs computed against `@zkpassport/poseidon2@0.6.2`. When upgrading the
// dependency, regenerate with `node` against the new module and cross-check
// at least one vector against `@aztec/bb.js` `poseidon2Hash` before pinning.
describe("computeNullifier — Poseidon2 regression vectors", () => {
  const PRIME =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

  const cases: Array<{
    name: string;
    inputs: NullifierInputs;
    expected: string;
  }> = [
    {
      name: "sequential 1..7",
      inputs: {
        privateKey: "1",
        mintLo: "2",
        mintHi: "3",
        epoch: "4",
        recipientLo: "5",
        recipientHi: "6",
        amount: "7",
      },
      expected:
        "0x16f929bc0d216df4b05bdc44222463edf2b9791bd949ab926eebda06a502d238",
    },
    {
      name: "mixed wide values",
      inputs: {
        privateKey: "0x0123456789abcdef",
        mintLo: "0xfedcba9876543210",
        mintHi: "100",
        epoch: "86400",
        recipientLo: "0xdeadbeef",
        recipientHi: "0xcafebabe",
        amount: "1000000",
      },
      expected:
        "0x083493f3f4a133bb2ad73a06e77fb3f6475a43b9acee58606bf8f986dfbb9fe7",
    },
    {
      name: "all zeros",
      inputs: {
        privateKey: "0",
        mintLo: "0",
        mintHi: "0",
        epoch: "0",
        recipientLo: "0",
        recipientHi: "0",
        amount: "0",
      },
      expected:
        "0x0c98aea3cf46e23f09b3de79dd0f85080820f47f0aa9371a2defe633a487cdc8",
    },
  ];

  for (const { name, inputs, expected } of cases) {
    it(name, async () => {
      const got = await computeNullifier(inputs);
      expect(got).toBe(expected);
    });
  }

  it("rejects negative inputs", async () => {
    await expect(
      computeNullifier({
        privateKey: "-1",
        mintLo: "0",
        mintHi: "0",
        epoch: "0",
        recipientLo: "0",
        recipientHi: "0",
        amount: "0",
      }),
    ).rejects.toThrow(/outside BN254/);
  });

  it("rejects inputs >= field prime", async () => {
    await expect(
      computeNullifier({
        privateKey: PRIME.toString(),
        mintLo: "0",
        mintHi: "0",
        epoch: "0",
        recipientLo: "0",
        recipientHi: "0",
        amount: "0",
      }),
    ).rejects.toThrow(/outside BN254/);
  });

  it("output is always 32-byte 0x-hex", async () => {
    const got = await computeNullifier({
      privateKey: "1",
      mintLo: "0",
      mintHi: "0",
      epoch: "0",
      recipientLo: "0",
      recipientHi: "0",
      amount: "0",
    });
    expect(got).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

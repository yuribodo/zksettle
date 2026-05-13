import { poseidon2Hash } from "@zkpassport/poseidon2";

export interface NullifierInputs {
  privateKey: string;
  mintLo: string;
  mintHi: string;
  epoch: string;
  recipientLo: string;
  recipientHi: string;
  amount: string;
}

// BN254 scalar field modulus. `poseidon2Hash` silently reduces inputs mod p,
// so reject out-of-range values at the boundary instead of letting a
// malformed caller mint a nullifier that aliases a different field element.
const BN254_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Aztec-style Poseidon2 sponge over BN254 for the seven fields the circuit
 * absorbs at `circuits/src/main.nr:127`. `@zkpassport/poseidon2` is a pure-TS
 * impl whose IV (`N * 2^64`), sponge layout (t=4, rate=3, capacity slot 3),
 * permutation parameters, and squeeze convention match Barretenberg's
 * `poseidon2Hash` byte-for-byte — verified against `@aztec/bb.js` on the full
 * seven-field input vector before the prover-side `bb.js` removal. The legacy
 * `Barretenberg` argument is gone; callers don't need a wasm handle anymore.
 */
export async function computeNullifier(fields: NullifierInputs): Promise<string> {
  const labelled: ReadonlyArray<readonly [keyof NullifierInputs, string]> = [
    ["privateKey", fields.privateKey],
    ["mintLo", fields.mintLo],
    ["mintHi", fields.mintHi],
    ["epoch", fields.epoch],
    ["recipientLo", fields.recipientLo],
    ["recipientHi", fields.recipientHi],
    ["amount", fields.amount],
  ];
  const inputs = labelled.map(([name, raw]) => {
    const n = BigInt(raw);
    if (n < 0n || n >= BN254_PRIME) {
      throw new RangeError(
        `Nullifier input "${name}" outside BN254 scalar field: ${raw}`,
      );
    }
    return n;
  });

  const hash = poseidon2Hash(inputs);
  const hex = hash.toString(16);
  if (hex.length > 64) {
    throw new RangeError(`Poseidon2 output overflowed 32 bytes: 0x${hex}`);
  }
  return "0x" + hex.padStart(64, "0");
}

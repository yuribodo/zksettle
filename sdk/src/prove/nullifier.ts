import type { Barretenberg } from "@aztec/bb.js";

/**
 * Compute the circuit-compatible nullifier:
 * poseidon2_hash([privateKey, mintLo, mintHi, epoch, recipientLo, recipientHi, amount])
 *
 * Each input is converted to a 32-byte big-endian representation before hashing.
 */
export async function computeNullifier(
  api: Barretenberg,
  privateKey: string,
  mintLo: string,
  mintHi: string,
  epoch: string,
  recipientLo: string,
  recipientHi: string,
  amount: string,
): Promise<string> {
  const inputs = [privateKey, mintLo, mintHi, epoch, recipientLo, recipientHi, amount]
    .map(fieldToBytes32);

  const { hash } = await api.poseidon2Hash({ inputs });
  return "0x" + Array.from(hash).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fieldToBytes32(value: string): Uint8Array {
  const n: bigint = BigInt(value);
  const buf = new Uint8Array(32);
  let rem = n;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(rem & 0xffn);
    rem >>= 8n;
  }
  return buf;
}

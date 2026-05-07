import type { Barretenberg } from "@aztec/bb.js";

export interface NullifierInputs {
  privateKey: string;
  mintLo: string;
  mintHi: string;
  epoch: string;
  recipientLo: string;
  recipientHi: string;
  amount: string;
}

export async function computeNullifier(
  api: Barretenberg,
  fields: NullifierInputs,
): Promise<string> {
  const inputs = [
    fields.privateKey,
    fields.mintLo,
    fields.mintHi,
    fields.epoch,
    fields.recipientLo,
    fields.recipientHi,
    fields.amount,
  ].map(fieldToBytes32);

  const { hash } = await api.poseidon2Hash({ inputs });
  return (
    "0x" +
    Array.from(hash)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

const BN254_MAX = (1n << 254n) - 1n;

function fieldToBytes32(value: string): Uint8Array {
  const n = BigInt(value);
  if (n < 0n || n > BN254_MAX) {
    throw new RangeError(`Field value out of BN254 range: ${value}`);
  }
  const buf = new Uint8Array(32);
  let rem = n;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(rem & 0xffn);
    rem >>= 8n;
  }
  return buf;
}

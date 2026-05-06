import type { Barretenberg } from "@aztec/bb.js";

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
  const inputs = [
    privateKey,
    mintLo,
    mintHi,
    epoch,
    recipientLo,
    recipientHi,
    amount,
  ].map(fieldToBytes32);

  const { hash } = await api.poseidon2Hash({ inputs });
  return (
    "0x" +
    Array.from(hash)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function fieldToBytes32(value: string): Uint8Array {
  let n: bigint = value.startsWith("0x") ? BigInt(value) : BigInt(value);
  const buf = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

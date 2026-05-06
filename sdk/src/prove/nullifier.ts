import { Barretenberg } from "@aztec/bb.js";

const BN254_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * nullifier = Poseidon2(private_key, mint_lo, mint_hi, epoch, recipient_lo, recipient_hi, amount)
 */
export async function computeNullifier(
  privateKey: string,
  mintLo: string,
  mintHi: string,
  epoch: string,
  recipientLo: string,
  recipientHi: string,
  amount: string,
  api?: Barretenberg,
): Promise<string> {
  const owned = !api;
  api ??= await Barretenberg.new({ threads: 1 });
  try {
    const inputs = [privateKey, mintLo, mintHi, epoch, recipientLo, recipientHi, amount].map(
      (v) => toField(v),
    );
    const { hash } = await api.poseidon2Hash({ inputs });
    return "0x" + Buffer.from(hash).toString("hex");
  } finally {
    if (owned) await api.destroy();
  }
}

function toField(value: string): Uint8Array {
  const buf = new Uint8Array(32);
  let n: bigint;
  if (value.startsWith("0x")) {
    const hex = value.slice(2).padStart(64, "0");
    n = BigInt("0x" + hex);
    for (let i = 0; i < 32; i++) {
      buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
  } else {
    n = BigInt(value);
    for (let i = 31; i >= 0; i--) {
      buf[i] = Number(n >> BigInt((31 - i) * 8) & 0xffn);
    }
  }
  if (n < 0n || n >= BN254_MODULUS) {
    throw new RangeError(`Value ${value} is outside BN254 field range`);
  }
  return buf;
}

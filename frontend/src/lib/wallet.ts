import { PublicKey } from "@solana/web3.js";

const HEX_RE = /^[0-9a-f]{64}$/;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function normalizeWalletHex(input: string): string {
  return input.trim().toLowerCase().replace(/^0x/, "");
}

function tryBase58ToHex(input: string): string | null {
  const trimmed = input.trim();
  if (!BASE58_RE.test(trimmed)) return null;
  try {
    const pk = new PublicKey(trimmed);
    return bytesToHex([...pk.toBytes()]);
  } catch {
    return null;
  }
}

export function normalizeWalletInput(input: string): string | null {
  const hex = normalizeWalletHex(input);
  if (HEX_RE.test(hex)) return hex;
  return tryBase58ToHex(input);
}

export function isValidWalletInput(input: string): boolean {
  return normalizeWalletInput(input) !== null;
}

export function isValidWalletHex(input: string): boolean {
  return HEX_RE.test(normalizeWalletHex(input));
}

export function bytesToHex(bytes: readonly number[]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, "0")).join("");
}

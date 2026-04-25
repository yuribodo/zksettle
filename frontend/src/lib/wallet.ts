const HEX_RE = /^[0-9a-f]{64}$/;

export function normalizeWalletHex(input: string): string {
  return input.trim().toLowerCase().replace(/^0x/, "");
}

export function isValidWalletHex(input: string): boolean {
  return HEX_RE.test(normalizeWalletHex(input));
}

export function bytesToHex(bytes: readonly number[]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, "0")).join("");
}

import type { PublicKey } from "@solana/web3.js";

import { bytesToHex } from "@/lib/wallet";

const REPLAY_WINDOW_MS = 240_000; // refresh 60s before the 300s server window

interface CachedSignature {
  walletHex: string;
  signature: string;
  timestamp: number;
  expiresAt: number;
}

let cached: CachedSignature | null = null;
let inflight: Promise<Record<string, string>> | null = null;

export type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;

interface RegisteredSigner {
  publicKey: PublicKey;
  signMessage: SignMessageFn;
}

let registeredSigner: RegisteredSigner | null = null;

export function registerWalletSigner(
  publicKey: PublicKey,
  signMessage: SignMessageFn,
): void {
  registeredSigner = { publicKey, signMessage };
}

export function unregisterWalletSigner(): void {
  registeredSigner = null;
  cached = null;
  inflight = null;
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let str = "";
  for (const byte of bytes) {
    if (byte === 0) str += ALPHABET[0];
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    str += ALPHABET[digits[i]!];
  }
  return str;
}

export function isWalletScopedPath(path: string): boolean {
  return (
    path.includes("/credentials/") ||
    path.includes("/proofs/membership/") ||
    path.includes("/proofs/sanctions/") ||
    path.includes("/proofs/jurisdiction/")
  );
}

async function signAndCache(
  publicKey: PublicKey,
  signMessage: SignMessageFn,
): Promise<Record<string, string>> {
  const walletHex = bytesToHex(Array.from(publicKey.toBytes()));
  const now = Date.now();
  const timestamp = Math.floor(now / 1000);
  const message = `zksettle:${walletHex}:${timestamp}`;
  const encoded = new TextEncoder().encode(message);
  const signatureBytes = await signMessage(encoded);
  const signature = encodeBase58(signatureBytes);

  cached = {
    walletHex,
    signature,
    timestamp,
    expiresAt: now + REPLAY_WINDOW_MS,
  };

  return {
    "x-wallet-signature": signature,
    "x-wallet-timestamp": String(timestamp),
  };
}

export async function getWalletAuthHeaders(): Promise<Record<string, string>> {
  if (!registeredSigner) return {};

  const { publicKey, signMessage } = registeredSigner;
  const walletHex = bytesToHex(Array.from(publicKey.toBytes()));
  const now = Date.now();

  if (cached && cached.walletHex === walletHex && now < cached.expiresAt) {
    return {
      "x-wallet-signature": cached.signature,
      "x-wallet-timestamp": String(cached.timestamp),
    };
  }

  // Deduplicate concurrent sign requests — only one Phantom popup
  if (inflight) return inflight;

  inflight = signAndCache(publicKey, signMessage).finally(() => {
    inflight = null;
  });

  return inflight;
}

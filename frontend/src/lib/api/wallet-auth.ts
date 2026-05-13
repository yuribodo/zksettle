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
let inflightWallet: string | null = null;

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
    path.includes("/proofs/jurisdiction/") ||
    path.includes("/prove/groth16")
  );
}

async function signAndCache(
  publicKey: PublicKey,
  signMessage: SignMessageFn,
  bodyHashHex?: string,
): Promise<Record<string, string>> {
  const walletHex = bytesToHex(Array.from(publicKey.toBytes()));
  const now = Date.now();
  const timestamp = Math.floor(now / 1000);
  const message = bodyHashHex
    ? `zksettle:${walletHex}:${timestamp}:${bodyHashHex}`
    : `zksettle:${walletHex}:${timestamp}`;
  const encoded = new TextEncoder().encode(message);
  const signatureBytes = await signMessage(encoded);
  const signature = encodeBase58(signatureBytes);

  // Body-bound signatures are unique per request — caching them would just
  // burn memory since the next call has a different body hash. Only cache
  // the bodyless variant, which is what GETs (membership/sanctions/etc) reuse.
  if (!bodyHashHex) {
    cached = {
      walletHex,
      signature,
      timestamp,
      expiresAt: now + REPLAY_WINDOW_MS,
    };
  }

  return {
    "x-wallet-pubkey": walletHex,
    "x-wallet-signature": signature,
    "x-wallet-timestamp": String(timestamp),
  };
}

function getPhantomFallback(): RegisteredSigner | null {
  if (typeof globalThis.window === "undefined") return null;
  const phantom =
    (globalThis as unknown as { phantom?: { solana?: { isConnected: boolean; publicKey: PublicKey; signMessage: SignMessageFn } } }).phantom?.solana;
  if (!phantom?.isConnected || !phantom.publicKey || typeof phantom.signMessage !== "function")
    return null;
  return {
    publicKey: phantom.publicKey,
    signMessage: (msg: Uint8Array) => phantom.signMessage(msg).then((r: { signature: Uint8Array } | Uint8Array) =>
      r instanceof Uint8Array ? r : r.signature,
    ),
  };
}

export interface WalletAuthOptions {
  /**
   * Hex-encoded sha256 of the request body. When set, the wallet signs
   * `zksettle:{wallet}:{ts}:{bodyHashHex}` instead of the cached bodyless
   * message — binding the auth headers to a specific request body so that
   * captured headers cannot be replayed against a different payload. Caller
   * must pass the SAME bytes the server will hash (raw request body).
   */
  bodyHashHex?: string;
}

export async function getWalletAuthHeaders(
  opts: WalletAuthOptions = {},
): Promise<Record<string, string>> {
  const signer = registeredSigner ?? getPhantomFallback();
  if (!signer) return {};

  const { publicKey, signMessage } = signer;
  const walletHex = bytesToHex(Array.from(publicKey.toBytes()));
  const now = Date.now();

  // Body-bound auth cannot reuse the cached bodyless signature. Also skip
  // the inflight-dedup — different bodies legitimately need different sigs.
  if (opts.bodyHashHex) {
    return signAndCache(publicKey, signMessage, opts.bodyHashHex);
  }

  if (cached?.walletHex === walletHex && now < cached.expiresAt) {
    return {
      "x-wallet-pubkey": walletHex,
      "x-wallet-signature": cached.signature,
      "x-wallet-timestamp": String(cached.timestamp),
    };
  }

  if (inflight && inflightWallet === walletHex) return inflight;

  inflight = signAndCache(publicKey, signMessage).finally(() => {
    inflight = null;
    inflightWallet = null;
  });
  inflightWallet = walletHex;

  return inflight;
}

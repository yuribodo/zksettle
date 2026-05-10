import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import { REDEMPTION_EXPIRY_SECS } from "./program";
import type { RedemptionRequest, Treasury } from "./types";

export function isValidPubkey(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  try {
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

const DECIMAL_BASE = 10n;
const ZERO_CHAR = "0";

function trimTrailingZeros(input: string): string {
  let end = input.length;
  while (end > 0 && input[end - 1] === ZERO_CHAR) end--;
  return input.slice(0, end);
}

export function formatAmount(value: BN | bigint, decimals: number): string {
  const raw = typeof value === "bigint" ? value : BigInt(value.toString());
  if (decimals === 0) return raw.toString();
  const divisor = DECIMAL_BASE ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  if (fraction === 0n) return whole.toString();
  const fractionStr = trimTrailingZeros(
    fraction.toString().padStart(decimals, "0"),
  );
  return fractionStr.length > 0 ? `${whole}.${fractionStr}` : whole.toString();
}

export function formatPubkey(
  pubkey: PublicKey,
  head = 4,
  tail = 4,
): string {
  const s = pubkey.toBase58();
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function pubkeysEqual(
  a: PublicKey | null | undefined,
  b: PublicKey | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.toBase58() === b.toBase58();
}

export interface MintCapProgress {
  capped: boolean;
  ratio: number;
  belowMinted: boolean;
}

const RATIO_PRECISION = 10_000n;

export function mintCapProgress(treasury: Treasury): MintCapProgress {
  const cap = BigInt(treasury.mintCap.toString());
  const minted = BigInt(treasury.totalMinted.toString());
  if (cap === 0n) {
    return { capped: false, ratio: 0, belowMinted: false };
  }
  let ratio: number;
  if (minted === 0n) ratio = 0;
  else if (minted >= cap) ratio = 1;
  else ratio = Number((minted * RATIO_PRECISION) / cap) / Number(RATIO_PRECISION);
  return {
    capped: true,
    ratio,
    belowMinted: minted > cap,
  };
}

export function circulatingSupply(treasury: Treasury): bigint {
  const minted = BigInt(treasury.totalMinted.toString());
  const burned = BigInt(treasury.totalBurned.toString());
  return minted >= burned ? minted - burned : 0n;
}

export interface RedemptionExpiry {
  expiresAt: number;
  expired: boolean;
  secondsRemaining: number;
}

export function redemptionExpiry(
  request: RedemptionRequest,
  now: number = Math.floor(Date.now() / 1000),
): RedemptionExpiry {
  const expiresAt = request.requestedAt + REDEMPTION_EXPIRY_SECS;
  const secondsRemaining = expiresAt - now;
  return {
    expiresAt,
    expired: secondsRemaining <= 0,
    secondsRemaining: Math.max(0, secondsRemaining),
  };
}

export function parseAmountToUnits(raw: string, decimals: number): BN | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, fractionRaw = ""] = trimmed.split(".");
  if (fractionRaw.length > decimals) return null;
  const fraction = fractionRaw.padEnd(decimals, "0");
  const combined = (whole + fraction).replace(/^0+/, "") || "0";
  return new BN(combined);
}

export function formatDuration(secs: number): string {
  if (secs <= 0) return "expired";
  const days = Math.floor(secs / 86_400);
  const hours = Math.floor((secs % 86_400) / 3_600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((secs % 3_600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${secs}s`;
}

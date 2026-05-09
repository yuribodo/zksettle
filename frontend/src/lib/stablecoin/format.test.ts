import { BN } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  circulatingSupply,
  formatAmount,
  formatDuration,
  formatPubkey,
  isValidPubkey,
  mintCapProgress,
  parseAmountToUnits,
  pubkeysEqual,
  redemptionExpiry,
} from "./format";
import { REDEMPTION_EXPIRY_SECS, STABLECOIN_DECIMALS } from "./program";
import type { RedemptionRequest, Treasury } from "./types";

const mint = Keypair.generate().publicKey;

function unit(n: number): BN {
  return new BN(n).mul(new BN(10).pow(new BN(STABLECOIN_DECIMALS)));
}

const baseTreasury: Treasury = {
  admin: Keypair.generate().publicKey,
  operator: Keypair.generate().publicKey,
  mint,
  totalMinted: unit(100),
  totalBurned: unit(25),
  decimals: STABLECOIN_DECIMALS,
  paused: false,
  pendingAdmin: null,
  mintCap: unit(1_000),
  redemptionNonce: new BN(0),
};

describe("formatAmount", () => {
  it("renders whole tokens", () => {
    expect(formatAmount(unit(42), STABLECOIN_DECIMALS)).toBe("42");
  });

  it("renders fractional tokens trimming trailing zeros", () => {
    expect(formatAmount(new BN(1_500_000), STABLECOIN_DECIMALS)).toBe("1.5");
  });

  it("handles zero decimals", () => {
    expect(formatAmount(new BN(7), 0)).toBe("7");
  });
});

describe("formatPubkey", () => {
  it("truncates long base58", () => {
    const formatted = formatPubkey(mint, 4, 4);
    expect(formatted.includes("…")).toBe(true);
    expect(formatted.length).toBeLessThan(mint.toBase58().length);
  });
});

describe("pubkeysEqual", () => {
  it("returns true for the same key", () => {
    expect(pubkeysEqual(mint, mint)).toBe(true);
  });
  it("returns false when either is missing", () => {
    expect(pubkeysEqual(null, mint)).toBe(false);
    expect(pubkeysEqual(mint, null)).toBe(false);
  });
});

describe("mintCapProgress", () => {
  it("flags uncapped treasuries", () => {
    const t: Treasury = { ...baseTreasury, mintCap: new BN(0) };
    expect(mintCapProgress(t).capped).toBe(false);
  });

  it("computes ratio for capped treasuries", () => {
    const result = mintCapProgress(baseTreasury);
    expect(result.capped).toBe(true);
    expect(result.ratio).toBeCloseTo(0.1, 2);
    expect(result.belowMinted).toBe(false);
  });

  it("flags caps below current minted supply", () => {
    const t: Treasury = { ...baseTreasury, mintCap: unit(50) };
    expect(mintCapProgress(t).belowMinted).toBe(true);
  });
});

describe("circulatingSupply", () => {
  it("subtracts burned from minted", () => {
    expect(circulatingSupply(baseTreasury)).toBe(75n * 10n ** BigInt(STABLECOIN_DECIMALS));
  });
});

describe("redemptionExpiry", () => {
  const redemption: RedemptionRequest = {
    pda: Keypair.generate().publicKey,
    holder: Keypair.generate().publicKey,
    treasury: Keypair.generate().publicKey,
    mint,
    tokenAccount: Keypair.generate().publicKey,
    amount: unit(10),
    nonce: new BN(1),
    requestedAt: 1_700_000_000,
  };

  it("computes seconds remaining when fresh", () => {
    const result = redemptionExpiry(redemption, redemption.requestedAt + 100);
    expect(result.expired).toBe(false);
    expect(result.secondsRemaining).toBe(REDEMPTION_EXPIRY_SECS - 100);
  });

  it("flags expired redemptions", () => {
    const result = redemptionExpiry(
      redemption,
      redemption.requestedAt + REDEMPTION_EXPIRY_SECS + 1,
    );
    expect(result.expired).toBe(true);
    expect(result.secondsRemaining).toBe(0);
  });
});

describe("parseAmountToUnits", () => {
  it("parses whole tokens", () => {
    expect(parseAmountToUnits("100", 6)?.toString()).toBe("100000000");
  });

  it("parses fractional tokens up to declared decimals", () => {
    expect(parseAmountToUnits("1.5", 6)?.toString()).toBe("1500000");
    expect(parseAmountToUnits("0.123456", 6)?.toString()).toBe("123456");
  });

  it("rejects more fractional digits than decimals", () => {
    expect(parseAmountToUnits("1.1234567", 6)).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseAmountToUnits("abc", 6)).toBeNull();
    expect(parseAmountToUnits("1.2.3", 6)).toBeNull();
    expect(parseAmountToUnits("-1", 6)).toBeNull();
    expect(parseAmountToUnits("", 6)).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(parseAmountToUnits("  42  ", 6)?.toString()).toBe("42000000");
  });

  it("handles zero", () => {
    expect(parseAmountToUnits("0", 6)?.toString()).toBe("0");
  });
});

describe("formatDuration", () => {
  it("returns expired for zero or negative input", () => {
    expect(formatDuration(-1)).toBe("expired");
    expect(formatDuration(0)).toBe("expired");
  });
  it("formats days and hours", () => {
    expect(formatDuration(86_400 + 3_600 * 2)).toBe("1d 2h");
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(3_600 * 2 + 60 * 30)).toBe("2h 30m");
  });
  it("formats minutes", () => {
    expect(formatDuration(60 * 5)).toBe("5m");
  });
  it("formats sub-minute durations in seconds", () => {
    expect(formatDuration(45)).toBe("45s");
  });
});

describe("isValidPubkey", () => {
  const realKey = mint.toBase58();

  it("accepts a real base58 pubkey", () => {
    expect(isValidPubkey(realKey)).toBe(true);
  });
  it("trims surrounding whitespace", () => {
    expect(isValidPubkey(`  ${realKey}  `)).toBe(true);
  });
  it("rejects empty input", () => {
    expect(isValidPubkey("")).toBe(false);
    expect(isValidPubkey("   ")).toBe(false);
  });
  it("rejects non-base58 input", () => {
    expect(isValidPubkey("not-a-key")).toBe(false);
  });
});

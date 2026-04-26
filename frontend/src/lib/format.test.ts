import { describe, expect, it } from "vitest";
import { fmtAmount, fmtCompact, truncateWallet } from "./format";

describe("truncateWallet", () => {
  it("truncates a long address to head…tail", () => {
    expect(truncateWallet("5g8H4nP3eR9aB2cD1eF4gH6iJ8kL0mN2oP4qR6sT8u")).toBe("5g8H…sT8u");
  });

  it("respects custom head/tail lengths", () => {
    expect(truncateWallet("abcdefghijkl", 2, 3)).toBe("ab…jkl");
  });

  it("returns the address untouched when it is shorter than head+tail", () => {
    expect(truncateWallet("abc", 4, 4)).toBe("abc");
  });
});

describe("fmtAmount", () => {
  it("formats a whole number with default USDC currency", () => {
    expect(fmtAmount(1200)).toBe("1,200.00 USDC");
  });

  it("rounds to two decimal places", () => {
    expect(fmtAmount(1234.5678)).toBe("1,234.57 USDC");
  });

  it("accepts a custom currency label", () => {
    expect(fmtAmount(500, "USD")).toBe("500.00 USD");
  });
});

describe("fmtCompact", () => {
  it("formats thousands with K suffix", () => {
    expect(fmtCompact(1500)).toBe("1.5K");
  });

  it("formats millions with M suffix", () => {
    expect(fmtCompact(23481)).toBe("23.5K");
  });

  it("passes small numbers through unchanged", () => {
    expect(fmtCompact(42)).toBe("42");
  });
});

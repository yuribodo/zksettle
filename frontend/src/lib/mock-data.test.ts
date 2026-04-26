import { describe, expect, it } from "vitest";
import {
  AUDIT_EVENTS,
  BILLING_USAGE,
  INITIAL_TRANSACTIONS,
  INVOICES,
  ISSUERS,
  POLICIES,
  TEAM,
  API_KEYS,
  generateLiveEvent,
  issuerById,
} from "./mock-data";

describe("mock-data fixtures", () => {
  it("ships the six canonical issuers", () => {
    expect(ISSUERS).toHaveLength(6);
    expect(ISSUERS.map((i) => i.name)).toEqual([
      "Persona",
      "Sumsub",
      "Onfido",
      "Jumio",
      "Veriff",
      "MockKYC",
    ]);
  });

  it("ships 100 initial transactions with the canonical shape", () => {
    expect(INITIAL_TRANSACTIONS).toHaveLength(100);
    const first = INITIAL_TRANSACTIONS[0]!;
    expect(first).toMatchObject({ currency: "USDC" });
    expect(typeof first.wallet).toBe("string");
    expect(typeof first.slot).toBe("number");
  });

  it("ships more than 200 audit events spanning 30 days", () => {
    expect(AUDIT_EVENTS.length).toBeGreaterThan(200);
    const times = AUDIT_EVENTS.map((e) => Date.parse(e.time));
    const span = Math.max(...times) - Math.min(...times);
    expect(span).toBeGreaterThan(28 * 24 * 60 * 60 * 1000);
  });

  it("ships 30 days of billing usage", () => {
    expect(BILLING_USAGE).toHaveLength(30);
    BILLING_USAGE.forEach((day) => expect(day.proofs).toBeGreaterThan(0));
  });

  it("ships 3 invoices, a team, policies, and api keys", () => {
    expect(INVOICES).toHaveLength(3);
    expect(TEAM.length).toBeGreaterThanOrEqual(3);
    expect(POLICIES.length).toBeGreaterThanOrEqual(2);
    expect(API_KEYS.length).toBeGreaterThanOrEqual(2);
  });

  it("resolves issuers by id", () => {
    const first = ISSUERS[0]!;
    expect(issuerById(first.id)).toBe(first);
    expect(issuerById("unknown")).toBeUndefined();
  });
});

describe("generateLiveEvent determinism", () => {
  it("produces the same transaction for the same seed and index", () => {
    const a = generateLiveEvent(1337, 5);
    const b = generateLiveEvent(1337, 5);
    expect(a).toEqual(b);
  });

  it("produces different transactions for different indices", () => {
    const a = generateLiveEvent(1337, 0);
    const b = generateLiveEvent(1337, 1);
    expect(a.id).not.toEqual(b.id);
  });

  it("monotonically advances time with index", () => {
    const a = generateLiveEvent(99, 0);
    const b = generateLiveEvent(99, 10);
    expect(Date.parse(b.time)).toBeGreaterThan(Date.parse(a.time));
  });
});

import { describe, expect, it } from "vitest";
import { createPrng } from "./prng";

describe("createPrng", () => {
  it("next() returns values in [0, 1)", () => {
    const prng = createPrng(42);
    for (let i = 0; i < 100; i++) {
      const v = prng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = createPrng(1337);
    const b = createPrng(1337);
    const sequenceA = Array.from({ length: 10 }, () => a.next());
    const sequenceB = Array.from({ length: 10 }, () => b.next());
    expect(sequenceA).toEqual(sequenceB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createPrng(1);
    const b = createPrng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("range(min, max) stays within bounds", () => {
    const prng = createPrng(99);
    for (let i = 0; i < 50; i++) {
      const v = prng.range(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it("pick() returns an element from the array deterministically", () => {
    const options = ["US", "EU", "UK", "BR"] as const;
    const a = createPrng(7);
    const b = createPrng(7);
    const pickA = a.pick(options);
    const pickB = b.pick(options);
    expect(pickA).toBe(pickB);
    expect(options).toContain(pickA);
  });

  it("pick() throws on empty array", () => {
    const prng = createPrng(0);
    expect(() => prng.pick([])).toThrow();
  });
});

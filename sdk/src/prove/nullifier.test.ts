import { describe, it, expect } from "vitest";
import { computeNullifier } from "./nullifier.js";

describe("computeNullifier", () => {
  it("matches the known test vector from fixture.rs", async () => {
    const result = await computeNullifier(
      "42",
      "1334440654591915542993625911497130241",
      "1334440654591915542993625911497130241",
      "0",
      "2668881309183831085987251822994260482",
      "2668881309183831085987251822994260482",
      "1000",
    );

    expect(result).toBe(
      "0x1d6ac8cee9f7b2d8f092a9169a9f49d81bb1ef665e21732414dcbe559ea0d560",
    );
  }, 30_000);
});

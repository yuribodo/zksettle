import { describe, expect, it } from "vitest";

import { USE_CASES } from "./use-cases";

describe("USE_CASES", () => {
  it("defines the expected use-case cards", () => {
    expect(USE_CASES).toHaveLength(5);
    expect(USE_CASES.map((item) => item.name)).toContain("Travel rule");
    expect(USE_CASES.every((item) => typeof item.tagline === "string")).toBe(true);
  });
});

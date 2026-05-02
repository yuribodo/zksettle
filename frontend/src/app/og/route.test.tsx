import React from "react";
import { describe, expect, it, vi } from "vitest";

const imageResponseMock = vi.fn((element: React.ReactNode, options: unknown) => ({
  element,
  options,
}));

vi.mock("next/og", () => ({
  ImageResponse: function ImageResponse(element: React.ReactNode, options: unknown) {
    return imageResponseMock(element, options);
  },
}));

import { alt, contentType, GET, runtime, size } from "./route";

describe("OG route", () => {
  it("exports the expected Open Graph metadata", () => {
    expect(runtime).toBe("edge");
    expect(contentType).toBe("image/png");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(alt).toContain("Compliance-grade rails");
  });

  it("builds an ImageResponse with the configured dimensions", async () => {
    const response = await GET();

    expect(imageResponseMock).toHaveBeenCalledTimes(1);
    expect(response).toEqual(
      expect.objectContaining({
        options: { width: 1200, height: 630 },
      }),
    );
  });
});

// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useMounted } from "./use-mounted";

describe("useMounted", () => {
  it("returns true after the first effect flushes", () => {
    const { result } = renderHook(() => useMounted());
    expect(result.current).toBe(true);
  });

  it("remains true across re-renders", () => {
    const { result, rerender } = renderHook(() => useMounted());
    act(() => {
      rerender();
    });
    expect(result.current).toBe(true);
  });
});

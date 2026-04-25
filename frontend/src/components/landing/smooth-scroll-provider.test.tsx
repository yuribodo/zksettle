// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SmoothScrollProvider } from "./smooth-scroll-provider";

vi.mock("lenis", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      raf: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
    })),
  };
});

vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: vi.fn(),
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
      lagSmoothing: vi.fn(),
    },
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {
    update: vi.fn(),
  },
}));

describe("SmoothScrollProvider", () => {
  it("renders children", () => {
    render(
      <SmoothScrollProvider>
        <div data-testid="child">hello</div>
      </SmoothScrollProvider>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
  });
});

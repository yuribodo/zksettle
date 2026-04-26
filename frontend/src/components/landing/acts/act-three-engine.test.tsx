// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@gsap/react", () => ({
  useGSAP: vi.fn(),
}));

vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: vi.fn(),
    defaults: vi.fn(),
    matchMedia: vi.fn(() => ({
      add: vi.fn(),
      revert: vi.fn(),
    })),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {},
}));

vi.mock("./use-act-pin", () => ({
  useActPin: vi.fn(),
}));

vi.mock("@/components/landing/canvas/use-canvas-stage", () => ({
  useCanvasStage: () => ({
    scrollStateRef: {
      current: { actThreeProgress: 0 },
    },
  }),
}));

vi.mock("@/components/landing/step-diagram", () => ({
  StepDiagram: () => <svg aria-hidden="true" />,
}));

vi.mock("@/components/ui/display-heading", () => ({
  DisplayHeading: ({
    children,
    id,
  }: {
    children: React.ReactNode;
    id?: string;
  }) => <h2 id={id}>{children}</h2>,
}));

vi.mock("@/components/landing/proof-console", () => ({
  ProofConsole: () => <div />,
}));

import { ActThreeEngine } from "./act-three-engine";

describe("ActThreeEngine", () => {
  it("renders engine chapters using the shared benchmark copy", () => {
    render(<ActThreeEngine />);

    expect(screen.getByText("Verify once.")).toBeTruthy();
    expect(screen.getAllByText("Settlement").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PII leaked").length).toBeGreaterThan(0);
  });
});

// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/landing/footer", () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}));

vi.mock("@/components/landing/acts", () => ({
  ActOneHero: () => <section data-testid="act-one">Act One</section>,
  ActTwoParadox: () => <section data-testid="act-two">Act Two</section>,
  PortalBreach: () => <section data-testid="portal-breach">Portal Breach</section>,
  ActThreeEngine: () => <section data-testid="act-three">Act Three</section>,
  ActFiveMarkets: () => <section data-testid="act-five">Act Five</section>,
}));

vi.mock("@/components/landing/canvas/canvas-stage-provider", () => ({
  CanvasStageProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-stage-provider">{children}</div>
  ),
}));

vi.mock("@/components/landing/nav", () => ({
  Nav: () => <nav data-testid="nav">Nav</nav>,
}));

vi.mock("@/components/landing/smooth-scroll-provider", () => ({
  SmoothScrollProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="smooth-scroll-provider">{children}</div>
  ),
}));

import Home from "./page";

describe("Home page", () => {
  it("composes the landing sections inside the app providers", () => {
    render(<Home />);

    expect(screen.getByTestId("smooth-scroll-provider")).toBeTruthy();
    expect(screen.getByTestId("canvas-stage-provider")).toBeTruthy();
    expect(screen.getByTestId("nav")).toBeTruthy();
    expect(screen.getByTestId("act-one")).toBeTruthy();
    expect(screen.getByTestId("act-two")).toBeTruthy();
    expect(screen.getByTestId("portal-breach")).toBeTruthy();
    expect(screen.getByTestId("act-three")).toBeTruthy();
    expect(screen.getByTestId("act-five")).toBeTruthy();
    expect(screen.getByTestId("footer")).toBeTruthy();
    expect(screen.getByRole("main").getAttribute("id")).toBe("main-content");
  });
});

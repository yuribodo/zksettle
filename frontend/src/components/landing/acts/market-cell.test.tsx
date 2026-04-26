// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketCell } from "./market-cell";

describe("MarketCell", () => {
  it("uses a staged hover treatment for the market card", () => {
    render(
      <MarketCell
        market={{ name: "Payments", descriptor: "Settle privacy-preserving payments." }}
        index={0}
        total={6}
        isDimmed={false}
        onHoverChange={vi.fn()}
      />,
    );

    const card = screen.getByText("Payments").closest("[data-markets-cell]");
    expect(card).toBeTruthy();
    expect(card?.className).toContain("hover:-translate-y-px");
    expect(card?.className).toContain("active:translate-y-0");

    const descriptor = screen.getByText("Settle privacy-preserving payments.").parentElement;
    expect(descriptor?.className).toContain("translate-y-1");
    expect(descriptor?.className).toContain("group-hover:translate-y-0");
  });
});

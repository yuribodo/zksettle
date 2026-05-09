// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketCell } from "./market-cell";

describe("MarketCell", () => {
  it("renders market name, descriptor, and index", () => {
    render(
      <MarketCell
        market={{ name: "Payments", descriptor: "Settle privacy-preserving payments." }}
        index={0}
        total={6}
      />,
    );

    const card = screen.getByText("Payments").closest("[data-markets-cell]");
    expect(card).toBeTruthy();

    expect(screen.getByText("Settle privacy-preserving payments.")).toBeTruthy();
    expect(screen.getByText("01/06")).toBeTruthy();
  });
});

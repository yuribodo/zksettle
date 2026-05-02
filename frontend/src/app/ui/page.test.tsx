// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UIPage, { metadata } from "./page";

describe("UIPage", () => {
  it("exports metadata for the primitives catalog", () => {
    expect(metadata.title).toBe("UI primitives");
    expect(metadata.description).toContain("Visual catalog");
  });

  it("renders the primitive catalog and switches tabs", () => {
    render(<UIPage />);

    expect(screen.getByRole("main").getAttribute("id")).toBe("main-content");
    expect(screen.getAllByRole("heading", { level: 1 })[0]?.textContent).toContain("shared");
    expect(screen.getAllByText("Primary").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("1,200")).toBeTruthy();
    expect((screen.getByDisplayValue("disabled") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("us");
    expect(screen.getByDisplayValue("1200").getAttribute("type")).toBe("range");
    expect(screen.getByText("Stale (>24h)")).toBeTruthy();
    expect(screen.getByText("Proofs verified (24h)")).toBeTruthy();
    expect(screen.getByText("Persona")).toBeTruthy();

    const settlementTab = screen.getByRole("tab", { name: "Settlement" });
    fireEvent.click(settlementTab);
    expect(screen.getByRole("tabpanel").textContent).toContain("Sub-5-second wall clock");
  });
});

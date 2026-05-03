// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { ShieldCheck } from "iconoir-react";
import { describe, expect, it } from "vitest";

import { TierBScaffold } from "./tier-b-scaffold";

describe("TierBScaffold", () => {
  it("renders the coming-soon panel", () => {
    render(
      <TierBScaffold
        icon={ShieldCheck}
        title="Policy editor"
        body="Private beta only."
      />,
    );

    expect(screen.getByRole("heading", { name: "Policy editor" })).toBeTruthy();
    expect(screen.getByText("Private beta only.")).toBeTruthy();
  });
});

// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders title, subtitle, and optional actions", () => {
    render(
      <PageHeader
        title="Issuer status"
        subtitle="Track issuer health."
        actions={<button type="button">Refresh</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Issuer status" })).toBeTruthy();
    expect(screen.getByText("Track issuer health.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });
});

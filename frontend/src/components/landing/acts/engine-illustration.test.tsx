// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EngineIllustration } from "./engine-illustration";

describe("EngineIllustration", () => {
  it("renders a premium systems diagram for each engine step", () => {
    const expected = [
      ["Verify once", "issuer signature", "merkle root"],
      ["Prove anywhere", "private inputs", "groth16 proof"],
      ["Settle forever", "transfer hook", "audit trail"],
    ] as const;

    expected.forEach(([title, firstDetail, secondDetail], index) => {
      render(<EngineIllustration activeStep={index} />);

      const scene = screen.getByLabelText(title);
      expect(scene).toBeTruthy();
      expect(screen.getAllByText(firstDetail).length).toBeGreaterThan(0);
      expect(screen.getAllByText(secondDetail).length).toBeGreaterThan(0);
      cleanup();
    });
  });
});

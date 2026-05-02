// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shiki", () => ({
  codeToHtml: vi.fn(async (code: string, lang: string) => `<pre data-lang="${lang}">${code}</pre>`),
}));

import { CodeBlock } from "./code-block";

describe("CodeBlock", () => {
  it("renders highlighted code returned by shiki", async () => {
    const { container } = render(
      <CodeBlock code={`console.log("zk");`} lang="ts" ariaLabel="Example snippet" />,
    );

    expect(screen.getByLabelText("Example snippet")).toBeTruthy();

    await waitFor(() => {
      expect(container.querySelector("pre")?.textContent).toContain(`console.log("zk");`);
    });
  });
});

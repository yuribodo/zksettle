// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("geist/font/sans", () => ({
  GeistSans: { variable: "geist-sans" },
}));

vi.mock("next/font/google", () => ({
  JetBrains_Mono: () => ({ variable: "jetbrains-mono" }),
}));

vi.mock("./providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}));

describe("app layout", () => {
  afterEach(() => {
    cleanup();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.resetModules();
  });

  it("renders the root shell with skip link and providers", async () => {
    const mod = await import("./layout");
    const RootLayout = mod.default;

    render(
      <RootLayout>
        <main>Dashboard</main>
      </RootLayout>,
    );

    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.className).toContain("geist-sans");
    expect(document.documentElement.className).toContain("jetbrains-mono");
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe(
      "#main-content",
    );
    expect(screen.getByTestId("providers")).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("uses NEXT_PUBLIC_SITE_URL when it is a valid URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://zksettle.dev";

    const mod = await import("./layout");

    expect(mod.metadata.metadataBase?.toString()).toBe("https://zksettle.dev/");
  });

  it("falls back to localhost metadata when NEXT_PUBLIC_SITE_URL is invalid", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not-a-url";

    const mod = await import("./layout");

    expect(mod.metadata.metadataBase?.toString()).toBe("http://localhost:3000/");
  });
});

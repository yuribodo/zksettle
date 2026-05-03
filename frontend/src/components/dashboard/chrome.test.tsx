// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathnameState = {
  value: "/dashboard/transactions",
};

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

vi.mock("@/components/wallet/connect-wallet-button", () => ({
  ConnectWalletButton: () => <button type="button">Wallet CTA</button>,
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    tenant: { tenant_id: "t1", wallet: "GgME…tvQk", name: null, tier: "developer" },
    isAuthenticated: true,
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    isSigningIn: false,
    signInError: null,
  }),
}));

import { findNavItem, NAV_GROUPS, NAV_ITEMS } from "./nav-items";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

describe("dashboard chrome", () => {
  beforeEach(() => {
    pathnameState.value = "/dashboard/transactions";
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("exposes grouped navigation metadata and path lookup", () => {
    expect(NAV_GROUPS.map((group) => group.id)).toEqual(["overview", "controls", "account"]);
    expect(NAV_ITEMS).toHaveLength(8);
    expect(findNavItem("/dashboard/api-keys")?.label).toBe("API keys");
    expect(findNavItem("/dashboard/api-keys/rotate")?.label).toBe("API keys");
    expect(findNavItem("/dashboard/unknown")).toBeUndefined();
  });

  it("renders the sidebar and marks the active item", () => {
    pathnameState.value = "/dashboard/api-keys/rotate";

    render(<Sidebar />);

    expect(screen.getByLabelText("Dashboard navigation")).toBeTruthy();
    expect(screen.getByLabelText("ZKSettle dashboard home").getAttribute("href")).toBe(
      "/dashboard",
    );
    expect(screen.getByText("Acme Stablecoin")).toBeTruthy();
    expect(screen.getByText("API keys").closest("a")?.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("v0.1.0")).toBeTruthy();
  });

  it("opens and closes the mobile drawer while trapping focus state", () => {
    render(
      <>
        <main>Dashboard content</main>
        <MobileNavDrawer />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(screen.getByRole("dialog", { name: "Dashboard navigation" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByText("Wallets & credentials").closest("a")?.getAttribute("aria-current")).toBe(
      "page",
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Dashboard navigation" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("renders the top bar and reacts to scroll state", () => {
    const { container } = render(<TopBar />);

    expect(screen.getByRole("banner", { name: "Dashboard top bar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search (not implemented)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain("border-transparent");

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 12,
    });
    fireEvent.scroll(window);

    expect((container.firstChild as HTMLElement).className).toContain("border-border-subtle");
  });
});

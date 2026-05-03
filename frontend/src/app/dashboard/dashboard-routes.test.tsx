// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (href: string) => redirectMock(href),
}));

vi.mock("@/components/dashboard/sidebar", () => ({
  Sidebar: () => <aside data-testid="sidebar">Sidebar</aside>,
}));

vi.mock("@/components/dashboard/top-bar", () => ({
  TopBar: () => <header data-testid="top-bar">Top Bar</header>,
}));

vi.mock("@/components/dashboard/page-header", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="page-header" data-title={title} data-subtitle={subtitle} />
  ),
}));

vi.mock("@/components/dashboard/wallets-credentials-panel", () => ({
  WalletsCredentialsPanel: () => <section data-testid="wallets-panel">Wallets panel</section>,
}));

vi.mock("@/components/dashboard/issuer-status-panel", () => ({
  IssuerStatusPanel: () => <section data-testid="issuer-status-panel">Issuer status</section>,
}));

vi.mock("@/components/dashboard/api-keys-panel", () => ({
  ApiKeysPanel: () => <section data-testid="api-keys-panel">API keys</section>,
}));

vi.mock("@/components/dashboard/audit-log-table", () => ({
  AuditLogTable: () => <section data-testid="audit-log-table">Audit log</section>,
}));

vi.mock("@/components/dashboard/billing-cards", () => ({
  BillingCards: () => <section data-testid="billing-cards">Billing cards</section>,
}));

vi.mock("@/components/dashboard/attestation-explorer-panel", () => ({
  AttestationExplorerPanel: () => <section data-testid="attestation-explorer">Attestation explorer</section>,
}));

vi.mock("@/components/dashboard/tier-b-scaffold", () => ({
  TierBScaffold: ({
    title,
    body,
  }: {
    title: string;
    body: string;
  }) => (
    <section data-testid="tier-b-scaffold" data-title={title} data-body={body}>
      Tier B
    </section>
  ),
}));

vi.mock("@/components/dashboard/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import DashboardLayout from "./layout";
import DashboardIndex from "./page";
import ApiKeysPage from "./api-keys/page";
import AttestationsPage from "./attestations/page";
import AuditLogPage from "./audit-log/page";
import BillingPage from "./billing/page";
import CounterpartiesPage from "./counterparties/page";
import PoliciesPage from "./policies/page";
import TeamPage from "./team/page";
import TransactionsPage from "./transactions/page";

describe("dashboard routes", () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the dashboard shell around page content", () => {
    render(
      <DashboardLayout>
        <div data-testid="dashboard-child">Child</div>
      </DashboardLayout>,
    );

    expect(screen.getByTestId("sidebar")).toBeTruthy();
    expect(screen.getByTestId("top-bar")).toBeTruthy();
    expect(screen.getByTestId("dashboard-child")).toBeTruthy();
    expect(screen.getByRole("main").getAttribute("id")).toBe("main-content");
  });

  it("redirects the dashboard index to transactions", () => {
    DashboardIndex();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/transactions");
  });

  it("renders the transactions page wrapper", () => {
    render(<TransactionsPage />);

    expect(screen.getByTestId("page-header").getAttribute("data-title")).toBe(
      "Wallets & credentials",
    );
    expect(screen.getByTestId("wallets-panel")).toBeTruthy();
  });

  it("renders the counterparties, api keys, audit log, and billing pages", () => {
    const { rerender } = render(<CounterpartiesPage />);
    expect(screen.getByTestId("page-header").getAttribute("data-title")).toBe("Issuer status");
    expect(screen.getByTestId("issuer-status-panel")).toBeTruthy();

    rerender(<ApiKeysPage />);
    expect(screen.getByTestId("page-header").getAttribute("data-title")).toBe("API keys");
    expect(screen.getByTestId("api-keys-panel")).toBeTruthy();

    rerender(<AuditLogPage />);
    expect(screen.getByTestId("page-header").getAttribute("data-title")).toBe("Audit log");
    expect(screen.getByTestId("audit-log-table")).toBeTruthy();

    rerender(<BillingPage />);
    expect(screen.getByTestId("page-header").getAttribute("data-title")).toBe("Billing");
    expect(screen.getByTestId("billing-cards")).toBeTruthy();
  });

  it("renders the attestations page with explorer panel", () => {
    render(<AttestationsPage />);
    expect(screen.getByTestId("page-header").getAttribute("data-title")).toBe("Attestations");
    expect(screen.getByTestId("attestation-explorer")).toBeTruthy();
    cleanup();
  });

  it("renders the scaffolded dashboard pages with their copy", () => {
    const { rerender } = render(<PoliciesPage />);
    expect(screen.getByTestId("tier-b-scaffold").getAttribute("data-title")).toBe(
      "Policy editor · coming soon",
    );

    rerender(<TeamPage />);
    expect(screen.getByTestId("tier-b-scaffold").getAttribute("data-title")).toBe(
      "Team workspace · coming soon",
    );
  });
});

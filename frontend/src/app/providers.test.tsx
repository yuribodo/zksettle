// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const providerProps = {
  endpoint: undefined as string | undefined,
  wallets: undefined as unknown[] | undefined,
  autoConnect: undefined as boolean | undefined,
  onError: undefined as ((error: unknown) => void) | undefined,
};

const adapterSpies = {
  phantom: vi.fn(() => ({ adapter: "phantom" })),
  backpack: vi.fn(() => ({ adapter: "backpack" })),
  solflare: vi.fn((options?: unknown) => ({ adapter: "solflare", options })),
};

vi.mock("@/lib/config", () => ({
  SOLANA_NETWORK: "devnet",
  SOLANA_RPC_URL: "https://rpc.zksettle.devnet",
}));

vi.mock("@/lib/api/query-client", () => ({
  createQueryClient: () => ({ id: "query-client" }),
}));

vi.mock("@solana/wallet-adapter-phantom", () => ({
  PhantomWalletAdapter: function PhantomWalletAdapter() {
    return adapterSpies.phantom();
  },
}));

vi.mock("@solana/wallet-adapter-backpack", () => ({
  BackpackWalletAdapter: function BackpackWalletAdapter() {
    return adapterSpies.backpack();
  },
}));

vi.mock("@solana/wallet-adapter-solflare", () => ({
  SolflareWalletAdapter: function SolflareWalletAdapter(options?: unknown) {
    return adapterSpies.solflare(options);
  },
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  ConnectionProvider: ({
    children,
    endpoint,
  }: {
    children: React.ReactNode;
    endpoint: string;
  }) => {
    providerProps.endpoint = endpoint;
    return <div data-testid="connection-provider">{children}</div>;
  },
  WalletProvider: ({
    children,
    wallets,
    autoConnect,
    onError,
  }: {
    children: React.ReactNode;
    wallets: unknown[];
    autoConnect: boolean;
    onError?: (error: unknown) => void;
  }) => {
    providerProps.wallets = wallets;
    providerProps.autoConnect = autoConnect;
    providerProps.onError = onError;
    return <div data-testid="wallet-provider">{children}</div>;
  },
}));

vi.mock("@solana/wallet-adapter-react-ui", () => ({
  WalletModalProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="wallet-modal-provider">{children}</div>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
}));

import { Providers } from "./providers";

describe("Providers", () => {
  beforeEach(() => {
    providerProps.endpoint = undefined;
    providerProps.wallets = undefined;
    providerProps.autoConnect = undefined;
    providerProps.onError = undefined;
    Object.values(adapterSpies).forEach((spy) => spy.mockClear());
  });

  it("wraps children with Solana and query providers", () => {
    render(
      <Providers>
        <div data-testid="child">wallet child</div>
      </Providers>,
    );

    expect(screen.getByTestId("connection-provider")).toBeTruthy();
    expect(screen.getByTestId("wallet-provider")).toBeTruthy();
    expect(screen.getByTestId("wallet-modal-provider")).toBeTruthy();
    expect(screen.getByTestId("query-client-provider")).toBeTruthy();
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("configures devnet endpoint, adapters, and auto-connect", () => {
    render(
      <Providers>
        <div />
      </Providers>,
    );

    expect(providerProps.endpoint).toBe("https://rpc.zksettle.devnet");
    expect(providerProps.autoConnect).toBe(true);
    expect(providerProps.onError).toBeTypeOf("function");
    expect(providerProps.wallets).toHaveLength(3);
    expect(adapterSpies.phantom).toHaveBeenCalledTimes(1);
    expect(adapterSpies.backpack).toHaveBeenCalledTimes(1);
    expect(adapterSpies.solflare).toHaveBeenCalledWith({ network: "devnet" });
  });

  it("logs wallet auto-connect errors through the WalletProvider onError handler", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("auto-connect failed");

    render(
      <Providers>
        <div />
      </Providers>,
    );

    providerProps.onError?.(error);

    expect(consoleError).toHaveBeenCalledWith("Wallet auto-connect error", error);

    consoleError.mockRestore();
  });
});

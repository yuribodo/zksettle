// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { PublicKey } from "@solana/web3.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useWalletMock = vi.fn();

vi.mock("@/hooks/use-wallet-connection", () => ({
  useWallet: () => useWalletMock(),
}));

vi.mock("@solana/wallet-adapter-react-ui", () => ({
  WalletModalButton: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <button data-testid="wallet-modal-button" className={className}>
      {children}
    </button>
  ),
  WalletMultiButton: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <button data-testid="wallet-multi-button" className={className}>
      {children}
    </button>
  ),
}));

import { ConnectWalletButton } from "./connect-wallet-button";

describe("ConnectWalletButton", () => {
  beforeEach(() => {
    useWalletMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the modal button while disconnected", () => {
    useWalletMock.mockReturnValue({ connected: false, publicKey: null });

    render(<ConnectWalletButton />);

    expect(screen.getByTestId("wallet-modal-button").textContent).toContain("Connect Wallet");
    expect(screen.queryByTestId("wallet-multi-button")).toBeNull();
  });

  it("renders the dropdown button and address badge while connected", () => {
    useWalletMock.mockReturnValue({
      connected: true,
      publicKey: new PublicKey("11111111111111111111111111111111"),
    });

    render(<ConnectWalletButton showAddress />);

    expect(screen.getByTestId("wallet-multi-button").textContent).toContain("Wallet");
    expect(screen.getByText("1111…1111")).toBeTruthy();
  });

  it("shows the truncated address as the button label when address badge is disabled", () => {
    useWalletMock.mockReturnValue({
      connected: true,
      publicKey: new PublicKey("11111111111111111111111111111111"),
    });

    render(<ConnectWalletButton />);

    expect(screen.getByTestId("wallet-multi-button").textContent).toContain("1111…1111");
    expect(screen.queryByText("Wallet")).toBeNull();
  });
});

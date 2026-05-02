// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublicKey } from "@solana/web3.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useWalletMock = vi.hoisted(() => vi.fn());
const setVisibleMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-wallet-connection", () => ({
  useWallet: () => useWalletMock(),
}));

vi.mock("@solana/wallet-adapter-react-ui", () => ({
  useWalletModal: () => ({ visible: false, setVisible: setVisibleMock }),
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
    setVisibleMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a custom button that opens the modal while disconnected", () => {
    useWalletMock.mockReturnValue({ connected: false, publicKey: null });

    render(<ConnectWalletButton />);

    const button = screen.getByRole("button", { name: /connect/i });
    expect(button).toBeTruthy();
    expect(screen.queryByTestId("wallet-multi-button")).toBeNull();

    fireEvent.click(button);
    expect(setVisibleMock).toHaveBeenCalledWith(true);
  });

  it("renders the dropdown button with address badge while connected", () => {
    useWalletMock.mockReturnValue({
      connected: true,
      publicKey: new PublicKey("11111111111111111111111111111111"),
    });

    render(<ConnectWalletButton />);

    const btn = screen.getByTestId("wallet-multi-button");
    expect(btn.textContent).toContain("1111…1111");
    expect(screen.getByLabelText("Connected")).toBeTruthy();
  });

  it("shows address in mono font with responsive class", () => {
    useWalletMock.mockReturnValue({
      connected: true,
      publicKey: new PublicKey("11111111111111111111111111111111"),
    });

    render(<ConnectWalletButton addressClassName="hidden sm:inline-flex" />);

    const btn = screen.getByTestId("wallet-multi-button");
    expect(btn.textContent).toContain("1111…1111");
  });

  it("falls back to 'Connected' label when publicKey is null", () => {
    useWalletMock.mockReturnValue({ connected: true, publicKey: null });

    render(<ConnectWalletButton />);

    expect(screen.getByTestId("wallet-multi-button").textContent).toContain("Connected");
  });
});

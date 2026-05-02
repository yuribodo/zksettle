// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

import { useConnectedWallet } from "./use-wallet-connection";

const useWalletMock = vi.hoisted(() => vi.fn());

vi.mock("@solana/wallet-adapter-react", () => ({
  useConnection: vi.fn(),
  useWallet: () => useWalletMock(),
}));

describe("useConnectedWallet", () => {
  it("returns the active public key", () => {
    const publicKey = new PublicKey("11111111111111111111111111111111");
    useWalletMock.mockReturnValue({ publicKey });

    const { result } = renderHook(() => useConnectedWallet());

    expect(result.current).toBe(publicKey);
  });

  it("returns null when the wallet is disconnected", () => {
    useWalletMock.mockReturnValue({ publicKey: null });

    const { result } = renderHook(() => useConnectedWallet());

    expect(result.current).toBeNull();
  });
});

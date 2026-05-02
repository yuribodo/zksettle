"use client";

export { useConnection, type ConnectionContextState, type WalletContextState } from "@solana/wallet-adapter-react";
export type { PublicKey } from "@solana/web3.js";

import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";

export { useWallet };

export function useConnectedWallet(): PublicKey | null {
  const { publicKey } = useWallet();
  return publicKey ?? null;
}

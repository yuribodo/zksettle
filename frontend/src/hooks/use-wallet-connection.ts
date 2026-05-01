"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { ConnectionContextState } from "@solana/wallet-adapter-react";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";

export { useConnection, useWallet };
export type { ConnectionContextState, PublicKey, WalletContextState };

export function useConnectedWallet(): PublicKey | null {
  const { publicKey } = useWallet();
  return publicKey ?? null;
}

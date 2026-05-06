"use client";

import { useEffect } from "react";

import { useWallet } from "@/hooks/use-wallet-connection";
import {
  registerWalletSigner,
  unregisterWalletSigner,
} from "@/lib/api/wallet-auth";

export function useWalletAuthSync(): void {
  const { publicKey, signMessage } = useWallet();

  useEffect(() => {
    if (publicKey && signMessage) {
      registerWalletSigner(publicKey, signMessage);
    } else {
      unregisterWalletSigner();
    }
    return () => unregisterWalletSigner();
  }, [publicKey, signMessage]);
}

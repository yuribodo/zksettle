"use client";

import { useCallback, useRef } from "react";

import { useWallet } from "@/hooks/use-wallet-connection";

const ZK_SIGN_MESSAGE = "zksettle:zk-private-key:v1";
const BN254_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function useZkPrivateKey() {
  const { publicKey, signMessage } = useWallet();
  const cachedRef = useRef<{ wallet: string; key: string } | null>(null);

  const derivePrivateKey = useCallback(async (): Promise<string> => {
    if (!publicKey || !signMessage) {
      throw new Error("Wallet not connected or signMessage unavailable");
    }

    const walletId = publicKey.toBase58();
    if (cachedRef.current?.wallet === walletId) {
      return cachedRef.current.key;
    }

    const encoded = new TextEncoder().encode(ZK_SIGN_MESSAGE);
    const sigBytes = await signMessage(encoded);

    const slice = sigBytes.slice(0, 31);
    const bigInt = slice.reduce(
      (acc: bigint, b: number) => (acc << 8n) + BigInt(b),
      0n,
    );
    const field = (bigInt % BN254_MODULUS).toString();

    cachedRef.current = { wallet: walletId, key: field };
    return field;
  }, [publicKey, signMessage]);

  return { derivePrivateKey };
}

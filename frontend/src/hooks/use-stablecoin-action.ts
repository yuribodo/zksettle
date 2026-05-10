"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import type { Connection, PublicKey, Transaction } from "@solana/web3.js";

import { useConnection, useWallet } from "@/hooks/use-wallet-connection";
import { redemptionsQueryKey } from "@/hooks/use-redemption-requests";
import { treasuryQueryKey } from "@/hooks/use-treasury";
import { SOLANA_NETWORK } from "@/lib/config";

export interface BuildTxArgs {
  payer: PublicKey;
  connection: Connection;
}

export type BuildTransactionFn = (
  args: BuildTxArgs,
) => Promise<Transaction>;

interface UseStablecoinActionArgs {
  mint: PublicKey;
}

export interface StablecoinActionResult {
  signature: string;
  solscanUrl: string;
}

function buildSolscanUrl(signature: string): string {
  if (SOLANA_NETWORK === WalletAdapterNetwork.Mainnet) {
    return `https://solscan.io/tx/${signature}`;
  }
  return `https://solscan.io/tx/${signature}?cluster=${SOLANA_NETWORK}`;
}

async function ensureTxIsSendable(
  tx: Transaction,
  payer: PublicKey,
  connection: Connection,
): Promise<void> {
  // Wallet adapters typically set these via prepareTransaction(), but not all
  // wallet implementations do — set them eagerly so the tx is sendable
  // regardless of the connected wallet's behavior.
  tx.feePayer ??= payer;
  if (!tx.recentBlockhash) {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
  }
}

export function useStablecoinAction({ mint }: Readonly<UseStablecoinActionArgs>) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  return useMutation<StablecoinActionResult, Error, BuildTransactionFn>({
    mutationFn: async (buildTransaction) => {
      if (!publicKey) {
        throw new Error("Connect a wallet to submit this action.");
      }
      const tx = await buildTransaction({ payer: publicKey, connection });
      await ensureTxIsSendable(tx, publicKey, connection);
      const signature = await sendTransaction(tx, connection);
      return { signature, solscanUrl: buildSolscanUrl(signature) };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treasuryQueryKey(mint) });
      queryClient.invalidateQueries({ queryKey: redemptionsQueryKey(mint) });
    },
  });
}

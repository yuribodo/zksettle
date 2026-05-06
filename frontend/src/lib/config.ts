import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function resolveSolanaNetwork(value: string | undefined): WalletAdapterNetwork {
  switch (value) {
    case WalletAdapterNetwork.Mainnet:
      return WalletAdapterNetwork.Mainnet;
    case WalletAdapterNetwork.Testnet:
      return WalletAdapterNetwork.Testnet;
    case WalletAdapterNetwork.Devnet:
    default:
      return WalletAdapterNetwork.Devnet;
  }
}

export const SOLANA_NETWORK = resolveSolanaNetwork(
  process.env.NEXT_PUBLIC_SOLANA_NETWORK,
);

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl(SOLANA_NETWORK);

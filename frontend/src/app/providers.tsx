"use client";

import React, { useCallback, useMemo, useState } from "react";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/auth-context";
import { createQueryClient } from "@/lib/api/query-client";
import { SOLANA_NETWORK, SOLANA_RPC_URL } from "@/lib/config";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(() => createQueryClient());
  const handleWalletError = useCallback((error: unknown) => {
    console.error("Wallet auto-connect error", error);
  }, []);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new BackpackWalletAdapter(),
      new SolflareWalletAdapter({
        network: SOLANA_NETWORK,
      }),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect onError={handleWalletError}>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <TooltipProvider>
              {children}
              </TooltipProvider>
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    borderRadius: "var(--radius-6)",
                    border: "1px solid var(--color-border-subtle)",
                    background: "var(--color-surface-deep)",
                    color: "var(--color-quill)",
                    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)",
                  },
                }}
              />
            </AuthProvider>
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet } from "iconoir-react";

import { Logo } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/hooks/use-wallet-connection";
import { truncateWallet } from "@/lib/format";

export default function LoginPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { isAuthenticated, isLoading, signIn, isSigningIn, signInError } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-sm text-muted">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Logo size={32} variant="canvas-ink" />
        <div className="flex w-full flex-col gap-4 text-center">
          <h1 className="font-display text-2xl text-ink">Sign in to ZKSettle</h1>
          <p className="text-sm text-muted">
            Connect your Solana wallet and sign a message to authenticate.
          </p>
        </div>

        {connected ? (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-center gap-2 rounded-[var(--radius-3)] border border-border-subtle bg-surface px-4 py-3">
              <span className="size-2 rounded-full bg-emerald" />
              <span className="font-mono text-sm text-quill">
                {publicKey ? truncateWallet(publicKey.toBase58()) : "Connected"}
              </span>
            </div>
            <Button onClick={signIn} disabled={isSigningIn} size="lg" className="w-full">
              {isSigningIn ? "Signing..." : "Sign in with Solana"}
            </Button>
          </div>
        ) : (
          <Button onClick={() => setVisible(true)} size="lg" className="w-full">
            <Wallet className="size-5" strokeWidth={1.5} />
            Connect Wallet
          </Button>
        )}

        {signInError ? (
          <div className="w-full rounded-[var(--radius-3)] border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {signInError.message}
          </div>
        ) : null}
      </div>
    </main>
  );
}

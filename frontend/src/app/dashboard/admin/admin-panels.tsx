"use client";

import { useEffect, useState } from "react";

import { AdminControls } from "@/components/dashboard/admin-controls";
import { OperatorControls } from "@/components/dashboard/operator-controls";
import { PauseBanner } from "@/components/dashboard/pause-banner";
import { RedemptionQueue } from "@/components/dashboard/redemption-queue";
import { TreasuryOverview } from "@/components/dashboard/treasury-overview";
import { useStablecoinRole } from "@/hooks/use-stablecoin-role";
import { useWallet } from "@/hooks/use-wallet-connection";
import type { StablecoinActionResult } from "@/hooks/use-stablecoin-action";
import { STABLECOIN_MINT, STABLECOIN_MINT_CONFIGURED } from "@/lib/stablecoin";

const TOAST_TIMEOUT_MS = 6_000;

interface ToastState {
  summary: string;
  solscanUrl: string;
}

export function AdminPanels() {
  const { publicKey } = useWallet();
  const { role, treasury, isLoading, isError, error, isPendingAdmin } =
    useStablecoinRole(STABLECOIN_MINT);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [toast]);

  if (!STABLECOIN_MINT_CONFIGURED) {
    return (
      <p className="rounded-[var(--radius-6)] border border-border-subtle bg-surface px-5 py-4 text-sm text-stone">
        Stablecoin mint not configured. Set{" "}
        <code className="font-mono">NEXT_PUBLIC_STABLECOIN_MINT</code> to view
        admin tooling.
      </p>
    );
  }

  if (isError) {
    return (
      <p
        role="alert"
        className="rounded-[var(--radius-6)] border border-rust/30 bg-danger-bg px-5 py-4 font-mono text-xs text-rust"
      >
        Failed to load treasury: {error?.message ?? "unknown error"}
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="rounded-[var(--radius-6)] border border-border-subtle bg-surface px-5 py-4 text-sm text-muted">
        Loading treasury…
      </p>
    );
  }

  if (!treasury) {
    return (
      <p className="rounded-[var(--radius-6)] border border-border-subtle bg-surface px-5 py-4 text-sm text-stone">
        Treasury not initialized for this mint. The stablecoin program must
        initialize the treasury before admin controls are available.
      </p>
    );
  }

  if (role === "none" && !isPendingAdmin) {
    return null;
  }

  if (!publicKey) return null;

  const onActionComplete = (result: StablecoinActionResult, summary: string) => {
    setToast({ summary, solscanUrl: result.solscanUrl });
  };

  const showAdmin = role === "admin" || role === "both" || isPendingAdmin;
  const showOperator = role === "operator" || role === "both";

  return (
    <div className="flex flex-col gap-8">
      {treasury.paused ? <PauseBanner /> : null}

      <TreasuryOverview treasury={treasury} walletPublicKey={publicKey} />

      {showAdmin ? (
        <AdminControls
          treasury={treasury}
          walletPublicKey={publicKey}
          onActionComplete={onActionComplete}
          isPendingAdmin={isPendingAdmin}
        />
      ) : null}

      {showOperator ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <OperatorControls
            treasury={treasury}
            onActionComplete={onActionComplete}
          />
          <RedemptionQueue
            treasury={treasury}
            onActionComplete={onActionComplete}
          />
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-6 bottom-6 z-50 flex max-w-sm flex-col gap-1 rounded-[var(--radius-6)] border border-border-subtle bg-surface-deep px-4 py-3 text-sm text-quill shadow-sm"
        >
          <span>{toast.summary}</span>
          <a
            href={toast.solscanUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-forest underline"
          >
            View on Solscan
          </a>
        </div>
      ) : null}
    </div>
  );
}

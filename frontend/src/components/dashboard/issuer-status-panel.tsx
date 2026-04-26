"use client";

import { Copy, Refresh, WarningTriangle } from "iconoir-react";
import { useState } from "react";

import { StatCard } from "@/components/dashboard/stat-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { useRoots, usePublishRoots } from "@/hooks/use-roots";
import { ApiError } from "@/lib/api/client";
import type { Roots } from "@/lib/api/schemas";
import { fmtCompact, truncateWallet } from "@/lib/format";

const ROOT_FIELDS: Array<{ key: keyof Pick<Roots, "membership_root" | "sanctions_root" | "jurisdiction_root">; label: string; description: string }> = [
  {
    key: "membership_root",
    label: "Membership root",
    description: "Hash over the credentialed wallet set.",
  },
  {
    key: "sanctions_root",
    label: "Sanctions root",
    description: "Exclusion tree proving wallets are not sanctioned.",
  },
  {
    key: "jurisdiction_root",
    label: "Jurisdiction root",
    description: "Per-wallet ISO jurisdiction commitments.",
  },
];

function formatSlot(slot: number): string {
  if (slot === 0) return "Never published";
  return `Slot ${slot.toLocaleString("en-US")}`;
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return "Not authorized. Check NEXT_PUBLIC_API_KEY.";
    }
    if (err.status === 502) {
      return "Upstream issuer-service is unreachable.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Unknown error";
}

export function IssuerStatusPanel() {
  const { data: roots, isLoading, isError, error, refetch, isFetching } = useRoots();
  const publish = usePublishRoots();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [publishToast, setPublishToast] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1_500);
    } catch {
      setCopiedKey(null);
    }
  };

  const onPublish = async () => {
    setPublishToast(null);
    try {
      const res = await publish.mutateAsync();
      setPublishToast(
        res.registered
          ? `Published at slot ${res.slot.toLocaleString("en-US")}`
          : `Submitted at slot ${res.slot.toLocaleString("en-US")} (issuer not yet registered)`,
      );
      setTimeout(() => setPublishToast(null), 4_000);
    } catch {
      // surfaced via publish.error below
    }
  };

  const status: { kind: "verified" | "warning" | "info"; label: string } = (() => {
    if (isError) return { kind: "warning", label: "Unavailable" };
    if (isLoading || !roots) return { kind: "info", label: "Loading" };
    if (roots.last_publish_slot === 0) return { kind: "warning", label: "Not published" };
    return { kind: "verified", label: "Live" };
  })();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-6)] border border-border-subtle bg-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <StatusPill kind={status.kind} label={status.label} />
          <span className="font-mono text-xs text-stone">
            {isFetching && !isLoading ? "refreshing…" : "auto-refresh every 30s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh roots"
          >
            <Refresh aria-hidden="true" className="size-4" />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onPublish}
            disabled={publish.isPending || isLoading || isError}
          >
            {publish.isPending ? "Publishing…" : "Publish roots"}
          </Button>
        </div>
      </section>

      {publish.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-3)] border border-rust/30 bg-danger-bg px-4 py-3 font-mono text-xs text-rust"
        >
          <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {describeError(publish.error)}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Wallet count"
          value={isLoading ? "—" : roots ? fmtCompact(roots.wallet_count) : "—"}
          sub="Credentialed wallets in the membership tree"
        />
        <StatCard
          label="Last publish"
          value={isLoading ? "—" : roots ? formatSlot(roots.last_publish_slot) : "—"}
          sub="Most recent on-chain root commit"
        />
      </div>

      <section
        aria-labelledby="roots-heading"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <div className="flex items-baseline justify-between">
          <span
            id="roots-heading"
            className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
          >
            Merkle roots
          </span>
          <span className="font-mono text-xs text-muted">From GET /v1/roots</span>
        </div>

        {isError ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 font-mono text-xs text-rust"
          >
            <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {describeError(error)}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-border-subtle">
            {ROOT_FIELDS.map((field) => {
              const value = roots?.[field.key];
              const display = isLoading
                ? "loading…"
                : value
                  ? truncateWallet(value, 10, 8)
                  : "—";
              return (
                <li
                  key={field.key}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink">{field.label}</span>
                    <span className="text-xs text-stone">{field.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs text-quill">{display}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!value}
                      onClick={() => value && copy(value, field.key)}
                      aria-label={`Copy ${field.label}`}
                    >
                      <Copy aria-hidden="true" className="size-4" />
                      {copiedKey === field.key ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {publishToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-6 bottom-6 z-50 rounded-[var(--radius-6)] border border-border-subtle bg-surface-deep px-4 py-3 text-sm text-quill shadow-sm"
        >
          {publishToast}
        </div>
      ) : null}
    </div>
  );
}

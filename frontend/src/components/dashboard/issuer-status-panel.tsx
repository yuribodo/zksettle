"use client";

import { Copy, Refresh, WarningTriangle } from "iconoir-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/stat-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TruncatedHash } from "@/components/dashboard/truncated-hash";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoots, usePublishRoots } from "@/hooks/use-roots";
import { ApiError } from "@/lib/api/client";
import type { Roots } from "@/lib/api/schemas";
import { cn } from "@/lib/cn";
import { fmtCompact } from "@/lib/format";

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

function statCardValue(
  isLoading: boolean,
  roots: Roots | undefined,
  format: (roots: Roots) => string,
): string {
  if (isLoading) return "—";
  if (!roots) return "—";
  return format(roots);
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return "Not authorized. Select an active API key in the sidebar.";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (isError) toast.error(describeError(error));
  }, [isError, error]);

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
    setConfirmOpen(false);
    try {
      const res = await publish.mutateAsync();
      toast.success(
        res.registered
          ? `Published at slot ${res.slot.toLocaleString("en-US")}`
          : `Submitted at slot ${res.slot.toLocaleString("en-US")} (issuer not yet registered)`,
      );
    } catch (err) {
      toast.error(describeError(err));
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
      {/* Status bar */}
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
            onClick={() => setConfirmOpen(true)}
            disabled={publish.isPending || isLoading || isError}
          >
            {publish.isPending ? "Publishing…" : "Publish roots"}
          </Button>
        </div>
      </section>

      <Separator className="bg-border-subtle" />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Wallet count"
          value={statCardValue(isLoading, roots, (r) => fmtCompact(r.wallet_count))}
          sub="Credentialed wallets in the membership tree"
          isLoading={isLoading}
        />
        <StatCard
          label="Last publish"
          value={statCardValue(isLoading, roots, (r) => formatSlot(r.last_publish_slot))}
          sub="Most recent on-chain root commit"
          isLoading={isLoading}
        />
      </div>

      <Separator className="bg-border-subtle" />

      {/* Merkle roots */}
      <Card className="border-border-subtle bg-surface">
        <CardHeader>
          <div className="flex items-baseline justify-between">
            <CardTitle
              id="roots-heading"
              className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
            >
              Merkle roots
            </CardTitle>
            <span className="font-mono text-xs text-muted">Current state</span>
          </div>
        </CardHeader>
        <CardContent>
          {isError ? null : (
            <ul
              aria-labelledby="roots-heading"
              className="flex flex-col divide-y divide-border-subtle"
            >
              {ROOT_FIELDS.map((field) => {
                const value = roots?.[field.key];
                let rootDisplay: React.ReactNode;
                if (isLoading) {
                  rootDisplay = <Skeleton className="h-5 w-40" />;
                } else if (value) {
                  rootDisplay = (
                    <TruncatedHash
                      value={value}
                      head={10}
                      tail={8}
                      className="text-xs text-quill"
                      copyable
                    />
                  );
                } else {
                  rootDisplay = <span className="font-mono text-xs text-muted">—</span>;
                }
                return (
                  <li
                    key={field.key}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-ink">{field.label}</span>
                      <span className="text-xs text-stone">{field.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {rootDisplay}
                      {/* Keep the manual copy button for users who prefer an explicit action */}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!value}
                        onClick={() => value && copy(value, field.key)}
                        aria-label={`Copy ${field.label}`}
                        className={cn(!value && "hidden")}
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
        </CardContent>
      </Card>

      {/* Publish confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WarningTriangle className="size-5 text-forest" aria-hidden="true" />
              Confirm publish
            </DialogTitle>
            <DialogDescription>
              This will commit the current Merkle roots on-chain. The action cannot be
              undone — downstream verifiers will immediately start using the new roots.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className={cn(
                "inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-3)] border border-ink bg-transparent px-3 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-canvas",
              )}
            >
              Cancel
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              onClick={onPublish}
              disabled={publish.isPending}
            >
              {publish.isPending ? "Publishing…" : "Yes, publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

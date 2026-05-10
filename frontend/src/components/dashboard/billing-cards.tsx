"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { BillingUsageChart } from "@/components/dashboard/billing-usage-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useUsage, useUsageHistory } from "@/hooks/use-usage";
import { TIER_PRICE_CENTS, type Tier } from "@/lib/api/schemas";
import { fmtCompact } from "@/lib/format";

const TIER_LABEL: Record<Tier, string> = {
  developer: "Developer",
  startup: "Startup",
  growth: "Growth",
  enterprise: "Enterprise",
};

function tierPriceLabel(tier: Tier, monthlyLimit: number): string {
  const cents = TIER_PRICE_CENTS[tier];
  if (cents === 0) return `${fmtCompact(monthlyLimit)} proofs/mo · free`;
  const dollars = (cents / 100).toFixed(2);
  return `${fmtCompact(monthlyLimit)} proofs/mo · $${dollars}/mo`;
}

export function BillingCards() {
  const { data: usage, isLoading, isError, error } = useUsage();
  const { data: history, isLoading: historyLoading, isError: historyError, error: historyErrorObj } =
    useUsageHistory(30);

  const tier: Tier = usage?.tier ?? "developer";
  const monthlyLimit = usage?.monthly_limit ?? 0;
  const usedThisMonth = usage?.usage.request_count ?? 0;
  const usagePct =
    monthlyLimit > 0 ? Math.min(100, Math.round((usedThisMonth / monthlyLimit) * 100)) : 0;
  const historyData = history?.history ?? [];
  const historyPeak = historyData.reduce((max, d) => Math.max(max, d.count), 0);

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Failed to load usage");
    }
  }, [isError, error]);

  useEffect(() => {
    if (historyError) {
      toast.error(historyErrorObj instanceof Error ? historyErrorObj.message : "Failed to load usage history");
    }
  }, [historyError, historyErrorObj]);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="current-tier"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span
              id="current-tier"
              className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
            >
              Current tier
            </span>
            <div className="mt-2 flex items-baseline gap-3">
              {isLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <>
                  <span className="font-display text-3xl text-ink">
                    {isError ? "Unavailable" : TIER_LABEL[tier]}
                  </span>
                  {!isError && (
                    <span className="font-mono text-sm text-stone">
                      {tierPriceLabel(tier, monthlyLimit)}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between font-mono text-xs text-stone">
            <span>
              Used this month ·{" "}
              {isLoading ? (
                <Skeleton className="inline-block h-3.5 w-12 align-middle" />
              ) : (
                <span className="text-ink">
                  {usedThisMonth.toLocaleString("en-US")}
                </span>
              )}
            </span>
            <span>
              {monthlyLimit > 0 ? `${usagePct}% of ${fmtCompact(monthlyLimit)}` : "—"}
            </span>
          </div>
          <progress
            className="h-2 w-full overflow-hidden rounded-full [&]:appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-border-subtle [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-forest [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-500 [&::-webkit-progress-value]:ease-[var(--ease-brand)] [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-forest"
            value={usagePct}
            max={100}
          />
        </div>
      </section>

      <section
        aria-labelledby="usage-chart"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <div className="flex items-baseline justify-between">
          <span
            id="usage-chart"
            className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
          >
            30-day requests
          </span>
          <span className="font-mono text-xs text-stone">
            {historyLoading && "loading…"}
            {!historyLoading && historyError && "Unavailable"}
            {!historyLoading && !historyError && `Peak ${fmtCompact(historyPeak)}`}
          </span>
        </div>
        <div className="mt-4">
          {historyLoading ? (
            <div className="flex h-[200px] flex-col justify-between gap-2 py-4">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <BillingUsageChart data={historyData} />
          )}
        </div>
      </section>
    </div>
  );
}

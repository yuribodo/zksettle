"use client";

import { BillingUsageChart } from "@/components/dashboard/billing-usage-chart";
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
  const { data: history, isLoading: historyLoading, isError: historyError } =
    useUsageHistory(30);

  const tier: Tier = usage?.tier ?? "developer";
  const monthlyLimit = usage?.monthly_limit ?? 0;
  const usedThisMonth = usage?.usage.request_count ?? 0;
  const usagePct =
    monthlyLimit > 0 ? Math.min(100, Math.round((usedThisMonth / monthlyLimit) * 100)) : 0;
  const historyData = history?.history ?? [];
  const historyPeak = historyData.reduce((max, d) => Math.max(max, d.count), 0);

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
              <span className="font-display text-3xl text-ink">
                {isLoading && "—"}
                {!isLoading && isError && "Unavailable"}
                {!isLoading && !isError && TIER_LABEL[tier]}
              </span>
              <span className="font-mono text-sm text-stone">
                {isLoading || isError ? "" : tierPriceLabel(tier, monthlyLimit)}
              </span>
            </div>
            {isError ? (
              <p className="mt-2 font-mono text-xs text-rust">
                {error instanceof Error ? error.message : "Failed to load usage"}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-baseline justify-between font-mono text-xs text-stone">
            <span>
              Used this month ·{" "}
              <span className="text-ink">
                {isLoading ? "…" : usedThisMonth.toLocaleString("en-US")}
              </span>
            </span>
            <span>
              {monthlyLimit > 0 ? `${usagePct}% of ${fmtCompact(monthlyLimit)}` : "—"}
            </span>
          </div>
          <progress
            value={usagePct}
            max={100}
            className="h-2 w-full overflow-hidden rounded-full bg-border-subtle [&::-webkit-progress-bar]:bg-border-subtle [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-forest [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-500 [&::-webkit-progress-value]:ease-[var(--ease-brand)] [&::-moz-progress-bar]:bg-forest [&::-moz-progress-bar]:rounded-full"
          >
            {usagePct}%
          </progress>
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
            {!historyLoading && !historyError && `Peak ${fmtCompact(historyPeak)} · GET /usage/history`}
          </span>
        </div>
        <div className="mt-4">
          {historyLoading ? (
            <div className="flex h-[200px] items-center justify-center font-mono text-xs text-muted">
              Loading usage…
            </div>
          ) : (
            <BillingUsageChart data={historyData} />
          )}
        </div>
      </section>

    </div>
  );
}

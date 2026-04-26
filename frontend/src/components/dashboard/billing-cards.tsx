"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BillingUsageChart } from "@/components/dashboard/billing-usage-chart";
import { Button } from "@/components/ui/button";
import { useUsage, useUsageHistory } from "@/hooks/use-usage";
import { TIER_PRICE_CENTS, type Tier } from "@/lib/api/schemas";
import { fmtAmount, fmtCompact } from "@/lib/format";
import { INVOICES } from "@/lib/mock-data";

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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const tier: Tier = usage?.tier ?? "developer";
  const monthlyLimit = usage?.monthly_limit ?? 0;
  const usedThisMonth = usage?.usage.request_count ?? 0;
  const usagePct =
    monthlyLimit > 0 ? Math.min(100, Math.round((usedThisMonth / monthlyLimit) * 100)) : 0;
  const historyData = history?.history ?? [];
  const historyPeak = historyData.reduce((max, d) => Math.max(max, d.count), 0);

  const handleInvoiceDownload = useCallback((id: string) => {
    if (toastTimerRef.current !== null) {
      clearTimeout(toastTimerRef.current);
    }
    setToast(`Invoice ${id} available in private beta · request access ↗`);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3_000);
  }, []);

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
                {isLoading ? "—" : isError ? "Unavailable" : TIER_LABEL[tier]}
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
          <Button variant="ghost" size="sm" disabled title="Upgrade not available yet">
            Upgrade plan →
          </Button>
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
          <div
            role="progressbar"
            aria-valuenow={usagePct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-border-subtle"
          >
            <div
              aria-hidden="true"
              className="h-full bg-forest transition-[width] duration-500 ease-[var(--ease-brand)]"
              style={{ width: `${usagePct}%` }}
            />
          </div>
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
            {historyLoading
              ? "loading…"
              : historyError
                ? "Unavailable"
                : `Peak ${fmtCompact(historyPeak)} · GET /usage/history`}
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

      {/* TODO(api): aguardando GET /invoices no api-gateway. */}
      <section
        aria-labelledby="invoices"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <div className="flex items-baseline justify-between">
          <span
            id="invoices"
            className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
          >
            Invoices (mock)
          </span>
          <span className="font-mono text-xs text-muted">Last 3 months</span>
        </div>
        <table className="mt-4 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              <th className="py-2 pr-3 font-medium">Period</th>
              <th className="py-2 pr-3 text-right font-medium">Amount</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-b border-border-subtle text-quill last:border-b-0"
              >
                <td className="py-3 pr-3">{invoice.period}</td>
                <td className="py-3 pr-3 text-right font-mono text-ink">
                  {fmtAmount(invoice.amount, "USD")}
                </td>
                <td className="py-3 pr-3 font-mono text-stone capitalize">{invoice.status}</td>
                <td className="py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleInvoiceDownload(invoice.id)}
                  >
                    Download PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-6 bottom-6 z-50 rounded-[var(--radius-6)] border border-border-subtle bg-surface-deep px-4 py-3 text-sm text-quill shadow-sm"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

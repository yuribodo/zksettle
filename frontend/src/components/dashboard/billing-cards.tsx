"use client";

import { useState } from "react";

import { BillingUsageChart } from "@/components/dashboard/billing-usage-chart";
import { Button } from "@/components/ui/button";
import { fmtAmount, fmtCompact } from "@/lib/format";
import { BILLING_USAGE, INVOICES } from "@/lib/mock-data";

const TIER_LIMIT = 50_000;
const USED_THIS_MONTH = BILLING_USAGE.reduce((sum, day) => sum + day.proofs, 0);

export function BillingCards() {
  const usagePct = Math.min(100, Math.round((USED_THIS_MONTH / TIER_LIMIT) * 100));
  const [toast, setToast] = useState<string | null>(null);

  const handleInvoiceDownload = (id: string) => {
    setToast(`Invoice ${id} available in private beta · request access ↗`);
    setTimeout(() => setToast(null), 3_000);
  };

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
              <span className="font-display text-3xl text-ink">Startup</span>
              <span className="font-mono text-sm text-stone">
                {fmtCompact(TIER_LIMIT)} proofs/mo · $0.05/proof
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            Upgrade plan →
          </Button>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-baseline justify-between font-mono text-xs text-stone">
            <span>
              Used this month ·{" "}
              <span className="text-ink">{USED_THIS_MONTH.toLocaleString("en-US")}</span>
            </span>
            <span>{usagePct}% of {fmtCompact(TIER_LIMIT)}</span>
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
            30-day proofs
          </span>
          <span className="font-mono text-xs text-stone">
            Peak {fmtCompact(Math.max(...BILLING_USAGE.map((d) => d.proofs)))} · Devnet
          </span>
        </div>
        <div className="mt-4">
          <BillingUsageChart />
        </div>
      </section>

      <section
        aria-labelledby="invoices"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <div className="flex items-baseline justify-between">
          <span
            id="invoices"
            className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
          >
            Invoices
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { StatCard } from "@/components/dashboard/stat-card";
import { TransactionTable } from "@/components/dashboard/transaction-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  INITIAL_TRANSACTIONS,
  ISSUERS,
  generateLiveEvent,
  type Transaction,
} from "@/lib/mock-data";
import { createPrng } from "@/lib/prng";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "blocked", label: "Blocked" },
] as const;
type FilterValue = (typeof FILTERS)[number]["value"];

const MAX_ROWS = 100;
const issuerNameById = new Map(ISSUERS.map((issuer) => [issuer.id, issuer.name]));
const resolveIssuer = (id: string) => issuerNameById.get(id) ?? "Unknown";

export interface TransactionsLiveFeedProps {
  seed: number;
}

export function TransactionsLiveFeed({ seed }: TransactionsLiveFeedProps) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [rows, setRows] = useState<readonly Transaction[]>(INITIAL_TRANSACTIONS);
  const indexRef = useRef<number>(0);

  useEffect(() => {
    const delayPrng = createPrng(seed >>> 0);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const delayMs = Math.floor(3_000 + delayPrng.next() * 5_000);
      timeoutId = setTimeout(() => {
        indexRef.current += 1;
        const event = generateLiveEvent(seed, indexRef.current);
        setRows((prev) => [event, ...prev].slice(0, MAX_ROWS));
        schedule();
      }, delayMs);
    };

    schedule();

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [seed]);

  const visibleRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((tx) => tx.status === filter)),
    [filter, rows],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Proofs verified (24h)" value="1,847" sub="+12% vs yesterday" />
        <StatCard label="Blocked" value="23" sub="1.2% rejection rate" />
        <StatCard label="Avg proving time" value="4.7s" sub="p95 6.2s" />
        <StatCard label="Avg verify cost" value="$0.00091" sub="Devnet" />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle pb-4">
        <div
          role="tablist"
          aria-label="Filter transactions by status"
          className="inline-flex items-center gap-0 rounded-[var(--radius-3)] border border-border-subtle bg-surface p-[3px]"
        >
          {FILTERS.map((option) => {
            const isActive = option.value === filter;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "rounded-[2px] px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
                  isActive ? "bg-canvas text-ink shadow-sm" : "text-stone hover:text-ink",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <Button variant="ghost" size="sm" className="ml-auto" aria-label="Date range">
          Last 24 hours
        </Button>

        <span className="font-mono text-xs text-muted">
          {visibleRows.length} {visibleRows.length === 1 ? "row" : "rows"}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <TransactionTable transactions={visibleRows} issuerName={resolveIssuer} />
      </div>
    </div>
  );
}

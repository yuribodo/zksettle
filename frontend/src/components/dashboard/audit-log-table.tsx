"use client";

import { useMemo, useState } from "react";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";

import { StatusPill, type StatusKind } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { fmtAmount, fmtCompact, truncateWallet } from "@/lib/format";
import {
  AUDIT_EVENTS,
  ISSUERS,
  type AuditEvent,
  type Jurisdiction,
  type Transaction,
} from "@/lib/mock-data";

type StatusFilter = "all" | Transaction["status"];
type JurisdictionFilter = "all" | Jurisdiction;
type IssuerFilter = "all" | (typeof ISSUERS)[number]["id"];

const ROWS_PER_PAGE = 10;

const RANGE_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
} as const;

const RANGE_LABEL = {
  "24h": "Last 24h",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
} as const;

const LATEST_AUDIT_TIME = AUDIT_EVENTS.reduce(
  (max, event) => Math.max(max, Date.parse(event.time)),
  0,
);

const PILL_BY_STATUS: Record<Transaction["status"], { kind: StatusKind; label: string }> = {
  verified: { kind: "verified", label: "Verified" },
  blocked: { kind: "blocked", label: "Blocked" },
  pending: { kind: "info", label: "Pending" },
};

const ISSUER_NAME_BY_ID = new Map(ISSUERS.map((issuer) => [issuer.id, issuer.name]));
const resolveIssuer = (id: string) => ISSUER_NAME_BY_ID.get(id) ?? "Unknown";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function paginationRange(current: number, total: number): readonly (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const first = 1;
  const last = total;
  const left = Math.max(first + 1, current - 1);
  const right = Math.min(last - 1, current + 1);
  const items: (number | "…")[] = [first];
  if (left > first + 1) items.push("…");
  for (let i = left; i <= right; i += 1) items.push(i);
  if (right < last - 1) items.push("…");
  items.push(last);
  return items;
}

export function AuditLogTable() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [issuer, setIssuer] = useState<IssuerFilter>("all");
  const [jurisdiction, setJurisdiction] = useState<JurisdictionFilter>("all");
  const [range, setRange] = useState<"24h" | "7d" | "30d">("30d");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const cutoff = LATEST_AUDIT_TIME - RANGE_MS[range];
    return AUDIT_EVENTS.filter((event) => {
      if (Date.parse(event.time) < cutoff) return false;
      if (status !== "all" && event.status !== status) return false;
      if (issuer !== "all" && event.issuerId !== issuer) return false;
      if (jurisdiction !== "all" && event.jurisdiction !== jurisdiction) return false;
      return true;
    });
  }, [status, issuer, jurisdiction, range]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const visibleStart = filtered.length === 0 ? 0 : (safePage - 1) * ROWS_PER_PAGE + 1;
  const visibleEnd = Math.min(safePage * ROWS_PER_PAGE, filtered.length);

  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE),
    [filtered, safePage],
  );

  const exportToast = (label: string) => {
    setToast(`${label} available in private beta · request access ↗`);
    setTimeout(() => setToast(null), 3_000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle pb-4">
        <FilterSelect
          label="Range"
          value={range}
          onChange={(v) => {
            setRange(v as typeof range);
            setPage(1);
          }}
          options={[
            { value: "24h", label: "Last 24h" },
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
          ]}
        />
        <FilterSelect
          label="Issuer"
          value={issuer}
          onChange={(v) => {
            setIssuer(v as IssuerFilter);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All issuers" },
            ...ISSUERS.map((i) => ({ value: i.id, label: i.name })),
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v as StatusFilter);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Any status" },
            { value: "verified", label: "Verified" },
            { value: "blocked", label: "Blocked" },
            { value: "pending", label: "Pending" },
          ]}
        />
        <FilterSelect
          label="Jurisdiction"
          value={jurisdiction}
          onChange={(v) => {
            setJurisdiction(v as JurisdictionFilter);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Any" },
            { value: "US", label: "US" },
            { value: "EU", label: "EU" },
            { value: "UK", label: "UK" },
            { value: "BR", label: "BR" },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => exportToast("CSV export")}>
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => exportToast("JSON export")}>
            Export JSON
          </Button>
          <Button variant="ghost" size="sm" onClick={() => exportToast("Webhook digest")}>
            Webhook digest
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-6)] border border-border-subtle bg-surface">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              <Th className="pl-5">Time</Th>
              <Th>Wallet</Th>
              <Th>Issuer</Th>
              <Th>Status</Th>
              <Th className="text-right">Amount</Th>
              <Th>Juris.</Th>
              <Th>Proof hash</Th>
              <Th className="text-right">Block</Th>
              <Th className="text-right">Slot</Th>
              <Th className="text-right">CU</Th>
              <Th className="pr-5">Tx</Th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((event: AuditEvent) => {
              const pill = PILL_BY_STATUS[event.status];
              return (
                <tr
                  key={event.id}
                  className="border-b border-border-subtle text-[13px] text-quill transition-colors last:border-b-0 hover:bg-surface-deep"
                >
                  <td className="py-3 pr-3 pl-5 font-mono text-stone">{formatDateTime(event.time)}</td>
                  <td className="py-3 pr-3 font-mono text-ink">{truncateWallet(event.wallet, 4, 4)}</td>
                  <td className="py-3 pr-3">{resolveIssuer(event.issuerId)}</td>
                  <td className="py-3 pr-3">
                    <StatusPill kind={pill.kind} label={pill.label} />
                  </td>
                  <td className="py-3 pr-3 text-right font-mono text-ink">{fmtAmount(event.amount)}</td>
                  <td className="py-3 pr-3 font-mono text-stone">{event.jurisdiction}</td>
                  <td className="py-3 pr-3 font-mono text-stone">{truncateWallet(event.proofHash, 6, 4)}</td>
                  <td className="py-3 pr-3 text-right font-mono text-stone">{fmtCompact(event.block)}</td>
                  <td className="py-3 pr-3 text-right font-mono text-stone">{fmtCompact(event.slot)}</td>
                  <td className="py-3 pr-3 text-right font-mono text-stone">
                    {event.cu.toLocaleString("en-US")}
                  </td>
                  <td className="py-3 pr-5 font-mono text-stone">{truncateWallet(event.txHash, 4, 4)}</td>
                </tr>
              );
            })}
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-sm text-muted">
                  No events match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 font-mono text-xs text-muted">
        <span>
          Showing {visibleStart}–{visibleEnd} of {fmtCompact(filtered.length)} attestations · {RANGE_LABEL[range]}
        </span>
        <Pagination
          current={safePage}
          total={totalPages}
          onChange={(next) => setPage(Math.max(1, Math.min(totalPages, next)))}
        />
      </div>

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

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("py-2.5 pr-3 font-medium", className)}>
      {children}
    </th>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-stone">
      <span className="font-mono tracking-[0.08em] text-muted uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-[var(--radius-2)] border border-border-subtle bg-canvas px-2 py-1 text-xs text-ink transition-colors hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (next: number) => void;
}) {
  const items = paginationRange(current, total);
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1 font-mono text-stone">
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="inline-flex size-7 items-center justify-center rounded-[2px] transition-colors hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        aria-label="Previous page"
      >
        <NavArrowLeft className="size-4" aria-hidden="true" strokeWidth={1.75} />
      </button>
      {items.map((item, index) =>
        item === "…" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === current ? "page" : undefined}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-[2px] transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
              item === current ? "bg-surface-deep text-ink" : "",
            )}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="inline-flex size-7 items-center justify-center rounded-[2px] transition-colors hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        aria-label="Next page"
      >
        <NavArrowRight className="size-4" aria-hidden="true" strokeWidth={1.75} />
      </button>
    </nav>
  );
}

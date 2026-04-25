"use client";

import { Refresh, WarningTriangle } from "iconoir-react";
import { useMemo, useState } from "react";

import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEvents, type EventsFilters } from "@/hooks/use-events";
import { ApiError } from "@/lib/api/client";
import type { EventDto } from "@/lib/api/schemas";
import { cn } from "@/lib/cn";
import { fmtAmount, fmtCompact, truncateWallet } from "@/lib/format";
import { isValidWalletHex, normalizeWalletHex } from "@/lib/wallet";

const ROWS_PER_PAGE = 20;

const RANGES = [
  { value: "all", label: "All time", seconds: null },
  { value: "24h", label: "Last 24h", seconds: 24 * 60 * 60 },
  { value: "7d", label: "Last 7 days", seconds: 7 * 24 * 60 * 60 },
  { value: "30d", label: "Last 30 days", seconds: 30 * 24 * 60 * 60 },
] as const;
type RangeValue = (typeof RANGES)[number]["value"];

function formatDateTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return "Not authorized. Set NEXT_PUBLIC_API_KEY.";
    }
    if (err.status === 502) {
      return "Indexer is unreachable from the gateway.";
    }
    if (err.status === 500) {
      return "Indexer URL not configured (or filter value invalid). Set GATEWAY_INDEXER_URL on the gateway and check filter inputs.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Unknown error";
}

export function AuditLogTable() {
  const [toast, setToast] = useState<string | null>(null);

  const [range, setRange] = useState<RangeValue>("30d");
  const [issuerInput, setIssuerInput] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  // Committed filter values (only update when blurred / Enter, so we don't
  // refetch on every keystroke).
  const [issuer, setIssuer] = useState("");
  const [recipient, setRecipient] = useState("");

  const filters: EventsFilters = useMemo(() => {
    const out: EventsFilters = {};
    const rangeSecs = RANGES.find((r) => r.value === range)?.seconds;
    if (rangeSecs) {
      out.fromTs = Math.floor(Date.now() / 1000) - rangeSecs;
    }
    if (issuer && isValidWalletHex(issuer)) out.issuer = normalizeWalletHex(issuer);
    if (recipient && isValidWalletHex(recipient))
      out.recipient = normalizeWalletHex(recipient);
    return out;
  }, [range, issuer, recipient]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
  } = useEvents(ROWS_PER_PAGE, filters);

  const events: EventDto[] = data?.pages.flatMap((p) => p.events) ?? [];

  const issuerInvalid = issuerInput.length > 0 && !isValidWalletHex(issuerInput);
  const recipientInvalid =
    recipientInput.length > 0 && !isValidWalletHex(recipientInput);

  const commitFilters = () => {
    if (!issuerInvalid) setIssuer(issuerInput);
    if (!recipientInvalid) setRecipient(recipientInput);
  };

  const clearFilters = () => {
    setIssuerInput("");
    setRecipientInput("");
    setIssuer("");
    setRecipient("");
    setRange("30d");
  };

  const exportToast = (label: string) => {
    setToast(`${label} not yet wired · backend exposes JSON via GET /v1/events`);
    setTimeout(() => setToast(null), 3_000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Range"
            value={range}
            onChange={(v) => setRange(v as RangeValue)}
            options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
          />
          <HexFilterInput
            label="Issuer"
            placeholder="64 hex chars"
            value={issuerInput}
            invalid={issuerInvalid}
            onChange={setIssuerInput}
            onCommit={commitFilters}
          />
          <HexFilterInput
            label="Recipient"
            placeholder="64 hex chars"
            value={recipientInput}
            invalid={recipientInvalid}
            onChange={setRecipientInput}
            onCommit={commitFilters}
          />
          <Button variant="ghost" size="sm" onClick={commitFilters}>
            Apply
          </Button>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <Refresh aria-hidden="true" className="size-4" />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportToast("CSV export")}>
              Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportToast("JSON export")}>
              Export JSON
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted">
          <span>
            {isLoading
              ? "loading…"
              : isError
                ? "Unavailable"
                : `${fmtCompact(events.length)} event${events.length === 1 ? "" : "s"} loaded`}
          </span>
          <span>· filters applied server-side via GET /v1/events</span>
        </div>
      </div>

      {isError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-3)] border border-rust/30 bg-danger-bg px-4 py-3 font-mono text-xs text-rust"
        >
          <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {describeError(error)}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-6)] border border-border-subtle bg-surface">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              <Th className="pl-5">Time (UTC)</Th>
              <Th>Status</Th>
              <Th>Recipient</Th>
              <Th>Issuer</Th>
              <Th className="text-right">Amount</Th>
              <Th>Mint</Th>
              <Th>Nullifier</Th>
              <Th className="text-right">Slot</Th>
              <Th className="pr-5">Tx signature</Th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={`${event.slot}-${event.signature}`}
                className="border-b border-border-subtle text-[13px] text-quill transition-colors last:border-b-0 hover:bg-surface-deep"
              >
                <td className="py-3 pr-3 pl-5 font-mono text-stone">
                  {formatDateTime(event.timestamp)}
                </td>
                <td className="py-3 pr-3">
                  <StatusPill kind="verified" label="Verified" />
                </td>
                <td className="py-3 pr-3 font-mono text-ink">
                  {truncateWallet(event.recipient, 6, 4)}
                </td>
                <td className="py-3 pr-3 font-mono text-stone">
                  {truncateWallet(event.issuer, 4, 4)}
                </td>
                <td className="py-3 pr-3 text-right font-mono text-ink">
                  {fmtAmount(event.amount / 1_000_000)}
                </td>
                <td className="py-3 pr-3 font-mono text-stone">
                  {truncateWallet(event.mint, 4, 4)}
                </td>
                <td className="py-3 pr-3 font-mono text-stone">
                  {truncateWallet(event.nullifier_hash, 6, 4)}
                </td>
                <td className="py-3 pr-3 text-right font-mono text-stone">
                  {fmtCompact(event.slot)}
                </td>
                <td className="py-3 pr-5 font-mono text-stone">
                  {truncateWallet(event.signature, 6, 6)}
                </td>
              </tr>
            ))}
            {!isLoading && !isError && events.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-muted">
                  No events match the current filters.
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-8 text-center font-mono text-xs text-muted">
                  Loading events…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 font-mono text-xs text-muted">
        <span>
          {events.length > 0
            ? `Showing ${fmtCompact(events.length)} event${events.length === 1 ? "" : "s"}`
            : ""}
        </span>
        {hasNextPage ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        ) : events.length > 0 ? (
          <span>End of results</span>
        ) : null}
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
    <label className="flex flex-col gap-1.5 text-xs text-stone">
      <span className="font-mono tracking-[0.08em] text-muted uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 appearance-none rounded-[var(--radius-2)] border border-border-subtle bg-canvas px-3 text-sm text-ink transition-colors hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
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

function HexFilterInput({
  label,
  placeholder,
  value,
  invalid,
  onChange,
  onCommit,
}: {
  label: string;
  placeholder: string;
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-stone">
      <span className="font-mono tracking-[0.08em] text-muted uppercase">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid}
        className={cn("w-[220px] font-mono text-sm", invalid && "border-rust")}
      />
    </label>
  );
}

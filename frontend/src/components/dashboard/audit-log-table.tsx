"use client";

import { Download, Refresh, SearchEngine } from "iconoir-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TableSkeleton } from "@/components/dashboard/table-skeleton";
import { TruncatedHash } from "@/components/dashboard/truncated-hash";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEvents, type EventsFilters } from "@/hooks/use-events";
import { ApiError } from "@/lib/api/client";
import type { EventDto } from "@/lib/api/schemas";
import { cn } from "@/lib/cn";
import { exportToCsv, exportToJson } from "@/lib/export";
import { fmtAmount, fmtCompact } from "@/lib/format";
import { isValidWalletHex, normalizeWalletHex } from "@/lib/wallet";

const ROWS_PER_PAGE = 20;

const RANGES = [
  { value: "all", label: "All time", seconds: null },
  { value: "24h", label: "Last 24 h", seconds: 24 * 60 * 60 },
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
    if (err.status === 401 || err.status === 403)
      return "Not authorized. Select an active API key in the sidebar.";
    if (err.status === 502) return "Indexer is unreachable from the gateway.";
    if (err.status === 500)
      return "Indexer URL not configured (or filter value invalid). Set GATEWAY_INDEXER_URL on the gateway and check filter inputs.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Unknown error";
}

export function AuditLogTable() {
  const [range, setRange] = useState<RangeValue>("30d");
  const [issuerInput, setIssuerInput] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
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

  useEffect(() => {
    if (isError) toast.error(describeError(error));
  }, [isError, error]);

  const handleExportCsv = () => {
    if (events.length === 0) {
      toast("No events to export");
      return;
    }
    exportToCsv(events, "zksettle-audit-log.csv");
  };

  const handleExportJson = () => {
    if (events.length === 0) {
      toast("No events to export");
      return;
    }
    exportToJson(events, "zksettle-audit-log.json");
  };

  let statusText: string;
  if (isLoading) {
    statusText = "Loading…";
  } else if (isError) {
    statusText = "Unavailable";
  } else {
    const plural = events.length === 1 ? "" : "s";
    statusText = `${fmtCompact(events.length)} event${plural} loaded`;
  }

  const paginationText =
    events.length > 0
      ? `Showing ${fmtCompact(events.length)} event${events.length === 1 ? "" : "s"}`
      : "";

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
              Range
            </span>
            <Select value={range} onValueChange={(v) => setRange(v as RangeValue)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <HexFilterInput
            label="Issuer"
            placeholder="64-char hex"
            value={issuerInput}
            invalid={issuerInvalid}
            onChange={setIssuerInput}
            onCommit={commitFilters}
          />
          <HexFilterInput
            label="Recipient"
            placeholder="64-char hex"
            value={recipientInput}
            invalid={recipientInvalid}
            onChange={setRecipientInput}
            onCommit={commitFilters}
          />

          <div className="flex items-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={commitFilters}>
              Apply
            </Button>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <Refresh aria-hidden="true" className="size-4" />
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--radius-3)] border border-ink bg-transparent px-3 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <Download className="size-4" />
                Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleExportCsv}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportJson}>
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="font-mono text-xs text-muted">
          {statusText}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[var(--radius-6)] border border-border-subtle bg-surface">
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow className="border-b border-border-subtle hover:bg-transparent">
              <TableHead className="pl-5 text-[11px]">Time (UTC)</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Recipient</TableHead>
              <TableHead className="text-[11px]">Issuer</TableHead>
              <TableHead className="text-right text-[11px]">Amount</TableHead>
              <TableHead className="text-[11px]">Mint</TableHead>
              <TableHead className="text-[11px]">Nullifier</TableHead>
              <TableHead className="text-right text-[11px]">Slot</TableHead>
              <TableHead className="pr-5 text-[11px]">Tx signature</TableHead>
            </TableRow>
          </TableHeader>

          {isLoading ? (
            <TableSkeleton columns={9} rows={5} />
          ) : (
            <TableBody>
              {events.map((event) => (
                <TableRow
                  key={`${event.slot}-${event.signature}`}
                  className="border-b border-border-subtle text-[13px] text-quill last:border-b-0"
                >
                  <TableCell className="py-3 pl-5 font-mono text-stone">
                    {formatDateTime(event.timestamp)}
                  </TableCell>
                  <TableCell className="py-3">
                    <StatusPill kind="verified" label="Verified" />
                  </TableCell>
                  <TableCell className="py-3 text-ink">
                    <TruncatedHash value={event.recipient} head={6} tail={4} />
                  </TableCell>
                  <TableCell className="py-3 text-stone">
                    <TruncatedHash value={event.issuer} head={4} tail={4} />
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono text-ink">
                    {fmtAmount(event.amount / 1_000_000)}
                  </TableCell>
                  <TableCell className="py-3 text-stone">
                    <TruncatedHash value={event.mint} head={4} tail={4} />
                  </TableCell>
                  <TableCell className="py-3 text-stone">
                    <TruncatedHash value={event.nullifier_hash} head={6} tail={4} />
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono text-stone">
                    {fmtCompact(event.slot)}
                  </TableCell>
                  <TableCell className="py-3 pr-5 text-stone">
                    <TruncatedHash value={event.signature} head={6} tail={6} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>

        {!isLoading && !isError && events.length === 0 && (
          <EmptyState
            icon={SearchEngine}
            title="No events match the current filters"
            description="Try adjusting the time range or clearing the wallet filters."
            action={{ label: "Clear filters", onClick: clearFilters }}
          />
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 font-mono text-xs text-muted">
        <span>{paginationText}</span>
        {hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
        {!hasNextPage && events.length > 0 && (
          <span className="text-ghost">End of results</span>
        )}
      </div>
    </div>
  );
}

function HexFilterInput({
  label,
  placeholder,
  value,
  invalid,
  onChange,
  onCommit,
}: Readonly<{
  label: string;
  placeholder: string;
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
  onCommit: () => void;
}>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
        {label}
      </span>
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
        className={cn("w-[200px] font-mono text-sm", invalid && "border-danger-text")}
      />
    </div>
  );
}

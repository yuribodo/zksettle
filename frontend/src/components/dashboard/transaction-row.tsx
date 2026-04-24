import { NavArrowDown } from "iconoir-react";

import { StatusPill, type StatusKind } from "@/components/dashboard/status-pill";
import { cn } from "@/lib/cn";
import { fmtAmount, truncateWallet } from "@/lib/format";
import type { Transaction } from "@/lib/mock-data";

const RULE_BY_STATUS: Record<Transaction["status"], string> = {
  verified: "bg-emerald",
  blocked: "bg-danger-text",
  pending: "bg-muted",
};

const PILL_BY_STATUS: Record<Transaction["status"], StatusKind> = {
  verified: "verified",
  blocked: "blocked",
  pending: "info",
};

const PILL_LABEL_BY_STATUS: Record<Transaction["status"], string> = {
  verified: "Verified",
  blocked: "Blocked",
  pending: "Pending",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export interface TransactionRowProps {
  tx: Transaction;
  issuerName: string;
}

export function TransactionRow({ tx, issuerName }: TransactionRowProps) {
  return (
    <tr className="group relative border-b border-border-subtle text-[13px] text-quill transition-colors last:border-b-0 hover:bg-surface-deep">
      <td className="relative py-3 pr-3 pl-5">
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-2 left-0 w-[2px] rounded-full",
            RULE_BY_STATUS[tx.status],
          )}
        />
        <span className="font-mono text-stone">{formatTime(tx.time)}</span>
      </td>
      <td className="py-3 pr-3 font-mono text-ink">{truncateWallet(tx.wallet, 4, 4)}</td>
      <td className="py-3 pr-3">{issuerName}</td>
      <td className="py-3 pr-3">
        <StatusPill
          kind={PILL_BY_STATUS[tx.status]}
          label={PILL_LABEL_BY_STATUS[tx.status]}
        />
      </td>
      <td className="py-3 pr-3 text-right font-mono text-ink">{fmtAmount(tx.amount)}</td>
      <td className="py-3 pr-3 font-mono text-stone">{tx.jurisdiction}</td>
      <td className="py-3 pr-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-stone">{truncateWallet(tx.txHash, 4, 4)}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-[2px] px-2 py-1 font-mono text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            View proof bytes
            <NavArrowDown className="size-3" aria-hidden="true" strokeWidth={1.5} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export interface TransactionTableProps {
  transactions: readonly Transaction[];
  issuerName: (id: string) => string;
}

export function TransactionTable({ transactions, issuerName }: TransactionTableProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-6)] border border-border-subtle bg-surface">
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border-subtle text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
            <th className="py-2.5 pr-3 pl-5 font-medium">Time</th>
            <th className="py-2.5 pr-3 font-medium">Wallet</th>
            <th className="py-2.5 pr-3 font-medium">Issuer</th>
            <th className="py-2.5 pr-3 font-medium">Status</th>
            <th className="py-2.5 pr-3 text-right font-medium">Amount</th>
            <th className="py-2.5 pr-3 font-medium">Juris.</th>
            <th className="py-2.5 pr-5 font-medium">Tx</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} issuerName={issuerName(tx.issuerId)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

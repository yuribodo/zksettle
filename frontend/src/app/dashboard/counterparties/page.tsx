import { PageHeader } from "@/components/dashboard/page-header";
import { findNavItem } from "@/components/dashboard/nav-items";
import { RegisterIssuerModal } from "@/components/dashboard/register-issuer-modal";
import { StatusPill } from "@/components/dashboard/status-pill";
import { fmtCompact, truncateWallet } from "@/lib/format";
import { ISSUERS, type Issuer } from "@/lib/mock-data";

const META = findNavItem("/dashboard/counterparties")!;

const STATUS_PILL: Record<Issuer["status"], { kind: "verified" | "warning" | "test"; label: string }> = {
  active: { kind: "verified", label: "Active" },
  stale: { kind: "warning", label: "Stale (>24h)" },
  test: { kind: "test", label: "Test mode" },
};

function formatLastUpdate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.parse("2026-04-18T12:00:00Z");
  const hours = Math.max(1, Math.round((now - then) / (60 * 60 * 1000)));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function CounterpartiesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} actions={<RegisterIssuerModal />} />

      <div className="overflow-hidden rounded-[var(--radius-6)] border border-border-subtle bg-surface">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              <th className="py-3 pr-3 pl-5 font-medium">Name</th>
              <th className="py-3 pr-3 font-medium">Pubkey</th>
              <th className="py-3 pr-3 font-medium">Merkle root</th>
              <th className="py-3 pr-3 text-right font-medium">Users</th>
              <th className="py-3 pr-3 font-medium">Last update</th>
              <th className="py-3 pr-5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ISSUERS.map((issuer) => {
              const pill = STATUS_PILL[issuer.status];
              return (
                <tr
                  key={issuer.id}
                  className="border-b border-border-subtle text-[13px] text-quill transition-colors last:border-b-0 hover:bg-surface-deep"
                >
                  <td className="py-3 pr-3 pl-5 font-medium text-ink">{issuer.name}</td>
                  <td className="py-3 pr-3 font-mono text-stone">
                    {truncateWallet(issuer.pubkey, 4, 4)}
                  </td>
                  <td className="py-3 pr-3 font-mono text-stone">
                    {truncateWallet(issuer.merkleRoot, 6, 4)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono text-ink">
                    {fmtCompact(issuer.users)}
                  </td>
                  <td className="py-3 pr-3 font-mono text-stone">
                    {formatLastUpdate(issuer.lastUpdate)}
                  </td>
                  <td className="py-3 pr-5">
                    <StatusPill kind={pill.kind} label={pill.label} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        6 issuers trusted by this workspace — to trust a new issuer, click{" "}
        <span className="text-quill">Register issuer</span> above.
      </p>
    </div>
  );
}

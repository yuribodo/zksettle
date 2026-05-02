"use client";

import { Copy, NavArrowDown, Search, WarningTriangle, Xmark } from "iconoir-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { StatusPill, type StatusKind } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMembershipProof } from "@/hooks/use-membership-proof";
import {
  useForgetWallet,
  useRecentWallets,
  useRecordWallet,
} from "@/hooks/use-recent-wallets";
import { useRoots } from "@/hooks/use-roots";
import { useSanctionsProof } from "@/hooks/use-sanctions-proof";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { truncateWallet } from "@/lib/format";
import { isValidWalletHex, normalizeWalletHex } from "@/lib/wallet";

const EMPTY_LEAF = "0".repeat(64);

type ComplianceStatus = "loading" | "compliant" | "sanctioned" | "unknown" | "error";

function deriveStatus(
  membership: ReturnType<typeof useMembershipProof>,
  sanctions: ReturnType<typeof useSanctionsProof>,
): ComplianceStatus {
  if (membership.isLoading || sanctions.isLoading) return "loading";
  if (membership.isError && sanctions.isError) return "error";
  if (membership.isError) return "unknown";
  if (sanctions.isError) return "error";
  if (sanctions.data && sanctions.data.leaf_value !== EMPTY_LEAF) return "sanctioned";
  return "compliant";
}

const STATUS_MAP: Record<ComplianceStatus, { kind: StatusKind; label: string }> = {
  loading: { kind: "info", label: "Loading" },
  compliant: { kind: "verified", label: "Compliant" },
  sanctioned: { kind: "blocked", label: "Sanctioned" },
  unknown: { kind: "warning", label: "Unknown wallet" },
  error: { kind: "warning", label: "Error" },
};

function describeProofError(err: unknown): { kind: "not-found" | "auth" | "other"; message: string } {
  if (err instanceof ApiError) {
    if (err.status === 404) return { kind: "not-found", message: "No proof found for this wallet." };
    if (err.status === 401 || err.status === 403)
      return { kind: "auth", message: "Not authorized. Check NEXT_PUBLIC_API_KEY." };
    return { kind: "other", message: err.message };
  }
  return { kind: "other", message: err instanceof Error ? err.message : "Unknown error" };
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // silent fail
  }
}

export function AttestationExplorerPanel() {
  const [walletInput, setWalletInput] = useState("");
  const [activeWallet, setActiveWallet] = useState<string | null>(null);

  const membershipQuery = useMembershipProof(activeWallet);
  const sanctionsQuery = useSanctionsProof(activeWallet);
  const { data: roots } = useRoots();
  const { data: recent = [] } = useRecentWallets();
  const recordWallet = useRecordWallet();
  const forgetWallet = useForgetWallet();

  const inputValid = isValidWalletHex(walletInput);

  const lookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValid) return;
    const normalized = normalizeWalletHex(walletInput);
    setActiveWallet(normalized);
    recordWallet(normalized);
  };

  const pickRecent = (wallet: string) => {
    setWalletInput(wallet);
    setActiveWallet(wallet);
    recordWallet(wallet);
  };

  const status = activeWallet ? deriveStatus(membershipQuery, sanctionsQuery) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Wallet search */}
      <section
        aria-labelledby="search-heading"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <span
          id="search-heading"
          className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
        >
          Search wallet attestation
        </span>
        <p className="mt-1 text-sm text-stone">
          Paste a 32-byte wallet pubkey as 64 hex chars (with or without{" "}
          <span className="font-mono">0x</span>).
        </p>

        <form onSubmit={lookup} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            placeholder="0x… (64 hex chars)"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={walletInput.length > 0 && !inputValid}
            aria-describedby="wallet-help"
            className="font-mono"
          />
          <Button type="submit" variant="primary" size="md" disabled={!inputValid}>
            <Search aria-hidden="true" className="size-4" />
            Search
          </Button>
        </form>

        {walletInput.length > 0 && !inputValid ? (
          <p id="wallet-help" className="mt-2 font-mono text-xs text-rust">
            Wallet must be 64 hex characters.
          </p>
        ) : (
          <p id="wallet-help" className="mt-2 font-mono text-xs text-muted">
            Calls{" "}
            <span className="text-quill">
              GET /v1/proofs/membership/&#123;wallet&#125;
            </span>{" "}
            and{" "}
            <span className="text-quill">
              GET /v1/proofs/sanctions/&#123;wallet&#125;
            </span>
            .
          </p>
        )}
      </section>

      {/* Compliance status */}
      {activeWallet && status ? (
        <AttestationStatusSection
          wallet={activeWallet}
          status={status}
          membershipQuery={membershipQuery}
          sanctionsQuery={sanctionsQuery}
          membershipRootMatch={
            membershipQuery.data && roots
              ? membershipQuery.data.root === roots.membership_root
              : null
          }
          sanctionsRootMatch={
            sanctionsQuery.data && roots
              ? sanctionsQuery.data.root === roots.sanctions_root
              : null
          }
        />
      ) : null}

      {/* Membership proof */}
      {membershipQuery.data ? (
        <ProofCard
          id="membership"
          title="Membership proof"
          proof={membershipQuery.data}
          extraFields={
            <><dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Leaf index</dt>
            <dd className="font-mono text-sm text-ink">{membershipQuery.data.leaf_index}</dd></>
          }
        />
      ) : null}

      {/* Sanctions proof */}
      {sanctionsQuery.data ? (
        <ProofCard
          id="sanctions"
          title="Sanctions proof"
          proof={sanctionsQuery.data}
          extraFields={
            <><dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Leaf value</dt>
            <dd className="flex items-center gap-2 font-mono text-sm text-ink">
              {sanctionsQuery.data.leaf_value !== EMPTY_LEAF ? (
                <StatusPill kind="blocked" label="Present (sanctioned)" />
              ) : (
                <StatusPill kind="verified" label="Empty (not sanctioned)" />
              )}
            </dd></>
          }
        />
      ) : null}

      <RecentWalletsSection
        recent={recent}
        onPick={pickRecent}
        onForget={forgetWallet}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function AttestationStatusSection({
  wallet,
  status,
  membershipQuery,
  sanctionsQuery,
  membershipRootMatch,
  sanctionsRootMatch,
}: Readonly<{
  wallet: string;
  status: ComplianceStatus;
  membershipQuery: ReturnType<typeof useMembershipProof>;
  sanctionsQuery: ReturnType<typeof useSanctionsProof>;
  membershipRootMatch: boolean | null;
  sanctionsRootMatch: boolean | null;
}>) {
  const pill = STATUS_MAP[status];
  const membershipError = membershipQuery.isError ? describeProofError(membershipQuery.error) : null;
  const sanctionsError = sanctionsQuery.isError ? describeProofError(sanctionsQuery.error) : null;

  return (
    <section
      aria-labelledby="status-heading"
      className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span
            id="status-heading"
            className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
          >
            Compliance status
          </span>
          <p className="mt-1 font-mono text-sm text-ink break-all">{wallet}</p>
        </div>
        <StatusPill kind={pill.kind} label={pill.label} />
      </div>

      {status === "loading" ? (
        <p className="mt-4 font-mono text-xs text-stone">Loading proofs…</p>
      ) : null}

      {membershipError && membershipError.kind !== "not-found" ? (
        <p role="alert" className="mt-4 flex items-start gap-2 font-mono text-xs text-rust">
          <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Membership: {membershipError.message}
        </p>
      ) : null}

      {sanctionsError && sanctionsError.kind !== "not-found" ? (
        <p role="alert" className="mt-4 flex items-start gap-2 font-mono text-xs text-rust">
          <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Sanctions: {sanctionsError.message}
        </p>
      ) : null}

      {(membershipRootMatch === false || sanctionsRootMatch === false) ? (
        <p className="mt-4 flex items-start gap-2 font-mono text-xs text-warning-text">
          <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {membershipRootMatch === false && sanctionsRootMatch === false
            ? "Both proof roots differ from the current published roots."
            : membershipRootMatch === false
              ? "Membership proof root differs from the current published root."
              : "Sanctions proof root differs from the current published root."}
        </p>
      ) : null}
    </section>
  );
}

function ProofCard({
  id,
  title,
  proof,
  extraFields,
}: Readonly<{
  id: string;
  title: string;
  proof: { wallet: string; path: string[]; path_indices: number[]; root: string };
  extraFields?: ReactNode;
}>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
    >
      <span
        id={`${id}-heading`}
        className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
      >
        {title}
      </span>

      <dl className="mt-4 grid gap-y-3 sm:grid-cols-[140px_1fr]">
        <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Wallet</dt>
        <dd className="font-mono text-sm text-ink break-all">{proof.wallet}</dd>

        {extraFields}

        <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Root</dt>
        <dd className="flex items-center gap-2 font-mono text-sm text-ink break-all">
          {truncateWallet(proof.root, 10, 10)}
          <button
            type="button"
            onClick={() => copyToClipboard(proof.root)}
            className="shrink-0 text-muted hover:text-ink"
            aria-label="Copy root"
          >
            <Copy className="size-3.5" />
          </button>
        </dd>

        <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Tree depth</dt>
        <dd className="font-mono text-sm text-ink">{proof.path.length}</dd>
      </dl>

      <div className="mt-5 border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 font-mono text-xs text-quill hover:text-ink"
        >
          <NavArrowDown
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
          {expanded ? "Hide" : "Show"} Merkle path ({proof.path.length} levels)
        </button>

        {expanded ? (
          <div className="mt-3">
            <MerklePathTable path={proof.path} pathIndices={proof.path_indices} />
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(JSON.stringify(proof, null, 2))}
              >
                <Copy aria-hidden="true" className="size-3.5" />
                Copy full proof
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RecentWalletsSection({
  recent,
  onPick,
  onForget,
}: Readonly<{
  recent: { wallet: string; lastSeenAt: number }[];
  onPick: (wallet: string) => void;
  onForget: (wallet: string) => void;
}>) {
  return (
    <section
      aria-labelledby="recent-heading"
      className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
    >
      <div className="flex items-baseline justify-between">
        <span
          id="recent-heading"
          className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
        >
          Recent lookups (this browser)
        </span>
        <span className="font-mono text-xs text-muted">{recent.length} stored</span>
      </div>

      {recent.length === 0 ? (
        <p className="mt-4 font-mono text-xs text-muted">
          No lookups yet. The last 8 wallets you check will appear here.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border-subtle">
          {recent.map((entry) => (
            <li
              key={entry.wallet}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <button
                type="button"
                onClick={() => onPick(entry.wallet)}
                className="flex flex-1 items-center gap-3 text-left font-mono text-sm text-ink hover:text-forest focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <span>{truncateWallet(entry.wallet, 8, 8)}</span>
                <span className="font-mono text-[11px] text-muted">
                  {new Date(entry.lastSeenAt).toLocaleString("en-US", {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Forget ${entry.wallet}`}
                onClick={() => onForget(entry.wallet)}
              >
                <Xmark aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MerklePathTable({
  path,
  pathIndices,
}: Readonly<{
  path: string[];
  pathIndices: number[];
}>) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-3)] border border-border-subtle">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border-subtle">
            <th className="px-3 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              Level
            </th>
            <th className="px-3 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              Direction
            </th>
            <th className="px-3 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
              Sibling hash
            </th>
          </tr>
        </thead>
        <tbody>
          {path.map((hash, i) => (
            <tr
              key={i}
              className="border-b border-border-subtle last:border-b-0"
            >
              <td className="px-3 py-2 font-mono text-xs text-quill">{i}</td>
              <td className="px-3 py-2 font-mono text-xs text-quill">
                {pathIndices[i] === 0 ? "L" : "R"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-quill">
                {truncateWallet(hash, 8, 8)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

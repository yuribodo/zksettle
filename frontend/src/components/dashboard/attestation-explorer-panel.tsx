"use client";

import { Copy, NavArrowDown, Search, Xmark } from "iconoir-react";
import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { toast } from "sonner";

import { clearActiveApiKey } from "@/lib/api/active-key";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusPill, type StatusKind } from "@/components/dashboard/status-pill";
import { TruncatedHash } from "@/components/dashboard/truncated-hash";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMembershipProof } from "@/hooks/use-membership-proof";
import {
  useForgetWallet,
  useRecentWallets,
  useRecordWallet,
} from "@/hooks/use-recent-wallets";
import { useRoots } from "@/hooks/use-roots";
import { useSanctionsProof } from "@/hooks/use-sanctions-proof";
import { useConnectedWallet } from "@/hooks/use-wallet-connection";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { bytesToHex, isValidWalletHex, normalizeWalletHex } from "@/lib/wallet";

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

function rootMismatchMessage(
  membershipRootMatch: boolean | null,
  sanctionsRootMatch: boolean | null,
): string {
  if (membershipRootMatch === false && sanctionsRootMatch === false) {
    return "Both proof roots differ from the current published roots.";
  }
  if (membershipRootMatch === false) {
    return "Membership proof root differs from the current published root.";
  }
  return "Sanctions proof root differs from the current published root.";
}

function describeProofError(err: unknown): { kind: "not-found" | "auth" | "other"; message: string } {
  if (err instanceof ApiError) {
    if (err.status === 404) return { kind: "not-found", message: "No proof found for this wallet." };
    if (err.status === 401 || err.status === 403) {
      const body = err.body as Record<string, unknown> | undefined;
      const detail = typeof body?.error === "string" ? body.error : "";
      if (detail.includes("signature") || detail.includes("wallet"))
        return { kind: "auth", message: "You can only look up proofs for your own connected wallet." };
      void clearActiveApiKey();
      return { kind: "auth", message: "API key expired or invalid. Re-authenticate below." };
    }
    return { kind: "other", message: err.message };
  }
  return { kind: "other", message: err instanceof Error ? err.message : "Unknown error" };
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
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
  const connectedPubkey = useConnectedWallet();
  const connectedHex = connectedPubkey
    ? bytesToHex(Array.from(connectedPubkey.toBytes()))
    : null;

  const inputValid = isValidWalletHex(walletInput);

  const useMyWallet = () => {
    if (!connectedHex) return;
    setWalletInput(connectedHex);
    setActiveWallet(connectedHex);
    recordWallet(connectedHex);
  };

  const lookup = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValid) return;
    const normalized = normalizeWalletHex(walletInput);
    setActiveWallet(normalized);
    recordWallet(normalized);
  };

  const pickRecent = (wallet: string) => {
    setWalletInput(wallet);
    if (wallet === activeWallet) {
      membershipQuery.refetch();
      sanctionsQuery.refetch();
    } else {
      setActiveWallet(wallet);
    }
    recordWallet(wallet);
  };

  const status = activeWallet ? deriveStatus(membershipQuery, sanctionsQuery) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Wallet search */}
      <Card className="border-border-subtle bg-surface">
        <CardHeader>
          <CardTitle className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Search wallet attestation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-stone">
            Paste a 32-byte wallet pubkey as 64 hex chars (with or without{" "}
            <span className="font-mono">0x</span>).
          </p>

          <form onSubmit={lookup} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              placeholder="0x... (64 hex chars)"
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
            {connectedHex && (
              <Button type="button" variant="ghost" size="md" onClick={useMyWallet}>
                Use my wallet
              </Button>
            )}
          </form>

          {walletInput.length > 0 && !inputValid ? (
            <p id="wallet-help" className="mt-2 font-mono text-xs text-rust">
              Wallet must be 64 hex characters.
            </p>
          ) : null}
        </CardContent>
      </Card>

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

      <ProofResultsSection
        activeWallet={activeWallet}
        status={status}
        membershipQuery={membershipQuery}
        sanctionsQuery={sanctionsQuery}
      />

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

function ProofResultsSection({
  activeWallet,
  status,
  membershipQuery,
  sanctionsQuery,
}: Readonly<{
  activeWallet: string | null;
  status: ComplianceStatus | null;
  membershipQuery: ReturnType<typeof useMembershipProof>;
  sanctionsQuery: ReturnType<typeof useSanctionsProof>;
}>) {
  if (!activeWallet) return null;

  if (status === "loading") {
    return (
      <>
        <ProofCardSkeleton title="Membership proof" />
        <ProofCardSkeleton title="Sanctions proof" />
      </>
    );
  }

  return (
    <>
      {membershipQuery.data ? (
        <ProofCard
          id="membership"
          title="Membership proof"
          description="Merkle inclusion proof for wallet membership in the compliance set"
          proof={membershipQuery.data}
          extraFields={
            <>
              <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Leaf index</dt>
              <dd className="font-mono text-sm text-ink">{membershipQuery.data.leaf_index}</dd>
            </>
          }
        />
      ) : null}

      {membershipQuery.data && sanctionsQuery.data ? (
        <Separator className="bg-border-subtle" />
      ) : null}

      {sanctionsQuery.data ? (
        <ProofCard
          id="sanctions"
          title="Sanctions proof"
          description="Merkle inclusion proof for sanctions screening status"
          proof={sanctionsQuery.data}
          extraFields={
            <>
              <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Leaf value</dt>
              <dd className="flex items-center gap-2 font-mono text-sm text-ink">
                {sanctionsQuery.data.leaf_value === EMPTY_LEAF ? (
                  <StatusPill kind="verified" label="Empty (not sanctioned)" />
                ) : (
                  <StatusPill kind="blocked" label="Present (sanctioned)" />
                )}
              </dd>
            </>
          }
        />
      ) : null}
    </>
  );
}

function ProofCardSkeleton({ title }: Readonly<{ title: string }>) {
  return (
    <Card className="border-border-subtle bg-surface">
      <CardHeader>
        <CardTitle className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-y-3 sm:grid-cols-[140px_1fr]">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-64" />

          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-32" />

          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-48" />

          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Separator className="my-5 bg-border-subtle" />
        <Skeleton className="h-4 w-48" />
      </CardContent>
    </Card>
  );
}

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

  useEffect(() => {
    if (membershipError && membershipError.kind !== "not-found") {
      toast.error(`Membership: ${membershipError.message}`);
    }
  }, [membershipError]);

  useEffect(() => {
    if (sanctionsError && sanctionsError.kind !== "not-found") {
      toast.error(`Sanctions: ${sanctionsError.message}`);
    }
  }, [sanctionsError]);

  useEffect(() => {
    if (membershipRootMatch === false || sanctionsRootMatch === false) {
      toast.warning(rootMismatchMessage(membershipRootMatch, sanctionsRootMatch));
    }
  }, [membershipRootMatch, sanctionsRootMatch]);

  return (
    <Card className="border-border-subtle bg-surface">
      <CardHeader>
        <CardTitle className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
          Compliance status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TruncatedHash
            value={wallet}
            head={12}
            tail={12}
            className="text-sm text-ink"
          />
          <StatusPill kind={pill.kind} label={pill.label} />
        </div>

        {status === "loading" ? (
          <div className="mt-4 flex items-center gap-3">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProofCard({
  id,
  title,
  description,
  proof,
  extraFields,
}: Readonly<{
  id: string;
  title: string;
  description?: string;
  proof: { wallet: string; path: string[]; path_indices: number[]; root: string };
  extraFields?: ReactNode;
}>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-border-subtle bg-surface">
      <CardHeader>
        <CardTitle
          id={`${id}-heading`}
          className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
        >
          {title}
        </CardTitle>
        {description ? (
          <p className="text-xs text-stone">{description}</p>
        ) : null}
      </CardHeader>

      <CardContent>
        <dl className="grid gap-y-3 sm:grid-cols-[140px_1fr]">
          <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Wallet</dt>
          <dd>
            <TruncatedHash
              value={proof.wallet}
              head={10}
              tail={10}
              className="text-sm text-ink"
            />
          </dd>

          {extraFields}

          <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Root</dt>
          <dd>
            <TruncatedHash
              value={proof.root}
              head={10}
              tail={10}
              className="text-sm text-ink"
            />
          </dd>

          <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Tree depth</dt>
          <dd className="font-mono text-sm text-ink">{proof.path.length}</dd>
        </dl>

        <Separator className="my-5 bg-border-subtle" />

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-mono text-xs text-quill transition-colors hover:bg-surface-deep hover:text-ink",
            expanded && "text-ink",
          )}
        >
          <NavArrowDown
            className={cn(
              "size-4 shrink-0 transition-transform duration-200",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
          {expanded ? "Hide" : "Show"} Merkle path ({proof.path.length} levels)
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-in-out",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className="pt-3">
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
          </div>
        </div>
      </CardContent>
    </Card>
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
    <Card className="border-border-subtle bg-surface">
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <CardTitle className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Recent lookups (this browser)
          </CardTitle>
          <span className="font-mono text-xs text-muted">{recent.length} stored</span>
        </div>
      </CardHeader>

      <CardContent>
        {recent.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No lookups yet"
            description="The last 8 wallets you check will appear here."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {recent.map((entry) => (
              <li
                key={entry.wallet}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <button
                  type="button"
                  onClick={() => onPick(entry.wallet)}
                  className="flex flex-1 cursor-pointer items-center gap-3 text-left font-mono text-sm text-ink hover:text-forest focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <TruncatedHash
                    value={entry.wallet}
                    head={8}
                    tail={8}
                    copyable={false}
                    className="text-sm text-ink pointer-events-none"
                  />
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
      </CardContent>
    </Card>
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
    <div className="rounded-md border border-border-subtle">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
              Level
            </TableHead>
            <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
              Direction
            </TableHead>
            <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
              Sibling hash
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {path.map((hash, i) => (
            <TableRow key={`${i}-${hash}`}>
              <TableCell className="font-mono text-xs text-quill">{i}</TableCell>
              <TableCell className="font-mono text-xs text-quill">
                {pathIndices[i] === 0 ? "L" : "R"}
              </TableCell>
              <TableCell>
                <TruncatedHash
                  value={hash}
                  head={8}
                  tail={8}
                  className="text-xs text-quill"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

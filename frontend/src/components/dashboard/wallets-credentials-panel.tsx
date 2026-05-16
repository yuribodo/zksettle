"use client";

import { Clock, Plus, Search, Trash, WarningTriangle, Xmark } from "iconoir-react";
import { useEffect, useState, type SyntheticEvent } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TruncatedHash } from "@/components/dashboard/truncated-hash";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCredential,
  useIssueCredential,
  useRevokeCredential,
} from "@/hooks/use-credential";
import {
  useForgetWallet,
  useRecentWallets,
  useRecordWallet,
} from "@/hooks/use-recent-wallets";
import { useRegisterWallet } from "@/hooks/use-register-wallet";
import { clearActiveApiKey } from "@/lib/api/active-key";
import { ApiError } from "@/lib/api/client";
import type { Credential } from "@/lib/api/schemas";
import { cn } from "@/lib/cn";
import { bytesToHex, isValidWalletHex, isValidWalletInput, normalizeWalletHex, normalizeWalletInput } from "@/lib/wallet";

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeError(err: unknown): { kind: "not-found" | "auth" | "conflict" | "other"; message: string } {
  if (err instanceof ApiError) {
    if (err.status === 404) return { kind: "not-found", message: "No credential for this wallet." };
    if (err.status === 401 || err.status === 403) {
      void clearActiveApiKey();
      return { kind: "auth", message: "API key expired or invalid. Re-authenticate below." };
    }
    if (err.status === 409) return { kind: "conflict", message: "Wallet already has a credential." };
    if (err.status === 400) return { kind: "other", message: "Invalid wallet address." };
    return { kind: "other", message: err.message };
  }
  return { kind: "other", message: err instanceof Error ? err.message : "Unknown error" };
}

function describeRegisterError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "Wallet is already registered in the membership tree.";
    if (err.status === 400) return "Invalid wallet address.";
    if (err.status === 401 || err.status === 403) {
      void clearActiveApiKey();
      return "API key expired or invalid. Re-authenticate below.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Unknown error";
}

export function WalletsCredentialsPanel() {
  const [walletInput, setWalletInput] = useState("");
  const [activeWallet, setActiveWallet] = useState<string | null>(null);
  const [issueJurisdiction, setIssueJurisdiction] = useState("US");
  const [registerInput, setRegisterInput] = useState("");

  const credentialQuery = useCredential(activeWallet);
  const issue = useIssueCredential();
  const revoke = useRevokeCredential();
  const register = useRegisterWallet();
  const { data: recent = [] } = useRecentWallets();
  const recordWallet = useRecordWallet();
  const forgetWallet = useForgetWallet();
  const registerInputValid = isValidWalletInput(registerInput);

  const inputValid = isValidWalletInput(walletInput);

  const runRegister = async (normalized: string): Promise<void> => {
    register.reset();
    try {
      const res = await register.mutateAsync(normalized);
      recordWallet(normalized);
      setRegisterInput("");
      toast.success(`Wallet registered — ${res.message}`);
    } catch (err) {
      toast.error(describeRegisterError(err));
    }
  };

  const onRegister = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeWalletInput(registerInput);
    if (!normalized) return;
    void runRegister(normalized);
  };

  const lookup = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeWalletInput(walletInput);
    if (!normalized) return;
    setActiveWallet(normalized);
    recordWallet(normalized);
    issue.reset();
    revoke.reset();
  };

  const pickRecent = (wallet: string) => {
    setWalletInput(wallet);
    setActiveWallet(wallet);
    recordWallet(wallet);
    issue.reset();
    revoke.reset();
  };

  const onIssue = async () => {
    if (!activeWallet) return;
    issue.reset();
    try {
      await issue.mutateAsync({ wallet: activeWallet, jurisdiction: issueJurisdiction || undefined });
      toast.success("Credential issued");
      credentialQuery.refetch();
    } catch (err) {
      toast.error(describeError(err).message);
    }
  };

  const onRevoke = async () => {
    if (!activeWallet) return;
    revoke.reset();
    try {
      await revoke.mutateAsync(activeWallet);
      toast.success("Credential revoked");
      credentialQuery.refetch();
    } catch (err) {
      toast.error(describeError(err).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Register wallet ── */}
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Register wallet
          </CardTitle>
          <CardDescription className="text-sm text-stone">
            Add a wallet to the membership tree. Paste a Solana address (Base58)
            or 64 hex chars.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-[var(--radius-3)] border border-warning-text/40 bg-warning-bg px-3 py-2 text-warning-text"
          >
            <WarningTriangle aria-hidden="true" className="size-4 shrink-0 mt-0.5" strokeWidth={1.8} />
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase">Devnet only</span>
              <span className="text-xs leading-snug">
                Paste a <strong>devnet</strong> wallet address. Mainnet addresses will not work here.
              </span>
            </div>
          </div>
          <form
            onSubmit={onRegister}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Input
              value={registerInput}
              onChange={(e) => {
                setRegisterInput(e.target.value);
                register.reset();
              }}
              placeholder="Solana address or 0x… hex"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={registerInput.length > 0 && !registerInputValid}
              aria-describedby="register-help"
              className="font-mono"
              disabled={register.isPending}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!registerInputValid || register.isPending}
            >
              <Plus aria-hidden="true" className="size-4" />
              {register.isPending ? "Registering…" : "Register"}
            </Button>
          </form>

          {registerInput.length > 0 && !registerInputValid ? (
            <p id="register-help" className="mt-2 font-mono text-xs text-rust">
              Enter a valid Solana address or 64 hex characters.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Look up wallet credential ── */}
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Look up wallet credential
          </CardTitle>
          <CardDescription className="text-sm text-stone">
            Paste a Solana address (Base58) or 64 hex chars.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-[var(--radius-3)] border border-warning-text/40 bg-warning-bg px-3 py-2 text-warning-text"
          >
            <WarningTriangle aria-hidden="true" className="size-4 shrink-0 mt-0.5" strokeWidth={1.8} />
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase">Devnet only</span>
              <span className="text-xs leading-snug">
                Look up <strong>devnet</strong> wallets only — mainnet addresses are not supported.
              </span>
            </div>
          </div>
          <form onSubmit={lookup} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              placeholder="Solana address or 0x… hex"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={walletInput.length > 0 && !inputValid}
              aria-describedby="wallet-help"
              className="font-mono"
            />
            <Button type="submit" variant="primary" size="md" disabled={!inputValid}>
              <Search aria-hidden="true" className="size-4" />
              Look up
            </Button>
          </form>

          {walletInput.length > 0 && !inputValid ? (
            <p id="wallet-help" className="mt-2 font-mono text-xs text-rust">
              Enter a valid Solana address or 64 hex characters.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {activeWallet ? (
        <>
          <Separator />
          <CredentialCard
            wallet={activeWallet}
            query={credentialQuery}
            issueJurisdiction={issueJurisdiction}
            onIssueJurisdictionChange={setIssueJurisdiction}
            onIssue={onIssue}
            onRevoke={onRevoke}
            issuePending={issue.isPending}
            revokePending={revoke.isPending}
          />
        </>
      ) : null}

      <Separator />

      {/* ── Recent lookups ── */}
      <Card>
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
              icon={Clock}
              title="No lookups yet"
              description="The last 8 wallets you check will appear here."
              className="py-8"
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {recent.map((entry) => (
                <li
                  key={entry.wallet}
                  className={cn(
                    "group/recent flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0",
                    "rounded-[var(--radius-3)] transition-colors",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => pickRecent(entry.wallet)}
                    className={cn(
                      "flex flex-1 cursor-pointer items-center gap-3 text-left",
                      "rounded-[var(--radius-2)] px-1 py-0.5 -ml-1",
                      "text-ink transition-colors hover:bg-surface-deep hover:text-forest",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
                    )}
                  >
                    <TruncatedHash
                      value={entry.wallet}
                      head={8}
                      tail={8}
                      copyable={false}
                      className="text-sm"
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
                    onClick={() => forgetWallet(entry.wallet)}
                    className="opacity-0 transition-opacity group-hover/recent:opacity-100 focus-visible:opacity-100"
                  >
                    <Xmark aria-hidden="true" className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface CredentialCardProps {
  wallet: string;
  query: ReturnType<typeof useCredential>;
  issueJurisdiction: string;
  onIssueJurisdictionChange: (value: string) => void;
  onIssue: () => void;
  onRevoke: () => void;
  issuePending: boolean;
  revokePending: boolean;
}

function CredentialCard({
  wallet,
  query,
  issueJurisdiction,
  onIssueJurisdictionChange,
  onIssue,
  onRevoke,
  issuePending,
  revokePending,
}: Readonly<CredentialCardProps>) {
  const { data: credential, isLoading, isError, error } = query;
  const errorInfo = isError ? describeError(error) : null;

  useEffect(() => {
    if (errorInfo && errorInfo.kind !== "not-found") {
      toast.error(errorInfo.message);
    }
  }, [errorInfo]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Credential
            </CardTitle>
            <TruncatedHash
              value={wallet}
              head={10}
              tail={10}
              className="text-sm text-ink"
            />
          </div>
          <CredentialStatus
            loading={isLoading}
            notFound={errorInfo?.kind === "not-found"}
            credential={credential ?? null}
            authError={errorInfo?.kind === "auth"}
            otherError={errorInfo?.kind === "other"}
          />
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? <CredentialSkeleton /> : null}

        {credential ? (
          <CredentialDetails credential={credential} />
        ) : null}

        <Separator className="my-5" />

        {credential && !credential.revoked ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink">Revoke this credential</p>
              <p className="text-xs text-stone">
                Zeros the wallet&apos;s leaf in the membership tree. Requires re-publish to take effect on-chain.
              </p>
            </div>
            <RevokeConfirmDialog
              onConfirm={onRevoke}
              revokePending={revokePending}
            />
          </div>
        ) : null}

        {!credential && errorInfo?.kind === "not-found" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">Issue credential for this wallet</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1.5 sm:max-w-[200px]">
                <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
                  Jurisdiction (ISO alpha-2)
                </span>
                <Input
                  value={issueJurisdiction}
                  onChange={(e) => onIssueJurisdictionChange(e.target.value.toUpperCase())}
                  placeholder="US"
                  maxLength={2}
                  className="font-mono uppercase"
                  disabled={issuePending}
                />
              </label>
              <Button
                variant="primary"
                size="md"
                onClick={onIssue}
                disabled={issuePending || issueJurisdiction.length === 0}
              >
                {issuePending ? "Issuing…" : "Issue credential"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RevokeConfirmDialog({
  onConfirm,
  revokePending,
}: Readonly<{ onConfirm: () => void; revokePending: boolean }>) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="md" disabled={revokePending}>
            <Trash aria-hidden="true" className="size-4" />
            {revokePending ? "Revoking…" : "Revoke"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke credential</DialogTitle>
          <DialogDescription>
            This will zero the wallet&apos;s leaf in the membership tree. The change requires a re-publish to take effect on-chain. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={<Button variant="ghost" />}
          >
            Cancel
          </DialogClose>
          <Button
            variant="primary"
            size="md"
            onClick={handleConfirm}
            disabled={revokePending}
          >
            <Trash aria-hidden="true" className="size-4" />
            {revokePending ? "Revoking…" : "Yes, revoke"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialSkeleton() {
  return (
    <div className="grid gap-y-3 sm:grid-cols-[140px_1fr]">
      {(["issuer", "wallet", "status", "issued", "expires"] as const).map((field) => (
        <div key={field} className="contents">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}

function CredentialStatus({
  loading,
  notFound,
  credential,
  authError,
  otherError,
}: Readonly<{
  loading: boolean;
  notFound: boolean;
  credential: Credential | null;
  authError: boolean;
  otherError: boolean;
}>) {
  if (loading) return <StatusPill kind="info" label="Loading" />;
  if (notFound) return <StatusPill kind="warning" label="Not found" />;
  if (authError) return <StatusPill kind="warning" label="Unauthorized" />;
  if (otherError) return <StatusPill kind="warning" label="Error" />;
  if (credential?.revoked) return <StatusPill kind="blocked" label="Revoked" />;
  if (credential) return <StatusPill kind="verified" label="Active" />;
  return null;
}

function CredentialDetails({ credential }: Readonly<{ credential: Credential }>) {
  const walletHex = bytesToHex(credential.wallet);
  return (
    <Card className="bg-surface-deep ring-0">
      <CardContent className="pt-1">
        <dl className="grid gap-y-3 sm:grid-cols-[140px_1fr]">
          <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Wallet</dt>
          <dd>
            <TruncatedHash
              value={walletHex}
              head={10}
              tail={10}
              className="text-sm text-ink"
            />
          </dd>

          <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Leaf index</dt>
          <dd className="font-mono text-sm text-ink">{credential.leaf_index}</dd>

          <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Jurisdiction</dt>
          <dd className="font-mono text-sm text-ink">{credential.jurisdiction}</dd>

          <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Issued at</dt>
          <dd className="font-mono text-sm text-ink">{formatTimestamp(credential.issued_at)}</dd>

          <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Revoked</dt>
          <dd className="font-mono text-sm text-ink">{credential.revoked ? "yes" : "no"}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

"use client";

import { Check, Plus, Search, Trash, WarningTriangle, Xmark } from "iconoir-react";
import { useState, type FormEvent } from "react";

import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ApiError } from "@/lib/api/client";
import type { Credential } from "@/lib/api/schemas";
import { truncateWallet } from "@/lib/format";
import { bytesToHex, isValidWalletHex, normalizeWalletHex } from "@/lib/wallet";

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
    if (err.status === 401 || err.status === 403)
      return { kind: "auth", message: "Not authorized. Check NEXT_PUBLIC_API_KEY." };
    if (err.status === 409) return { kind: "conflict", message: "Wallet already has a credential." };
    if (err.status === 400) return { kind: "other", message: "Invalid wallet hex (need 64 chars)." };
    return { kind: "other", message: err.message };
  }
  return { kind: "other", message: err instanceof Error ? err.message : "Unknown error" };
}

function describeRegisterError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "Wallet is already registered in the membership tree.";
    if (err.status === 400) return "Invalid wallet hex (need exactly 64 hex characters).";
    if (err.status === 401 || err.status === 403)
      return "Not authorized. Check NEXT_PUBLIC_API_KEY.";
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
  const registerInputValid = isValidWalletHex(registerInput);

  const inputValid = isValidWalletHex(walletInput);

  const onRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registerInputValid) return;
    const normalized = normalizeWalletHex(registerInput);
    register.reset();
    try {
      await register.mutateAsync(normalized);
      recordWallet(normalized);
      setRegisterInput("");
    } catch {
      // error surfaced via register.error
    }
  };

  const lookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValid) return;
    const normalized = normalizeWalletHex(walletInput);
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
      credentialQuery.refetch();
    } catch {
      // surfaced via issue.error
    }
  };

  const onRevoke = async () => {
    if (!activeWallet) return;
    revoke.reset();
    try {
      await revoke.mutateAsync(activeWallet);
      credentialQuery.refetch();
    } catch {
      // surfaced via revoke.error
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="register-heading"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <span
          id="register-heading"
          className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
        >
          Register wallet
        </span>
        <p className="mt-1 text-sm text-stone">
          Add a wallet to the membership tree. Paste a 32-byte pubkey as 64 hex
          chars (with or without <span className="font-mono">0x</span>).
        </p>

        <form
          onSubmit={onRegister}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <Input
            value={registerInput}
            onChange={(e) => {
              setRegisterInput(e.target.value);
              register.reset();
            }}
            placeholder="0x… (64 hex chars)"
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
            Wallet must be 64 hex characters.
          </p>
        ) : (
          <p id="register-help" className="mt-2 font-mono text-xs text-muted">
            Calls <span className="text-quill">POST /v1/wallets</span>.
          </p>
        )}

        {register.isSuccess ? (
          <output
            className="mt-3 flex items-start gap-2 font-mono text-xs text-forest"
          >
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Wallet registered — {register.data.message}
          </output>
        ) : null}

        {register.isError ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 font-mono text-xs text-rust"
          >
            <WarningTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {describeRegisterError(register.error)}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="lookup-heading"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <span
          id="lookup-heading"
          className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
        >
          Look up wallet credential
        </span>
        <p className="mt-1 text-sm text-stone">
          Paste a 32-byte wallet pubkey as 64 hex chars (with or without <span className="font-mono">0x</span>).
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
            Look up
          </Button>
        </form>

        {walletInput.length > 0 && !inputValid ? (
          <p id="wallet-help" className="mt-2 font-mono text-xs text-rust">
            Wallet must be 64 hex characters.
          </p>
        ) : (
          <p id="wallet-help" className="mt-2 font-mono text-xs text-muted">
            Calls <span className="text-quill">GET /v1/credentials/&#123;wallet&#125;</span>.
          </p>
        )}
      </section>

      {activeWallet ? (
        <CredentialCard
          wallet={activeWallet}
          query={credentialQuery}
          issueJurisdiction={issueJurisdiction}
          onIssueJurisdictionChange={setIssueJurisdiction}
          onIssue={onIssue}
          onRevoke={onRevoke}
          issuePending={issue.isPending}
          revokePending={revoke.isPending}
          issueError={issue.error}
          revokeError={revoke.error}
        />
      ) : null}

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
                  onClick={() => pickRecent(entry.wallet)}
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
                  onClick={() => forgetWallet(entry.wallet)}
                >
                  <Xmark aria-hidden="true" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
  issueError: unknown;
  revokeError: unknown;
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
  issueError,
  revokeError,
}: Readonly<CredentialCardProps>) {
  const { data: credential, isLoading, isError, error } = query;
  const errorInfo = isError ? describeError(error) : null;

  return (
    <section
      aria-labelledby="credential-heading"
      className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span
            id="credential-heading"
            className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
          >
            Credential
          </span>
          <p className="mt-1 font-mono text-sm text-ink break-all">{wallet}</p>
        </div>
        <CredentialStatus
          loading={isLoading}
          notFound={errorInfo?.kind === "not-found"}
          credential={credential ?? null}
          authError={errorInfo?.kind === "auth"}
          otherError={errorInfo?.kind === "other"}
        />
      </div>

      {isLoading ? (
        <p className="mt-4 font-mono text-xs text-stone">Loading credential…</p>
      ) : null}

      {errorInfo && errorInfo.kind !== "not-found" ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 font-mono text-xs text-rust"
        >
          <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {errorInfo.message}
        </p>
      ) : null}

      {credential ? (
        <CredentialDetails credential={credential} />
      ) : null}

      <div className="mt-6 border-t border-border-subtle pt-5">
        {credential && !credential.revoked ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink">Revoke this credential</p>
              <p className="text-xs text-stone">
                Zeros the wallet&apos;s leaf in the membership tree. Requires re-publish to take effect on-chain.
              </p>
            </div>
            <Button
              variant="ghost"
              size="md"
              onClick={onRevoke}
              disabled={revokePending}
            >
              <Trash aria-hidden="true" className="size-4" />
              {revokePending ? "Revoking…" : "Revoke"}
            </Button>
          </div>
        ) : null}

        {!credential && errorInfo?.kind === "not-found" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">Issue credential for this wallet</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1.5 sm:max-w-[200px]">
                <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
                  Jurisdiction (ISO α-2)
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

        {issueError ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 font-mono text-xs text-rust"
          >
            <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {describeError(issueError).message}
          </p>
        ) : null}
        {revokeError ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 font-mono text-xs text-rust"
          >
            <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {describeError(revokeError).message}
          </p>
        ) : null}
      </div>
    </section>
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
    <dl className="mt-5 grid gap-y-3 sm:grid-cols-[140px_1fr]">
      <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Wallet</dt>
      <dd className="font-mono text-sm text-ink break-all">{walletHex}</dd>

      <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Leaf index</dt>
      <dd className="font-mono text-sm text-ink">{credential.leaf_index}</dd>

      <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Jurisdiction</dt>
      <dd className="font-mono text-sm text-ink">{credential.jurisdiction}</dd>

      <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Issued at</dt>
      <dd className="font-mono text-sm text-ink">{formatTimestamp(credential.issued_at)}</dd>

      <dt className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Revoked</dt>
      <dd className="font-mono text-sm text-ink">{credential.revoked ? "yes" : "no"}</dd>
    </dl>
  );
}

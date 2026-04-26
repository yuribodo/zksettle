"use client";

import { Copy, Trash, WarningTriangle } from "iconoir-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  lookupKeyPrefix,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  type CreatedKey,
} from "@/hooks/use-api-keys";
import { ApiError } from "@/lib/api/client";
import type { ListedKey, Tier } from "@/lib/api/schemas";

const TIER_LABEL: Record<Tier, string> = {
  developer: "Developer",
  startup: "Startup",
  growth: "Growth",
  enterprise: "Enterprise",
};

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return "Not authorized. Set NEXT_PUBLIC_API_KEY to your admin key, or set GATEWAY_ALLOW_OPEN_KEYS=true on the gateway.";
    }
    if (err.status === 500) {
      return "Key administration is disabled on the gateway. Set GATEWAY_ADMIN_KEY or GATEWAY_ALLOW_OPEN_KEYS=true.";
    }
    if (err.status === 404) {
      return "Key not found (it may have already been revoked).";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Unknown error";
}

function displayPrefix(keyHash: string): string {
  const cached = typeof window === "undefined" ? null : lookupKeyPrefix(keyHash);
  if (cached) return cached;
  return `hash ${keyHash.slice(0, 8)}…${keyHash.slice(-4)}`;
}

export function ApiKeysPanel() {
  const { data, isLoading, isError, error, refetch } = useApiKeys();
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();

  const [owner, setOwner] = useState("");
  const [revealed, setRevealed] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = owner.trim();
    if (!trimmed || createKey.isPending) return;
    try {
      const created = await createKey.mutateAsync(trimmed);
      setRevealed(created);
      setOwner("");
      setCopied(false);
    } catch {
      // surfaced via createKey.error
    }
  };

  const copyKey = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  const onRevoke = async (key: ListedKey) => {
    const confirmed = window.confirm(
      `Revoke key "${displayPrefix(key.key_hash)}" owned by "${key.owner}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    deleteKey.reset();
    try {
      await deleteKey.mutateAsync(key.key_hash);
    } catch {
      // surfaced via deleteKey.error
    }
  };

  const keys = data?.keys ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="create-key-heading"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <div className="flex flex-col gap-1">
          <span
            id="create-key-heading"
            className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
          >
            Create new key
          </span>
          <p className="text-sm text-stone">
            Provisions a <span className="font-mono text-ink">zks_…</span> key on the
            gateway. Default tier:{" "}
            <span className="font-mono text-ink">developer</span> · 1,000 proofs/mo.
          </p>
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
              Owner label
            </span>
            <Input
              required
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g. backend-prod"
              autoComplete="off"
              disabled={createKey.isPending}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!owner.trim() || createKey.isPending}
          >
            {createKey.isPending ? "Creating…" : "Create key"}
          </Button>
        </form>

        {createKey.error ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 font-mono text-xs text-rust"
          >
            <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {describeError(createKey.error)}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="keys-list-heading"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6"
      >
        <div className="flex items-baseline justify-between">
          <span
            id="keys-list-heading"
            className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
          >
            Provisioned keys
          </span>
          <div className="flex items-center gap-3 font-mono text-xs text-muted">
            <span>
              {isLoading ? "loading…" : `${keys.length} active`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone">
          Lives on the gateway via <span className="font-mono text-quill">GET /api-keys</span>. The
          full key is shown only at creation time; we cache the prefix locally so you can
          recognise it later.
        </p>

        {isError ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 font-mono text-xs text-rust"
          >
            <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {describeError(error)}
          </p>
        ) : null}

        {deleteKey.error ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 font-mono text-xs text-rust"
          >
            <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {describeError(deleteKey.error)}
          </p>
        ) : null}

        {!isError && keys.length === 0 && !isLoading ? (
          <p className="mt-6 font-mono text-xs text-muted">
            No keys yet. Create one above to get started.
          </p>
        ) : null}

        {keys.length > 0 ? (
          <table className="mt-4 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
                <th className="py-2 pr-3 font-medium">Prefix</th>
                <th className="py-2 pr-3 font-medium">Owner</th>
                <th className="py-2 pr-3 font-medium">Tier</th>
                <th className="py-2 pr-3 font-medium">Created</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr
                  key={key.key_hash}
                  className="border-b border-border-subtle text-quill last:border-b-0"
                >
                  <td className="py-3 pr-3 font-mono text-ink">
                    {displayPrefix(key.key_hash)}
                  </td>
                  <td className="py-3 pr-3">{key.owner}</td>
                  <td className="py-3 pr-3 font-mono text-stone">{TIER_LABEL[key.tier]}</td>
                  <td className="py-3 pr-3 font-mono text-xs text-stone">
                    {formatDate(key.created_at)}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Revoke key ${displayPrefix(key.key_hash)}`}
                      disabled={
                        deleteKey.isPending && deleteKey.variables === key.key_hash
                      }
                      onClick={() => onRevoke(key)}
                    >
                      <Trash aria-hidden="true" className="size-4" />
                      {deleteKey.isPending && deleteKey.variables === key.key_hash
                        ? "Revoking…"
                        : "Revoke"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {revealed ? (
        <RevealKeyDialog
          created={revealed}
          copied={copied}
          onCopy={copyKey}
          onDismiss={() => setRevealed(null)}
        />
      ) : null}
    </div>
  );
}

interface RevealKeyDialogProps {
  created: CreatedKey;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}

function RevealKeyDialog({ created, copied, onCopy, onDismiss }: RevealKeyDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-key-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="w-full max-w-lg rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <WarningTriangle aria-hidden="true" className="mt-1 size-5 shrink-0 text-rust" />
          <div className="flex flex-col gap-1">
            <h2
              id="reveal-key-heading"
              className="font-display text-xl text-ink"
            >
              Copy this key now
            </h2>
            <p className="text-sm text-stone">
              We won&apos;t show it again. Store it in your secret manager before closing
              this dialog.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
            Owner: {created.owner} · Tier: {TIER_LABEL[created.tier]}
          </span>
          <div className="flex items-center gap-2 rounded-[var(--radius-3)] border border-border-subtle bg-canvas p-3">
            <code className="flex-1 break-all font-mono text-sm text-ink">
              {created.api_key}
            </code>
            <Button variant="ghost" size="sm" onClick={onCopy} aria-label="Copy API key">
              <Copy aria-hidden="true" className="size-4" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="primary" size="md" onClick={onDismiss}>
            I saved it
          </Button>
        </div>
      </div>
    </div>
  );
}

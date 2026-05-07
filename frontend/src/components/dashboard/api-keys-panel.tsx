"use client";

import { Copy, Trash, WarningTriangle } from "iconoir-react";
import { useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  lookupKeyPrefix,
  lookupFullKey,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  type CreatedKey,
} from "@/hooks/use-api-keys";
import { useSetActiveKey, useActiveKey } from "@/hooks/use-active-key";
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
      return "Not authorized. Select an active API key in the sidebar, or set GATEWAY_ALLOW_OPEN_KEYS=true on the gateway.";
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
  const cached = globalThis.window === undefined ? null : lookupKeyPrefix(keyHash);
  if (cached) return cached;
  return `hash ${keyHash.slice(0, 8)}…${keyHash.slice(-4)}`;
}

export function ApiKeysPanel() {
  const { data, isLoading, isError, error, refetch } = useApiKeys();
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();
  const setActiveKey = useSetActiveKey();
  const { data: activeKey } = useActiveKey();

  const [owner, setOwner] = useState("");
  const [revealed, setRevealed] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<ListedKey | null>(null);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = owner.trim();
    if (!trimmed || createKey.isPending) return;
    try {
      const created = await createKey.mutateAsync(trimmed);
      setActiveKey.mutate(created.api_key);
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
    setRevoking(key);
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    deleteKey.reset();
    try {
      await deleteKey.mutateAsync(revoking.key_hash);
      setRevoking(null);
    } catch {
      setRevoking(null);
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
            className="mt-3 flex items-start gap-2 font-mono text-xs text-[var(--color-danger-text)]"
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
          recognise it later. Click <span className="font-mono text-ink">Activate</span> to use a key for gateway requests.
        </p>

        {isError ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 font-mono text-xs text-[var(--color-danger-text)]"
          >
            <WarningTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {describeError(error)}
          </p>
        ) : null}

        {deleteKey.error ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 font-mono text-xs text-[var(--color-danger-text)]"
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
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const fullKey = lookupFullKey(key.key_hash);
                const isActive = !!fullKey && activeKey === fullKey;
                let statusCell: React.ReactNode;
                if (isActive) {
                  statusCell = (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-forest">
                      <span className="size-1.5 rounded-full bg-forest" aria-hidden="true" />
                      {"Active"}
                    </span>
                  );
                } else if (fullKey) {
                  statusCell = (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setActiveKey.mutate(fullKey)}
                    >
                      Activate
                    </Button>
                  );
                } else {
                  statusCell = (
                    <span className="font-mono text-[11px] text-muted italic">Not stored</span>
                  );
                }
                return (
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
                    <td className="py-3 pr-3">
                      {statusCell}
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
                );
              })}
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

      {revoking ? (
        <RevokeConfirmDialog
          prefix={displayPrefix(revoking.key_hash)}
          owner={revoking.owner}
          isPending={deleteKey.isPending}
          onConfirm={confirmRevoke}
          onCancel={() => setRevoking(null)}
        />
      ) : null}
    </div>
  );
}

interface RevealKeyDialogProps {
  readonly created: CreatedKey;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly onDismiss: () => void;
}

function RevealKeyDialog({ created, copied, onCopy, onDismiss }: RevealKeyDialogProps) {
  return (
    <dialog
      open
      aria-labelledby="reveal-key-heading"
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none items-center justify-center border-none bg-ink/40 p-4"
    >
      <div className="w-full max-w-lg rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <WarningTriangle aria-hidden="true" className="mt-1 size-5 shrink-0 text-[var(--color-danger-text)]" />
          <div className="min-w-0 flex-1 flex-col gap-1">
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
    </dialog>
  );
}

interface RevokeConfirmDialogProps {
  readonly prefix: string;
  readonly owner: string;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function RevokeConfirmDialog({ prefix, owner, isPending, onConfirm, onCancel }: RevokeConfirmDialogProps) {
  return (
    <dialog
      open
      aria-labelledby="revoke-heading"
      aria-describedby="revoke-desc"
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none items-center justify-center border-none bg-ink/40 p-4"
    >
      <div className="w-full max-w-md rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <WarningTriangle aria-hidden="true" className="mt-1 size-5 shrink-0 text-[var(--color-danger-text)]" />
          <div className="min-w-0 flex-1 flex-col gap-1">
            <h2
              id="revoke-heading"
              className="font-display text-xl text-ink"
            >
              Revoke this key?
            </h2>
            <p id="revoke-desc" className="text-sm text-stone">
              This cannot be undone. Any service using this key will immediately lose access.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[var(--radius-3)] border border-border-subtle bg-canvas p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-ink">{prefix}</span>
            <span className="text-stone">·</span>
            <span className="text-stone">{owner}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="md" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-3)] px-4 font-sans text-sm font-medium text-canvas transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--color-danger-text)" }}
          >
            {isPending ? "Revoking…" : "Revoke key"}
           </button>
        </div>
      </div>
    </dialog>
  );
}

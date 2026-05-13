"use client";

import { Copy, Key, Trash, WarningTriangle } from "iconoir-react";
import { useEffect, useState, type SyntheticEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TableSkeleton } from "@/components/dashboard/table-skeleton";
import { TruncatedHash } from "@/components/dashboard/truncated-hash";
import {
  lookupKeyPrefix,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  type CreatedKey,
} from "@/hooks/use-api-keys";
import { ApiError } from "@/lib/api/client";
import {
  clearActiveApiKey,
  fetchActiveKeyStatus,
  onActiveKeyChanged,
  setActiveApiKey,
  type ActiveKeyStatus,
} from "@/lib/api/active-key";
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
      return "Not authorized. Create or activate an API key, or set GATEWAY_ALLOW_OPEN_KEYS=true on the gateway.";
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

  const [owner, setOwner] = useState("");
  const [revealed, setRevealed] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<ListedKey | null>(null);
  const [activePrefix, setActivePrefix] = useState<string | null>(null);

  useEffect(() => {
    if (isError) toast.error(describeError(error));
  }, [isError, error]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const fallback: ActiveKeyStatus = { hasKey: false };
      const status = await fetchActiveKeyStatus().catch(() => fallback);
      if (!cancelled) setActivePrefix(status.hasKey ? status.prefix ?? null : null);
    };
    void refresh();
    const off = onActiveKeyChanged(() => void refresh());
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const runCreate = async (trimmed: string): Promise<void> => {
    try {
      const created = await createKey.mutateAsync(trimmed);
      setRevealed(created);
      setOwner("");
      setCopied(false);
    } catch (err) {
      toast.error(describeError(err));
    }
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = owner.trim();
    if (!trimmed || createKey.isPending) return;
    void runCreate(trimmed);
  };

  const dismissReveal = async () => {
    const created = revealed;
    setRevealed(null);
    if (!created) return;
    try {
      await setActiveApiKey(created.api_key);
    } catch {
      // non-fatal: user can re-paste from their secret manager
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

  const requestRevoke = (key: ListedKey) => {
    deleteKey.reset();
    setPendingRevoke(key);
  };

  const confirmRevoke = async () => {
    if (!pendingRevoke) return;
    const target = pendingRevoke;
    const targetPrefix = lookupKeyPrefix(target.key_hash);
    setPendingRevoke(null);
    try {
      await deleteKey.mutateAsync(target.key_hash);
      toast.success("API key revoked");
      if (targetPrefix && activePrefix && targetPrefix === activePrefix) {
        await clearActiveApiKey();
      }
    } catch (err) {
      toast.error(describeError(err));
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
            Provisions a <span className="font-mono text-ink">zks_...</span> key on the
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
            {createKey.isPending ? "Creating..." : "Create key"}
          </Button>
        </form>
      </section>

      <Separator />

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
              {isLoading ? "loading..." : `${keys.length} active`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone">
          The full key is shown only at creation time; we cache the prefix locally so you can
          recognise it later.
        </p>

        {isLoading && (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Prefix</TableHead>
                  <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Owner</TableHead>
                  <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Tier</TableHead>
                  <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableSkeleton columns={5} rows={3} />
            </Table>
          </div>
        )}

        {!isLoading && !isError && keys.length === 0 && (
          <EmptyState
            icon={Key}
            title="No keys yet"
            description="Create one above to get started."
            className="mt-4"
          />
        )}

        {!isLoading && keys.length > 0 && (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Prefix</TableHead>
                  <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Owner</TableHead>
                  <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Tier</TableHead>
                  <TableHead className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => {
                  const prefix = displayPrefix(key.key_hash);
                  const isActive =
                    activePrefix !== null && lookupKeyPrefix(key.key_hash) === activePrefix;
                  return (
                    <TableRow key={key.key_hash} className="text-quill">
                      <TableCell className="font-mono text-ink">
                        <div className="flex items-center gap-2">
                          <TruncatedHash value={key.key_hash} head={8} tail={4} />
                          {isActive && (
                            <Badge variant="success">active</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{key.owner}</TableCell>
                      <TableCell className="font-mono text-stone">{TIER_LABEL[key.tier]}</TableCell>
                      <TableCell className="font-mono text-xs text-stone">
                        {formatDate(key.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Revoke key ${prefix}`}
                          disabled={
                            deleteKey.isPending && deleteKey.variables === key.key_hash
                          }
                          onClick={() => requestRevoke(key)}
                        >
                          <Trash aria-hidden="true" className="size-4" />
                          {deleteKey.isPending && deleteKey.variables === key.key_hash
                            ? "Revoking..."
                            : "Revoke"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog
        open={revealed !== null}
        onOpenChange={(open) => {
          if (!open) void dismissReveal();
        }}
      >
        {revealed && (
          <DialogContent showCloseButton={false} className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <WarningTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rust" />
                <div className="flex flex-col gap-1">
                  <DialogTitle className="font-display text-xl text-ink">
                    Copy this key now
                  </DialogTitle>
                  <DialogDescription className="text-sm text-stone">
                    We won&apos;t show it again. Store it in your secret manager before closing
                    this dialog. After you close this dialog, it will be set as your
                    active key (stored as an HttpOnly cookie, never visible to JS).
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
                Owner: {revealed.owner} · Tier: {TIER_LABEL[revealed.tier]}
              </span>
              <div className="flex items-center gap-2 rounded-[var(--radius-3)] border border-border-subtle bg-canvas p-3">
                <code className="flex-1 break-all font-mono text-sm text-ink">
                  {revealed.api_key}
                </code>
                <Button variant="ghost" size="sm" onClick={copyKey} aria-label="Copy API key">
                  <Copy aria-hidden="true" className="size-4" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="primary" size="md" onClick={() => void dismissReveal()}>
                I saved it
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null);
        }}
      >
        {pendingRevoke && (
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-ink">
                Revoke API key?
              </DialogTitle>
              <DialogDescription className="text-sm text-stone">
                This will permanently revoke{" "}
                <span className="font-mono text-ink">{displayPrefix(pendingRevoke.key_hash)}</span>{" "}
                owned by <span className="font-mono text-ink">{pendingRevoke.owner}</span>. This
                cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="ghost" size="md" onClick={() => setPendingRevoke(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={confirmRevoke}>
                Revoke key
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

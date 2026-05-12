"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { Copy, Key, WarningTriangle } from "iconoir-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearActiveApiKey,
  fetchActiveKeyStatus,
  onActiveKeyChanged,
  setActiveApiKey,
  type ActiveKeyStatus,
} from "@/lib/api/active-key";
import { useApiKeys, useCreateApiKey, lookupKeyPrefix } from "@/hooks/use-api-keys";

const KEY_FORMAT = /^zks_[A-Za-z0-9_-]{32,}$/;

export function RequireApiKey({ children }: Readonly<{ children: ReactNode }>) {
  const [status, setStatus] = useState<ActiveKeyStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await fetchActiveKeyStatus();
        if (next.hasKey) {
          const probe = await fetch("/api/proxy/usage", { credentials: "same-origin" });
          if (probe.status === 401 || probe.status === 403) {
            await clearActiveApiKey().catch(() => {});
            if (!cancelled) setStatus({ hasKey: false });
            return;
          }
        }
        if (!cancelled) setStatus(next);
      } catch {
        if (!cancelled) setStatus({ hasKey: false });
      }
    };
    void refresh();
    const off = onActiveKeyChanged(() => void refresh());
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  if (status === null) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex min-h-[40vh] items-center justify-center px-4"
      >
        <div className="h-32 w-full max-w-md animate-pulse rounded-[var(--radius-6)] border border-border-subtle bg-surface" />
        <span className="sr-only">Checking active API key…</span>
      </div>
    );
  }

  if (status.hasKey) return <>{children}</>;

  return <ApiKeyGate />;
}

function ApiKeyGate() {
  const { data, isLoading, isError, refetch } = useApiKeys();
  const createKey = useCreateApiKey();
  const [owner, setOwner] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedKey, setPastedKey] = useState("");
  const [activateError, setActivateError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pasteInputId = useId();
  const ownerInputId = useId();

  const keys = data?.keys ?? [];

  const handleCreate = useCallback(async () => {
    setActivateError(null);
    try {
      const result = await createKey.mutateAsync(owner || "dashboard");
      // Reveal the key first; activation happens on user confirmation so they
      // have a chance to copy the secret before the gate closes.
      setRevealedKey(result.api_key);
      setCopied(false);
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : "Failed to create key");
    }
  }, [createKey, owner]);

  const handleConfirmReveal = useCallback(async () => {
    if (!revealedKey) return;
    setActivateError(null);
    try {
      await setActiveApiKey(revealedKey);
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : "Failed to activate key");
    }
  }, [revealedKey]);

  const copyRevealedKey = useCallback(async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [revealedKey]);

  const isPasteValid = KEY_FORMAT.test(pastedKey);

  const handlePaste = useCallback(async () => {
    setActivateError(null);
    if (!isPasteValid) return;
    try {
      await setActiveApiKey(pastedKey);
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : "Failed to activate key");
    }
  }, [pastedKey, isPasteValid]);

  if (revealedKey) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6">
          <div className="flex items-start gap-3">
            <WarningTriangle aria-hidden="true" className="mt-1 size-5 shrink-0 text-rust" />
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-xl text-ink">Copy this key now</h2>
              <p className="text-sm text-stone">
                We won&apos;t show it again. Store it in your secret manager before
                continuing — you&apos;ll need it for any non-dashboard usage (SDK, curl,
                CI). The key will also be set as your active key in an HttpOnly cookie.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-[var(--radius-3)] border border-border-subtle bg-canvas p-3">
            <code className="flex-1 break-all font-mono text-sm text-ink">
              {revealedKey}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyRevealedKey}
              aria-label="Copy API key"
            >
              <Copy aria-hidden="true" className="size-4" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {activateError && (
            <p role="alert" className="mt-3 text-xs text-red-600">
              {activateError}
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <Button variant="primary" size="md" onClick={handleConfirmReveal}>
              I saved it — continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6">
        <div className="flex items-center gap-2 text-ink">
          <Key className="size-5" strokeWidth={1.5} />
          <h2 className="text-sm font-medium">API key required</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-stone">
          Select an existing API key or create a new one to continue. The key is stored
          server-side as an HttpOnly cookie — never exposed to JavaScript.
        </p>

        {isLoading && (
          <p className="mt-4 text-xs text-muted">Loading keys...</p>
        )}

        {!isLoading && keys.length > 0 && !pasteMode && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-xs font-medium text-stone">
              You have {keys.length} key{keys.length > 1 ? "s" : ""} — paste one
              below or create a new one.
            </p>
            <ul className="max-h-32 overflow-y-auto rounded-[var(--radius-2)] border border-border-subtle bg-canvas p-2 text-xs text-muted">
              {keys.map((k) => (
                <li key={k.key_hash} className="flex justify-between py-0.5">
                  <span className="font-mono">
                    {lookupKeyPrefix(k.key_hash) || k.key_hash.slice(0, 12) + "…"}
                  </span>
                  <span className="text-quill">{k.tier}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPasteMode(true)}>
                Paste existing key
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={createKey.isPending}>
                {createKey.isPending ? "Creating…" : "Create new key"}
              </Button>
            </div>
          </div>
        )}

        {!isLoading && keys.length > 0 && pasteMode && (
          <div className="mt-4 flex flex-col gap-3">
            <label htmlFor={pasteInputId} className="text-xs font-medium text-stone">
              Paste your API key (starts with <code className="font-mono">zks_</code>)
            </label>
            <Input
              id={pasteInputId}
              value={pastedKey}
              onChange={(e) => setPastedKey(e.target.value)}
              placeholder="zks_…"
              className="font-mono text-xs"
            />
            {pastedKey && !isPasteValid && (
              <p className="text-xs text-red-600">
                Invalid format. Keys must match <code>zks_</code> followed by 32+ characters.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPasteMode(false);
                  setPastedKey("");
                }}
              >
                Back
              </Button>
              <Button size="sm" onClick={handlePaste} disabled={!isPasteValid}>
                Use this key
              </Button>
            </div>
          </div>
        )}

        {!isLoading && isError && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-xs text-red-600">
              Failed to load API keys. Check your connection and try again.
            </p>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && keys.length === 0 && (
          <div className="mt-4 flex flex-col gap-3">
            <label htmlFor={ownerInputId} className="text-xs font-medium text-stone">
              No API keys found. Create one to get started.
            </label>
            <Input
              id={ownerInputId}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Key label (e.g. dashboard)"
              className="text-xs"
            />
            <Button size="sm" onClick={handleCreate} disabled={createKey.isPending}>
              {createKey.isPending ? "Creating…" : "Create API key"}
            </Button>
          </div>
        )}

        {(createKey.isError || activateError) && (
          <p className="mt-2 text-xs text-red-600">
            {activateError ??
              (createKey.error instanceof Error
                ? createKey.error.message
                : "Failed to create key")}
          </p>
        )}
      </div>
    </div>
  );
}

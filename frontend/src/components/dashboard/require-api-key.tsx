"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { Key } from "iconoir-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
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
  const pasteInputId = useId();
  const ownerInputId = useId();

  const keys = data?.keys ?? [];

  const handleCreate = useCallback(async () => {
    setActivateError(null);
    try {
      const result = await createKey.mutateAsync(owner || "dashboard");
      await setActiveApiKey(result.api_key);
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : "Failed to activate key");
    }
  }, [createKey, owner]);

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

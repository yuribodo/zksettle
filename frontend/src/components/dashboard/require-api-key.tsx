"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Key } from "iconoir-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActiveApiKey, setActiveApiKey } from "@/lib/api/active-key";
import { useApiKeys, useCreateApiKey, lookupKeyPrefix } from "@/hooks/use-api-keys";

export function RequireApiKey({ children }: Readonly<{ children: ReactNode }>) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    setHasKey(!!getActiveApiKey());

    const handler = () => setHasKey(!!getActiveApiKey());
    window.addEventListener("zks:active-key-changed", handler);
    return () => window.removeEventListener("zks:active-key-changed", handler);
  }, []);

  if (hasKey === null) return null;
  if (hasKey) return <>{children}</>;

  return <ApiKeyGate onSelected={() => setHasKey(true)} />;
}

function ApiKeyGate({ onSelected }: { onSelected: () => void }) {
  const { data, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const [owner, setOwner] = useState("");

  const keys = data?.keys ?? [];

  const handleCreate = useCallback(async () => {
    const result = await createKey.mutateAsync(owner || "dashboard");
    setActiveApiKey(result.api_key);
    onSelected();
  }, [createKey, owner, onSelected]);

  // If the user picks an existing key from the dropdown, we don't have the raw key.
  // The list only returns hashes. We need to ask the user to paste it or create a new one.
  // For UX: show existing keys for reference but the action is "create new" or "paste existing".
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedKey, setPastedKey] = useState("");

  const handlePaste = useCallback(() => {
    if (!pastedKey.startsWith("zks_")) return;
    setActiveApiKey(pastedKey);
    onSelected();
  }, [pastedKey, onSelected]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6">
        <div className="flex items-center gap-2 text-ink">
          <Key className="size-5" strokeWidth={1.5} />
          <h2 className="text-sm font-medium">API key required</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-stone">
          This page makes requests through the gateway proxy. Select an existing
          API key or create a new one to continue.
        </p>

        {isLoading && (
          <p className="mt-4 text-xs text-muted">Loading keys...</p>
        )}

        {!isLoading && keys.length > 0 && !pasteMode && (
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-xs font-medium text-stone">
              You have {keys.length} key{keys.length > 1 ? "s" : ""} — paste one
              below or create a new one.
            </label>
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
            <label className="text-xs font-medium text-stone">
              Paste your API key (starts with <code className="font-mono">zks_</code>)
            </label>
            <Input
              value={pastedKey}
              onChange={(e) => setPastedKey(e.target.value)}
              placeholder="zks_…"
              className="font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPasteMode(false)}
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handlePaste}
                disabled={!pastedKey.startsWith("zks_")}
              >
                Use this key
              </Button>
            </div>
          </div>
        )}

        {!isLoading && keys.length === 0 && (
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-xs font-medium text-stone">
              No API keys found. Create one to get started.
            </label>
            <Input
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

        {createKey.isError && (
          <p className="mt-2 text-xs text-red-600">
            {createKey.error instanceof Error
              ? createKey.error.message
              : "Failed to create key"}
          </p>
        )}
      </div>
    </div>
  );
}

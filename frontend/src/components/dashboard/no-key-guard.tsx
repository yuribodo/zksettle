"use client";

import { Key } from "iconoir-react";
import Link from "next/link";

import { useKeyStatus } from "@/hooks/use-active-key";
import { useSetActiveKey } from "@/hooks/use-active-key";
import { useApiKeys, lookupKeyPrefix, lookupFullKey } from "@/hooks/use-api-keys";
import { usePathname } from "next/navigation";

function keyDisplayLabel(keyHash: string): string {
  const cached = lookupKeyPrefix(keyHash);
  if (cached) return cached;
  return `${keyHash.slice(0, 8)}…${keyHash.slice(-4)}`;
}

export function NoKeyGuard({ children }: { children: React.ReactNode }) {
  const { hasKey, availableKeys, isLoading } = useKeyStatus();
  const pathname = usePathname() ?? "";

  if (pathname === "/dashboard/api-keys") {
    return <>{children}</>;
  }

  if (isLoading) {
    return <>{children}</>;
  }

  if (hasKey) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-deep">
        <Key className="size-6 text-stone" aria-hidden="true" strokeWidth={1.5} />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-display text-lg text-ink">
          {availableKeys === 0 ? "Create an API key to get started" : "Select an API key"}
        </h2>
        <p className="max-w-sm text-sm text-stone">
          {availableKeys === 0
            ? "You need an API key to authenticate gateway requests. Create one in the API keys settings."
            : "Choose one of your keys below to activate it."}
        </p>
      </div>
      {availableKeys > 0 ? (
        <InlineKeySelector />
      ) : (
        <Link
          href="/dashboard/api-keys"
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-3)] bg-forest px-4 font-sans text-sm font-medium text-canvas transition-colors hover:bg-forest-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Create API key
        </Link>
      )}
    </div>
  );
}

function InlineKeySelector() {
  const { data: keysData } = useApiKeys();
  const setActiveKey = useSetActiveKey();

  const keys = keysData?.keys ?? [];

  return (
    <div className="w-full max-w-sm rounded-[var(--radius-4)] border border-border-subtle bg-surface p-3">
      <span className="mb-2 block font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
        Your keys
      </span>
      <div className="flex flex-col gap-1">
        {keys.map((key) => {
          const fullKey = lookupFullKey(key.key_hash);
          return (
            <button
              key={key.key_hash}
              type="button"
              onClick={() => fullKey && setActiveKey.mutate(fullKey)}
              disabled={!fullKey}
              className={[
                "flex w-full items-center gap-2 rounded-[var(--radius-2)] px-2 py-2 text-left text-sm transition-colors",
                fullKey ? "text-quill hover:bg-surface-deep cursor-pointer" : "text-muted cursor-not-allowed",
              ].join(" ")}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {keyDisplayLabel(key.key_hash)}
              </span>
              {fullKey ? (
                <span className="shrink-0 font-mono text-[10px] text-forest">Activate</span>
              ) : (
                <span className="shrink-0 font-mono text-[10px] text-muted italic">not stored</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 border-t border-border-subtle pt-2">
        <Link
          href="/dashboard/api-keys"
          className="block cursor-pointer rounded-[var(--radius-2)] px-2 py-1.5 text-center font-mono text-[11px] text-forest hover:bg-surface-deep"
        >
          Manage keys →
        </Link>
      </div>
    </div>
  );
}

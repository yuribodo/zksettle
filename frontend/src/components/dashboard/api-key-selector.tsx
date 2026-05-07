"use client";

import { Key, NavArrowDown } from "iconoir-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

import { useApiKeys, lookupKeyPrefix, lookupFullKey } from "@/hooks/use-api-keys";
import {
  useActiveKey,
  useSetActiveKey,
  useClearActiveKey,
} from "@/hooks/use-active-key";
import { activeKeyPrefix } from "@/lib/active-key";
import type { ListedKey } from "@/lib/api/schemas";

function keyDisplayLabel(keyHash: string): string {
  const cached = lookupKeyPrefix(keyHash);
  if (cached) return cached;
  return `${keyHash.slice(0, 8)}…${keyHash.slice(-4)}`;
}

export function ApiKeySelector({ compact = false }: { readonly compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: keysData, isLoading: keysLoading } = useApiKeys();
  const { data: activeKey } = useActiveKey();
  const clearActiveKey = useClearActiveKey();

  const keys = keysData?.keys ?? [];
  const currentPrefix = activeKey ? activeKeyPrefix() : null;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const triggerClass = compact
    ? "flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-3)] px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-deep"
    : "flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-3)] px-3 py-2 text-left text-sm transition-colors hover:bg-surface-deep";

  const iconSize = compact ? "size-3.5" : "size-4";
  const arrowSize = compact ? "size-3" : "size-3.5";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Key className={`${iconSize} shrink-0 text-stone`} aria-hidden="true" strokeWidth={1.5} />
        <span className="flex-1 truncate font-mono text-muted">
          {currentPrefix ?? "No key selected"}
        </span>
        <NavArrowDown className={`${arrowSize} shrink-0 text-muted`} aria-hidden="true" strokeWidth={1.5} />
      </button>
      {open ? (
        <KeyDropdown
          keys={keys}
          isLoading={keysLoading}
          onClear={() => { clearActiveKey.mutate(); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

interface KeyDropdownProps {
  readonly keys: ListedKey[];
  readonly isLoading: boolean;
  readonly onClear: () => void;
  readonly onClose: () => void;
}

function KeyDropdown({ keys, isLoading, onClear, onClose }: KeyDropdownProps) {
  const setActiveKey = useSetActiveKey();
  const { data: activeKey } = useActiveKey();

  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState("");

  const activateStoredKey = (keyHash: string) => {
    const fullKey = lookupFullKey(keyHash);
    if (fullKey) {
      setActiveKey.mutate(fullKey);
      onClose();
    }
  };

  const applyPastedKey = () => {
    const trimmed = pasteValue.trim();
    if (!trimmed) return;
    setActiveKey.mutate(trimmed);
    setPasteValue("");
    onClose();
  };

  let dropdownContent: React.ReactNode;
  if (isLoading) {
    dropdownContent = (
      <span className="block px-2 py-1.5 font-mono text-[11px] text-muted">Loading…</span>
    );
  } else if (keys.length === 0) {
    dropdownContent = (
      <div className="px-2 py-2">
        <p className="font-mono text-[11px] text-muted">No keys found.</p>
        <Link
          href="/dashboard/api-keys"
          onClick={onClose}
          className="mt-1 inline-block cursor-pointer font-mono text-[11px] text-forest hover:text-forest-hover"
        >
          Create one →
        </Link>
      </div>
    );
  } else {
    dropdownContent = (
      <div className="flex flex-col">
        <span className="px-2 py-1 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
          Select a key
        </span>
        <div className="flex flex-col gap-px">
          {keys.map((key) => {
            const fullKey = lookupFullKey(key.key_hash);
            const isActive = activeKey === fullKey;
            return (
              <button
                key={key.key_hash}
                type="button"
                onClick={() => fullKey && activateStoredKey(key.key_hash)}
                disabled={!fullKey}
                className={[
                  "flex w-full items-center gap-2 rounded-[var(--radius-2)] px-2 py-1.5 text-left text-xs transition-colors",
                  fullKey ? "text-quill hover:bg-surface-deep cursor-pointer" : "text-muted cursor-not-allowed",
                  isActive && fullKey ? "bg-surface-deep text-ink" : "",
                ].join(" ")}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${isActive && fullKey ? "bg-forest" : "bg-transparent"}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate font-mono">
                  {keyDisplayLabel(key.key_hash)}
                </span>
                {!fullKey && (
                  <span className="shrink-0 font-mono text-[10px] text-muted italic">not stored</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label="Select API key"
      className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-[var(--radius-4)] border border-border-subtle bg-surface p-2 shadow-lg"
    >
      {dropdownContent}

      {showPaste ? (
        <div className="mt-2 border-t border-border-subtle pt-2">
          <span className="block px-2 pb-1 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
            Paste a key manually
          </span>
          <div className="flex gap-1 px-1">
            <input
              type="text"
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyPastedKey(); }}
              placeholder="zks_…"
              className="h-7 flex-1 rounded-[var(--radius-2)] border border-border-subtle bg-canvas px-2 font-mono text-[11px] text-ink placeholder:text-muted focus:border-forest focus:outline-none"
            />
            <button
              type="button"
              onClick={applyPastedKey}
              disabled={!pasteValue.trim()}
              className="h-7 cursor-pointer rounded-[var(--radius-2)] bg-forest px-2 font-mono text-[11px] text-canvas disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPaste(false)}
            className="mt-1 block w-full cursor-pointer px-2 py-0.5 text-left font-mono text-[10px] text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPaste(true)}
          className="mt-2 block w-full cursor-pointer rounded-[var(--radius-2)] px-2 py-1 text-left font-mono text-[11px] text-muted hover:bg-surface-deep hover:text-quill"
        >
          Paste a key manually…
        </button>
      )}

      <div className="mt-1 border-t border-border-subtle pt-1 flex flex-col">
        <Link
          href="/dashboard/api-keys"
          onClick={onClose}
          className="block cursor-pointer rounded-[var(--radius-2)] px-2 py-1.5 font-mono text-[11px] text-forest hover:bg-surface-deep"
        >
          Manage keys →
        </Link>
        <button
          type="button"
          onClick={onClear}
          className="block w-full cursor-pointer rounded-[var(--radius-2)] px-2 py-1.5 text-left font-mono text-[11px] text-rust hover:bg-surface-deep"
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}

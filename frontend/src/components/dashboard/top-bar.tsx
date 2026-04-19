"use client";

import { useEffect, useState } from "react";
import { Bell, Search } from "iconoir-react";

import { cn } from "@/lib/cn";

export function TopBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full items-center justify-end gap-4 bg-canvas/95 px-4 backdrop-blur-sm transition-colors md:px-8",
        "border-b",
        scrolled ? "border-border-subtle" : "border-transparent",
      )}
    >
      <button
        type="button"
        className="hidden items-center gap-2 rounded-[var(--radius-3)] border border-border-subtle bg-surface/60 px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-border hover:text-quill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:flex"
        aria-label="Search (not implemented)"
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span>Search</span>
        <span className="ml-4 flex items-center gap-[2px] font-mono text-[10px] text-muted">
          <kbd className="rounded-[2px] border border-border-subtle bg-canvas px-1">⌘</kbd>
          <kbd className="rounded-[2px] border border-border-subtle bg-canvas px-1">K</kbd>
        </span>
      </button>

      <button
        type="button"
        aria-label="Notifications"
        className="relative inline-flex size-9 items-center justify-center rounded-full text-quill transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Bell className="size-5" aria-hidden="true" strokeWidth={1.5} />
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 size-1.5 rounded-full bg-forest"
        />
      </button>

      <div
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-full bg-surface-deep font-mono text-xs text-quill"
      >
        MR
      </div>
    </header>
  );
}

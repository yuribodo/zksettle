"use client";

import { useEffect, useState } from "react";
import { Bell, LogOut, Search } from "iconoir-react";

import { MobileNavDrawer } from "@/components/dashboard/mobile-nav-drawer";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/cn";
import { truncateWallet } from "@/lib/format";

export function TopBar() {
  const [scrolled, setScrolled] = useState(false);
  const { tenant, isAuthenticated, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      aria-label="Dashboard top bar"
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full items-center gap-4 bg-canvas/95 px-4 backdrop-blur-sm transition-colors md:px-8",
        "border-b",
        scrolled ? "border-border-subtle" : "border-transparent",
      )}
    >
      <MobileNavDrawer />
      <div className="ml-auto flex items-center gap-4">
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
          className="relative inline-flex size-10 items-center justify-center rounded-full text-quill transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <Bell className="size-5" aria-hidden="true" strokeWidth={1.5} />
          <span
            aria-hidden="true"
            className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-forest"
          />
        </button>
        {isAuthenticated ? (
          <>
            <span className="hidden text-sm text-quill sm:inline">
              {tenant?.name ?? (tenant?.wallet ? truncateWallet(tenant.wallet) : null)}
            </span>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="relative inline-flex size-10 items-center justify-center rounded-full text-quill transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <LogOut className="size-5" aria-hidden="true" strokeWidth={1.5} />
            </button>
          </>
        ) : (
          <ConnectWalletButton
            showAddress
            size="sm"
            variant="ghost"
            className="min-w-[148px] border-border-subtle bg-surface/60 px-3 text-quill hover:border-border hover:bg-surface hover:text-ink"
            addressClassName="hidden sm:inline-flex"
          />
        )}
      </div>
    </header>
  );
}

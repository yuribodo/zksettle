"use client";

import { useEffect, useState } from "react";
import { LogOut } from "iconoir-react";

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

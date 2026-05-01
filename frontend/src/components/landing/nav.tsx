"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/icons/logo";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Demo", href: "#demo" },
  { label: "SDK", href: "#developers" },
  { label: "GitHub", href: "https://github.com/zksettle" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () =>
      setScrolled(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-14 w-full",
        "border-b transition-all duration-300 ease-[var(--ease-brand)]",
        scrolled
          ? "border-border-subtle bg-canvas/80 backdrop-blur-md"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-5 md:px-8">
        <Link
          href="/"
          aria-label="ZKSettle home"
          className="inline-flex items-center rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
        >
          <Logo size={28} variant={scrolled ? "canvas-ink" : "forest-surface"} />
        </Link>
        <div className="flex items-center gap-1 md:gap-4">
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "inline-flex h-9 items-center rounded-[2px] px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
                    scrolled
                      ? "text-quill hover:text-ink"
                      : "text-white/70 hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <ConnectWalletButton
            size="sm"
            className={cn(
              scrolled
                ? "border-border-subtle bg-surface text-quill hover:border-border hover:bg-surface-deep hover:text-ink"
                : "border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/16 hover:text-white",
            )}
          />
          <Link
            href="#demo"
            className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
          >
            Try demo
          </Link>
        </div>
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/icons/logo";
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
          <Logo size={28} />
        </Link>
        <div className="flex items-center gap-1 md:gap-4">
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex h-9 items-center rounded-[2px] px-3 text-sm text-quill transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
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

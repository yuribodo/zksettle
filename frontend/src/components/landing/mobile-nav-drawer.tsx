"use client";

import Link from "next/link";
import { Menu, Xmark } from "iconoir-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Demo", href: "#act-three-engine" },
  { label: "GitHub", href: "https://github.com/yuribodo/zksettle" },
];

export function MobileNavDrawer({ scrolled }: Readonly<{ scrolled: boolean }>) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const main = document.querySelector("main");
    if (main) {
      main.setAttribute("inert", "");
      mainRef.current = main;
    }
    return () => {
      if (mainRef.current) {
        mainRef.current.removeAttribute("inert");
        mainRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === "Tab") {
        const drawer = drawerRef.current;
        if (!drawer) return;
        const focusable = drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = drawerRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    first?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="landing-mobile-nav"
        aria-label="Open navigation"
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:hidden",
          scrolled
            ? "text-quill hover:text-ink"
            : "text-white/70 hover:text-white",
        )}
      >
        <Menu className="size-5" aria-hidden="true" strokeWidth={1.5} />
      </button>

      {open ? (
        <dialog
          id="landing-mobile-nav"
          ref={drawerRef}
          open
          aria-label="Site navigation"
          className="fixed inset-0 z-[60] m-0 flex h-full w-full max-w-none max-h-none flex-col border-none bg-ink p-0 md:hidden"
        >
          <div className="flex items-center justify-end px-5 pt-4">
            <button
              type="button"
              onClick={close}
              aria-label="Close navigation"
              className="inline-flex size-9 items-center justify-center rounded-[2px] text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <Xmark className="size-5" aria-hidden="true" strokeWidth={1.5} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col items-center justify-center gap-8">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="font-display text-2xl text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              onClick={close}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "mt-4",
              )}
            >
              Dashboard →
            </Link>
          </nav>
        </dialog>
      ) : null}
    </>
  );
}

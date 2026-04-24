"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Xmark } from "iconoir-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Logo } from "@/components/icons/logo";
import { NAV_GROUPS, NAV_ITEMS } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/cn";

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = drawerRef.current?.querySelector<HTMLAnchorElement>("a");
    first?.focus();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label="Open navigation"
        className="inline-flex size-10 items-center justify-center rounded-[2px] text-quill transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:hidden"
      >
        <Menu className="size-5" aria-hidden="true" strokeWidth={1.5} />
      </button>

      {open ? (
        <div
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard navigation"
          className="fixed inset-0 z-50 md:hidden"
        >
          <button
            type="button"
            aria-label="Close navigation"
            onClick={close}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
          />
          <div
            ref={drawerRef}
            className="relative flex h-full w-[280px] flex-col border-r border-border-subtle bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <Logo size={22} variant="surface-forest" />
              <button
                type="button"
                onClick={close}
                aria-label="Close navigation"
                className="inline-flex size-9 items-center justify-center rounded-[2px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <Xmark className="size-4" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 pb-6">
              {NAV_GROUPS.map((group) => (
                <div key={group.id} className="mt-4 first:mt-0">
                  <div className="px-3 pt-1 pb-2">
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                      {group.label}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-[2px]">
                    {NAV_ITEMS.filter((item) => item.group === group.id).map((item) => {
                      const isActive =
                        item.href === "/dashboard"
                          ? pathname === item.href
                          : pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={close}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "relative flex min-h-11 items-center gap-3 rounded-[var(--radius-3)] px-3 py-2 text-sm transition-colors",
                              "text-quill hover:text-ink",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
                              isActive && "bg-surface-deep text-ink",
                            )}
                          >
                            {isActive ? (
                              <span
                                aria-hidden="true"
                                className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-forest"
                              />
                            ) : null}
                            <Icon
                              className={cn(
                                "size-5 shrink-0",
                                isActive ? "text-forest" : "text-stone",
                              )}
                              aria-hidden="true"
                              strokeWidth={1.5}
                            />
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}

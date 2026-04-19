"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavArrowDown } from "iconoir-react";

import { Logo } from "@/components/icons/logo";
import { NAV_GROUPS, NAV_ITEMS } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Dashboard navigation"
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border-subtle bg-surface md:flex"
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link
          href="/dashboard"
          aria-label="ZKSettle dashboard home"
          className="inline-flex items-center rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
        >
          <Logo size={22} variant="surface-forest" />
        </Link>
      </div>

      <button
        type="button"
        className="mx-3 mb-3 flex items-center justify-between rounded-[var(--radius-3)] border border-border-subtle bg-canvas px-3 py-2 text-left text-sm text-quill transition-colors hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <span className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            Workspace
          </span>
          <span className="text-sm text-ink">Acme Stablecoin</span>
        </span>
        <NavArrowDown className="size-4 text-muted" aria-hidden="true" />
      </button>

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
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-[var(--radius-3)] px-3 py-2 text-sm transition-colors",
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

      <div className="border-t border-border-subtle px-4 py-4">
        <div className="flex items-center justify-between text-[11px]">
          <button
            type="button"
            className="flex items-center gap-1 rounded-[2px] font-mono text-muted uppercase tracking-[0.08em] transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <span className="size-1.5 rounded-full bg-emerald" aria-hidden="true" />
            Devnet
            <NavArrowDown className="size-3" aria-hidden="true" />
          </button>
          <span className="font-mono text-muted">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}

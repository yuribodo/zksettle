import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-6)] border border-border-subtle bg-surface px-5 py-5",
        className,
      )}
    >
      <div className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted uppercase">
        {label}
      </div>
      <div className="font-display text-[clamp(28px,3vw,44px)] leading-[1.05] tracking-[-0.02em] text-ink">
        {value}
      </div>
      {sub ? <div className="font-mono text-[13px] text-stone">{sub}</div> : null}
    </article>
  );
}

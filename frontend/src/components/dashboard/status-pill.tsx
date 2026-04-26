import { Check, InfoCircle, Sparks, WarningTriangle, Xmark } from "iconoir-react";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/cn";

export type StatusKind = "verified" | "blocked" | "warning" | "info" | "test";

type StatusVariant = {
  bg: string;
  text: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
};

const VARIANTS: Record<StatusKind, StatusVariant> = {
  verified: { bg: "bg-mint", text: "text-forest", Icon: Check, label: "Verified" },
  blocked: { bg: "bg-danger-bg", text: "text-danger-text", Icon: Xmark, label: "Blocked" },
  warning: {
    bg: "bg-warning-bg",
    text: "text-warning-text",
    Icon: WarningTriangle,
    label: "Stale",
  },
  info: { bg: "bg-info-bg", text: "text-info-text", Icon: InfoCircle, label: "Info" },
  test: { bg: "bg-surface-deep", text: "text-muted", Icon: Sparks, label: "Test mode" },
};

export interface StatusPillProps {
  kind: StatusKind;
  label?: string;
  className?: string;
}

export function StatusPill({ kind, label, className }: StatusPillProps) {
  const variant = VARIANTS[kind];
  const Icon = variant.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-2)] px-2 py-[3px] text-[11px] font-medium tracking-[0.02em] uppercase",
        variant.bg,
        variant.text,
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={1.75} aria-hidden="true" />
      <span>{label ?? variant.label}</span>
    </span>
  );
}

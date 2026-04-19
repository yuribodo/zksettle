import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius-2)] border px-2 py-0.5 font-mono text-xs leading-none uppercase tracking-[0.08em] whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border-subtle bg-surface text-quill",
        success: "border-emerald/40 bg-mint text-emerald",
        warning: "border-warning-text/30 bg-warning-bg text-warning-text",
        danger: "border-danger-text/30 bg-danger-bg text-danger-text",
        info: "border-info-text/30 bg-info-bg text-info-text",
        forest: "border-forest bg-forest text-canvas",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        badgeVariants({ variant }),
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";

export { badgeVariants };

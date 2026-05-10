import type { FC, SVGProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: FC<SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: Readonly<EmptyStateProps>) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-10 text-ghost" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && (
          <p className="max-w-xs text-[13px] text-stone">{description}</p>
        )}
      </div>
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}

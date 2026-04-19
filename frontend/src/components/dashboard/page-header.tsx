import type { ReactNode } from "react";

import { DisplayHeading } from "@/components/ui/display-heading";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-6 pb-6 md:flex-row md:items-start md:justify-between", className)}>
      <div className="max-w-2xl">
        <DisplayHeading level="m" as="h1">
          {title}
        </DisplayHeading>
        <p className="mt-2 text-sm text-stone">{subtitle}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

import { type HTMLAttributes, type ReactNode } from "react";

import { DisplayHeading } from "@/components/ui/display-heading";
import { cn } from "@/lib/cn";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  bleed?: boolean;
}

export function Section({ className, children, bleed = false, ...props }: SectionProps) {
  return (
    <section
      className={cn("py-24 md:py-40", className)}
      {...props}
    >
      {bleed ? children : <div className="mx-auto w-full max-w-6xl px-5 md:px-8">{children}</div>}
    </section>
  );
}

export interface SectionHeaderProps {
  eyebrow: string;
  headline: ReactNode;
  level?: "xl" | "l" | "m";
  tone?: "ink" | "surface";
  className?: string;
  children?: ReactNode;
}

export function SectionHeader({
  eyebrow,
  headline,
  level = "l",
  tone = "ink",
  className,
  children,
}: SectionHeaderProps) {
  const eyebrowColor = tone === "surface" ? "text-surface/80" : "text-forest";
  const ruleColor = tone === "surface" ? "bg-surface/80" : "bg-forest";
  const headingColor = tone === "surface" ? "text-surface" : "text-ink";

  return (
    <header className={cn("flex flex-col gap-6", className)}>
      <p
        className={cn(
          "font-mono text-xs leading-none uppercase tracking-[0.08em]",
          eyebrowColor,
        )}
      >
        {eyebrow}
      </p>
      <span aria-hidden="true" className={cn("inline-block h-px w-5", ruleColor)} />
      <DisplayHeading level={level} className={cn(headingColor)}>
        {headline}
      </DisplayHeading>
      {children}
    </header>
  );
}

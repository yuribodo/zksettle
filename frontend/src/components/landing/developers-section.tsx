import Link from "next/link";

import { SectionHeader, Section } from "@/components/landing/section";
import { buttonVariants } from "@/components/ui/button";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";

export function DevelopersSection() {
  const { eyebrow, headline, code, install, version, githubLabel, license, tabs } =
    COPY.developers;

  return (
    <Section id="developers" aria-labelledby="developers-heading">
      <SectionHeader
        eyebrow={eyebrow}
        headline={<span id="developers-heading">{headline}</span>}
        level="l"
      />
      <div className="mt-16 grid gap-8 md:mt-20 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12">
        <div className="flex flex-col gap-4">
          <div
            role="tablist"
            aria-label="SDK languages"
            className="flex gap-1 border-b border-border-subtle"
          >
            {tabs.map((tab, i) => (
              <span
                key={tab}
                role="tab"
                aria-selected={i === 0}
                className={cn(
                  "px-3 py-2 font-mono text-xs uppercase tracking-[0.08em]",
                  i === 0
                    ? "border-b-2 border-forest text-ink"
                    : "text-muted",
                )}
              >
                {tab}
              </span>
            ))}
          </div>
          <pre
            aria-label="Code sample"
            className="overflow-x-auto rounded-[var(--radius-6)] border border-border-subtle bg-surface-deep p-6 font-mono text-sm leading-relaxed text-ink"
          >
            <code>{code}</code>
          </pre>
        </div>
        <aside className="flex flex-col gap-4 rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6 md:p-7">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-forest">
              Install
            </span>
            <code className="block rounded-[var(--radius-3)] border border-border-subtle bg-canvas px-3 py-2 font-mono text-sm text-ink">
              {install}
            </code>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">
            {version}
          </p>
          <Link
            href="https://github.com/zksettle"
            className={cn(buttonVariants({ variant: "ghost", size: "md" }), "w-full")}
          >
            {githubLabel}
          </Link>
          <p className="font-mono text-xs text-muted">{license}</p>
        </aside>
      </div>
    </Section>
  );
}

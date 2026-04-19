import Link from "next/link";

import { SectionHeader, Section } from "@/components/landing/section";
import { FadeIn } from "@/components/motion/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";

const TAB_VALUES = ["typescript", "rust", "anchor"] as const;

export async function DevelopersSection() {
  const {
    eyebrow,
    headline,
    code,
    tabs,
    tabComingSoon,
    install,
    version,
    githubLabel,
    license,
  } = COPY.developers;

  return (
    <Section id="developers" aria-labelledby="developers-heading">
      <SectionHeader
        eyebrow={eyebrow}
        headline={<span id="developers-heading">{headline}</span>}
        level="l"
      />
      <div className="mt-16 grid gap-8 md:mt-20 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12">
        <FadeIn delay={0} amount={0.25} className="flex flex-col gap-4">
          <Tabs defaultValue="typescript" aria-label="SDK language">
            <TabsList aria-label="SDK languages">
              {tabs.map((tab, i) => {
                const value = TAB_VALUES[i];
                if (!value) return null;
                return (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="font-mono text-xs uppercase tracking-[0.08em]"
                  >
                    {tab}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <TabsContent value="typescript">
              <CodeBlock code={code} lang="typescript" ariaLabel="TypeScript SDK example" />
            </TabsContent>
            <TabsContent value="rust">
              <ComingSoonPanel label={tabComingSoon} />
            </TabsContent>
            <TabsContent value="anchor">
              <ComingSoonPanel label={tabComingSoon} />
            </TabsContent>
          </Tabs>
        </FadeIn>
        <FadeIn
          as="article"
          delay={0.12}
          amount={0.25}
          className="flex flex-col gap-4 rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6 md:p-7"
        >
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-forest">
              Install
            </span>
            <code className="block rounded-[var(--radius-3)] border border-border-subtle bg-canvas px-3 py-2 font-mono text-sm text-ink">
              {install}
            </code>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">{version}</p>
          <Link
            href="https://github.com/zksettle"
            className={cn(buttonVariants({ variant: "ghost", size: "md" }), "w-full")}
          >
            {githubLabel}
          </Link>
          <p className="font-mono text-xs text-muted">{license}</p>
        </FadeIn>
      </div>
    </Section>
  );
}

function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div
      role="note"
      className="flex min-h-[168px] items-center justify-center rounded-[var(--radius-6)] border border-border-subtle bg-surface-deep p-6 font-mono text-sm text-muted"
    >
      {label}
    </div>
  );
}

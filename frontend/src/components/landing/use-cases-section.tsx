import { SectionHeader, Section } from "@/components/landing/section";
import { COPY } from "@/content/copy";
import { USE_CASES, type UseCase } from "@/content/use-cases";

export function UseCasesSection() {
  const { eyebrow, headline } = COPY.useCases;
  const firstRow = USE_CASES.slice(0, 3);
  const secondRow = USE_CASES.slice(3);

  return (
    <Section id="use-cases" aria-labelledby="use-cases-heading" className="bg-surface">
      <SectionHeader
        eyebrow={eyebrow}
        headline={<span id="use-cases-heading">{headline}</span>}
        level="l"
      />
      <div className="mt-16 flex flex-col gap-6 md:mt-20">
        <div className="grid gap-6 md:grid-cols-3">
          {firstRow.map((item) => (
            <UseCaseCard key={item.name} item={item} />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {secondRow.map((item) => (
            <UseCaseCard key={item.name} item={item} />
          ))}
          <div aria-hidden className="hidden md:block" />
        </div>
      </div>
    </Section>
  );
}

function UseCaseCard({ item }: { item: UseCase }) {
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-6)] border border-border-subtle bg-canvas p-6 md:p-7">
      <h3 className="font-display text-2xl text-ink">{item.name}</h3>
      <p className="max-w-[32ch] text-base leading-relaxed text-quill">{item.tagline}</p>
      {item.footnote ? (
        <p className="mt-auto font-mono text-xs uppercase tracking-[0.08em] text-muted">
          {item.footnote}
        </p>
      ) : null}
    </article>
  );
}

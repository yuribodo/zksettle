import { SectionHeader, Section } from "@/components/landing/section";
import { COPY } from "@/content/copy";

export function MomentumSection() {
  const { eyebrow, headline, columns, footnote } = COPY.momentum;

  return (
    <Section id="momentum" aria-labelledby="momentum-heading">
      <SectionHeader
        eyebrow={eyebrow}
        headline={<span id="momentum-heading">{headline}</span>}
        level="l"
      />
      <div className="mt-16 md:mt-20">
        <div className="grid gap-0 md:grid-cols-3 md:divide-x md:divide-border-subtle">
          {columns.map((col, i) => (
            <article
              key={col.title}
              className={
                "flex flex-col gap-4 border-t border-border-subtle py-8 md:border-t-0 md:py-0 " +
                (i === 0 ? "md:pr-10" : i === columns.length - 1 ? "md:pl-10" : "md:px-10")
              }
            >
              <h3 className="font-display text-2xl text-ink md:text-3xl">{col.title}</h3>
              <p className="max-w-[42ch] text-base leading-relaxed text-quill">{col.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-10 font-mono text-xs uppercase tracking-[0.08em] text-muted">
          {footnote}
        </p>
      </div>
    </Section>
  );
}

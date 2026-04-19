import { SectionHeader, Section } from "@/components/landing/section";
import { BenchmarkNumber } from "@/components/landing/benchmark-number";
import { DisplayHeading } from "@/components/ui/display-heading";
import { COPY } from "@/content/copy";

export function NumbersSection() {
  const { eyebrow, headline, items } = COPY.numbers;

  return (
    <Section id="numbers" aria-labelledby="numbers-heading" className="bg-surface py-24 md:py-40">
      <SectionHeader
        eyebrow={eyebrow}
        headline={<span id="numbers-heading">{headline}</span>}
        level="l"
      />
      <dl className="mt-16 grid gap-12 md:mt-20 md:grid-cols-2 md:gap-16">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-3 border-t border-border pt-6">
            <dt className="font-mono text-xs uppercase tracking-[0.08em] text-forest">
              {item.label}
            </dt>
            <dd>
              <DisplayHeading level="xl" as="p" className="text-ink">
                <BenchmarkNumber label={item.label} fallback={item.number} />
              </DisplayHeading>
              <p className="mt-3 font-mono text-sm text-stone">{item.sub}</p>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

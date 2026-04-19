import { SectionHeader, Section } from "@/components/landing/section";
import { COPY } from "@/content/copy";

export function ParadoxSection() {
  const { eyebrow, headline, body } = COPY.paradox;

  return (
    <Section id="paradox" aria-labelledby="paradox-heading">
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-20">
        <SectionHeader
          eyebrow={eyebrow}
          headline={<span id="paradox-heading">{headline}</span>}
          level="l"
        />
        <p className="max-w-[55ch] text-lg leading-relaxed text-quill md:text-xl md:leading-relaxed">
          {body}
        </p>
      </div>
    </Section>
  );
}

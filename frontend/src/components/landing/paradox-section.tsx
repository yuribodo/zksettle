import { SectionHeader, Section } from "@/components/landing/section";
import { FadeIn } from "@/components/motion/fade-in";
import { COPY } from "@/content/copy";

function splitIntoSentences(body: string): string[] {
  return body
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ParadoxSection() {
  const { eyebrow, headline, body } = COPY.paradox;
  const sentences = splitIntoSentences(body);

  return (
    <Section id="paradox" aria-labelledby="paradox-heading">
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-20">
        <div className="md:sticky md:top-24 md:self-start">
          <SectionHeader
            eyebrow={eyebrow}
            headline={<span id="paradox-heading">{headline}</span>}
            level="l"
          />
        </div>
        <div className="flex max-w-[55ch] flex-col gap-5 text-lg leading-relaxed text-quill md:text-xl md:leading-relaxed">
          {sentences.map((sentence, i) => (
            <FadeIn key={i} as="p" delay={i * 0.08} amount={0.4}>
              {sentence}
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

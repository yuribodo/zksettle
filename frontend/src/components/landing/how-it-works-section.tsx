import { SectionHeader, Section } from "@/components/landing/section";
import { StepDiagram } from "@/components/landing/step-diagram";
import { FadeIn } from "@/components/motion/fade-in";
import { COPY } from "@/content/copy";

export function HowItWorksSection() {
  const { eyebrow, headline, steps } = COPY.howItWorks;

  return (
    <Section id="how-it-works" aria-labelledby="how-it-works-heading">
      <SectionHeader
        eyebrow={eyebrow}
        headline={<span id="how-it-works-heading">{headline}</span>}
        level="l"
      />
      <ol className="mt-16 grid gap-10 md:mt-20 md:grid-cols-3 md:gap-12">
        {steps.map((step, i) => (
          <FadeIn
            key={step.index}
            as="li"
            delay={i * 0.12}
            amount={0.3}
            className="relative flex flex-col gap-4 border-t border-border-subtle pt-6"
          >
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-forest">
              {step.index}
            </span>
            <StepDiagram index={i as 0 | 1 | 2} delay={i * 0.12 + 0.2} />
            <h3 className="font-display text-2xl text-ink md:text-3xl">{step.title}</h3>
            <p className="max-w-[42ch] text-base leading-relaxed text-quill">{step.body}</p>
          </FadeIn>
        ))}
      </ol>
    </Section>
  );
}

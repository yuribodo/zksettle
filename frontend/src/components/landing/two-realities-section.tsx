import { SectionHeader, Section } from "@/components/landing/section";
import { Badge } from "@/components/ui/badge";
import { COPY, type TwoRealitiesSide } from "@/content/copy";
import { cn } from "@/lib/cn";

export function TwoRealitiesSection() {
  const { eyebrow, headline, left, right, caption } = COPY.twoRealities;

  return (
    <Section id="two-realities" aria-labelledby="two-realities-heading">
      <SectionHeader
        eyebrow={eyebrow}
        headline={<span id="two-realities-heading">{headline}</span>}
        level="l"
      />
      <div className="mt-16 grid gap-6 md:mt-20 md:grid-cols-2">
        <RealityCard side={left} variant="without" />
        <RealityCard side={right} variant="with" />
      </div>
      <p className="mt-10 max-w-[55ch] font-display text-lg italic text-quill md:text-xl">
        {caption}
      </p>
    </Section>
  );
}

function RealityCard({
  side,
  variant,
}: {
  side: TwoRealitiesSide;
  variant: "with" | "without";
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-6 rounded-[var(--radius-6)] border p-6 md:p-8",
        variant === "without"
          ? "border-border-subtle bg-surface"
          : "border-border-subtle bg-surface-deep",
      )}
    >
      <header className="flex items-center justify-between">
        <h3 className="font-display text-2xl text-ink">{side.title}</h3>
        <Badge variant={side.pill.tone === "danger" ? "danger" : "forest"}>
          {side.pill.label}
        </Badge>
      </header>
      <dl className="divide-y divide-border-subtle">
        {side.rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-4 py-3"
          >
            <dt className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
              {row.label}
            </dt>
            <dd
              className={cn(
                "font-mono text-sm",
                variant === "without" ? "text-ink" : "text-stone",
              )}
            >
              {variant === "without" ? row.value : row.redacted}
            </dd>
          </div>
        ))}
      </dl>
      {side.proof ? (
        <p className="font-mono text-sm text-forest">{side.proof}</p>
      ) : null}
    </article>
  );
}

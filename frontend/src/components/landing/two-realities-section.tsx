"use client";

import { Check, WarningTriangle } from "iconoir-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Section, SectionHeader } from "@/components/landing/section";
import { PinnedSection } from "@/components/motion/pinned-section";
import { badgeVariants } from "@/components/ui/badge";
import { COPY, type TwoRealitiesRow } from "@/content/copy";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";
import { brandMatchMedia, gsap, ScrollTrigger } from "@/lib/gsap";

const BLOCK = "\u2593";

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function rowProgress(progress: number, index: number, total: number): number {
  const span = 0.4;
  const stride = total > 1 ? (1 - span) / (total - 1) : 0;
  const start = index * stride;
  return clamp01((progress - start) / span);
}

function dissolve(value: string, p: number): string {
  if (p <= 0) return value;
  const chars = Array.from(value);
  if (p >= 1) return BLOCK.repeat(chars.length);
  const cutoff = Math.ceil(chars.length * p);
  return chars.map((c, i) => (i < cutoff ? BLOCK : c)).join("");
}

export function TwoRealitiesSection() {
  const { eyebrow, headline, left, right, caption } = COPY.twoRealities;
  const reducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveProgress = reducedMotion ? 1 : progress;

  const handleProgress = useCallback((p: number) => {
    setProgress(p);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const mm = brandMatchMedia((conditions) => {
      if (!conditions.isMobile) return;

      const cards = Array.from(
        node.querySelectorAll<HTMLElement>("[data-reality-card]"),
      );
      const triggers: ScrollTrigger[] = [];

      cards.forEach((card, i) => {
        gsap.set(card, { opacity: 0, y: 16 });
        const tween = gsap.to(card, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay: i * 0.15,
          ease: "power2.out",
          scrollTrigger: {
            trigger: card,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        });
        const trigger = tween.scrollTrigger;
        if (trigger) triggers.push(trigger);
      });

      return () => {
        triggers.forEach((t) => t.kill());
        gsap.set(cards, { clearProps: "opacity,transform" });
      };
    });

    return () => mm.kill();
  }, []);

  return (
    <Section id="two-realities" aria-labelledby="two-realities-heading">
      <div ref={containerRef}>
        <PinnedSection pinDuration={1.5} onProgress={handleProgress}>
          <SectionHeader
            eyebrow={eyebrow}
            headline={<span id="two-realities-heading">{headline}</span>}
            level="l"
          />
          <div className="mt-16 grid gap-6 md:mt-20 md:grid-cols-2">
            <WithoutZkCard
              title={left.title}
              rows={left.rows}
              pillLabel={left.pill.label}
              progress={effectiveProgress}
            />
            <WithZkCard
              title={right.title}
              rows={right.rows}
              pillLabel={right.pill.label}
              proof={right.proof ?? ""}
            />
          </div>
          <p className="mt-10 max-w-[55ch] font-display text-lg italic text-quill md:text-xl">
            {caption}
          </p>
        </PinnedSection>
      </div>
    </Section>
  );
}

function WithoutZkCard({
  title,
  rows,
  pillLabel,
  progress,
}: {
  title: string;
  rows: readonly TwoRealitiesRow[];
  pillLabel: string;
  progress: number;
}) {
  return (
    <article
      data-reality-card
      className="flex flex-col gap-6 rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6 md:p-8"
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-display text-2xl text-ink">{title}</h3>
        <span
          className={cn(
            badgeVariants({ variant: "danger" }),
            "inline-flex items-center gap-1.5",
          )}
        >
          <WarningTriangle
            className="h-3 w-3 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          {pillLabel}
        </span>
      </header>
      <dl className="divide-y divide-border-subtle">
        {rows.map((row, i) => {
          const p = rowProgress(progress, i, rows.length);
          const displayed = dissolve(row.value, p);
          const redactedFully = p >= 1;
          return (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-4 py-3"
            >
              <dt className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
                {row.label}
              </dt>
              <dd
                aria-label={`${row.label}: ${row.value}`}
                className={cn(
                  "font-mono text-sm transition-colors",
                  redactedFully ? "text-stone" : "text-ink",
                )}
              >
                <span aria-hidden="true">{displayed}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

function WithZkCard({
  title,
  rows,
  pillLabel,
  proof,
}: {
  title: string;
  rows: readonly TwoRealitiesRow[];
  pillLabel: string;
  proof: string;
}) {
  return (
    <article
      data-reality-card
      className="flex flex-col gap-6 rounded-[var(--radius-6)] border border-border-subtle bg-surface-deep p-6 md:p-8"
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-display text-2xl text-ink">{title}</h3>
        <span
          className={cn(
            badgeVariants({ variant: "success" }),
            "inline-flex items-center gap-1.5",
          )}
        >
          <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          {pillLabel}
        </span>
      </header>
      <dl className="divide-y divide-border-subtle">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-4 py-3"
          >
            <dt className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
              {row.label}
            </dt>
            <dd aria-label={`${row.label}: redacted`} className="font-mono text-sm text-stone">
              <span aria-hidden="true">{row.redacted}</span>
            </dd>
          </div>
        ))}
      </dl>
      {proof ? <p className="font-mono text-sm text-forest">{proof}</p> : null}
    </article>
  );
}

"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Link from "next/link";
import { useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/display-heading";
import { COPY } from "@/content/copy";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

import { VeilCanvasLazy } from "./veil-canvas-lazy";

// Split headline on comma boundaries so each clause enters on its own line.
// e.g. "Settle in 181ms, audit for life." → ["Settle in 181ms,", "audit for life."]
function splitHeadlineLines(headline: string): string[] {
  const parts = headline.split(/(?<=,)\s*/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function Hero() {
  const { eyebrow, headline, sub, ctas } = COPY.hero;
  const lines = splitHeadlineLines(headline);

  const headlineRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useGSAP(
    () => {
      if (reduceMotion) return;
      const lineEls = headlineRef.current?.querySelectorAll<HTMLElement>("[data-line]");
      if (!lineEls || lineEls.length === 0) return;
      gsap.from(lineEls, {
        yPercent: 100,
        opacity: 0,
        duration: 1.0,
        stagger: 0.15,
        ease: "expo.out",
      });
    },
    { scope: headlineRef, dependencies: [reduceMotion] },
  );

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-canvas"
    >
      <VeilCanvasLazy className="pointer-events-none absolute inset-0 -z-10" />
      <div className="relative mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-6xl flex-col justify-center gap-10 px-5 py-24 md:px-8 md:py-40">
        <p className="font-mono text-xs leading-none uppercase tracking-[0.08em] text-forest">
          {eyebrow}
        </p>
        <div ref={headlineRef}>
          <DisplayHeading id="hero-heading" level="xl" className="max-w-[18ch]">
            {lines.map((line, i) => (
              <span key={i} className="block overflow-hidden">
                <span data-line className="inline-block">
                  {line}
                </span>
              </span>
            ))}
          </DisplayHeading>
        </div>
        <p className="max-w-[55ch] text-lg leading-relaxed text-quill md:text-xl">{sub}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={ctas.primary.href}
            className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
          >
            {ctas.primary.label}
          </Link>
          <Link
            href={ctas.secondary.href}
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
          >
            {ctas.secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

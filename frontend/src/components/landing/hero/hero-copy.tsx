"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Link from "next/link";
import { useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { COPY } from "@/content/copy";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

import { useHeadlineSplit } from "./use-headline-split";

export function HeroCopy() {
  const { eyebrow, headline, sub, ctas } = COPY.hero;
  const heroRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const chars = useHeadlineSplit(headline);

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;

      const eyebrowEl = root.querySelector("[data-hero-eyebrow]");
      const charEls = root.querySelectorAll("[data-hero-char]");
      const subEl = root.querySelector("[data-hero-sub]");
      const ctaEls = root.querySelectorAll("[data-hero-cta]");

      if (reduceMotion) {
        gsap.set(
          [eyebrowEl, ...Array.from(charEls), subEl, ...Array.from(ctaEls)],
          { opacity: 1, yPercent: 0, y: 0 },
        );
        return;
      }

      gsap.set(eyebrowEl, { opacity: 0, y: 8 });
      gsap.set(charEls, { yPercent: 100 });
      gsap.set(subEl, { opacity: 0, y: 8 });
      gsap.set(ctaEls, { opacity: 0, y: 6 });

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.to(eyebrowEl, { opacity: 1, y: 0, duration: 0.4 }, 0)
        .to(
          charEls,
          { yPercent: 0, duration: 0.7, stagger: 0.035, ease: "expo.out" },
          0.2,
        )
        .to(subEl, { opacity: 1, y: 0, duration: 0.5 }, 0.7)
        .to(ctaEls, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, 0.85);
    },
    { scope: heroRef, dependencies: [reduceMotion, headline] },
  );

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      ref={heroRef}
      className="relative isolate"
    >
      <div className="relative mx-auto grid min-h-[calc(100vh-56px)] w-full max-w-6xl grid-cols-12 px-5 py-24 md:px-8 md:py-32">
        <div className="col-span-12 flex flex-col justify-center gap-8 md:col-span-6 md:gap-10">
          <p
            data-hero-eyebrow
            className="font-mono text-xs leading-none uppercase tracking-[0.18em] text-forest"
          >
            {eyebrow}
          </p>

          <h1
            id="hero-heading"
            className="font-display font-normal text-ink text-[clamp(48px,6vw,96px)] leading-[0.98] tracking-[-0.035em] max-w-[14ch]"
          >
            <span className="inline-block">
              {chars.map((c) => (
                <span
                  key={c.key}
                  className="inline-block overflow-hidden align-bottom"
                  style={{ verticalAlign: "bottom" }}
                >
                  <span data-hero-char className="inline-block leading-[1.0]">
                    {c.isSpace ? " " : c.char}
                  </span>
                </span>
              ))}
            </span>
          </h1>

          <p
            data-hero-sub
            className="max-w-[44ch] text-base leading-relaxed text-quill md:text-lg"
          >
            {sub}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={ctas.primary.href}
              data-hero-cta
              className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
            >
              {ctas.primary.label}
            </Link>
            <Link
              href={ctas.secondary.href}
              data-hero-cta
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
            >
              {ctas.secondary.label}
            </Link>
          </div>
        </div>

        {/* Right column intentionally empty — the persistent canvas wordmark
            lives in this region (positioned via NDC center in the canvas). */}
        <div className="hidden md:col-span-6 md:block" aria-hidden />
      </div>
    </section>
  );
}

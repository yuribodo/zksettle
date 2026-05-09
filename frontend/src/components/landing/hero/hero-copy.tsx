"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Link from "next/link";
import { useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { GlitchText } from "@/components/ui/glitch-text";
import { useCanvasStage } from "@/components/landing/canvas/use-canvas-stage";
import { COPY } from "@/content/copy";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

export function HeroCopy() {
  const { eyebrow, headline, sub, ctas } = COPY.hero;
  const heroRef = useRef<HTMLDivElement>(null);
  const { enabled: canvasEnabled, ready: stageReady } = useCanvasStage();
  const reduceMotion = useReducedMotion();
  const [cipherActive, setCipherActive] = useState(false);

  useGSAP(
    () => {
      if (!stageReady) return;

      const root = heroRef.current;
      if (!root) return;

      const eyebrowEl = root.querySelector("[data-hero-eyebrow]");
      const headlineEl = root.querySelector("[data-hero-headline]");
      const subEl = root.querySelector("[data-hero-sub]");
      const ctaEls = root.querySelectorAll("[data-hero-cta]");

      if (reduceMotion) {
        gsap.set(
          [eyebrowEl, headlineEl, subEl, ...Array.from(ctaEls)],
          { opacity: 1, y: 0 },
        );
        setCipherActive(true);
        return;
      }

      gsap.set(eyebrowEl, { opacity: 0, y: 8 });
      gsap.set(headlineEl, { opacity: 0, y: 20 });
      gsap.set(subEl, { opacity: 0, y: 8 });
      gsap.set(ctaEls, { opacity: 0, y: 6 });

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.to(eyebrowEl, { opacity: 1, y: 0, duration: 0.4 }, 0)
        .to(headlineEl, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "expo.out",
          onStart: () => setCipherActive(true),
        }, 0.15)
        .to(subEl, { opacity: 1, y: 0, duration: 0.5 }, 1.2)
        .to(ctaEls, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, 1.4);
    },
    { scope: heroRef, dependencies: [reduceMotion, headline, stageReady] },
  );

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      ref={heroRef}
      className={cn("relative isolate", canvasEnabled ? "bg-transparent" : "bg-ink")}
    >
      <div className="relative mx-auto flex min-h-[calc(100dvh-56px)] w-full max-w-7xl flex-col items-center justify-center px-5 py-24 md:px-8">
        <p
          data-hero-eyebrow
          className="mb-8 font-mono text-xs leading-none uppercase tracking-[0.18em] text-white/60 md:mb-10"
        >
          {eyebrow}
        </p>

        <div data-hero-headline className="relative w-full">
          <h1
            id="hero-heading"
            aria-label={headline}
            className="font-display font-normal text-white text-center text-[clamp(52px,9.5vw,144px)] leading-[0.93] tracking-[-0.04em]"
          >
            {reduceMotion ? (
              headline
            ) : (
              <>
                <GlitchText text="Prove without" active={cipherActive} />
                <br />
                <GlitchText text="showing." active={cipherActive} />
              </>
            )}
          </h1>
        </div>

        <p
          data-hero-sub
          className="mt-8 max-w-[52ch] text-center text-base leading-relaxed text-white/70 md:mt-10 md:text-lg"
        >
          {sub}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:mt-10">
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
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "border-white/30 text-white hover:bg-white/10 hover:text-white",
            )}
          >
            {ctas.secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

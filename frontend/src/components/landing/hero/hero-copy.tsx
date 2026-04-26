"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { COPY } from "@/content/copy";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

import { useCipherDecode } from "./use-cipher-decode";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=?/\\|<>~^";
function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!; // NOSONAR — visual animation, not security
}

function splitWords(text: string): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = [];
  let wordStart = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === " ") {
      if (i > wordStart) result.push({ start: wordStart, end: i });
      wordStart = i + 1;
    }
  }
  return result;
}

function useWordScramble(text: string) {
  const [overrides, setOverrides] = useState<Map<number, string>>(new Map());
  const rafRef = useRef(0);

  const scrambleWord = useCallback(
    (start: number, end: number) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const charDelay = 30;
      const scrambleDuration = 300;
      const t0 = performance.now();

      const tick = () => {
        const elapsed = performance.now() - t0;
        const next = new Map<number, string>();
        let running = false;

        for (let i = start; i < end; i++) {
          if (text[i] === " ") continue;
          const local = i - start;
          const charEnd = local * charDelay + scrambleDuration;

          if (elapsed < charEnd) {
            next.set(i, randomGlyph());
            running = true;
          }
        }

        setOverrides(next);

        if (running) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = 0;
        }
      };

      const initial = new Map<number, string>();
      for (let i = start; i < end; i++) {
        if (text[i] !== " ") initial.set(i, randomGlyph());
      }
      setOverrides(initial);
      rafRef.current = requestAnimationFrame(tick);
    },
    [text],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { overrides, scrambleWord };
}

export function HeroCopy() {
  const { eyebrow, headline, sub, ctas } = COPY.hero;
  const heroRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [cipherActive, setCipherActive] = useState(false);

  const lastSpaceIdx = headline.lastIndexOf(" ");
  const words = splitWords(headline);

  const cipher = useCipherDecode(headline, {
    startDelay: 500,
    charDelay: 35,
    scrambleDuration: 350,
    lastWordExtraDelay: 600,
    active: cipherActive && !reduceMotion,
  });

  const { overrides, scrambleWord } = useWordScramble(headline);

  const onWordHover = useCallback(
    (word: { start: number; end: number }) => {
      if (!cipher.done || reduceMotion) return;
      scrambleWord(word.start, word.end);
    },
    [cipher.done, reduceMotion, scrambleWord],
  );

  useGSAP(
    () => {
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
        setCipherActive(false);
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
    { scope: heroRef, dependencies: [reduceMotion, headline] },
  );

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      ref={heroRef}
      className="relative isolate"
    >
      <div className="relative mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-7xl flex-col items-center justify-center px-5 py-24 md:px-8">
        <p
          data-hero-eyebrow
          className="mb-8 font-mono text-xs leading-none uppercase tracking-[0.18em] text-white/60 md:mb-10"
        >
          {eyebrow}
        </p>

        <h1
          id="hero-heading"
          data-hero-headline
          className="font-display font-normal text-white text-center text-[clamp(52px,9.5vw,144px)] leading-[0.93] tracking-[-0.04em]"
          aria-label={headline}
        >
          {words.map((word, wi) => (
            <span
              key={wi}
              className={cn(
                "inline-flex cursor-default whitespace-nowrap",
                wi > 0 && "ml-[0.27em]",
              )}
              onMouseEnter={() => onWordHover(word)}
            >
              {cipher.display.slice(word.start, word.end).map((ch, ci) => {
                const i = word.start + ci;
                const isLastWord = i > lastSpaceIdx;
                const hoverCh = overrides.get(i);
                const isHoverScrambled = hoverCh !== undefined;
                const isDecoded = isHoverScrambled ? false : cipher.decoded[i];
                const displayCh = isHoverScrambled ? hoverCh : ch;

                return (
                  <span
                    key={i}
                    className={cn(
                      "inline-block transition-all duration-300",
                      !isDecoded && !isHoverScrambled && "font-mono text-white/40",
                      !isDecoded && isHoverScrambled && "text-white/40",
                      isDecoded && isLastWord && !cipher.done && "text-cyan-300",
                    )}
                    style={
                      !isDecoded
                        ? { filter: "blur(1.5px)" }
                        : isDecoded && isLastWord && !cipher.done
                          ? { filter: "blur(0.3px)" }
                          : undefined
                    }
                  >
                    {displayCh}
                  </span>
                );
              })}
            </span>
          ))}
        </h1>

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

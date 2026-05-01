"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCanvasStage } from "@/components/landing/canvas/use-canvas-stage";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function ActTwoParadox() {
  const sectionRef = useRef<HTMLElement>(null);
  const membraneRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const h2Ref = useRef<HTMLHeadingElement>(null);
  const h3Ref = useRef<HTMLHeadingElement>(null);
  const { scrollStateRef } = useCanvasStage();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop:
            "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          if (!ctx.conditions?.isDesktop) return;
          const section = sectionRef.current;
          if (!section) return;

          const allWords =
            section.querySelectorAll<HTMLElement>("[data-word]");
          gsap.set(allWords, { opacity: 0 });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: "+=600%",
              pin: true,
              scrub: 1.2,
              onUpdate: (self) => {
                scrollStateRef.current.actTwoProgress = self.progress;
              },
            },
          });

          /* ── Phase 1: "$9 trillion moves in the open." ── */
          /* appear 0.01→0.08, HOLD 0.08→0.20, fade 0.20→0.24 */
          const h1Words = h1Ref.current?.querySelectorAll("[data-word]");
          if (h1Words?.length) {
            tl.fromTo(
              h1Words,
              { opacity: 0, filter: "blur(10px)", y: 16 },
              {
                opacity: 1,
                filter: "blur(0px)",
                y: 0,
                stagger: 0.02,
                ease: "power2.out",
                duration: 0.06,
              },
              0.01,
            );
            tl.to(
              h1Words,
              { opacity: 0, filter: "blur(4px)", stagger: 0.01, duration: 0.04 },
              0.20,
            );
          }

          /* ── Membrane descends (0.22→0.50) ── */
          if (membraneRef.current) {
            tl.fromTo(
              membraneRef.current,
              { yPercent: -120 },
              { yPercent: 0, ease: "none", duration: 0.28 },
              0.22,
            );
          }

          /* ── Phase 2: "What if the proof was enough?" ── */
          /* appear 0.26→0.33, HOLD 0.33→0.46, fade 0.46→0.50 */
          const h2Words = h2Ref.current?.querySelectorAll("[data-word]");
          if (h2Words?.length) {
            tl.fromTo(
              h2Words,
              { opacity: 0, filter: "blur(10px)", y: 14 },
              {
                opacity: 1,
                filter: "blur(0px)",
                y: 0,
                stagger: 0.02,
                ease: "power2.out",
                duration: 0.06,
              },
              0.26,
            );
            tl.to(
              h2Words,
              { opacity: 0, filter: "blur(4px)", stagger: 0.01, duration: 0.04 },
              0.46,
            );
          }

          /* ── Phase 3: "Verified. Sealed. Settled." ── */
          /* appear 0.52→0.60, HOLD 0.60→0.74, fade 0.74→0.78 */
          const h3Words = h3Ref.current?.querySelectorAll("[data-word]");
          if (h3Words?.length) {
            tl.fromTo(
              h3Words,
              { opacity: 0, filter: "blur(14px)", y: 20, scale: 0.97 },
              {
                opacity: 1,
                filter: "blur(0px)",
                y: 0,
                scale: 1,
                stagger: 0.04,
                ease: "power2.out",
                duration: 0.06,
              },
              0.52,
            );
            tl.to(
              h3Words,
              { opacity: 0, stagger: 0.02, duration: 0.04 },
              0.74,
            );
          }

          return () => {
            scrollStateRef.current.actTwoProgress = 0;
          };
        },
      );
      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      id="act-two-membrane"
      aria-labelledby="act-two-heading"
      className="relative overflow-hidden md:h-screen"
    >
      {/* ── Desktop: pinned scroll theater ── */}
      <div className="hidden h-full items-center justify-center md:flex">
        {/* Membrane — frosted glass descending on scroll */}
        <div
          ref={membraneRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[120%]"
          style={{
            transform: "translateY(-120%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            maskImage:
              "linear-gradient(to bottom, black 85%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 85%, transparent 100%)",
            background: "rgba(250, 250, 247, 0.12)",
          }}
        />

        {/* Headlines — grid-stacked in same cell, GSAP controls visibility */}
        <div className="relative z-10 grid place-items-center [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
          <h2
            ref={h1Ref}
            className="col-start-1 row-start-1 whitespace-nowrap text-center font-display text-[clamp(2.5rem,5vw,5.5rem)] font-medium leading-[1.05] tracking-[-0.035em] text-white"
          >
            <WordSplit text="$9 trillion moves in the open." />
          </h2>

          <h2
            ref={h2Ref}
            className="col-start-1 row-start-1 max-w-[20ch] text-center font-display text-[clamp(2rem,4.5vw,4.5rem)] font-medium leading-[1.1] tracking-[0.01em] text-white/85"
          >
            <WordSplit text="What if the proof was enough?" />
          </h2>

          <h2
            ref={h3Ref}
            id="act-two-heading"
            className="col-start-1 row-start-1 whitespace-nowrap text-center font-display text-[clamp(3rem,6vw,6.5rem)] font-medium leading-[0.95] tracking-[-0.04em] text-white"
          >
            <WordSplit text="Verified. Sealed. Settled." />
          </h2>
        </div>
      </div>

      {/* ── Mobile: simple stacked layout ── */}
      <div className="flex flex-col items-center gap-10 bg-canvas px-6 py-16 text-center md:hidden">
        <h2 className="font-display text-[2rem] font-normal leading-tight tracking-tight text-ink">
          $9 trillion moves in the open.
        </h2>
        <p className="font-display text-[1.5rem] font-normal leading-snug text-stone">
          What if the proof was enough?
        </p>
        <h2
          id="act-two-heading"
          className="font-display text-[2.5rem] font-normal leading-tight tracking-tight text-forest"
        >
          Verified. Sealed. Settled.
        </h2>
      </div>
    </section>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function WordSplit({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={i} data-word className="inline-block">
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}


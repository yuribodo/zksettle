"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { useActPin } from "./use-act-pin";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const ACT_DURATION = "+=80%";

const STEP_LABELS = ["install", "prove", "wrap"] as const;

export function ActFourThreeLines() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, { duration: ACT_DURATION });

  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const headline = root.querySelector("[data-three-lines-headline]");
        const ruleTop = root.querySelector('[data-three-lines-rule="top"]');
        const steps = root.querySelectorAll("[data-three-lines-step]");
        const ruleBottom = root.querySelector('[data-three-lines-rule="bottom"]');
        const footer = root.querySelector("[data-three-lines-footer]");

        gsap.set([headline, ...Array.from(steps), footer], { opacity: 0, y: 12 });
        gsap.set([ruleTop, ruleBottom], { scaleX: 0, transformOrigin: "left center" });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top 70%",
            once: true,
          },
          defaults: { ease: "power2.out" },
        });

        tl.to(headline, { opacity: 1, y: 0, duration: 0.35 })
          .to(ruleTop, { scaleX: 1, duration: 0.28 }, "-=0.15")
          .to(steps, { opacity: 1, y: 0, duration: 0.28, stagger: 0.08 }, "-=0.1")
          .to(ruleBottom, { scaleX: 1, duration: 0.22 }, "-=0.1")
          .to(footer, { opacity: 1, y: 0, duration: 0.2 }, "-=0.05");
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );

  const { lines } = COPY.move.code;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-four-heading"
      className="relative isolate min-h-screen overflow-hidden bg-ink text-canvas"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 25% 35%, rgba(12,61,46,0.45), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 75%, rgba(12,61,46,0.25), transparent 65%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-10 px-6 py-24 md:px-8">
        <DisplayHeading
          id="act-four-heading"
          level="l"
          className="text-center text-canvas"
          data-three-lines-headline
        >
          Three lines.
        </DisplayHeading>

        <div className="w-full max-w-3xl">
          <hr className="border-0 border-t border-forest/30" data-three-lines-rule="top" />

          <ol className="my-10 flex flex-col gap-6 md:gap-7">
            {lines.map((line, i) => (
              <li
                key={line}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 md:gap-x-10"
                data-three-lines-step
              >
                <div className="flex items-baseline gap-3 font-mono text-xs uppercase tracking-[0.16em] text-canvas/55 tabular-nums">
                  <span className="text-canvas/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden className="text-canvas/30">─</span>
                  <span>{STEP_LABELS[i]}</span>
                </div>
                <code
                  className={
                    i === 0
                      ? "font-mono text-base text-canvas/55 md:text-lg"
                      : "font-mono text-base text-[#5fb88f] md:text-lg"
                  }
                >
                  {line}
                </code>
              </li>
            ))}
          </ol>

          <hr className="border-0 border-t border-forest/30" data-three-lines-rule="bottom" />

          <p
            className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[#5fb88f]"
            data-three-lines-footer
          >
            ✓ ready · 0 PII leaked
          </p>
        </div>
      </div>
    </section>
  );
}

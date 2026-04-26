"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCanvasStage } from "@/components/landing/canvas/use-canvas-stage";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function PortalBreach() {
  const sectionRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const innerRingRef = useRef<HTMLDivElement>(null);
  const floodRef = useRef<HTMLDivElement>(null);
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

          const ring = ringRef.current;
          const innerRing = innerRingRef.current;
          const flood = floodRef.current;
          if (!ring || !innerRing || !flood) return;

          gsap.set(ring, { opacity: 0, scale: 2.5 });
          gsap.set(innerRing, { opacity: 0, scale: 2.2 });
          gsap.set(flood, { opacity: 0 });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: "+=200%",
              pin: true,
              scrub: 1.2,
              onUpdate: (self) => {
                scrollStateRef.current.breachProgress = self.progress;
              },
            },
          });

          /* ── Rings converge (0→0.35) ── */

          tl.to(ring, { opacity: 0.2, duration: 0.08 }, 0.02);
          tl.to(innerRing, { opacity: 0.15, duration: 0.08 }, 0.04);

          tl.to(
            ring,
            { scale: 1.4, opacity: 0.6, duration: 0.20, ease: "power2.inOut" },
            0.10,
          );
          tl.to(
            innerRing,
            { scale: 1.1, opacity: 0.4, duration: 0.20, ease: "power2.inOut" },
            0.12,
          );

          tl.to(
            section,
            {
              x: 2,
              duration: 0.015,
              yoyo: true,
              repeat: 3,
              ease: "power1.inOut",
            },
            0.30,
          );

          /* ── Collapse + flood (0.35→0.65) ── */

          tl.to(
            ring,
            { scale: 0.6, opacity: 0.9, duration: 0.08, ease: "power3.in" },
            0.35,
          );
          tl.to(
            innerRing,
            { scale: 0.35, opacity: 0.8, duration: 0.08, ease: "power3.in" },
            0.36,
          );

          tl.to(
            flood,
            { opacity: 1, duration: 0.18, ease: "power2.inOut" },
            0.38,
          );

          tl.to(
            ring,
            { scale: 0.1, opacity: 1, duration: 0.06, ease: "power4.in" },
            0.43,
          );
          tl.to(
            innerRing,
            { scale: 0, opacity: 0, duration: 0.06, ease: "power4.in" },
            0.44,
          );

          tl.to(
            ring,
            { opacity: 0, scale: 0, duration: 0.08, ease: "power2.out" },
            0.50,
          );

          tl.to(section, { x: 0, duration: 0.02, ease: "power2.out" }, 0.48);

          return () => {
            scrollStateRef.current.breachProgress = 0;
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
      aria-label="Transition"
      className="relative overflow-hidden md:h-screen"
    >
      {/* ── Desktop: pinned scroll theater ── */}
      <div className="hidden h-full items-center justify-center md:flex">
        {/* Outer ring */}
        <div
          ref={ringRef}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-[2]"
          style={{
            width: "110vmin",
            height: "110vmin",
            borderRadius: "50%",
            transform: "translate(-50%, -50%) scale(2.5)",
            border: "2px solid rgba(250, 250, 247, 0.25)",
            boxShadow:
              "0 0 120px 40px rgba(250, 250, 247, 0.12), 0 0 40px 10px rgba(250, 250, 247, 0.08), inset 0 0 80px 20px rgba(250, 250, 247, 0.06)",
            opacity: 0,
          }}
        />

        {/* Inner ring */}
        <div
          ref={innerRingRef}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-[2]"
          style={{
            width: "70vmin",
            height: "70vmin",
            borderRadius: "50%",
            transform: "translate(-50%, -50%) scale(2.2)",
            border: "1px solid rgba(250, 250, 247, 0.15)",
            boxShadow:
              "0 0 60px 20px rgba(250, 250, 247, 0.08), inset 0 0 40px 10px rgba(250, 250, 247, 0.05)",
            opacity: 0,
          }}
        />

        {/* White flood overlay */}
        <div
          ref={floodRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[3] bg-canvas"
          style={{ opacity: 0 }}
        />
      </div>

      {/* ── Mobile: simple spacer ── */}
      <div className="h-16 bg-canvas md:hidden" />
    </section>
  );
}

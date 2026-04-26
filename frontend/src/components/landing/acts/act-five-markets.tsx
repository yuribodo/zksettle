"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { buttonVariants } from "@/components/ui/button";
import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { cn } from "@/lib/cn";

import { useActPin } from "./use-act-pin";
import { MarketCell } from "./market-cell";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const ACT_DURATION = "+=120%";

export function ActFiveMarkets() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, { duration: ACT_DURATION });

  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const eyebrow = root.querySelector("[data-markets-eyebrow]");
        const cells = root.querySelectorAll("[data-markets-cell]");
        const divider = root.querySelector("[data-markets-divider]");
        const closer = root.querySelector("[data-markets-closer]");

        gsap.set(eyebrow, { opacity: 0, y: 8 });
        gsap.set(cells, { opacity: 0, y: 12 });
        gsap.set(divider, { scaleX: 0, transformOrigin: "left center" });
        gsap.set(closer, { opacity: 0, y: 12 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top 65%",
            once: true,
          },
          defaults: { ease: "power2.out" },
        });

        tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.3 })
          .to(cells, { opacity: 1, y: 0, duration: 0.32, stagger: 0.06 }, "-=0.1")
          .to(divider, { scaleX: 1, duration: 0.3 }, "-=0.1")
          .to(closer, { opacity: 1, y: 0, duration: 0.4 }, "-=0.15");
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { markets, closer } = COPY.move;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-five-heading"
      className="relative isolate min-h-screen overflow-hidden bg-ink text-canvas"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 75% 25%, rgba(12,61,46,0.40), transparent 70%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(12,61,46,0.22), transparent 65%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-14 px-6 py-24 md:px-8">
        <p
          className="font-mono text-xs uppercase tracking-[0.18em] text-canvas/55"
          data-markets-eyebrow
        >
          One primitive. Six markets.
        </p>

        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          data-markets-grid
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {markets.map((m, i) => (
            <MarketCell
              key={m.name}
              market={m}
              index={i}
              total={markets.length}
              isDimmed={hoveredIndex !== null && hoveredIndex !== i}
              onHoverChange={(hovering) => {
                if (hovering) setHoveredIndex(i);
                else setHoveredIndex((prev) => (prev === i ? null : prev));
              }}
            />
          ))}
        </div>

        <div
          className="h-px w-full bg-forest/30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, rgba(12,61,46,0.5) 0 8px, transparent 8px 14px)",
            backgroundColor: "transparent",
          }}
          data-markets-divider
        />

        <div data-markets-closer>
          <DisplayHeading
            id="act-five-heading"
            level="m"
            className="max-w-[20ch] text-canvas"
          >
            {closer.headline}
          </DisplayHeading>
          <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-canvas/65">
            {closer.sub}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={closer.ctas.primary.href}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "shadow-[0_8px_30px_-10px_rgba(12,61,46,0.6)]",
              )}
            >
              {closer.ctas.primary.label}
            </Link>
            <Link
              href={closer.ctas.secondary.href}
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "border border-canvas/15 text-canvas hover:bg-canvas/5",
              )}
            >
              {closer.ctas.secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

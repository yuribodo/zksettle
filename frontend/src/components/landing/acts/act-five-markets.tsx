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
import { useCanvasStage } from "@/components/landing/canvas/use-canvas-stage";

import { useActPin } from "./use-act-pin";
import { MarketCell } from "./market-cell";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const ACT_DURATION = "+=120%";

export function ActFiveMarkets() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollStateRef } = useCanvasStage();

  useActPin(containerRef, {
    duration: ACT_DURATION,
    onUpdate: (progress) => {
      scrollStateRef.current.actFiveProgress = progress;
    },
  });

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

      return () => {
        scrollStateRef.current.actFiveProgress = 0;
        mm.revert();
      };
    },
    { scope: containerRef },
  );

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { markets, closer } = COPY.move;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-five-heading"
      className="relative isolate min-h-screen overflow-hidden bg-canvas text-ink"
    >
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-6 py-16 md:px-8 lg:gap-7 lg:py-12">
        <p
          className="font-mono text-xs uppercase tracking-[0.18em] text-forest"
          data-markets-eyebrow
        >
          One primitive. Six markets.
        </p>

        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3"
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
          className="h-px w-full bg-border-subtle"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, var(--color-border) 0 8px, transparent 8px 14px)",
            backgroundColor: "transparent",
          }}
          data-markets-divider
        />

        <div
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-end lg:gap-10"
          data-markets-closer
        >
          <DisplayHeading
            id="act-five-heading"
            level="m"
            className="max-w-[18ch] text-ink"
          >
            {closer.headline}
          </DisplayHeading>
          <div>
            <p className="max-w-[38ch] text-sm leading-relaxed text-quill md:text-base">
              {closer.sub}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={closer.ctas.primary.href}
                className={cn(buttonVariants({ variant: "primary", size: "md" }))}
              >
                {closer.ctas.primary.label}
              </Link>
              <Link
                href={closer.ctas.secondary.href}
                className={cn(buttonVariants({ variant: "ghost", size: "md" }))}
              >
                {closer.ctas.secondary.label}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

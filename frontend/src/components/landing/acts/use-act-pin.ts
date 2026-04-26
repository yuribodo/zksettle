"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type RefObject } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

type UseActPinOptions = {
  /** ScrollTrigger end value, e.g. "+=150%" for 1.5x viewport pin duration. */
  duration: string;
  /** Optional progress callback (0..1) called on each scrub frame. */
  onUpdate?: (progress: number) => void;
  /** Optional scrub damping (default 0.5). */
  scrub?: number | boolean;
};

export function useActPin(
  containerRef: RefObject<HTMLElement | null>,
  { duration, onUpdate, scrub = 0.5 }: UseActPinOptions,
) {
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
          const trigger = containerRef.current;
          if (!trigger) return;

          ScrollTrigger.create({
            trigger,
            start: "top top",
            end: duration,
            pin: true,
            scrub,
            onUpdate: (self) => onUpdate?.(self.progress),
          });
        },
      );
      return () => mm.revert();
    },
    { scope: containerRef },
  );
}

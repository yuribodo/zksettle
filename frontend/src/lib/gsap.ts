"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export const BRAND_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
export const BRAND_EASE_CSS = "cubic-bezier(0.32, 0.72, 0, 1)";

let registered = false;
function ensureRegistered() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power2.out" });
  registered = true;
}

if (typeof window !== "undefined") ensureRegistered();

export interface BreakpointConditions {
  isDesktop: boolean;
  isMobile: boolean;
  isReduced: boolean;
}

const BREAKPOINT_QUERIES = {
  isDesktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
  isMobile: "(max-width: 767px)",
  isReduced: "(prefers-reduced-motion: reduce)",
} as const;

export type BrandMatchMediaSetup = (
  conditions: BreakpointConditions,
  context: gsap.Context,
) => void | (() => void);

export function brandMatchMedia(setup: BrandMatchMediaSetup): gsap.MatchMedia {
  ensureRegistered();
  const mm = gsap.matchMedia();
  mm.add(BREAKPOINT_QUERIES, (context) => {
    const conditions: BreakpointConditions = {
      isDesktop: Boolean(context.conditions?.isDesktop),
      isMobile: Boolean(context.conditions?.isMobile),
      isReduced: Boolean(context.conditions?.isReduced),
    };
    return setup(conditions, context);
  });
  return mm;
}

export { gsap, ScrollTrigger };

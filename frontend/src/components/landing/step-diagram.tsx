"use client";

import { motion, type Transition } from "motion/react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { BRAND_EASE } from "@/lib/gsap";

interface StepDiagramProps {
  index: 0 | 1 | 2;
  delay?: number;
}

const VIEWPORT = { once: true, amount: 0.5 } as const;
const INITIAL = { pathLength: 0, opacity: 0 } as const;
const REVEAL = { pathLength: 1, opacity: 1 } as const;

function trans(delay: number): Transition {
  return { duration: 0.9, delay, ease: BRAND_EASE };
}

export function StepDiagram({ index, delay = 0 }: StepDiagramProps) {
  const reduced = useReducedMotion();
  const d = (extra: number) => delay + extra;

  return (
    <svg
      viewBox="0 0 98 24"
      width={98}
      height={24}
      role="img"
      aria-hidden="true"
      className="text-forest"
      shapeRendering="geometricPrecision"
      fill="none"
      stroke="currentColor"
    >
      {index === 0 ? (
        reduced ? (
          <>
            <circle cx="6" cy="12" r="4" strokeWidth={1.25} />
            <path d="M 12 12 L 44 12" strokeWidth={1.25} />
            <rect x="44" y="6" width="12" height="12" strokeWidth={1.25} />
            <path d="M 56 12 L 84 12" strokeWidth={1.25} />
            <rect x="84" y="6" width="12" height="12" strokeWidth={1.25} />
          </>
        ) : (
          <>
            <motion.circle
              cx="6"
              cy="12"
              r="4"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0))}
            />
            <motion.path
              d="M 12 12 L 44 12"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.1))}
            />
            <motion.rect
              x="44"
              y="6"
              width="12"
              height="12"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.2))}
            />
            <motion.path
              d="M 56 12 L 84 12"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.3))}
            />
            <motion.rect
              x="84"
              y="6"
              width="12"
              height="12"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.4))}
            />
          </>
        )
      ) : null}

      {index === 1 ? (
        reduced ? (
          <>
            <rect x="2" y="4" width="16" height="16" rx="1" strokeWidth={1.25} />
            <path d="M 20 12 L 72 12" strokeWidth={1.25} strokeDasharray="2 3" />
            <circle cx="82" cy="12" r="8" strokeWidth={1.25} />
            <path
              d="M 78 12 L 81 15 L 86 9"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            <motion.rect
              x="2"
              y="4"
              width="16"
              height="16"
              rx="1"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0))}
            />
            <motion.path
              d="M 20 12 L 72 12"
              strokeWidth={1.25}
              strokeDasharray="2 3"
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.15))}
            />
            <motion.circle
              cx="82"
              cy="12"
              r="8"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.3))}
            />
            <motion.path
              d="M 78 12 L 81 15 L 86 9"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.45))}
            />
          </>
        )
      ) : null}

      {index === 2 ? (
        reduced ? (
          <>
            <circle cx="8" cy="12" r="6" strokeWidth={1.25} />
            <path d="M 16 12 L 72 12" strokeWidth={1.25} />
            <path
              d="M 68 8 L 72 12 L 68 16"
              strokeWidth={1.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="76" y="4" width="16" height="16" strokeWidth={1.25} />
            <path d="M 80 10 L 88 10 M 80 14 L 88 14" strokeWidth={1} />
          </>
        ) : (
          <>
            <motion.circle
              cx="8"
              cy="12"
              r="6"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0))}
            />
            <motion.path
              d="M 16 12 L 72 12"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.1))}
            />
            <motion.path
              d="M 68 8 L 72 12 L 68 16"
              strokeWidth={1.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.2))}
            />
            <motion.rect
              x="76"
              y="4"
              width="16"
              height="16"
              strokeWidth={1.25}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.3))}
            />
            <motion.path
              d="M 80 10 L 88 10 M 80 14 L 88 14"
              strokeWidth={1}
              initial={INITIAL}
              whileInView={REVEAL}
              viewport={VIEWPORT}
              transition={trans(d(0.4))}
            />
          </>
        )
      ) : null}
    </svg>
  );
}

StepDiagram.displayName = "StepDiagram";

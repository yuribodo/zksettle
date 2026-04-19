"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { ComponentType, ReactNode } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { BRAND_EASE } from "@/lib/gsap";

type FadeInTag = "div" | "p" | "li" | "article" | "section" | "span";

export interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  amount?: number;
  as?: FadeInTag;
  className?: string;
  id?: string;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.6,
  y = 8,
  amount = 0.3,
  as = "div",
  className,
  id,
}: FadeInProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    const Static = as;
    return (
      <Static id={id} className={className}>
        {children}
      </Static>
    );
  }

  const MotionTag = motion[as] as ComponentType<HTMLMotionProps<"div">>;

  return (
    <MotionTag
      id={id}
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration, delay, ease: BRAND_EASE }}
    >
      {children}
    </MotionTag>
  );
}

FadeIn.displayName = "FadeIn";

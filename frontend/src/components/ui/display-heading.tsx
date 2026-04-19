import { cva, type VariantProps } from "class-variance-authority";
import { type ElementType, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

const displayHeadingVariants = cva("font-display font-normal text-ink", {
  variants: {
    level: {
      xl: "text-[clamp(56px,7vw,128px)] leading-[0.95] tracking-[-0.035em]",
      l: "text-[clamp(40px,5vw,72px)] leading-[1.03] tracking-[-0.035em]",
      m: "text-[clamp(32px,4vw,48px)] leading-[1.05] tracking-[-0.02em]",
    },
  },
  defaultVariants: {
    level: "xl",
  },
});

type DisplayHeadingLevel = NonNullable<VariantProps<typeof displayHeadingVariants>["level"]>;

type DisplayHeadingTag = "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";

const DEFAULT_TAG_BY_LEVEL: Record<DisplayHeadingLevel, DisplayHeadingTag> = {
  xl: "h1",
  l: "h2",
  m: "h3",
};

export interface DisplayHeadingProps extends HTMLAttributes<HTMLElement> {
  level?: DisplayHeadingLevel;
  as?: DisplayHeadingTag;
  children: ReactNode;
}

export function DisplayHeading({
  level = "xl",
  as,
  className,
  children,
  ...props
}: DisplayHeadingProps) {
  const Tag = (as ?? DEFAULT_TAG_BY_LEVEL[level]) as ElementType;
  return (
    <Tag className={cn(displayHeadingVariants({ level }), className)} {...props}>
      {children}
    </Tag>
  );
}

DisplayHeading.displayName = "DisplayHeading";

export { displayHeadingVariants };

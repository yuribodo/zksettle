import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-sans font-medium whitespace-nowrap rounded-[var(--radius-3)] transition-colors duration-150 ease-[var(--ease-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-forest text-canvas hover:bg-forest-hover focus-visible:outline-forest",
        ghost:
          "border border-ink text-ink bg-transparent hover:bg-ink hover:text-canvas focus-visible:outline-forest",
        link: "text-forest underline decoration-forest decoration-1 underline-offset-4 hover:text-forest-hover hover:decoration-forest-hover focus-visible:outline-forest rounded-[2px] px-1 py-0.5",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    compoundVariants: [
      { variant: "link", size: "sm", class: "h-auto px-1 py-0.5 text-sm" },
      { variant: "link", size: "md", class: "h-auto px-1 py-0.5 text-base" },
      { variant: "link", size: "lg", class: "h-auto px-1 py-0.5 text-lg" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };

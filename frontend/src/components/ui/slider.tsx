import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      className={cn(
        "zks-slider h-10 w-full cursor-pointer bg-transparent",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Slider.displayName = "Slider";

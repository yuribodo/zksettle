import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/display-heading";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";

export function ClosingCta() {
  const { headline, sub, ctas } = COPY.closingCta;

  return (
    <section
      id="closing-cta"
      aria-labelledby="closing-cta-heading"
      className="bg-forest text-canvas"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-24 md:px-8 md:py-40">
        <DisplayHeading
          id="closing-cta-heading"
          level="l"
          className="max-w-[22ch] text-canvas"
        >
          {headline}
        </DisplayHeading>
        <p className="max-w-[55ch] text-lg leading-relaxed text-canvas/80 md:text-xl">{sub}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={ctas.primary.href}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-[var(--radius-3)] bg-canvas px-6 font-medium text-forest transition-colors duration-150 ease-[var(--ease-brand)] hover:bg-canvas/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas h-12 text-lg",
            )}
          >
            {ctas.primary.label}
          </Link>
          <Link
            href={ctas.secondary.href}
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "border-canvas text-canvas hover:bg-canvas hover:text-forest focus-visible:outline-canvas",
            )}
          >
            {ctas.secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

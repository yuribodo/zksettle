import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/display-heading";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";

export function Hero() {
  const { eyebrow, headline, sub, ctas } = COPY.hero;

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-canvas"
    >
      <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-6xl flex-col justify-center gap-10 px-5 py-24 md:px-8 md:py-40">
        <p className="font-mono text-xs leading-none uppercase tracking-[0.08em] text-forest">
          {eyebrow}
        </p>
        <DisplayHeading id="hero-heading" level="xl" className="max-w-[18ch]">
          {headline}
        </DisplayHeading>
        <p className="max-w-[55ch] text-lg leading-relaxed text-quill md:text-xl">{sub}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={ctas.primary.href}
            className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
          >
            {ctas.primary.label}
          </Link>
          <Link
            href={ctas.secondary.href}
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
          >
            {ctas.secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

import { COPY } from "@/content/copy";

export function Footer() {
  const { wordmark, tagline, links, bottomLine } = COPY.footer;

  return (
    <footer className="border-t border-border-subtle bg-canvas">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-14 md:px-8 md:py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-6">
          <p className="font-display text-2xl text-ink md:text-3xl">{wordmark}</p>
          <p className="max-w-[42ch] text-base text-quill">{tagline}</p>
        </div>
        <ul className="flex flex-wrap gap-x-8 gap-y-3">
          {links.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="inline-flex items-center rounded-[2px] py-1 text-sm text-quill transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">{bottomLine}</p>
      </div>
    </footer>
  );
}

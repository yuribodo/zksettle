import Link from "next/link";

const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { label: "Demo", href: "#demo" },
      { label: "Docs", href: "/docs" },
      { label: "SDK", href: "#developers" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "GitHub", href: "https://github.com/zksettle" },
      { label: "Twitter", href: "https://twitter.com/zksettle" },
      { label: "Founders", href: "mailto:hello@zksettle.dev" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-border-subtle bg-canvas text-ink">
      <div className="mx-auto max-w-6xl px-5 pt-14 pb-5 md:px-8 md:pt-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-16">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-forest">
              ZKSettle
            </p>
            <p className="mt-4 max-w-[20ch] font-display text-[clamp(34px,4.6vw,64px)] leading-[0.98] tracking-[-0.035em] text-ink">
              Compliance via proofs.
            </p>
            <p className="mt-4 max-w-[42ch] text-sm leading-relaxed text-quill md:text-base">
              Stablecoin settlement rails with auditability on-chain and private
              data off-record.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-10 text-sm md:min-w-[300px]"
          >
            {FOOTER_LINKS.map((group) => (
              <div key={group.title}>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                  {group.title}
                </p>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-stone transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-border-subtle pt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Built for the Colosseum Frontier 2026 · Solana</p>
          <p>© 2026 ZKSettle</p>
        </div>

        <p
          aria-label="ZKSettle"
          className="mt-8 select-none font-display text-[clamp(66px,18.5vw,250px)] leading-[0.72] tracking-[-0.085em] text-ink"
        >
          ZKSETTLE
        </p>
      </div>
    </footer>
  );
}

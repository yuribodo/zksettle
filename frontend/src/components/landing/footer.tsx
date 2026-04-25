import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 md:flex-row md:items-center md:px-8">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            ZKSettle
          </span>
          <span className="text-sm text-stone">— compliance via proofs.</span>
        </div>
        <nav aria-label="Footer" className="flex gap-6 text-sm text-stone">
          <Link href="/docs" className="transition-colors hover:text-ink">
            Docs
          </Link>
          <Link
            href="https://github.com/zksettle"
            className="transition-colors hover:text-ink"
          >
            GitHub
          </Link>
          <Link
            href="https://twitter.com/zksettle"
            className="transition-colors hover:text-ink"
          >
            Twitter
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl px-5 font-mono text-xs uppercase tracking-[0.08em] text-stone md:px-8">
        Built for the Colosseum Frontier 2026 · Solana
      </p>
    </footer>
  );
}

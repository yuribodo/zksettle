export default function Home() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-24"
    >
      <h1 className="font-display text-5xl leading-[0.95] tracking-[-0.035em] md:text-7xl">
        Settle <em>everywhere</em>.<br />
        Prove <em>anywhere</em>.
      </h1>
      <p className="max-w-prose text-lg text-quill">
        ZKSettle gives stablecoin issuers sub-5-second proofs of compliance without ever writing
        PII to chain. Built on Solana, denominated in trust.
      </p>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
        Colosseum Frontier 2026 · Landing scaffold
      </p>
    </main>
  );
}

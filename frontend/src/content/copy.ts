export interface HeroCta {
  readonly label: string;
  readonly href: string;
}

export interface HeroCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly sub: string;
  readonly ctas: {
    readonly primary: HeroCta;
    readonly secondary: HeroCta;
  };
}

// ── Act 2 ────────────────────────────────────────────────────────────────────
export interface ParadoxActCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly closer: string;
}

// ── Act 3 ────────────────────────────────────────────────────────────────────
export interface EngineBenchmark {
  readonly value: string;
  readonly label: string;
}

export interface EngineChapter {
  readonly title: string;
  readonly kicker: string;
  readonly body: string;
  readonly benchmarks: readonly EngineBenchmark[];
}

export interface EngineCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly chapters: readonly EngineChapter[];
  readonly demoCta: string;
}

// ── Act 4 ────────────────────────────────────────────────────────────────────
export interface Market {
  readonly name: string;
  readonly descriptor: string;
}

export interface MoveCopy {
  readonly markets: readonly Market[];
  readonly closer: {
    readonly headline: string;
    readonly sub: string;
    readonly ctas: {
      readonly primary: HeroCta;
      readonly secondary: HeroCta;
    };
  };
}

export interface LandingCopy {
  readonly hero: HeroCopy;
  // ── 4-act blocks ──────────────────────────────────────────────────────────
  readonly paradoxAct: ParadoxActCopy;
  readonly engine: EngineCopy;
  readonly move: MoveCopy;
}

export const COPY: LandingCopy = {
  hero: {
    eyebrow: "COMPLIANCE FOR PROGRAMMABLE MONEY",
    headline: "Prove without showing.",
    sub: "Stablecoins moved $9.3T last year. Compliance is still spreadsheets. zksettle lets every transfer carry its own audit — cryptographic, instant, private.",
    ctas: {
      primary: { label: "See a live proof →", href: "#act-three-engine" },
      secondary: { label: "How it works", href: "#act-two-membrane" },
    },
  },

  // ── Act 2: Paradox ────────────────────────────────────────────────────────
  paradoxAct: {
    eyebrow: "$9T moved in 2025. Until now, only one option.",
    headline: "Same transaction. Two realities.",
    closer: "Compliance and privacy — one proof.",
  },

  // ── Act 3: Engine ─────────────────────────────────────────────────────────
  engine: {
    eyebrow: "How it works",
    headline: "Verify once. Prove anywhere. Settle forever.",
    chapters: [
      {
        title: "Verify once.",
        kicker: "identity intake",
        body: "KYC issuer signs once. The Merkle tree root goes on-chain. You never expose a document again.",
        benchmarks: [
          { value: "1", label: "Credential" },
          { value: "0", label: "PII exposed" },
        ],
      },
      {
        title: "Prove anywhere.",
        kicker: "local proving",
        body: "The browser generates a Groth16 proof in <5s. No server. No trust assumption.",
        benchmarks: [
          { value: "<5s", label: "Proof generation" },
          { value: "192B", label: "Proof size" },
        ],
      },
      {
        title: "Settle forever.",
        kicker: "on-chain verification",
        body: "The Transfer Hook verifies in $0.001 of compute. Audit trail lives forever.",
        benchmarks: [
          { value: "$0.001", label: "Verify cost" },
          { value: "181ms", label: "Settlement" },
        ],
      },
    ] as const,
    demoCta: "Try it →",
  },

  // ── Act 4: Move ───────────────────────────────────────────────────────────
  move: {
    markets: [
      { name: "Remittances",   descriptor: "Cross-border value, sub-second." },
      { name: "Payroll",       descriptor: "Salaries on-chain, amounts off-record." },
      { name: "DEX",           descriptor: "Private flow, public proof." },
      { name: "Bridges",       descriptor: "One identity, every chain." },
      { name: "Institutional", descriptor: "Desk-grade compliance, retail UX." },
      { name: "Settlements",   descriptor: "Batch clearing, zero PII." },
    ] as const,
    closer: {
      headline: "Compliance is no longer a six-month moat.",
      sub: "It's an SDK. Integrate in an afternoon.",
      ctas: {
        primary: { label: "View on GitHub →", href: "https://github.com/yuribodo/zksettle" },
        secondary: { label: "Contact us", href: "mailto:hello@zksettle.dev" },
      },
    },
  },
};

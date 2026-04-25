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
export interface RecapField {
  readonly key: string;
  readonly value: string;
  readonly flag: string | null;
}

export interface ParadoxActCopy {
  readonly eyebrow: string;
  readonly headline: readonly [string, string];
  readonly closer: string;
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly recap: {
    readonly leftFields: readonly RecapField[];
    readonly rightFields: readonly RecapField[];
  };
}

// ── Act 3 ────────────────────────────────────────────────────────────────────
export interface EngineChapter {
  readonly title: string;
  readonly body: string;
}

export interface EngineBenchmark {
  readonly value: string;
  readonly label: string;
}

export interface EngineCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly chapters: readonly EngineChapter[];
  readonly benchmarks: readonly EngineBenchmark[];
  readonly demoCta: string;
}

// ── Act 4 ────────────────────────────────────────────────────────────────────
export interface MoveCopy {
  readonly code: {
    readonly label: string;
    readonly lines: readonly [string, string, string];
  };
  readonly useCases: readonly string[];
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
    eyebrow: "ZKSETTLE · COMPLIANCE INFRASTRUCTURE",
    headline: "Settle in 181ms, audit for life.",
    sub: "Zero-knowledge proofs for stablecoin compliance on Solana. Travel rule, sanctions, jurisdiction — proven on-chain, never revealed.",
    ctas: {
      primary: { label: "Try the demo →", href: "#demo" },
      secondary: { label: "Read the spec", href: "https://github.com/zksettle" },
    },
  },

  // ── Act 2: Paradox ────────────────────────────────────────────────────────
  paradoxAct: {
    eyebrow: "$9T moved in 2025. Until now, only one option.",
    headline: ["Same transaction.", "Two realities."] as const,
    closer:
      "Compliance e privacidade — impossível até 2025. Agora é só uma proof.",
    leftLabel: "Without ZK",
    rightLabel: "With ZK",
    // Migrated from TwoRealitiesSection (Task 3.3). Legacy section preserved during transition.
    recap: {
      leftFields: [
        { key: "Recipient", value: "Maria Silva", flag: "GDPR" },
        { key: "Tax ID", value: "123.456.789-00", flag: "LGPD" },
        { key: "Country", value: "BR", flag: null },
        { key: "Amount", value: "$5,200 USDC", flag: null },
      ] as const,
      rightFields: [
        { key: "Recipient", value: "▓▓▓▓▓▓▓", flag: null },
        { key: "Tax ID", value: "▓▓▓▓▓▓▓", flag: null },
        { key: "Country", value: "▓▓▓▓▓▓▓", flag: null },
        { key: "Amount", value: "▓▓▓▓▓▓▓", flag: null },
      ] as const,
    },
  },

  // ── Act 3: Engine ─────────────────────────────────────────────────────────
  engine: {
    eyebrow: "How it works",
    headline: "Verify once. Prove anywhere. Settle forever.",
    chapters: [
      {
        title: "Verify once.",
        body: "KYC issuer signs once. The Merkle tree root goes on-chain. You never expose a document again.",
      },
      {
        title: "Prove anywhere.",
        body: "The browser generates a Groth16 proof in <5s. No server. No trust assumption.",
      },
      {
        title: "Settle forever.",
        body: "The Transfer Hook verifies in $0.001 of compute. Audit trail lives forever.",
      },
    ] as const,
    benchmarks: [
      { value: "181ms", label: "Settlement" },
      { value: "<5s", label: "Proof generation" },
      { value: "$0.001", label: "Verify cost" },
      { value: "0", label: "PII leaked" },
    ] as const,
    demoCta: "Try it →",
  },

  // ── Act 4: Move ───────────────────────────────────────────────────────────
  move: {
    code: {
      label: "Three lines.",
      lines: [
        "$ npm i @zksettle/sdk",
        "→ zksettle.prove(credential)",
        "→ zksettle.wrap(transferIx, proof)",
      ] as const,
    },
    useCases: [
      "Remittances",
      "Payroll",
      "DEX",
      "Bridges",
      "Institutional",
      "Settlements",
    ] as const,
    closer: {
      headline: "Compliance is no longer a six-month moat.",
      sub: "It's an SDK. Integrate in an afternoon.",
      ctas: {
        primary: { label: "Read the docs →", href: "/docs" },
        secondary: { label: "Talk to founders", href: "mailto:hello@zksettle.dev" },
      },
    },
  },
};

import { USE_CASES, type UseCase } from "@/content/use-cases";

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

export interface ParadoxCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly body: string;
}

export interface TwoRealitiesRow {
  readonly label: string;
  readonly value: string;
  readonly redacted: string;
}

export interface TwoRealitiesSide {
  readonly title: string;
  readonly rows: readonly TwoRealitiesRow[];
  readonly pill: {
    readonly label: string;
    readonly tone: "danger" | "forest";
  };
  readonly proof?: string;
}

export interface TwoRealitiesCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly left: TwoRealitiesSide;
  readonly right: TwoRealitiesSide;
  readonly caption: string;
}

export interface HowItWorksStep {
  readonly index: string;
  readonly title: string;
  readonly body: string;
}

export interface HowItWorksCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly steps: readonly HowItWorksStep[];
}

export interface NumberTuple {
  readonly label: string;
  readonly number: string;
  readonly sub: string;
}

export interface NumbersCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly items: readonly NumberTuple[];
}

export interface DemoFormField {
  readonly label: string;
  readonly placeholder?: string;
  readonly options?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly defaultValue?: number | string;
}

export interface DemoCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly initialTerminal: string;
  readonly form: {
    readonly recipient: DemoFormField;
    readonly amount: DemoFormField;
    readonly jurisdiction: DemoFormField;
    readonly generateCta: string;
    readonly submitCta: string;
    readonly expiredToggle: string;
  };
  readonly honestyFooter: string;
  readonly expiredError: string;
}

export interface UseCasesCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly items: readonly UseCase[];
}

export interface DevelopersCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly code: string;
  readonly language: "typescript";
  readonly tabs: readonly string[];
  readonly tabComingSoon: string;
  readonly install: string;
  readonly version: string;
  readonly githubLabel: string;
  readonly license: string;
}

export interface MomentumColumn {
  readonly title: string;
  readonly body: string;
}

export interface MomentumCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly columns: readonly MomentumColumn[];
  readonly footnote: string;
}

export interface ClosingCtaCopy {
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

export interface FooterCopy {
  readonly wordmark: string;
  readonly tagline: string;
  readonly links: readonly HeroCta[];
  readonly bottomLine: string;
}

export interface LandingCopy {
  readonly hero: HeroCopy;
  readonly paradox: ParadoxCopy;
  readonly twoRealities: TwoRealitiesCopy;
  readonly howItWorks: HowItWorksCopy;
  readonly numbers: NumbersCopy;
  readonly demo: DemoCopy;
  readonly useCases: UseCasesCopy;
  readonly developers: DevelopersCopy;
  readonly momentum: MomentumCopy;
  readonly closingCta: ClosingCtaCopy;
  readonly footer: FooterCopy;
  // ── New 4-act blocks (Tasks 3.x / 4.x / 5.x) ─────────────────────────────
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
  paradox: {
    eyebrow: "THE PROBLEM",
    headline: "A paradox worth nine trillion dollars.",
    body: "Stablecoins moved $9T in 2025. Every fintech that enters the market spends six months and half a million dollars rebuilding the same compliance pipeline. The reason is structural: travel rule demands disclosure on a public ledger. Privacy law forbids it. Until 2025, there was no way out.",
  },
  twoRealities: {
    eyebrow: "WITH ZK · WITHOUT ZK",
    headline: "Same transaction. Two realities.",
    left: {
      title: "Without ZK",
      rows: [
        { label: "Recipient", value: "Maria Silva", redacted: "▓▓▓▓▓▓▓" },
        { label: "Tax ID", value: "123.456.789-00", redacted: "▓▓▓▓▓▓▓" },
        { label: "Country", value: "BR", redacted: "▓▓▓▓▓▓▓" },
        { label: "Amount", value: "$5,200 USDC", redacted: "▓▓▓▓▓▓▓" },
      ],
      pill: {
        label: "VIOLATES GDPR · LGPD · MiCA",
        tone: "danger",
      },
    },
    right: {
      title: "With ZK",
      rows: [
        { label: "Recipient", value: "Maria Silva", redacted: "▓▓▓▓▓▓▓" },
        { label: "Tax ID", value: "123.456.789-00", redacted: "▓▓▓▓▓▓▓" },
        { label: "Country", value: "BR", redacted: "▓▓▓▓▓▓▓" },
        { label: "Amount", value: "$5,200 USDC", redacted: "▓▓▓▓▓▓▓" },
      ],
      proof: "Proof: 0xa3f8...c91b",
      pill: {
        label: "COMPLIANT · VERIFIED",
        tone: "forest",
      },
    },
    caption: "Both prove the user is verified. Only one can stand in court.",
  },
  howItWorks: {
    eyebrow: "HOW IT WORKS",
    headline: "Verify once. Prove anywhere.",
    steps: [
      {
        index: "01",
        title: "Verify once.",
        body: "User completes KYC with an issuer. The issuer signs a credential and adds the wallet to a private Merkle tree. Only the root is published on-chain.",
      },
      {
        index: "02",
        title: "Prove anywhere.",
        body: "When transferring, the user generates a Groth16 proof in the browser. No data leaves the device. Average proving time: under five seconds.",
      },
      {
        index: "03",
        title: "Verify on-chain.",
        body: "A Transfer Hook intercepts the SPL transfer, verifies the proof via alt_bn128 syscalls, and writes a ComplianceAttestation. Cost: under $0.001.",
      },
    ],
  },
  numbers: {
    eyebrow: "BENCHMARKS",
    headline: "Math, measured.",
    items: [
      {
        label: "Proving time",
        number: "<5s",
        sub: "In-browser proving · Groth16 BN254",
      },
      {
        label: "Verify cost",
        number: "<$0.001",
        sub: "On-chain verification · Devnet",
      },
      {
        label: "PII leaked",
        number: "0",
        sub: "PII written to the ledger",
      },
      {
        label: "Proof size",
        number: "256 bytes",
        sub: "Proof size · Constant",
      },
    ],
  },
  demo: {
    eyebrow: "TRY IT",
    headline: "Generate a compliant transfer.",
    initialTerminal: '// Click "Generate proof" to begin',
    form: {
      recipient: {
        label: "Recipient wallet",
        placeholder: "5g8H4nP3eR...",
        defaultValue: "5g8H4nP3eR...",
      },
      amount: {
        label: "Amount",
        min: 100,
        max: 10000,
        defaultValue: 1200,
      },
      jurisdiction: {
        label: "Jurisdiction",
        options: ["US", "EU", "UK", "BR"],
        defaultValue: "US",
      },
      generateCta: "Generate proof",
      submitCta: "Submit to devnet →",
      expiredToggle: "Try with expired credential",
    },
    honestyFooter:
      'Simulation. Click "View on Solscan" to verify the hash is real on-chain.',
    expiredError: "proof rejected · credential expired (block 287,901,433)",
  },
  useCases: {
    eyebrow: "USE CASES",
    headline: "One primitive. Five markets.",
    items: USE_CASES,
  },
  developers: {
    eyebrow: "SDK",
    headline: "Three lines of code.",
    code: [
      'import { zksettle } from "@zksettle/sdk";',
      "",
      "const proof = await zksettle.prove(credential);",
      "const tx    = zksettle.wrap(transferIx, proof);",
      "await connection.sendTransaction(tx);",
    ].join("\n"),
    language: "typescript",
    tabs: ["TypeScript", "Rust", "Anchor CPI"],
    tabComingSoon: "Coming soon · TypeScript first",
    install: "npm i @zksettle/sdk",
    version: "v0.1.0",
    githubLabel: "GitHub",
    license: "MIT licensed · Open source from day one",
  },
  momentum: {
    eyebrow: "WHY NOW",
    headline: "Three things converged in 2025.",
    columns: [
      {
        title: "Regulation",
        body: "GENIUS Act signed 2025. MiCA Travel Rule live Q3 2026. Federal compliance obligation, no opt-out.",
      },
      {
        title: "Stack",
        body: "Solana shipped alt_bn128 syscalls. Verification dropped from millions of CUs to under 200,000. ZK became economically viable.",
      },
      {
        title: "Volume",
        body: "$650B in stablecoins on Solana in February 2026. Growing 14% MoM. Forty-plus fintechs identified, zero with native ZK compliance.",
      },
    ],
    footnote: "Sources: Solana Foundation · Visa Onchain Analytics · ZKSettle research",
  },
  closingCta: {
    headline: "Compliance is no longer a six-month moat.",
    sub: "It's an SDK. Integrate in an afternoon. Pay per proof.",
    ctas: {
      primary: { label: "Start integrating →", href: "https://github.com/zksettle" },
      secondary: { label: "View on GitHub", href: "https://github.com/zksettle" },
    },
  },
  footer: {
    wordmark: "ZKSettle",
    tagline: "Built for Colosseum Frontier 2026.",
    links: [
      { label: "Docs", href: "#" },
      { label: "GitHub", href: "https://github.com/zksettle" },
      { label: "X", href: "https://x.com/zksettle" },
      { label: "Spec", href: "#" },
      { label: "Privacy", href: "#" },
    ],
    bottomLine: "SOL devnet · v0.1.0 · MIT",
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

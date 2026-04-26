export interface UseCase {
  readonly name: string;
  readonly tagline: string;
  readonly footnote: string;
}

export const USE_CASES: readonly UseCase[] = [
  {
    name: "Travel rule",
    tagline: "$9T stablecoin volume",
    footnote: "GENIUS Act (US, 2025) · MiCA (EU, in force)",
  },
  {
    name: "Proof of solvency",
    tagline: "Unlock undercollateralized lending in DeFi",
    footnote: "$5T addressable",
  },
  {
    name: "ZK credit score",
    tagline: "Borrow on history, not identity",
    footnote: "zero solutions live",
  },
  {
    name: "AML by behavior",
    tagline: "Prove a clean trail without doxxing the user",
    footnote: "",
  },
  {
    name: "Proof of reserves",
    tagline: "Solvency claims without revealing positions",
    footnote: "$300B",
  },
] as const;

# ZKSettle Landing + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the ZKSettle landing page and read-only dashboard for the Colosseum Frontier 2026 submission, aligned with the canonical design system in [`docs/superpowers/specs/2026-04-18-zksettle-landing-design.md`](../specs/2026-04-18-zksettle-landing-design.md).

**Architecture:** Single Next.js 15 (App Router) project at `frontend/`. Static generation for all pages. Three.js vanilla for the Veil hero shader. GSAP ScrollTrigger for pinned narrative sections. Mock-data only — no backend, no auth, no fetches. Demo proof generation is simulated with real wall-clock timer + pre-generated valid Groth16 byte sequence.

**Tech Stack:** Next.js 15 · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui (token-customized) · GSAP + ScrollTrigger · motion v11 · Three.js vanilla · Shiki · Iconoir v7 · pnpm 9.

**Working directory:** `/home/mario/zksettle/frontend` (currently empty).

**Phasing (aligned with PRD §12):**
- Phase 1 — Foundation (Week 1, T1–T6)
- Phase 2 — Landing skeleton (Week 1–2, T7–T11)
- Phase 3 — Veil + scroll-locked sections (Week 2, T12–T17)
- Phase 4 — Demo + remaining landing (Week 3, T18–T22)
- Phase 5 — Dashboard chrome + Tier A pages (Week 4, T23–T28)
- Phase 6 — Tier B scaffolds + a11y + mobile (Week 4, T29–T31)
- Phase 7 — Pitch ready (Week 5, T32–T34)

---

## File Structure

Files this plan creates, grouped by responsibility:

**Project root** — `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.ts`, `frontend/postcss.config.mjs`, `frontend/.gitignore`, `frontend/README.md`.

**App shell** — `src/app/layout.tsx` (root, font registration, metadata), `src/app/globals.css` (Tailwind v4 + design tokens + font-face).

**Landing** — `src/app/page.tsx` (composes 10 sections), `src/components/landing/{nav,paradox-section,two-realities-section,how-it-works-section,numbers-section,demo-section,proof-console,use-cases-section,developers-section,momentum-section,closing-cta}.tsx`, `src/components/landing/hero/{hero,veil-canvas,veil-shaders}.{tsx,ts}`.

**Dashboard** — `src/app/dashboard/{layout,page}.tsx` and one `page.tsx` per route under `transactions / attestations / counterparties / policies / api-keys / audit-log / team / billing /`. Components in `src/components/dashboard/{sidebar,top-bar,stat-card,status-pill,transaction-row,transactions-table,counterparties-table,audit-table,billing-cards,tier-b-scaffold}.tsx`.

**Shared UI primitives** — `src/components/ui/{button,input,select,slider,badge,tabs,code-block}.tsx` (token-driven shadcn).

**Motion primitives** — `src/components/motion/{pinned-section,fade-in,count-up}.tsx`.

**Brand icons** — `src/components/icons/{logo.tsx,commitment-glyph.tsx}` (custom SVG).

**Lib** — `src/lib/{mock-data,proof-bytes,demo-script,gsap,shiki,cn,format,prng}.ts`.

**Hooks** — `src/hooks/{use-scroll-progress,use-reduced-motion,use-mounted}.ts`.

**Content** — `src/content/{copy.ts,use-cases.ts}` (single source of truth).

**Public** — `public/fonts/` (Geist + Berkeley Mono), `public/og.png`, `public/favicon.svg`.

---

## Conventions

- All components are React Server Components unless explicitly marked `"use client"` (hero canvas, GSAP-driven sections, demo console, dashboard interactive bits).
- Imports use the `@/` alias (configured in `tsconfig.json`).
- All commits follow the Conventional Commits style and end with the `Co-Authored-By` trailer this repo already uses.
- After each task: run `pnpm typecheck && pnpm lint && pnpm build` in `frontend/`. If any fail, fix before committing.
- TDD applies for `src/lib/*.ts` utilities (vitest). For components, the verification is `pnpm typecheck && pnpm lint && pnpm dev` + a documented manual visual check.

---

# Phase 1 — Foundation

## Task 1: Initialize Next.js project

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.ts`, `frontend/.gitignore`, `frontend/.npmrc`, `frontend/README.md`
- Modify: `frontend/` (currently empty)

- [ ] **Step 1: Run create-next-app non-interactively**

```bash
cd /home/mario/zksettle/frontend
pnpm dlx create-next-app@15 . --ts --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-pnpm --turbo
```

Expected: scaffolds Next 15 in `frontend/` with TypeScript, Tailwind, App Router, `src/`, `@/` alias, Turbopack dev. (We add ESLint manually in Task 2 to use the v9 flat config.)

- [ ] **Step 2: Pin Node engines and add scripts**

Edit `frontend/package.json` to ensure these fields exist:

```json
{
  "engines": { "node": ">=20.10" },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Tighten tsconfig**

Edit `frontend/tsconfig.json` to set `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"forceConsistentCasingInFileNames": true`. Keep the `@/*` path alias.

- [ ] **Step 4: Create README**

```markdown
# ZKSettle Frontend

Marketing landing + read-only dashboard for ZKSettle (Colosseum Frontier 2026).

## Stack

Next.js 15 · React 19 · TypeScript strict · Tailwind v4 · GSAP · Three.js · Iconoir.

## Run

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

## Design system

Spec: `docs/superpowers/specs/2026-04-18-zksettle-landing-design.md`. Source of truth: <https://claude.ai/design/p/428580d1-b5d6-429a-bea0-0ba1069a5d96>.
```

- [ ] **Step 5: Verify scaffold builds**

```bash
cd /home/mario/zksettle/frontend
pnpm install
pnpm build
```

Expected: build succeeds. Default Next.js page compiles.

- [ ] **Step 6: Commit**

```bash
cd /home/mario/zksettle
git add frontend/
git commit -m "$(cat <<'EOF'
chore: Scaffold Next.js 15 frontend with TS strict + Tailwind v4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Install lint + test toolchain

**Files:**
- Create: `frontend/eslint.config.mjs`, `frontend/vitest.config.ts`, `frontend/.prettierrc`

- [ ] **Step 1: Add deps**

```bash
cd /home/mario/zksettle/frontend
pnpm add -D eslint@9 eslint-config-next@15 typescript-eslint@8 prettier prettier-plugin-tailwindcss vitest@2 @vitest/ui jsdom
```

- [ ] **Step 2: Create flat ESLint config**

Create `frontend/eslint.config.mjs`:

```js
import next from "eslint-config-next";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  ...next(),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },
];
```

- [ ] **Step 3: Create Prettier config**

Create `frontend/.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 4: Create Vitest config**

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", globals: false },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 5: Verify everything runs**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: typecheck clean, lint clean, vitest reports "no test files" — all exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "$(cat <<'EOF'
chore: Add ESLint flat config + Prettier + Vitest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Install fonts + Iconoir + motion + GSAP + Three + Shiki

**Files:**
- Create: `frontend/public/fonts/.gitkeep`
- Modify: `frontend/package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd /home/mario/zksettle/frontend
pnpm add geist iconoir-react motion three @types/three gsap shiki clsx tailwind-merge class-variance-authority
```

Notes:
- `geist` ships both Sans and Mono via `next/font`; we only use Geist Sans (Berkeley Mono is the project mono).
- `gsap@3.x` includes ScrollTrigger free since 2024.
- Berkeley Mono is commercial and not on npm. We self-host the woff2 in `public/fonts/`. Until the team uploads the file, the font-face declaration falls back to `JetBrains Mono` from a system import (registered in Step 4 below).

- [ ] **Step 2: Add JetBrains Mono fallback via next/font**

This will be wired in `src/app/layout.tsx` in Task 5. For now, just confirm install:

```bash
pnpm ls geist iconoir-react motion three gsap shiki
```

Expected: all listed at expected versions.

- [ ] **Step 3: Add font directory placeholder**

```bash
mkdir -p frontend/public/fonts
touch frontend/public/fonts/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "$(cat <<'EOF'
chore: Install fonts, Iconoir, motion, GSAP, Three.js, Shiki

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Design tokens in globals.css

**Files:**
- Modify: `frontend/src/app/globals.css` (replace scaffolded content)

- [ ] **Step 1: Replace globals.css with token system**

Overwrite `frontend/src/app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  /* Backgrounds & borders */
  --color-canvas: #FAFAF7;
  --color-surface: #F5F3EE;
  --color-surface-deep: #EFEDE8;
  --color-border-subtle: #E8E5DF;
  --color-border: #C8C4BC;

  /* Text — five greys */
  --color-ink: #1A1917;
  --color-quill: #4A4640;
  --color-stone: #6B6762;
  --color-muted: #8A8880;
  --color-ghost: #B4B0A8;

  /* Forest — the accent (≤ 8% of pixels) */
  --color-forest: #0C3D2E;
  --color-forest-hover: #0F4D38;
  --color-emerald: #1A6B4A;
  --color-mint: #E8F2EE;

  /* Semantic */
  --color-warning-bg: #FBF4E8;
  --color-warning-text: #7A5C1E;
  --color-danger-bg: #FAF0EF;
  --color-danger-text: #BC2A24;
  --color-info-bg: #EEF4FC;
  --color-info-text: #2563A8;

  /* Typography */
  --font-display: Georgia, "Times New Roman", serif;
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono), ui-monospace, "JetBrains Mono", "Berkeley Mono", monospace;

  /* Radii */
  --radius-2: 2px;
  --radius-3: 3px;
  --radius-6: 6px;
  --radius-10: 10px;

  /* Easing */
  --ease-brand: cubic-bezier(0.32, 0.72, 0, 1);
}

html, body {
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* Display em — italic forest */
em {
  font-style: italic;
  color: var(--color-forest);
  font-weight: inherit;
}

/* Selection */
::selection {
  background: var(--color-forest);
  color: var(--color-canvas);
}

/* Skip link */
.skip-to-content {
  position: absolute;
  left: -9999px;
}
.skip-to-content:focus {
  left: 1rem;
  top: 1rem;
  background: var(--color-forest);
  color: var(--color-canvas);
  padding: 0.5rem 1rem;
  z-index: 100;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify build still works**

```bash
pnpm build
```

Expected: build succeeds. Tailwind v4 reads `@theme` block.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat: Add ZKSettle design tokens to globals.css

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Root layout with fonts and metadata

**Files:**
- Modify: `frontend/src/app/layout.tsx` (replace scaffolded)

- [ ] **Step 1: Replace layout.tsx**

Overwrite `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zksettle.com"),
  title: {
    default: "ZKSettle — Compliance infrastructure for stablecoins on Solana",
    template: "%s · ZKSettle",
  },
  description:
    "Zero-knowledge proofs for stablecoin compliance on Solana. Travel rule, sanctions, jurisdiction — proven on-chain, never revealed.",
  openGraph: {
    title: "ZKSettle — Settle in 181ms, audit for life.",
    description:
      "Compliance-grade rails for stablecoin settlement, powered by zero-knowledge proofs on Solana.",
    type: "website",
    images: ["/og.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-to-content" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm typecheck && pnpm build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat: Wire root layout with fonts, metadata, and skip link

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: The Seal logo SVG component

**Files:**
- Create: `frontend/src/components/icons/logo.tsx`
- Create: `frontend/public/favicon.svg`
- Modify: `frontend/src/app/layout.tsx` (add favicon link via metadata icons)

- [ ] **Step 1: Build the Seal component**

Create `frontend/src/components/icons/logo.tsx`:

```tsx
type Variant = "canvas-ink" | "surface-forest" | "forest-surface";

const palette: Record<Variant, { bg: string; mark: string; text: string }> = {
  "canvas-ink":     { bg: "transparent", mark: "var(--color-ink)",    text: "var(--color-ink)" },
  "surface-forest": { bg: "transparent", mark: "var(--color-forest)", text: "var(--color-ink)" },
  "forest-surface": { bg: "transparent", mark: "var(--color-canvas)", text: "var(--color-canvas)" },
};

interface SealProps {
  variant?: Variant;
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

export function Logo({
  variant = "canvas-ink",
  size = 32,
  withWordmark = true,
  className,
}: SealProps) {
  const c = palette[variant];
  const wordmarkSize = size * 0.85;
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4, color: c.text }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" aria-label="ZKSettle">
        {/* Outer ring */}
        <circle cx="32" cy="32" r="28" fill="none" stroke={c.mark} strokeWidth="1.25" />
        {/* Registration ticks at 12, 3, 6, 9 */}
        <line x1="32" y1="2"  x2="32" y2="6"  stroke={c.mark} strokeWidth="1.25" />
        <line x1="62" y1="32" x2="58" y2="32" stroke={c.mark} strokeWidth="1.25" />
        <line x1="32" y1="62" x2="32" y2="58" stroke={c.mark} strokeWidth="1.25" />
        <line x1="2"  y1="32" x2="6"  y2="32" stroke={c.mark} strokeWidth="1.25" />
        {/* Serif Z (Georgia path) */}
        <text
          x="32" y="42"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontWeight="400"
          fontSize="34"
          fill={c.mark}
        >Z</text>
        {/* Settlement bar */}
        <line x1="14" y1="32" x2="50" y2="32" stroke={c.mark} strokeWidth="2.5" />
      </svg>
      {withWordmark && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: wordmarkSize,
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          ZKSettle
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Build favicon SVG (seal only)**

Create `frontend/public/favicon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="28" fill="none" stroke="#0C3D2E" stroke-width="2" />
  <line x1="32" y1="2"  x2="32" y2="6"  stroke="#0C3D2E" stroke-width="2" />
  <line x1="62" y1="32" x2="58" y2="32" stroke="#0C3D2E" stroke-width="2" />
  <line x1="32" y1="62" x2="32" y2="58" stroke="#0C3D2E" stroke-width="2" />
  <line x1="2"  y1="32" x2="6"  y2="32" stroke="#0C3D2E" stroke-width="2" />
  <text x="32" y="42" text-anchor="middle" font-family="Georgia, serif" font-weight="400" font-size="34" fill="#0C3D2E">Z</text>
  <line x1="14" y1="32" x2="50" y2="32" stroke="#0C3D2E" stroke-width="3.5" />
</svg>
```

- [ ] **Step 3: Add favicon link via metadata**

Edit `frontend/src/app/layout.tsx` — add inside the `metadata` object:

```ts
icons: { icon: "/favicon.svg" },
```

- [ ] **Step 4: Visual smoke check**

Drop a temporary preview into `src/app/page.tsx` (will be replaced in Task 7):

```tsx
import { Logo } from "@/components/icons/logo";
export default function Home() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, padding: 48 }}>
      <Logo variant="canvas-ink" size={32} />
      <Logo variant="canvas-ink" size={64} />
      <div style={{ background: "var(--color-surface)", padding: 32 }}>
        <Logo variant="surface-forest" size={48} />
      </div>
      <div style={{ background: "var(--color-forest)", padding: 32 }}>
        <Logo variant="forest-surface" size={48} />
      </div>
    </div>
  );
}
```

Run `pnpm dev` and open <http://localhost:3000>. Confirm: three variants render, registration ticks visible at 12/3/6/9, settlement bar crosses the Z, wordmark sits to the right.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "$(cat <<'EOF'
feat: Add Seal logo component and favicon

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 2 — Landing skeleton

## Task 7: Copy single source of truth

**Files:**
- Create: `frontend/src/content/copy.ts`, `frontend/src/content/use-cases.ts`

- [ ] **Step 1: Create copy.ts**

Create `frontend/src/content/copy.ts`:

```ts
export const hero = {
  eyebrow: "ZKSETTLE · COMPLIANCE INFRASTRUCTURE",
  headline: ["Settle in ", "181ms", ", audit for life."] as const,
  sub: "Zero-knowledge proofs for stablecoin compliance on Solana. Travel rule, sanctions, jurisdiction — proven on-chain, never revealed.",
  ctaPrimary: "Try the demo",
  ctaSecondary: "Read the spec",
} as const;

export const paradox = {
  eyebrow: "THE PROBLEM",
  headline: ["A paradox worth ", "nine trillion dollars", "."] as const,
  body: "Stablecoins moved $9T in 2025. Every fintech that enters the market spends six months and half a million dollars rebuilding the same compliance pipeline. The reason is structural: travel rule demands disclosure on a public ledger. Privacy law forbids it. Until 2025, there was no way out.",
} as const;

export const twoRealities = {
  eyebrow: "WITH ZK · WITHOUT ZK",
  headline: ["Same transaction. Two ", "realities", "."] as const,
  caption: "Both prove the user is verified. Only one can stand in court.",
  withoutZk: {
    title: "Without ZK",
    rows: [
      ["Recipient", "Maria Silva"],
      ["Tax ID", "123.456.789-00"],
      ["Country", "BR"],
      ["Amount", "$5,200 USDC"],
    ] as const,
    badge: "VIOLATES GDPR · LGPD · MiCA",
  },
  withZk: {
    title: "With ZK",
    rows: [
      ["Recipient", "▓▓▓▓▓▓▓▓"],
      ["Tax ID", "▓▓▓▓▓▓▓▓"],
      ["Country", "▓▓"],
      ["Amount", "▓▓▓▓▓ ▓▓▓▓"],
    ] as const,
    proof: "0xa3f8...c91b",
    badge: "COMPLIANT · VERIFIED",
  },
} as const;

export const howItWorks = {
  eyebrow: "HOW IT WORKS",
  headline: ["Verify once. Prove ", "anywhere", "."] as const,
  steps: [
    {
      number: "01",
      title: "Verify once.",
      body: "User completes KYC with an issuer. The issuer signs a credential and adds the wallet to a private Merkle tree. Only the root is published on-chain.",
    },
    {
      number: "02",
      title: "Prove anywhere.",
      body: "When transferring, the user generates a Groth16 proof in the browser. No data leaves the device. Average proving time: under five seconds.",
    },
    {
      number: "03",
      title: "Verify on-chain.",
      body: "A Transfer Hook intercepts the SPL transfer, verifies the proof via alt_bn128 syscalls, and writes a ComplianceAttestation. Cost: under $0.001.",
    },
  ] as const,
} as const;

export const numbers = {
  eyebrow: "BENCHMARKS",
  headline: ["Math, ", "measured", "."] as const,
  items: [
    { value: "<5s", label: "In-browser proving · Groth16 BN254" },
    { value: "<$0.001", label: "On-chain verification · Devnet" },
    { value: "0", label: "PII written to the ledger" },
    { value: "256 bytes", label: "Proof size · Constant" },
  ] as const,
} as const;

export const demo = {
  eyebrow: "TRY IT",
  headline: ["Generate a ", "compliant", " transfer."] as const,
  honesty:
    'Simulation. Click "View on Solscan" to verify the hash is real on-chain.',
} as const;

export const developers = {
  eyebrow: "SDK",
  headline: ["Three lines of ", "code", "."] as const,
  installCmd: "npm i @zksettle/sdk",
  version: "v0.1.0",
  license: "MIT licensed · Open source from day one",
  snippet: `import { zksettle } from "@zksettle/sdk";

const proof = await zksettle.prove(credential);
const tx    = zksettle.wrap(transferIx, proof);
await connection.sendTransaction(tx);`,
} as const;

export const momentum = {
  eyebrow: "WHY NOW",
  headline: ["Three things converged in ", "2025", "."] as const,
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
  ] as const,
  footnote: "Sources: Solana Foundation · Visa Onchain Analytics · ZKSettle research",
} as const;

export const closing = {
  headline: ["Compliance is no longer a six-month ", "moat", "."] as const,
  sub: "It's an SDK. Integrate in an afternoon. Pay per proof.",
  ctaPrimary: "Start integrating",
  ctaSecondary: "View on GitHub",
  footer: {
    line: "Built for Colosseum Frontier 2026.",
    links: ["Docs", "GitHub", "X", "Spec", "Privacy"] as const,
    bottom: "SOL devnet · v0.1.0 · MIT",
  },
} as const;
```

- [ ] **Step 2: Create use-cases.ts**

Create `frontend/src/content/use-cases.ts`:

```ts
export const useCases = {
  eyebrow: "USE CASES",
  headline: ["One primitive. Five ", "markets", "."] as const,
  cards: [
    { title: "Travel rule",        body: "$9T stablecoin volume · GENIUS Act · MiCA Q3" },
    { title: "Proof of solvency",  body: "Unlock undercollateralized lending in DeFi · $5T addressable" },
    { title: "ZK credit score",    body: "Borrow on history, not identity · zero solutions live" },
    { title: "AML by behavior",    body: "Prove a clean trail without doxxing the user" },
    { title: "Proof of reserves",  body: "Solvency claims without revealing positions · $300B" },
  ] as const,
} as const;
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/content/
git commit -m "$(cat <<'EOF'
feat: Add landing copy as single source of truth

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Utility lib — cn, format, prng

**Files:**
- Create: `frontend/src/lib/cn.ts`, `frontend/src/lib/format.ts`, `frontend/src/lib/prng.ts`
- Create: `frontend/src/lib/format.test.ts`, `frontend/src/lib/prng.test.ts`

- [ ] **Step 1: Write failing tests for format**

Create `frontend/src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { truncateWallet, fmtAmount, fmtRelativeTime } from "./format";

describe("truncateWallet", () => {
  it("keeps first 4 and last 4 chars", () => {
    expect(truncateWallet("5g8H4nP3eR2tQ7mK9vL")).toBe("5g8H...9vL");
  });
  it("returns input unchanged if shorter than 11 chars", () => {
    expect(truncateWallet("abc")).toBe("abc");
  });
});

describe("fmtAmount", () => {
  it("formats with thousand separators and currency", () => {
    expect(fmtAmount(1200, "USDC")).toBe("1,200 USDC");
    expect(fmtAmount(5200000, "USDC")).toBe("5,200,000 USDC");
  });
});

describe("fmtRelativeTime", () => {
  it("returns seconds for <60", () => {
    expect(fmtRelativeTime(20)).toBe("20s ago");
  });
  it("returns minutes for <3600", () => {
    expect(fmtRelativeTime(120)).toBe("2m ago");
  });
  it("returns hours for <86400", () => {
    expect(fmtRelativeTime(7200)).toBe("2h ago");
  });
  it("returns days otherwise", () => {
    expect(fmtRelativeTime(259200)).toBe("3d ago");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test
```

Expected: fails — `format` module not found.

- [ ] **Step 3: Implement format.ts**

Create `frontend/src/lib/format.ts`:

```ts
export function truncateWallet(addr: string): string {
  if (addr.length < 11) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-3)}`;
}

export function fmtAmount(value: number, currency: string): string {
  return `${value.toLocaleString("en-US")} ${currency}`;
}

export function fmtRelativeTime(secondsAgo: number): string {
  if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  return `${Math.floor(secondsAgo / 86400)}d ago`;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: format tests pass.

- [ ] **Step 5: Write failing tests for PRNG**

Create `frontend/src/lib/prng.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "./prng";

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toEqual(b());
  });
  it("returns floats in [0, 1)", () => {
    const r = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 6: Run to confirm failure**

```bash
pnpm test
```

Expected: prng tests fail — module not found.

- [ ] **Step 7: Implement prng.ts**

Create `frontend/src/lib/prng.ts`:

```ts
/**
 * Mulberry32 — small, fast deterministic PRNG. Used for mock-data feeds so
 * the live dashboard renders the same sequence per seed across runs.
 */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 8: Implement cn.ts (no test needed)**

Create `frontend/src/lib/cn.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 9: Verify everything**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: clean across the board.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/lib/
git commit -m "$(cat <<'EOF'
feat: Add format, prng, cn utility libs with tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Reusable UI primitives

**Files:**
- Create: `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/eyebrow.tsx`, `frontend/src/components/ui/section.tsx`

- [ ] **Step 1: Build Button primitive**

Create `frontend/src/components/ui/button.tsx`:

```tsx
import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "inverted";
type Size = "md" | "lg";

const base =
  "inline-flex items-center gap-2 font-medium transition-colors duration-200 rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-forest)]";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--color-forest)] text-[var(--color-canvas)] hover:bg-[var(--color-forest-hover)]",
  secondary:
    "border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)]",
  ghost: "text-[var(--color-forest)] underline-offset-4 hover:underline",
  inverted:
    "bg-[var(--color-canvas)] text-[var(--color-forest)] hover:bg-[var(--color-mint)]",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-[14px]",
  lg: "h-12 px-7 text-[16px]",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...rest} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={cn(base, variants[variant], sizes[size], className)} {...rest} />;
}
```

- [ ] **Step 2: Build Eyebrow primitive**

Create `frontend/src/components/ui/eyebrow.tsx`:

```tsx
import { cn } from "@/lib/cn";

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span aria-hidden className="block h-px w-5 bg-[var(--color-forest)]" />
      <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--color-forest)]">
        {children}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Build Section wrapper**

Create `frontend/src/components/ui/section.tsx`:

```tsx
import { cn } from "@/lib/cn";

export function Section({
  id,
  children,
  className,
  width = "wide",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  width?: "narrow" | "wide";
}) {
  const max = width === "narrow" ? "max-w-[720px]" : "max-w-[1200px]";
  return (
    <section
      id={id}
      className={cn(
        "mx-auto px-5 md:px-8",
        max,
        "py-24 md:py-40",
        className,
      )}
    >
      {children}
    </section>
  );
}
```

- [ ] **Step 4: Verify**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "$(cat <<'EOF'
feat: Add Button, Eyebrow, Section UI primitives

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: DisplayHeading helper

**Files:**
- Create: `frontend/src/components/ui/display-heading.tsx`

- [ ] **Step 1: Build the helper**

Display headlines in copy.ts are tuples like `["Settle in ", "181ms", ", audit for life."]` — the middle slot becomes an italic forest `<em>`. Build a renderer:

Create `frontend/src/components/ui/display-heading.tsx`:

```tsx
import { cn } from "@/lib/cn";

type HeadingTuple = readonly [string, string, string];

export function DisplayHeading({
  parts,
  size = "xl",
  as: Tag = "h1",
  className,
}: {
  parts: HeadingTuple;
  size?: "xl" | "l" | "m";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const sizeClass = {
    xl: "text-[clamp(56px,7vw,128px)] leading-[0.95] tracking-[-0.035em]",
    l: "text-[clamp(40px,5vw,72px)] leading-[1.03] tracking-[-0.035em]",
    m: "text-[clamp(28px,3.5vw,48px)] leading-[1.05] tracking-[-0.02em]",
  }[size];
  return (
    <Tag
      className={cn(
        "font-[family-name:var(--font-display)] font-normal text-[var(--color-ink)]",
        sizeClass,
        className,
      )}
    >
      {parts[0]}
      <em>{parts[1]}</em>
      {parts[2]}
    </Tag>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/display-heading.tsx
git commit -m "$(cat <<'EOF'
feat: Add DisplayHeading helper for tuple-based em rendering

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Landing nav + 10 section shells + page composition

**Files:**
- Create: `frontend/src/components/landing/nav.tsx`
- Create: `frontend/src/components/landing/hero/hero.tsx`
- Create: `frontend/src/components/landing/paradox-section.tsx`
- Create: `frontend/src/components/landing/two-realities-section.tsx`
- Create: `frontend/src/components/landing/how-it-works-section.tsx`
- Create: `frontend/src/components/landing/numbers-section.tsx`
- Create: `frontend/src/components/landing/demo-section.tsx`
- Create: `frontend/src/components/landing/use-cases-section.tsx`
- Create: `frontend/src/components/landing/developers-section.tsx`
- Create: `frontend/src/components/landing/momentum-section.tsx`
- Create: `frontend/src/components/landing/closing-cta.tsx`
- Modify: `frontend/src/app/page.tsx`

Each section is built as a static shell first; motion + WebGL is layered in Phase 3+.

- [ ] **Step 1: Build the global Nav**

Create `frontend/src/components/landing/nav.tsx`:

```tsx
import Link from "next/link";
import { Logo } from "@/components/icons/logo";
import { ButtonLink } from "@/components/ui/button";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-[var(--color-canvas)]/80 backdrop-blur border-b border-transparent transition-colors">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 md:px-8">
        <Link href="/"><Logo size={28} /></Link>
        <div className="flex items-center gap-6 text-[14px] text-[var(--color-quill)]">
          <Link href="#how" className="hidden md:inline">How it works</Link>
          <Link href="#demo" className="hidden md:inline">Demo</Link>
          <Link href="#sdk" className="hidden md:inline">SDK</Link>
          <Link href="/dashboard">Dashboard</Link>
          <ButtonLink href="#demo" variant="primary" size="md">Try the demo</ButtonLink>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Build static Hero shell (no canvas yet)**

Create `frontend/src/components/landing/hero/hero.tsx`:

```tsx
import { hero } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ButtonLink } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[80vh] max-w-[1200px] flex-col justify-center px-5 py-32 md:px-8">
      <Eyebrow>{hero.eyebrow}</Eyebrow>
      <DisplayHeading parts={hero.headline} size="xl" as="h1" className="mt-6" />
      <p className="mt-8 max-w-[640px] text-[22px] leading-[1.45] text-[var(--color-stone)]">
        {hero.sub}
      </p>
      <div className="mt-10 flex items-center gap-4">
        <ButtonLink href="#demo" variant="primary" size="lg">{hero.ctaPrimary} →</ButtonLink>
        <ButtonLink href="https://github.com/yuribodo/zksettle" variant="ghost" size="lg">
          {hero.ctaSecondary}
        </ButtonLink>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Build Paradox shell**

Create `frontend/src/components/landing/paradox-section.tsx`:

```tsx
import { paradox } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";

export function ParadoxSection() {
  return (
    <Section id="paradox" width="narrow">
      <Eyebrow>{paradox.eyebrow}</Eyebrow>
      <DisplayHeading parts={paradox.headline} size="l" as="h2" className="mt-6" />
      <p className="mt-10 text-[22px] leading-[1.45] text-[var(--color-quill)]">
        {paradox.body}
      </p>
    </Section>
  );
}
```

- [ ] **Step 4: Build Two Realities shell**

Create `frontend/src/components/landing/two-realities-section.tsx`:

```tsx
import { twoRealities } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";
import { WarningTriangle, Check } from "iconoir-react";

function Card({ side }: { side: "without" | "with" }) {
  const data = side === "without" ? twoRealities.withoutZk : twoRealities.withZk;
  const isWith = side === "with";
  return (
    <div className="flex flex-col gap-6 rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-8">
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
        {data.title}
      </div>
      <dl className="space-y-3">
        {data.rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4">
            <dt className="text-[14px] text-[var(--color-stone)]">{k}</dt>
            <dd className="font-mono text-[14px] text-[var(--color-ink)]">{v}</dd>
          </div>
        ))}
      </dl>
      {isWith && "proof" in data && (
        <div className="flex items-center gap-2 font-mono text-[14px] text-[var(--color-forest)]">
          <Check width={16} height={16} strokeWidth={1.5} />
          <span>Proof: {data.proof}</span>
        </div>
      )}
      <div
        className={
          isWith
            ? "inline-flex w-fit items-center gap-2 rounded-[2px] bg-[var(--color-mint)] px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--color-forest)]"
            : "inline-flex w-fit items-center gap-2 rounded-[2px] bg-[var(--color-danger-bg)] px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--color-danger-text)]"
        }
      >
        {isWith ? (
          <Check width={14} height={14} strokeWidth={1.5} />
        ) : (
          <WarningTriangle width={14} height={14} strokeWidth={1.5} />
        )}
        {data.badge}
      </div>
    </div>
  );
}

export function TwoRealitiesSection() {
  return (
    <Section id="two-realities">
      <Eyebrow>{twoRealities.eyebrow}</Eyebrow>
      <DisplayHeading parts={twoRealities.headline} size="l" as="h2" className="mt-6" />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Card side="without" />
        <Card side="with" />
      </div>
      <p className="mt-12 max-w-[640px] text-[18px] text-[var(--color-stone)]">
        {twoRealities.caption}
      </p>
    </Section>
  );
}
```

- [ ] **Step 5: Build How it works shell**

Create `frontend/src/components/landing/how-it-works-section.tsx`:

```tsx
import { howItWorks } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";

export function HowItWorksSection() {
  return (
    <Section id="how">
      <Eyebrow>{howItWorks.eyebrow}</Eyebrow>
      <DisplayHeading parts={howItWorks.headline} size="l" as="h2" className="mt-6" />
      <ol className="mt-16 space-y-12 border-l border-[var(--color-forest)] pl-8 max-w-[760px]">
        {howItWorks.steps.map((step) => (
          <li key={step.number}>
            <div className="flex items-baseline gap-4">
              <span className="font-mono text-[14px] text-[var(--color-forest)]">{step.number}</span>
              <h3 className="font-[family-name:var(--font-display)] text-[28px] text-[var(--color-ink)]">
                {step.title}
              </h3>
            </div>
            <p className="mt-3 text-[18px] leading-[1.5] text-[var(--color-stone)]">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
```

- [ ] **Step 6: Build Numbers shell**

Create `frontend/src/components/landing/numbers-section.tsx`:

```tsx
import { numbers } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";

export function NumbersSection() {
  return (
    <Section id="benchmarks">
      <Eyebrow>{numbers.eyebrow}</Eyebrow>
      <DisplayHeading parts={numbers.headline} size="l" as="h2" className="mt-6" />
      <dl className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2">
        {numbers.items.map((n) => (
          <div key={n.label} className="border-t border-[var(--color-border-subtle)] pt-6">
            <dt className="font-[family-name:var(--font-display)] text-[clamp(56px,8vw,96px)] leading-[0.95] tracking-[-0.035em] text-[var(--color-ink)]">
              {n.value}
            </dt>
            <dd className="mt-3 font-mono text-[14px] text-[var(--color-stone)]">{n.label}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
```

- [ ] **Step 7: Build Demo shell (form + console placeholder)**

Create `frontend/src/components/landing/demo-section.tsx`:

```tsx
import { demo } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";

export function DemoSection() {
  return (
    <Section id="demo">
      <Eyebrow>{demo.eyebrow}</Eyebrow>
      <DisplayHeading parts={demo.headline} size="l" as="h2" className="mt-6" />
      <div
        id="demo-mount"
        className="mt-12 grid gap-6 md:grid-cols-2 min-h-[480px] rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
      >
        {/* Wired in Phase 4 (Task 18+). */}
        <div className="text-[var(--color-muted)]">Demo form mounts here.</div>
        <div className="text-[var(--color-muted)]">Proof console mounts here.</div>
      </div>
      <p className="mt-6 font-mono text-[12px] text-[var(--color-muted)]">{demo.honesty}</p>
    </Section>
  );
}
```

- [ ] **Step 8: Build Use Cases shell**

Create `frontend/src/components/landing/use-cases-section.tsx`:

```tsx
import { useCases } from "@/content/use-cases";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";

export function UseCasesSection() {
  return (
    <Section id="use-cases">
      <Eyebrow>{useCases.eyebrow}</Eyebrow>
      <DisplayHeading parts={useCases.headline} size="l" as="h2" className="mt-6" />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {useCases.cards.map((c) => (
          <article
            key={c.title}
            className="group flex flex-col gap-3 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-b-[var(--color-forest)] hover:border-b-2"
          >
            <h3 className="font-[family-name:var(--font-display)] text-[24px] text-[var(--color-ink)]">
              {c.title}
            </h3>
            <p className="text-[14px] text-[var(--color-stone)]">{c.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 9: Build Developers shell**

Create `frontend/src/components/landing/developers-section.tsx`:

```tsx
import { developers } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";

export function DevelopersSection() {
  return (
    <Section id="sdk">
      <Eyebrow>{developers.eyebrow}</Eyebrow>
      <DisplayHeading parts={developers.headline} size="l" as="h2" className="mt-6" />
      <div className="mt-12 grid gap-8 md:grid-cols-[2fr,1fr]">
        <pre
          aria-label="SDK example"
          className="overflow-x-auto rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-deep)] p-6 font-mono text-[14px] text-[var(--color-ink)]"
        >
          {developers.snippet}
        </pre>
        <aside className="flex flex-col gap-4 text-[14px] text-[var(--color-stone)]">
          <code className="font-mono text-[var(--color-ink)]">{developers.installCmd}</code>
          <span className="font-mono text-[var(--color-muted)]">{developers.version}</span>
          <p>{developers.license}</p>
        </aside>
      </div>
    </Section>
  );
}
```

(Shiki syntax highlighting is added in Task 19.)

- [ ] **Step 10: Build Momentum shell**

Create `frontend/src/components/landing/momentum-section.tsx`:

```tsx
import { momentum } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";

export function MomentumSection() {
  return (
    <Section id="why-now">
      <Eyebrow>{momentum.eyebrow}</Eyebrow>
      <DisplayHeading parts={momentum.headline} size="l" as="h2" className="mt-6" />
      <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-0 md:divide-x md:divide-[var(--color-border-subtle)]">
        {momentum.columns.map((c) => (
          <div key={c.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
            <h3 className="font-[family-name:var(--font-display)] text-[24px] text-[var(--color-ink)]">
              {c.title}
            </h3>
            <p className="mt-4 text-[16px] leading-[1.55] text-[var(--color-quill)]">{c.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-12 font-mono text-[12px] text-[var(--color-muted)]">{momentum.footnote}</p>
    </Section>
  );
}
```

- [ ] **Step 11: Build Closing CTA + Footer**

Create `frontend/src/components/landing/closing-cta.tsx`:

```tsx
import { closing } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/icons/logo";

export function ClosingCTA() {
  return (
    <>
      <section className="bg-[var(--color-forest)] py-32 text-[var(--color-canvas)]">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <DisplayHeading
            parts={closing.headline}
            size="l"
            as="h2"
            className="!text-[var(--color-canvas)]"
          />
          <p className="mt-8 max-w-[640px] text-[22px] leading-[1.45] text-[var(--color-mint)]">
            {closing.sub}
          </p>
          <div className="mt-10 flex items-center gap-4">
            <ButtonLink href="https://github.com/yuribodo/zksettle" variant="inverted" size="lg">
              {closing.ctaPrimary} →
            </ButtonLink>
            <ButtonLink
              href="https://github.com/yuribodo/zksettle"
              size="lg"
              className="text-[var(--color-canvas)] underline-offset-4 hover:underline"
            >
              {closing.ctaSecondary}
            </ButtonLink>
          </div>
        </div>
      </section>
      <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-canvas)] py-16">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 md:flex-row md:items-end md:justify-between md:px-8">
          <Logo variant="canvas-ink" size={28} />
          <div className="flex flex-col gap-3 md:items-end">
            <span className="text-[14px] text-[var(--color-stone)]">{closing.footer.line}</span>
            <ul className="flex gap-6 text-[14px] text-[var(--color-quill)]">
              {closing.footer.links.map((l) => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
            <span className="font-mono text-[12px] text-[var(--color-muted)]">
              {closing.footer.bottom}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
```

- [ ] **Step 12: Compose page.tsx**

Replace `frontend/src/app/page.tsx`:

```tsx
import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero/hero";
import { ParadoxSection } from "@/components/landing/paradox-section";
import { TwoRealitiesSection } from "@/components/landing/two-realities-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { NumbersSection } from "@/components/landing/numbers-section";
import { DemoSection } from "@/components/landing/demo-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { DevelopersSection } from "@/components/landing/developers-section";
import { MomentumSection } from "@/components/landing/momentum-section";
import { ClosingCTA } from "@/components/landing/closing-cta";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <ParadoxSection />
        <TwoRealitiesSection />
        <HowItWorksSection />
        <NumbersSection />
        <DemoSection />
        <UseCasesSection />
        <DevelopersSection />
        <MomentumSection />
        <ClosingCTA />
      </main>
    </>
  );
}
```

- [ ] **Step 13: Visual verification in dev**

```bash
pnpm dev
```

Open <http://localhost:3000>. Confirm: nav sticky, hero with display heading + forest CTA, all 10 sections render in order, closing CTA forest panel + footer. Italic forest "em" appears in every display headline. No console errors. No layout overflow.

- [ ] **Step 14: Verify static checks**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Expected: clean.

- [ ] **Step 15: Commit**

```bash
git add frontend/src/components/landing/ frontend/src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat: Build landing nav and 10 static section shells

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 3 — Veil hero + scroll-locked sections

## Task 12: Reduced-motion + scroll progress hooks

**Files:**
- Create: `frontend/src/hooks/use-reduced-motion.ts`, `frontend/src/hooks/use-scroll-progress.ts`, `frontend/src/hooks/use-mounted.ts`

- [ ] **Step 1: Build use-mounted**

Create `frontend/src/hooks/use-mounted.ts`:

```ts
"use client";
import { useEffect, useState } from "react";

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
```

- [ ] **Step 2: Build use-reduced-motion**

Create `frontend/src/hooks/use-reduced-motion.ts`:

```ts
"use client";
import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
```

- [ ] **Step 3: Build use-scroll-progress**

Create `frontend/src/hooks/use-scroll-progress.ts`:

```ts
"use client";
import { useEffect, useState, type RefObject } from "react";

/**
 * Returns a 0..1 scroll progress for a target element entering and leaving the viewport.
 * 0 = top of element at bottom of viewport · 1 = bottom of element at top of viewport.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height + vh;
      const seen = vh - r.top;
      const p = Math.min(1, Math.max(0, seen / total));
      setProgress(p);
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
  return progress;
}
```

- [ ] **Step 4: Verify**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/
git commit -m "$(cat <<'EOF'
feat: Add use-mounted, use-reduced-motion, use-scroll-progress hooks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Veil canvas (Three.js)

**Files:**
- Create: `frontend/src/components/landing/hero/veil-shaders.ts`, `frontend/src/components/landing/hero/veil-canvas.tsx`
- Modify: `frontend/src/components/landing/hero/hero.tsx`

- [ ] **Step 1: Write the GLSL shaders**

Create `frontend/src/components/landing/hero/veil-shaders.ts`:

```ts
export const vertex = /* glsl */ `
attribute float aSeed;
uniform float uProgress;
uniform float uTime;
uniform vec2 uResolution;
varying float vAlpha;

void main() {
  // Drift origin: noise-displaced point in NDC
  float angle = aSeed * 6.2831853;
  float radius = 0.45 + 0.2 * fract(aSeed * 7.13);
  vec2 origin = vec2(cos(angle), sin(angle)) * radius;

  // Slow drift over time
  vec2 drift = origin + 0.04 * vec2(
    sin(uTime * 0.2 + aSeed * 13.0),
    cos(uTime * 0.27 + aSeed * 11.0)
  );

  // Converge to center as progress increases
  vec2 pos = mix(drift, vec2(0.0), smoothstep(0.0, 1.0, uProgress));

  gl_Position = vec4(pos, 0.0, 1.0);

  // Particle size in pixels — shrinks as it converges
  float size = mix(2.0, 1.0, uProgress);
  gl_PointSize = size * (uResolution.y / 1000.0);

  // Alpha pulses subtly with seed and time
  vAlpha = 0.18 + 0.12 * sin(uTime * 0.5 + aSeed * 17.0);
}
`;

export const fragment = /* glsl */ `
precision mediump float;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float edge = smoothstep(0.5, 0.4, d);
  gl_FragColor = vec4(0.10, 0.10, 0.09, vAlpha * edge);
}
`;
```

- [ ] **Step 2: Build the canvas component**

Create `frontend/src/components/landing/hero/veil-canvas.tsx`:

```tsx
"use client";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useScrollProgress } from "@/hooks/use-scroll-progress";
import { vertex, fragment } from "./veil-shaders";

function pickParticleCount(): number {
  if (typeof navigator === "undefined") return 4000;
  const w = window.innerWidth;
  if (w >= 1024) return 12000;
  if (w >= 640) return 6000;
  return 3000;
}

export function VeilCanvas({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const progress = useScrollProgress(targetRef);
  const progressRef = useRef(0);
  progressRef.current = progress;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reduced) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      material.uniforms.uResolution.value.set(w, h);
    };
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);

    const count = pickParticleCount();
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
      },
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    resize();

    const start = performance.now();
    let raf = 0;
    const tick = () => {
      material.uniforms.uTime.value = (performance.now() - start) / 1000;
      material.uniforms.uProgress.value = progressRef.current;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [reduced]);

  if (reduced) {
    return (
      <div
        ref={containerRef}
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_var(--color-surface)_0%,_var(--color-canvas)_70%)]"
      />
    );
  }

  return <div ref={containerRef} aria-hidden className="absolute inset-0 -z-10" />;
}
```

- [ ] **Step 3: Wire VeilCanvas into Hero**

Replace `frontend/src/components/landing/hero/hero.tsx`:

```tsx
"use client";
import { useRef } from "react";
import { hero } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ButtonLink } from "@/components/ui/button";
import { VeilCanvas } from "./veil-canvas";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  return (
    <section
      ref={ref}
      className="relative mx-auto flex min-h-[90vh] max-w-[1200px] flex-col justify-center px-5 py-32 md:px-8"
    >
      <VeilCanvas targetRef={ref} />
      <Eyebrow>{hero.eyebrow}</Eyebrow>
      <DisplayHeading parts={hero.headline} size="xl" as="h1" className="mt-6" />
      <p className="mt-8 max-w-[640px] text-[22px] leading-[1.45] text-[var(--color-stone)]">
        {hero.sub}
      </p>
      <div className="mt-10 flex items-center gap-4">
        <ButtonLink href="#demo" variant="primary" size="lg">{hero.ctaPrimary} →</ButtonLink>
        <ButtonLink href="https://github.com/yuribodo/zksettle" variant="ghost" size="lg">
          {hero.ctaSecondary}
        </ButtonLink>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Visual verification**

```bash
pnpm dev
```

Open <http://localhost:3000>. Confirm: hero shows soft drifting particle cloud behind text. Scroll slowly — particles converge toward center as you go. Toggle "Reduce motion" in OS settings — particles disappear, replaced by the radial gradient. No frame drops on a mid laptop.

- [ ] **Step 5: Verify static checks**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/landing/hero/
git commit -m "$(cat <<'EOF'
feat: Add Veil WebGL canvas with scroll-driven particle convergence

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: GSAP setup + PinnedSection primitive

**Files:**
- Create: `frontend/src/lib/gsap.ts`, `frontend/src/components/motion/pinned-section.tsx`, `frontend/src/components/motion/fade-in.tsx`

- [ ] **Step 1: GSAP plugin registration**

Create `frontend/src/lib/gsap.ts`:

```ts
"use client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };
```

- [ ] **Step 2: PinnedSection wrapper**

Create `frontend/src/components/motion/pinned-section.tsx`:

```tsx
"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Pins a section while scrolling through it. Children get a CSS variable
 * --pin-progress (0..1) updated every frame.
 */
export function PinnedSection({
  children,
  height = "200vh",
  className,
}: {
  children: ReactNode;
  height?: string;
  className?: string;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !wrapper.current) return;
    const el = wrapper.current;
    const inner = el.firstElementChild as HTMLElement;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      pin: inner,
      pinSpacing: false,
      scrub: true,
      onUpdate: (s) => {
        inner.style.setProperty("--pin-progress", String(s.progress));
      },
    });
    return () => {
      trigger.kill();
    };
  }, [reduced]);

  return (
    <div ref={wrapper} className={className} style={{ height }}>
      <div className="h-screen flex items-center justify-center">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: FadeIn primitive (motion v11)**

Create `frontend/src/components/motion/fade-in.tsx`:

```tsx
"use client";
import { motion, type HTMLMotionProps } from "motion/react";

export function FadeIn({
  delay = 0,
  y = 20,
  className,
  children,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.7, delay, ease: [0.32, 0.72, 0, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/gsap.ts frontend/src/components/motion/
git commit -m "$(cat <<'EOF'
feat: Add GSAP setup, PinnedSection, FadeIn motion primitives

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Two Realities pinned scroll-locked redaction

**Files:**
- Modify: `frontend/src/components/landing/two-realities-section.tsx`

- [ ] **Step 1: Replace the section with pinned + progress-driven redaction**

Overwrite `frontend/src/components/landing/two-realities-section.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { twoRealities } from "@/content/copy";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { WarningTriangle, Check } from "iconoir-react";
import { ScrollTrigger } from "@/lib/gsap";

function block(len: number) {
  return "\u2593".repeat(len);
}

function Card({
  side,
  redactProgress,
}: {
  side: "without" | "with";
  redactProgress: number; // 0..1
}) {
  const data = side === "without" ? twoRealities.withoutZk : twoRealities.withZk;
  const isWith = side === "with";
  return (
    <div className="flex flex-col gap-6 rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-8">
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
        {data.title}
      </div>
      <dl className="space-y-3">
        {data.rows.map(([k, v]) => {
          const display =
            !isWith && redactProgress > 0
              ? renderRedacted(v as string, redactProgress)
              : v;
          return (
            <div key={k} className="flex items-baseline justify-between gap-4">
              <dt className="text-[14px] text-[var(--color-stone)]">{k}</dt>
              <dd className="font-mono text-[14px] text-[var(--color-ink)]">{display}</dd>
            </div>
          );
        })}
      </dl>
      {isWith && "proof" in data && (
        <div className="flex items-center gap-2 font-mono text-[14px] text-[var(--color-forest)]">
          <Check width={16} height={16} strokeWidth={1.5} />
          <span>Proof: {data.proof}</span>
        </div>
      )}
      <div
        className={
          isWith
            ? "inline-flex w-fit items-center gap-2 rounded-[2px] bg-[var(--color-mint)] px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--color-forest)]"
            : "inline-flex w-fit items-center gap-2 rounded-[2px] bg-[var(--color-danger-bg)] px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--color-danger-text)]"
        }
      >
        {isWith ? (
          <Check width={14} height={14} strokeWidth={1.5} />
        ) : (
          <WarningTriangle width={14} height={14} strokeWidth={1.5} />
        )}
        {data.badge}
      </div>
    </div>
  );
}

function renderRedacted(value: string, p: number): string {
  // p in 0..1: progressively replace characters left-to-right with ▓
  const cut = Math.floor(value.length * p);
  return block(cut) + value.slice(cut);
}

export function TwoRealitiesSection() {
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !wrap.current) return;
    const el = wrap.current;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      pin: el.querySelector("[data-pinned]") as HTMLElement,
      pinSpacing: false,
      scrub: true,
      onUpdate: (s) => {
        el.style.setProperty("--redact", String(s.progress));
        // Force re-render via React state? We use CSS var read by inline style trick:
        const rerender = el.querySelector("[data-redact-target]") as HTMLElement | null;
        if (rerender) rerender.dataset.p = String(s.progress);
      },
    });
    return () => trigger.kill();
  }, [reduced]);

  // We track progress manually for the React state mapping; simpler approach below:
  return (
    <section
      ref={wrap}
      className="relative"
      style={{ height: reduced ? "auto" : "200vh" }}
    >
      <div data-pinned className="mx-auto max-w-[1200px] px-5 md:px-8 py-24">
        <Eyebrow>{twoRealities.eyebrow}</Eyebrow>
        <DisplayHeading parts={twoRealities.headline} size="l" as="h2" className="mt-6" />
        <ProgressDriven />
        <p className="mt-12 max-w-[640px] text-[18px] text-[var(--color-stone)]">
          {twoRealities.caption}
        </p>
      </div>
    </section>
  );
}

function ProgressDriven() {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const loop = () => {
      const next = parseFloat(el.dataset.p ?? "0");
      setP((curr) => (Math.abs(curr - next) > 0.005 ? next : curr));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={ref} data-redact-target data-p="0" className="mt-12 grid gap-6 md:grid-cols-2">
      <Card side="without" redactProgress={p} />
      <Card side="with" redactProgress={p} />
    </div>
  );
}
```

Note: this is a deliberate single-file implementation to keep the redaction tightly coupled to its scroll trigger. Cleaner abstraction can come later.

- [ ] **Step 2: Visual verification**

```bash
pnpm dev
```

Open <http://localhost:3000>, scroll down to Two Realities. Confirm: section pins, left card field values get progressively replaced with `▓` blocks as you scroll. Right card stays redacted from the start. Caption stays at bottom. With OS reduced motion: no pin, both cards render side-by-side immediately.

- [ ] **Step 3: Verify static checks**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/two-realities-section.tsx
git commit -m "$(cat <<'EOF'
feat: Pin Two Realities section with scroll-driven redaction

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: CountUp + Numbers section

**Files:**
- Create: `frontend/src/components/motion/count-up.tsx`
- Modify: `frontend/src/components/landing/numbers-section.tsx`

- [ ] **Step 1: Build CountUp**

Create `frontend/src/components/motion/count-up.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

export function CountUp({
  value,
  format,
  durationMs = 1400,
}: {
  value: number;
  format: (n: number) => string;
  durationMs?: number;
}) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (t: number) => {
              const p = Math.min(1, (t - start) / durationMs);
              const eased = 1 - Math.pow(1 - p, 3);
              setN(value * eased);
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return <span ref={ref}>{format(n)}</span>;
}
```

- [ ] **Step 2: Wire CountUp into Numbers**

Replace `frontend/src/components/landing/numbers-section.tsx`:

```tsx
import { numbers } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";
import { CountUp } from "@/components/motion/count-up";

function renderValue(value: string) {
  // Animated only for "256 bytes" — others are categorical.
  if (value === "256 bytes") {
    return <CountUp value={256} format={(n) => `${Math.round(n)} bytes`} />;
  }
  return value;
}

export function NumbersSection() {
  return (
    <Section id="benchmarks">
      <Eyebrow>{numbers.eyebrow}</Eyebrow>
      <DisplayHeading parts={numbers.headline} size="l" as="h2" className="mt-6" />
      <dl className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2">
        {numbers.items.map((n) => (
          <div key={n.label} className="border-t border-[var(--color-border-subtle)] pt-6">
            <dt className="font-[family-name:var(--font-display)] text-[clamp(56px,8vw,96px)] leading-[0.95] tracking-[-0.035em] text-[var(--color-ink)] tabular-nums">
              {renderValue(n.value)}
            </dt>
            <dd className="mt-3 font-mono text-[14px] text-[var(--color-stone)]">{n.label}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
```

- [ ] **Step 3: Visual verification**

`pnpm dev`. Scroll to Benchmarks. Confirm: "256 bytes" counts up from 0 when scrolled into view. Other three values render statically. No layout shift.

- [ ] **Step 4: Static checks + commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add frontend/src/components/motion/count-up.tsx frontend/src/components/landing/numbers-section.tsx
git commit -m "$(cat <<'EOF'
feat: Add CountUp animation for benchmark numbers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: FadeIn pass on remaining static sections

**Files:**
- Modify: `frontend/src/components/landing/paradox-section.tsx`, `how-it-works-section.tsx`, `use-cases-section.tsx`, `momentum-section.tsx`

- [ ] **Step 1: Wrap content in FadeIn**

For each of the four files, wrap the headline/body/grid contents in a `FadeIn` from `@/components/motion/fade-in`. Example for `paradox-section.tsx`:

```tsx
import { paradox } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";
import { FadeIn } from "@/components/motion/fade-in";

export function ParadoxSection() {
  return (
    <Section id="paradox" width="narrow">
      <FadeIn><Eyebrow>{paradox.eyebrow}</Eyebrow></FadeIn>
      <FadeIn delay={0.1}>
        <DisplayHeading parts={paradox.headline} size="l" as="h2" className="mt-6" />
      </FadeIn>
      <FadeIn delay={0.2}>
        <p className="mt-10 text-[22px] leading-[1.45] text-[var(--color-quill)]">
          {paradox.body}
        </p>
      </FadeIn>
    </Section>
  );
}
```

Repeat the same shape on `how-it-works-section.tsx` (wrap each step), `use-cases-section.tsx` (wrap grid + each card with stagger via `delay={0.05 * i}`), and `momentum-section.tsx` (wrap each column).

- [ ] **Step 2: Visual verification**

`pnpm dev` — scroll through landing. Each section gently fades + lifts on entry. No janky double-fires. Reduced motion still works.

- [ ] **Step 3: Static checks + commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add frontend/src/components/landing/
git commit -m "$(cat <<'EOF'
feat: Add scroll-triggered fade-in to remaining landing sections

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 4 — Demo + remaining landing polish

## Task 18: proof-bytes + demo-script (deterministic data)

**Files:**
- Create: `frontend/src/lib/proof-bytes.ts`, `frontend/src/lib/demo-script.ts`, `frontend/src/lib/demo-script.test.ts`

- [ ] **Step 1: Create proof-bytes (placeholder hex)**

Create `frontend/src/lib/proof-bytes.ts`:

```ts
/**
 * Pre-generated valid Groth16 proof bytes (BN254). The real bytes are
 * delivered by the backend team in Week 2 (see PRD §12 / spec R5). Until
 * then, this static placeholder ships so the demo flow renders.
 *
 * Replace VALID_PROOF_HEX and EXPIRED_NULLIFIER with the real values when
 * ready. The format and length must remain identical.
 */
export const VALID_PROOF_HEX =
  "0x8a3f7e2c4b1d9f0a17d4e8b3c5a2f1e0" +
  "9d4c7b6a5f3e2d1c8b9a0f7e6d5c4b3a" +
  "21089f0e7d6c5b4a39281706f5e4d3c2" +
  "b1a09f8e7d6c5b4a3928170f6e5d4c3b";

export const VALID_NULLIFIER = "0x4c917a2b3e8f5d6c0a1b2e3f4d5c6b7a";

export const EXPIRED_BLOCK = 287_901_433;

/** Fake but realistic SOL devnet tx signature. Replace with a real tx. */
export const DEMO_TX_SIGNATURE =
  "5g8H4nP3eR2tQ7mK9vL8xY6cB1jH4dF2kM3nP9qR5sT7uV1wXzYa";

export const SOLSCAN_URL = `https://solscan.io/tx/${DEMO_TX_SIGNATURE}?cluster=devnet`;
```

- [ ] **Step 2: Write failing test for demo-script state machine**

Create `frontend/src/lib/demo-script.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildDemoScript } from "./demo-script";

describe("buildDemoScript", () => {
  it("valid flow has 4 steps then proof line then duration", () => {
    const script = buildDemoScript({ kind: "valid" });
    expect(script.steps).toHaveLength(4);
    expect(script.steps.every((s) => s.label.startsWith("["))).toBe(true);
    expect(script.outcome.kind).toBe("ok");
  });
  it("expired flow fails on step 3 with a danger line", () => {
    const script = buildDemoScript({ kind: "expired" });
    expect(script.steps).toHaveLength(3);
    expect(script.outcome.kind).toBe("error");
  });
  it("total wall-clock is approximately 4710ms for valid", () => {
    const script = buildDemoScript({ kind: "valid" });
    const total = script.steps.reduce((a, s) => a + s.durationMs, 0);
    expect(total).toBeGreaterThan(4500);
    expect(total).toBeLessThan(4900);
  });
});
```

- [ ] **Step 3: Confirm failure**

```bash
pnpm test
```

- [ ] **Step 4: Implement demo-script**

Create `frontend/src/lib/demo-script.ts`:

```ts
import { VALID_PROOF_HEX, VALID_NULLIFIER, EXPIRED_BLOCK } from "./proof-bytes";

export type DemoKind = "valid" | "expired";

export interface DemoStep {
  label: string;
  durationMs: number;
}

export type DemoOutcome =
  | { kind: "ok"; proof: string; nullifier: string; durationMs: number }
  | { kind: "error"; message: string };

export interface DemoScript {
  steps: DemoStep[];
  outcome: DemoOutcome;
}

export function buildDemoScript(input: { kind: DemoKind }): DemoScript {
  const baseSteps: DemoStep[] = [
    { label: "[1/4] Loading credential ......... ok", durationMs: 320 },
    { label: "[2/4] Building Merkle path ....... ok", durationMs: 540 },
    { label: "[3/4] Computing Poseidon hashes .. ok", durationMs: 1180 },
    { label: "[4/4] Generating Groth16 proof ... ok", durationMs: 2670 },
  ];

  if (input.kind === "expired") {
    return {
      steps: [
        baseSteps[0]!,
        baseSteps[1]!,
        {
          label: `[3/4] Computing Poseidon hashes .. fail`,
          durationMs: 980,
        },
      ],
      outcome: {
        kind: "error",
        message: `proof rejected · credential expired (block ${EXPIRED_BLOCK.toLocaleString("en-US")})`,
      },
    };
  }

  return {
    steps: baseSteps,
    outcome: {
      kind: "ok",
      proof: VALID_PROOF_HEX,
      nullifier: VALID_NULLIFIER,
      durationMs: 4710,
    },
  };
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/proof-bytes.ts frontend/src/lib/demo-script.ts frontend/src/lib/demo-script.test.ts
git commit -m "$(cat <<'EOF'
feat: Add deterministic demo script + placeholder proof bytes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Proof console + demo form

**Files:**
- Create: `frontend/src/components/landing/proof-console.tsx`, `frontend/src/components/landing/demo-form.tsx`
- Modify: `frontend/src/components/landing/demo-section.tsx`

- [ ] **Step 1: Build the proof console (terminal animation)**

Create `frontend/src/components/landing/proof-console.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { buildDemoScript, type DemoKind, type DemoScript } from "@/lib/demo-script";
import { SOLSCAN_URL } from "@/lib/proof-bytes";
import { ButtonLink } from "@/components/ui/button";

export function ProofConsole({
  trigger,
  kind,
  onComplete,
}: {
  trigger: number; // increment to start a new run
  kind: DemoKind;
  onComplete: (ok: boolean) => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DemoScript["outcome"] | null>(null);

  useEffect(() => {
    if (trigger === 0) return;
    setLines([]);
    setError(null);
    setDone(null);
    const script = buildDemoScript({ kind });
    let cancelled = false;
    let timeAcc = 0;
    script.steps.forEach((step) => {
      timeAcc += step.durationMs;
      window.setTimeout(() => {
        if (cancelled) return;
        setLines((curr) => [...curr, step.label]);
      }, timeAcc);
    });
    window.setTimeout(() => {
      if (cancelled) return;
      if (script.outcome.kind === "error") {
        setError(script.outcome.message);
      } else {
        setDone(script.outcome);
      }
      onComplete(script.outcome.kind === "ok");
    }, timeAcc + 80);
    return () => { cancelled = true; };
  }, [trigger, kind, onComplete]);

  return (
    <div className="flex flex-col gap-4 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-deep)] p-6">
      <div
        role="log"
        aria-live="polite"
        className="font-mono text-[13px] leading-[1.6] text-[var(--color-ink)] min-h-[180px]"
      >
        {trigger === 0 && (
          <span className="text-[var(--color-muted)]">// Click "Generate proof" to begin</span>
        )}
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
        {done && (
          <>
            <div className="mt-3">proof: {done.proof}</div>
            <div>nullifier: {done.nullifier}</div>
            <div>duration: {(done.durationMs / 1000).toFixed(2)}s</div>
          </>
        )}
        {error && (
          <div className="mt-3 text-[var(--color-danger-text)]">{error}</div>
        )}
      </div>
      {done && (
        <ButtonLink href={SOLSCAN_URL} target="_blank" rel="noopener" variant="primary" size="md">
          Submit to devnet → View on Solscan ↗
        </ButtonLink>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build the demo form**

Create `frontend/src/components/landing/demo-form.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProofConsole } from "./proof-console";

const JURISDICTIONS = ["US", "EU", "UK", "BR"] as const;

export function DemoForm() {
  const [recipient, setRecipient] = useState("5g8H4nP3eR2tQ7mK9vL8xY6cB1jH4dF2");
  const [amount, setAmount] = useState(1200);
  const [jurisdiction, setJurisdiction] = useState<(typeof JURISDICTIONS)[number]>("US");
  const [tryExpired, setTryExpired] = useState(false);
  const [run, setRun] = useState(0);

  return (
    <>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            Recipient wallet
          </span>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="rounded-[2px] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 font-mono text-[14px] text-[var(--color-ink)] focus:outline focus:outline-2 focus:outline-[var(--color-forest)]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            Amount: {amount.toLocaleString("en-US")} USDC
          </span>
          <input
            type="range"
            min={100}
            max={10000}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="accent-[var(--color-forest)]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            Jurisdiction
          </span>
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value as (typeof JURISDICTIONS)[number])}
            className="rounded-[2px] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-[14px]"
          >
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] text-[var(--color-stone)]">
          <input
            type="checkbox"
            checked={tryExpired}
            onChange={(e) => setTryExpired(e.target.checked)}
            className="accent-[var(--color-forest)]"
          />
          Try with expired credential
        </label>
        <Button variant="primary" size="lg" onClick={() => setRun((r) => r + 1)}>
          Generate proof
        </Button>
      </div>
      <ProofConsole trigger={run} kind={tryExpired ? "expired" : "valid"} onComplete={() => undefined} />
    </>
  );
}
```

- [ ] **Step 3: Wire form into demo section**

Replace the placeholder grid in `frontend/src/components/landing/demo-section.tsx`:

```tsx
import { demo } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";
import { DemoForm } from "./demo-form";

export function DemoSection() {
  return (
    <Section id="demo">
      <Eyebrow>{demo.eyebrow}</Eyebrow>
      <DisplayHeading parts={demo.headline} size="l" as="h2" className="mt-6" />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <DemoForm />
      </div>
      <p className="mt-6 font-mono text-[12px] text-[var(--color-muted)]">{demo.honesty}</p>
    </Section>
  );
}
```

- [ ] **Step 4: Visual verification**

`pnpm dev`. Open <http://localhost:3000#demo>. Confirm: form renders left, proof console right with placeholder text. Click "Generate proof" — terminal animates 4 lines over ~4.7s, then shows proof + nullifier + duration + Solscan button. Toggle "Try with expired" — terminal shows 3 lines and danger error. Solscan button does not render on error. Aria-live announces line additions to screen readers.

- [ ] **Step 5: Static checks + commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add frontend/src/components/landing/proof-console.tsx frontend/src/components/landing/demo-form.tsx frontend/src/components/landing/demo-section.tsx
git commit -m "$(cat <<'EOF'
feat: Wire interactive proof console + demo form

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Shiki code block for SDK section

**Files:**
- Create: `frontend/src/lib/shiki.ts`, `frontend/src/components/ui/code-block.tsx`
- Modify: `frontend/src/components/landing/developers-section.tsx`

- [ ] **Step 1: Create shiki helper**

Create `frontend/src/lib/shiki.ts`:

```ts
import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Promise<Highlighter> | null = null;

export function getHighlighter() {
  if (!highlighter) {
    highlighter = createHighlighter({
      themes: ["github-light"],
      langs: ["typescript", "rust", "bash"],
    });
  }
  return highlighter;
}
```

- [ ] **Step 2: Server component code block**

Create `frontend/src/components/ui/code-block.tsx`:

```tsx
import { getHighlighter } from "@/lib/shiki";

export async function CodeBlock({
  code,
  lang,
}: {
  code: string;
  lang: "typescript" | "rust" | "bash";
}) {
  const hl = await getHighlighter();
  const html = hl.codeToHtml(code, {
    lang,
    theme: "github-light",
    transformers: [
      {
        pre(node) {
          node.properties.style =
            "background:var(--color-surface-deep);padding:1.5rem;border:1px solid var(--color-border-subtle);border-radius:6px;overflow-x:auto;font-family:var(--font-mono);font-size:14px;line-height:1.55;";
          return node;
        },
      },
    ],
  });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

- [ ] **Step 3: Replace `<pre>` in developers section**

Edit `frontend/src/components/landing/developers-section.tsx` — swap the `<pre>` for `<CodeBlock code={developers.snippet} lang="typescript" />`. The component is async so the section becomes async too:

```tsx
import { developers } from "@/content/copy";
import { Section } from "@/components/ui/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DisplayHeading } from "@/components/ui/display-heading";
import { CodeBlock } from "@/components/ui/code-block";

export async function DevelopersSection() {
  return (
    <Section id="sdk">
      <Eyebrow>{developers.eyebrow}</Eyebrow>
      <DisplayHeading parts={developers.headline} size="l" as="h2" className="mt-6" />
      <div className="mt-12 grid gap-8 md:grid-cols-[2fr,1fr]">
        <CodeBlock code={developers.snippet} lang="typescript" />
        <aside className="flex flex-col gap-4 text-[14px] text-[var(--color-stone)]">
          <code className="font-mono text-[var(--color-ink)]">{developers.installCmd}</code>
          <span className="font-mono text-[var(--color-muted)]">{developers.version}</span>
          <p>{developers.license}</p>
        </aside>
      </div>
    </Section>
  );
}
```

(Update the import in `page.tsx` if it still uses the old non-async name — name stays the same, just await flows through automatically since it's an RSC.)

- [ ] **Step 4: Visual verification + checks**

`pnpm dev`. Scroll to SDK section. Confirm: code block renders with syntax highlighting on canvas-warm bg. No client JS for highlighting (view-source shows pre-rendered HTML).

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/shiki.ts frontend/src/components/ui/code-block.tsx frontend/src/components/landing/developers-section.tsx
git commit -m "$(cat <<'EOF'
feat: Add Shiki SSR code block to SDK section

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 5 — Dashboard chrome + Tier A pages

## Task 21: Mock data for dashboard

**Files:**
- Create: `frontend/src/lib/mock-data.ts`, `frontend/src/lib/mock-data.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/lib/mock-data.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateFeed, ISSUERS, generateAuditRows, BILLING_USAGE } from "./mock-data";

describe("generateFeed", () => {
  it("is deterministic per seed", () => {
    const a = generateFeed({ seed: 7, count: 30 });
    const b = generateFeed({ seed: 7, count: 30 });
    expect(a).toEqual(b);
  });
  it("produces the requested count", () => {
    expect(generateFeed({ seed: 1, count: 12 })).toHaveLength(12);
  });
  it("uses only known issuer ids", () => {
    const ids = new Set(ISSUERS.map((i) => i.name));
    for (const r of generateFeed({ seed: 3, count: 50 })) {
      expect(ids.has(r.issuer)).toBe(true);
    }
  });
});

describe("ISSUERS", () => {
  it("contains six entries", () => {
    expect(ISSUERS).toHaveLength(6);
  });
});

describe("generateAuditRows + BILLING_USAGE", () => {
  it("audit rows is deterministic", () => {
    expect(generateAuditRows({ seed: 9, count: 5 })).toEqual(
      generateAuditRows({ seed: 9, count: 5 }),
    );
  });
  it("billing usage covers 30 days", () => {
    expect(BILLING_USAGE).toHaveLength(30);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test
```

- [ ] **Step 3: Implement mock-data.ts**

Create `frontend/src/lib/mock-data.ts`:

```ts
import { mulberry32 } from "./prng";

export type FeedStatus = "verified" | "blocked";

export interface FeedRow {
  id: string;
  timestamp: number; // unix ms
  wallet: string;
  issuer: string;
  status: FeedStatus;
  blockedReason?: string;
  amount: number;
  currency: "USDC";
  jurisdiction: "US" | "EU" | "UK" | "BR";
  txSig: string;
}

export const ISSUERS = [
  { name: "Persona",  pubkey: "9zK4mP1aN5o6Q7r8S9t0", root: "0x4c918e2f", users: 12_847, lastUpdate: "2h ago",  status: "active" as const },
  { name: "Sumsub",   pubkey: "4aB7nQ2bO5p6R7s8T9u0", root: "0xa3f8c91b", users:  8_392, lastUpdate: "5h ago",  status: "active" as const },
  { name: "Onfido",   pubkey: "2cD9rT3cP5q6S7t8U9v0", root: "0x7e1a4d5f", users:  5_201, lastUpdate: "12h ago", status: "active" as const },
  { name: "Jumio",    pubkey: "8eF2sU4dQ5r6T7u8V9w0", root: "0xbb290ee8", users:  3_108, lastUpdate: "1d ago",  status: "active" as const },
  { name: "Veriff",   pubkey: "1gH5tV5eR5s6U7v8W9x0", root: "0x2f47a18c", users:  1_847, lastUpdate: "3d ago",  status: "stale"  as const },
  { name: "MockKYC",  pubkey: "7iJ8uW6fS5t6V7w8X9y0", root: "0xdeadbeef", users:    100, lastUpdate: "—",       status: "test"   as const },
];

const JURIS: FeedRow["jurisdiction"][] = ["US", "EU", "UK", "BR"];
const REASONS = [
  "credential expired",
  "sanctions list match",
  "jurisdiction not allowed",
  "merkle root not registered",
];

function makeWallet(rng: () => number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(rng() * chars.length)];
  return `${out.slice(0, 4)}...${out.slice(4, 7)}`;
}

function makeTx(rng: () => number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(rng() * chars.length)];
  return out;
}

export function generateFeed({ seed, count, baseTime = Date.now() }: { seed: number; count: number; baseTime?: number }): FeedRow[] {
  const rng = mulberry32(seed);
  const rows: FeedRow[] = [];
  let t = baseTime;
  for (let i = 0; i < count; i++) {
    t -= Math.floor(rng() * 8000) + 2000;
    const isBlocked = rng() < 0.012;
    const issuer = ISSUERS[Math.floor(rng() * ISSUERS.length)]!.name;
    rows.push({
      id: `${seed}-${i}`,
      timestamp: t,
      wallet: makeWallet(rng),
      issuer,
      status: isBlocked ? "blocked" : "verified",
      blockedReason: isBlocked ? REASONS[Math.floor(rng() * REASONS.length)] : undefined,
      amount: Math.floor(100 + rng() * 18000),
      currency: "USDC",
      jurisdiction: JURIS[Math.floor(rng() * JURIS.length)]!,
      txSig: makeTx(rng),
    });
  }
  return rows;
}

export interface AuditRow extends FeedRow {
  proofHash: string;
  block: number;
  slot: number;
  cuConsumed: number;
}

export function generateAuditRows({ seed, count }: { seed: number; count: number }): AuditRow[] {
  const base = generateFeed({ seed, count });
  const rng = mulberry32(seed + 1);
  return base.map((r) => ({
    ...r,
    proofHash: `0x${Math.floor(rng() * 0xffffffff).toString(16).padStart(8, "0")}`,
    block: 287_900_000 + Math.floor(rng() * 10_000),
    slot: 290_100_000 + Math.floor(rng() * 10_000),
    cuConsumed: 180_000 + Math.floor(rng() * 30_000),
  }));
}

/** 30-day usage series for billing chart */
export const BILLING_USAGE: { day: number; proofs: number }[] = (() => {
  const rng = mulberry32(42);
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    proofs: 400 + Math.floor(rng() * 1100),
  }));
})();
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/mock-data.ts frontend/src/lib/mock-data.test.ts
git commit -m "$(cat <<'EOF'
feat: Add deterministic mock data for dashboard feed/issuers/audit/billing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: Dashboard chrome (sidebar + topbar + layout)

**Files:**
- Create: `frontend/src/components/dashboard/sidebar.tsx`, `frontend/src/components/dashboard/top-bar.tsx`
- Create: `frontend/src/app/dashboard/layout.tsx`, `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Build sidebar**

Create `frontend/src/components/dashboard/sidebar.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Check, User, Page, Key, Clock, Group, Receipt } from "iconoir-react";
import { Logo } from "@/components/icons/logo";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; Icon: typeof Activity };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "OVERVIEW",
    items: [
      { href: "/dashboard/transactions",   label: "Transactions",   Icon: Activity },
      { href: "/dashboard/attestations",   label: "Attestations",   Icon: Check },
      { href: "/dashboard/counterparties", label: "Counterparties", Icon: User },
    ],
  },
  {
    title: "CONTROLS",
    items: [
      { href: "/dashboard/policies",  label: "Policies",  Icon: Page },
      { href: "/dashboard/api-keys",  label: "API keys",  Icon: Key },
      { href: "/dashboard/audit-log", label: "Audit log", Icon: Clock },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { href: "/dashboard/team",    label: "Team",    Icon: Group },
      { href: "/dashboard/billing", label: "Billing", Icon: Receipt },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
      <div className="mb-8 flex items-center justify-between px-2">
        <Logo size={24} />
        <span className="font-mono text-[11px] text-[var(--color-muted)]">Acme ▾</span>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <div className="mb-2 px-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
              {s.title}
            </div>
            <ul className="space-y-1">
              {s.items.map((it) => {
                const active = pathname === it.href;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-[3px] px-3 py-2 text-[14px] transition-colors",
                        active
                          ? "bg-[var(--color-surface-deep)] text-[var(--color-ink)]"
                          : "text-[var(--color-quill)] hover:bg-[var(--color-surface-deep)]",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[var(--color-forest)]"
                        />
                      )}
                      <it.Icon width={20} height={20} strokeWidth={1.5} />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-[var(--color-border-subtle)] pt-4 text-[12px] text-[var(--color-muted)]">
        <div className="px-3">Devnet ▾</div>
        <div className="px-3 font-mono">v0.1.0</div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Build topbar**

Create `frontend/src/components/dashboard/top-bar.tsx`:

```tsx
import { Bell, Search, User } from "iconoir-react";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-canvas)]">
      <div className="flex items-end justify-between px-8 py-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[32px] leading-[1.1] text-[var(--color-ink)]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 max-w-[640px] text-[14px] text-[var(--color-stone)]">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-[var(--color-muted)]">
          <span className="font-mono text-[12px]">⌘K</span>
          <Search width={20} height={20} strokeWidth={1.5} />
          <Bell width={20} height={20} strokeWidth={1.5} />
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-surface-deep)] text-[var(--color-quill)]">
            <User width={16} height={16} strokeWidth={1.5} />
          </span>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Dashboard layout**

Create `frontend/src/app/dashboard/layout.tsx`:

```tsx
import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-h-screen bg-[var(--color-canvas)]">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Redirect from /dashboard**

Create `frontend/src/app/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function DashboardIndex() {
  redirect("/dashboard/transactions");
}
```

- [ ] **Step 5: Visual verification**

`pnpm dev`. Open <http://localhost:3000/dashboard>. Confirm: redirect to `/dashboard/transactions` (will 404 until next task). Sidebar still renders 3 groups with correct labels. Active state highlights with forest left rule. Hover state changes bg.

- [ ] **Step 6: Static checks + commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add frontend/src/components/dashboard/ frontend/src/app/dashboard/
git commit -m "$(cat <<'EOF'
feat: Add dashboard chrome (sidebar with 8-route IA + topbar)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 23: StatusPill + StatCard primitives

**Files:**
- Create: `frontend/src/components/dashboard/status-pill.tsx`, `frontend/src/components/dashboard/stat-card.tsx`

- [ ] **Step 1: StatusPill (Iconoir glyph + label)**

Create `frontend/src/components/dashboard/status-pill.tsx`:

```tsx
import { Check, Xmark, WarningTriangle, Sparks } from "iconoir-react";
import { cn } from "@/lib/cn";

type Tone = "verified" | "blocked" | "warning" | "test";

const tones: Record<Tone, { bg: string; text: string; Icon: typeof Check }> = {
  verified: { bg: "var(--color-mint)",        text: "var(--color-forest)",       Icon: Check },
  blocked:  { bg: "var(--color-danger-bg)",   text: "var(--color-danger-text)",  Icon: Xmark },
  warning:  { bg: "var(--color-warning-bg)",  text: "var(--color-warning-text)", Icon: WarningTriangle },
  test:     { bg: "var(--color-surface-deep)",text: "var(--color-muted)",        Icon: Sparks },
};

export function StatusPill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] px-2 py-1 text-[12px] font-medium uppercase tracking-[0.06em]",
        className,
      )}
      style={{ background: t.bg, color: t.text }}
    >
      <t.Icon width={12} height={12} strokeWidth={1.5} />
      {children}
    </span>
  );
}
```

- [ ] **Step 2: StatCard**

Create `frontend/src/components/dashboard/stat-card.tsx`:

```tsx
export function StatCard({
  value,
  label,
  delta,
}: {
  value: string;
  label: string;
  delta?: string;
}) {
  return (
    <div className="rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
      <div className="font-[family-name:var(--font-display)] text-[32px] leading-[1] text-[var(--color-ink)] tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-[13px] text-[var(--color-stone)]">{label}</div>
      {delta && (
        <div className="mt-1 font-mono text-[12px] text-[var(--color-muted)]">{delta}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Static checks + commit**

```bash
pnpm typecheck && pnpm lint
git add frontend/src/components/dashboard/
git commit -m "$(cat <<'EOF'
feat: Add StatusPill (Iconoir glyph, no dot) and StatCard primitives

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 24: /dashboard/transactions (Tier A)

**Files:**
- Create: `frontend/src/components/dashboard/transaction-row.tsx`, `frontend/src/components/dashboard/transactions-table.tsx`
- Create: `frontend/src/app/dashboard/transactions/page.tsx`

- [ ] **Step 1: TransactionRow with side rule (no dot)**

Create `frontend/src/components/dashboard/transaction-row.tsx`:

```tsx
import { ArrowUpRight } from "iconoir-react";
import { StatusPill } from "./status-pill";
import { fmtAmount, fmtRelativeTime } from "@/lib/format";
import type { FeedRow } from "@/lib/mock-data";

const RULE_COLOR: Record<FeedRow["status"], string> = {
  verified: "var(--color-emerald)",
  blocked:  "var(--color-danger-text)",
};

export function TransactionRow({ row, now }: { row: FeedRow; now: number }) {
  return (
    <div
      className="grid grid-cols-[12px_120px_minmax(120px,1fr)_120px_140px_minmax(140px,1fr)_80px_24px] items-center gap-3 py-3 pl-0 pr-4 hover:bg-[var(--color-surface-deep)]"
    >
      <div
        aria-hidden
        className="h-full w-[2px]"
        style={{ background: RULE_COLOR[row.status] }}
      />
      <span className="font-mono text-[12px] text-[var(--color-muted)] tabular-nums">
        {fmtRelativeTime(Math.max(0, (now - row.timestamp) / 1000))}
      </span>
      <span className="font-mono text-[14px] text-[var(--color-ink)]">{row.wallet}</span>
      <span className="text-[14px] text-[var(--color-quill)]">{row.issuer}</span>
      <StatusPill tone={row.status === "verified" ? "verified" : "blocked"}>
        {row.status === "verified" ? "Verified" : `Blocked${row.blockedReason ? ` · ${row.blockedReason}` : ""}`}
      </StatusPill>
      <span className="font-mono text-[14px] text-[var(--color-ink)] tabular-nums">
        {fmtAmount(row.amount, row.currency)}
      </span>
      <span className="font-mono text-[12px] text-[var(--color-quill)]">{row.jurisdiction}</span>
      <a
        href={`https://solscan.io/tx/${row.txSig}?cluster=devnet`}
        target="_blank"
        rel="noopener"
        className="text-[var(--color-muted)] hover:text-[var(--color-forest)]"
        aria-label="View on Solscan"
      >
        <ArrowUpRight width={16} height={16} strokeWidth={1.5} />
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Live-pushing transactions table**

Create `frontend/src/components/dashboard/transactions-table.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { generateFeed, type FeedRow } from "@/lib/mock-data";
import { TransactionRow } from "./transaction-row";

const SEED = 7;
const INITIAL = 30;

export function TransactionsTable() {
  const [rows, setRows] = useState<FeedRow[]>(() => generateFeed({ seed: SEED, count: INITIAL }));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let i = INITIAL;
    const tick = () => {
      const next = generateFeed({ seed: SEED + i, count: 1, baseTime: Date.now() })[0]!;
      i += 1;
      setRows((curr) => [next, ...curr].slice(0, 100));
    };
    const id = setInterval(tick, 4500 + Math.random() * 3000);
    const clock = setInterval(() => setNow(Date.now()), 5000);
    return () => { clearInterval(id); clearInterval(clock); };
  }, []);

  return (
    <div className="rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-canvas)]">
      <div className="grid grid-cols-[12px_120px_minmax(120px,1fr)_120px_140px_minmax(140px,1fr)_80px_24px] gap-3 border-b border-[var(--color-border-subtle)] px-0 pr-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
        <span />
        <span>Time</span>
        <span>Wallet</span>
        <span>Issuer</span>
        <span>Status</span>
        <span>Amount</span>
        <span>Juris.</span>
        <span />
      </div>
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {rows.map((r) => (
          <TransactionRow key={r.id} row={r} now={now} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build the page**

Create `frontend/src/app/dashboard/transactions/page.tsx`:

```tsx
import { TopBar } from "@/components/dashboard/top-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { TransactionsTable } from "@/components/dashboard/transactions-table";

export const metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <>
      <TopBar
        title="Transactions"
        subtitle="Live feed of settlement events. Every row carries a proof; every proof is replayable six months from now."
      />
      <main className="p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard value="1,847" label="proofs verified (last 24h)" delta="+12% vs yesterday" />
          <StatCard value="23"    label="blocked"                    delta="1.2% rejection rate" />
          <StatCard value="4.7s"  label="avg proving time"           delta="p95 6.2s" />
          <StatCard value="$0.00091" label="avg verify cost"         delta="Devnet" />
        </div>
        <div className="mt-8">
          <TransactionsTable />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Visual verification**

`pnpm dev` — open `/dashboard`. Should redirect to `/dashboard/transactions`. Confirm: 4 stat cards, table with side rules (emerald for verified, danger-text for blocked, no dots), new rows fade in every few seconds. No console errors.

- [ ] **Step 5: Static checks + commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add frontend/src/components/dashboard/ frontend/src/app/dashboard/
git commit -m "$(cat <<'EOF'
feat: Build /dashboard/transactions Tier A page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 25: /dashboard/counterparties (Tier A)

**Files:**
- Create: `frontend/src/components/dashboard/counterparties-table.tsx`
- Create: `frontend/src/app/dashboard/counterparties/page.tsx`

- [ ] **Step 1: Build the table**

Create `frontend/src/components/dashboard/counterparties-table.tsx`:

```tsx
import { ISSUERS } from "@/lib/mock-data";
import { StatusPill } from "./status-pill";

const TONE = { active: "verified", stale: "warning", test: "test" } as const;
const LABEL = { active: "Active", stale: "Stale (>24h)", test: "Test mode" } as const;

export function CounterpartiesTable() {
  return (
    <div className="rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-canvas)]">
      <div className="grid grid-cols-[160px_minmax(140px,1fr)_minmax(140px,1fr)_120px_140px_140px] gap-4 border-b border-[var(--color-border-subtle)] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
        <span>Name</span>
        <span>Pubkey</span>
        <span>Merkle root</span>
        <span>Users</span>
        <span>Last update</span>
        <span>Status</span>
      </div>
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {ISSUERS.map((i) => (
          <div
            key={i.name}
            className="grid grid-cols-[160px_minmax(140px,1fr)_minmax(140px,1fr)_120px_140px_140px] items-center gap-4 px-4 py-3 hover:bg-[var(--color-surface-deep)]"
          >
            <span className="text-[14px] text-[var(--color-ink)]">{i.name}</span>
            <span className="font-mono text-[13px] text-[var(--color-quill)]">{i.pubkey}</span>
            <span className="font-mono text-[13px] text-[var(--color-quill)]">{i.root}</span>
            <span className="font-mono text-[13px] text-[var(--color-ink)] tabular-nums">{i.users.toLocaleString("en-US")}</span>
            <span className="text-[13px] text-[var(--color-stone)]">{i.lastUpdate}</span>
            <StatusPill tone={TONE[i.status]}>{LABEL[i.status]}</StatusPill>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the page**

Create `frontend/src/app/dashboard/counterparties/page.tsx`:

```tsx
import { TopBar } from "@/components/dashboard/top-bar";
import { CounterpartiesTable } from "@/components/dashboard/counterparties-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Counterparties" };

export default function CounterpartiesPage() {
  return (
    <>
      <TopBar
        title="Counterparties"
        subtitle="Issuers that have published a Merkle root your policies trust."
      />
      <main className="p-8">
        <div className="mb-6 flex justify-end">
          <Button variant="primary" size="md">Register issuer →</Button>
        </div>
        <CounterpartiesTable />
      </main>
    </>
  );
}
```

- [ ] **Step 3: Visual + checks + commit**

`pnpm dev` — open `/dashboard/counterparties`. Confirm rows render with correct status pills (Active/Stale/Test). Each pill shows Iconoir glyph + label, no colored dot.

```bash
pnpm typecheck && pnpm lint && pnpm build
git add frontend/src/components/dashboard/ frontend/src/app/dashboard/
git commit -m "$(cat <<'EOF'
feat: Build /dashboard/counterparties Tier A page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 26: /dashboard/audit-log (Tier A)

**Files:**
- Create: `frontend/src/components/dashboard/audit-table.tsx`
- Create: `frontend/src/app/dashboard/audit-log/page.tsx`

- [ ] **Step 1: Build audit table**

Create `frontend/src/components/dashboard/audit-table.tsx`:

```tsx
import { generateAuditRows } from "@/lib/mock-data";
import { StatusPill } from "./status-pill";
import { fmtAmount } from "@/lib/format";

export function AuditTable() {
  const rows = generateAuditRows({ seed: 23, count: 50 });
  return (
    <div className="rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-canvas)] overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)] font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            {["Time","Wallet","Issuer","Status","Amount","Juris.","Proof hash","Block","Slot","CU","Tx"].map((h) => (
              <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-[var(--color-surface-deep)]">
              <td className="px-3 py-3 font-mono text-[12px] text-[var(--color-muted)]">
                {new Date(r.timestamp).toISOString().slice(11, 19)}
              </td>
              <td className="px-3 py-3 font-mono text-[13px] text-[var(--color-ink)]">{r.wallet}</td>
              <td className="px-3 py-3 text-[13px] text-[var(--color-quill)]">{r.issuer}</td>
              <td className="px-3 py-3">
                <StatusPill tone={r.status === "verified" ? "verified" : "blocked"}>
                  {r.status === "verified" ? "Verified" : "Blocked"}
                </StatusPill>
              </td>
              <td className="px-3 py-3 font-mono text-[13px] text-[var(--color-ink)] tabular-nums">{fmtAmount(r.amount, r.currency)}</td>
              <td className="px-3 py-3 font-mono text-[12px] text-[var(--color-quill)]">{r.jurisdiction}</td>
              <td className="px-3 py-3 font-mono text-[12px] text-[var(--color-quill)]">{r.proofHash}</td>
              <td className="px-3 py-3 font-mono text-[12px] text-[var(--color-quill)] tabular-nums">{r.block.toLocaleString("en-US")}</td>
              <td className="px-3 py-3 font-mono text-[12px] text-[var(--color-quill)] tabular-nums">{r.slot.toLocaleString("en-US")}</td>
              <td className="px-3 py-3 font-mono text-[12px] text-[var(--color-quill)] tabular-nums">{r.cuConsumed.toLocaleString("en-US")}</td>
              <td className="px-3 py-3">
                <a
                  href={`https://solscan.io/tx/${r.txSig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener"
                  className="text-[var(--color-muted)] hover:text-[var(--color-forest)] underline-offset-4 hover:underline"
                >↗</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Build the page**

Create `frontend/src/app/dashboard/audit-log/page.tsx`:

```tsx
import { TopBar } from "@/components/dashboard/top-bar";
import { AuditTable } from "@/components/dashboard/audit-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Audit log" };

export default function AuditLogPage() {
  return (
    <>
      <TopBar
        title="Audit log"
        subtitle="Every attestation, exportable on request."
      />
      <main className="p-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="md">All time</Button>
          <Button variant="secondary" size="md">All issuers</Button>
          <Button variant="secondary" size="md">All statuses</Button>
          <Button variant="secondary" size="md">All jurisdictions</Button>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="md">Export CSV</Button>
            <Button variant="ghost" size="md">Export JSON</Button>
            <Button variant="ghost" size="md">Webhook digest</Button>
          </div>
        </div>
        <AuditTable />
        <div className="mt-6 flex items-center justify-between font-mono text-[12px] text-[var(--color-muted)]">
          <span>Showing 50 of 23,481 attestations · Last 30 days</span>
          <span>← 1 2 3 ... 47 →</span>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Visual + checks + commit**

`pnpm dev` — `/dashboard/audit-log`. Confirm dense table with all columns, mono numbers right-aligned-ish, status pills. Filter buttons render but are non-functional (per spec).

```bash
pnpm typecheck && pnpm lint && pnpm build
git add frontend/src/components/dashboard/ frontend/src/app/dashboard/
git commit -m "$(cat <<'EOF'
feat: Build /dashboard/audit-log Tier A page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 27: /dashboard/billing (Tier A)

**Files:**
- Create: `frontend/src/components/dashboard/billing-cards.tsx`, `frontend/src/components/dashboard/usage-chart.tsx`
- Create: `frontend/src/app/dashboard/billing/page.tsx`

- [ ] **Step 1: Usage chart (pure SVG line, no chart lib)**

Create `frontend/src/components/dashboard/usage-chart.tsx`:

```tsx
import { BILLING_USAGE } from "@/lib/mock-data";

export function UsageChart() {
  const w = 720;
  const h = 200;
  const pad = 24;
  const max = Math.max(...BILLING_USAGE.map((d) => d.proofs));
  const xs = (i: number) => pad + (i / (BILLING_USAGE.length - 1)) * (w - 2 * pad);
  const ys = (v: number) => h - pad - (v / max) * (h - 2 * pad);

  const path = BILLING_USAGE
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(1)} ${ys(d.proofs).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="30-day usage" className="w-full h-auto">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line
          key={g}
          x1={pad}
          y1={ys(max * g)}
          x2={w - pad}
          y2={ys(max * g)}
          stroke="var(--color-border-subtle)"
          strokeWidth="1"
        />
      ))}
      <path d={path} fill="none" stroke="var(--color-forest)" strokeWidth="1.5" />
      {BILLING_USAGE.map((d, i) => (
        i % 5 === 0 && (
          <text
            key={d.day}
            x={xs(i)}
            y={h - 4}
            fontSize="10"
            fontFamily="var(--font-mono)"
            fill="var(--color-muted)"
            textAnchor="middle"
          >{`d${d.day}`}</text>
        )
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Billing cards**

Create `frontend/src/components/dashboard/billing-cards.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { UsageChart } from "./usage-chart";
import { BILLING_USAGE } from "@/lib/mock-data";

export function BillingCards() {
  const used = BILLING_USAGE.reduce((a, b) => a + b.proofs, 0);
  const tier = 50_000;
  const pct = Math.round((used / tier) * 100);
  return (
    <div className="space-y-6">
      <div className="rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
          Current tier
        </div>
        <div className="mt-2 font-[family-name:var(--font-display)] text-[28px] text-[var(--color-ink)]">
          Startup · 50,000 proofs/mo · $0.05/proof
        </div>
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-deep)]">
          <div className="h-full bg-[var(--color-forest)]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 font-mono text-[13px] text-[var(--color-stone)]">
          Used this month: {used.toLocaleString("en-US")} ({pct}%)
        </div>
      </div>

      <div className="rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
          Last 30 days
        </div>
        <div className="mt-4">
          <UsageChart />
        </div>
      </div>

      <div className="rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
          Invoices
        </div>
        <ul className="mt-4 divide-y divide-[var(--color-border-subtle)]">
          {["2026-04", "2026-03", "2026-02"].map((m) => (
            <li key={m} className="flex items-center justify-between py-3">
              <span className="font-mono text-[14px] text-[var(--color-ink)]">{m}</span>
              <Button variant="ghost" size="md">Download PDF</Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build the page**

Create `frontend/src/app/dashboard/billing/page.tsx`:

```tsx
import { TopBar } from "@/components/dashboard/top-bar";
import { BillingCards } from "@/components/dashboard/billing-cards";

export const metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <>
      <TopBar title="Billing" subtitle="Pay for what you prove." />
      <main className="p-8 max-w-[840px]">
        <BillingCards />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Visual + checks + commit**

`pnpm dev` — `/dashboard/billing`. Confirm: tier card with progress bar, line chart of 30 days renders, invoices stack.

```bash
pnpm typecheck && pnpm lint && pnpm build
git add frontend/src/components/dashboard/ frontend/src/app/dashboard/
git commit -m "$(cat <<'EOF'
feat: Build /dashboard/billing Tier A page with usage chart

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 6 — Tier B scaffolds + a11y + mobile

## Task 28: TierBScaffold + 4 scaffold pages

**Files:**
- Create: `frontend/src/components/dashboard/tier-b-scaffold.tsx`
- Create: `frontend/src/app/dashboard/attestations/page.tsx`, `policies/page.tsx`, `api-keys/page.tsx`, `team/page.tsx`

- [ ] **Step 1: Build the shared scaffold**

Create `frontend/src/components/dashboard/tier-b-scaffold.tsx`:

```tsx
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";

export function TierBScaffold({
  Icon,
  title,
  body,
}: {
  Icon: ComponentType<{ width?: number; height?: number; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <main className="grid place-items-center p-16 min-h-[60vh]">
      <div className="flex max-w-[420px] flex-col items-center text-center">
        <Icon width={64} height={64} strokeWidth={1.5} />
        <h2 className="mt-6 font-[family-name:var(--font-display)] text-[32px] leading-[1.1] text-[var(--color-ink)]">
          {title}
        </h2>
        <p className="mt-3 text-[15px] text-[var(--color-stone)]">{body}</p>
        <div className="mt-8">
          <Button variant="ghost" size="md">Request access ↗</Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build the 4 scaffold pages**

Create `frontend/src/app/dashboard/attestations/page.tsx`:

```tsx
import { Check } from "iconoir-react";
import { TopBar } from "@/components/dashboard/top-bar";
import { TierBScaffold } from "@/components/dashboard/tier-b-scaffold";

export const metadata = { title: "Attestations" };

export default function Page() {
  return (
    <>
      <TopBar title="Attestations" subtitle="Inspect every ComplianceAttestation written on-chain." />
      <TierBScaffold
        Icon={Check}
        title="Attestation explorer · coming soon"
        body="Filter, search, and inspect every ComplianceAttestation. Available to private-beta participants."
      />
    </>
  );
}
```

Create `frontend/src/app/dashboard/policies/page.tsx`:

```tsx
import { Page } from "iconoir-react";
import { TopBar } from "@/components/dashboard/top-bar";
import { TierBScaffold } from "@/components/dashboard/tier-b-scaffold";

export const metadata = { title: "Policies" };

export default function PoliciesPage() {
  return (
    <>
      <TopBar title="Policies" subtitle="Per-mint compliance rules. Jurisdiction. Risk tier. Amount caps." />
      <TierBScaffold
        Icon={Page}
        title="Policy editor · coming soon"
        body="Configure compliance policies per token mint. Available to private-beta participants."
      />
    </>
  );
}
```

Create `frontend/src/app/dashboard/api-keys/page.tsx`:

```tsx
import { Key } from "iconoir-react";
import { TopBar } from "@/components/dashboard/top-bar";
import { TierBScaffold } from "@/components/dashboard/tier-b-scaffold";

export const metadata = { title: "API keys" };

export default function ApiKeysPage() {
  return (
    <>
      <TopBar title="API keys" subtitle="Programmatic access to ZKSettle." />
      <TierBScaffold
        Icon={Key}
        title="API key management · coming soon"
        body="Provision, rotate, and scope API keys. Available to private-beta participants."
      />
    </>
  );
}
```

Create `frontend/src/app/dashboard/team/page.tsx`:

```tsx
import { Group } from "iconoir-react";
import { TopBar } from "@/components/dashboard/top-bar";
import { TierBScaffold } from "@/components/dashboard/tier-b-scaffold";

export const metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <TopBar title="Team" subtitle="People with access to this workspace." />
      <TierBScaffold
        Icon={Group}
        title="Team management · coming soon"
        body="Invite teammates and assign roles. Available to private-beta participants."
      />
    </>
  );
}
```

- [ ] **Step 3: Visual + checks**

`pnpm dev` — click each Tier B nav item. All 4 should render the scaffold with their respective icon + title + body.

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/ frontend/src/app/dashboard/
git commit -m "$(cat <<'EOF'
feat: Add TierBScaffold and 4 Tier B dashboard pages

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 29: Mobile fallbacks audit

**Files:**
- Modify: `frontend/src/components/landing/two-realities-section.tsx` (remove pin on small screens)
- Modify: `frontend/src/components/landing/hero/veil-canvas.tsx` (already adapts, verify)
- Modify: any section with overflow problems

- [ ] **Step 1: Update Two Realities mobile path**

In `two-realities-section.tsx`, ensure the section has `style={{ height: reduced ? "auto" : "200vh" }}` for desktop and `auto` on small screens. Use a media query class:

Patch the wrapper:

```tsx
<section
  ref={wrap}
  className="relative md:min-h-[200vh]"
  style={{ height: reduced ? "auto" : undefined }}
>
```

And inside the GSAP `useEffect`, gate the trigger creation by `window.matchMedia("(min-width: 768px)").matches`:

```ts
if (reduced || !wrap.current) return;
if (!window.matchMedia("(min-width: 768px)").matches) return;
```

- [ ] **Step 2: Test mobile via dev tools**

`pnpm dev`. Open Chrome DevTools, toggle device emulation (iPhone 14 Pro). Confirm:
- Hero: text scales (clamp), VeilCanvas runs with reduced particle count (3000), no horizontal scroll.
- Paradox: column reads at 720px max; text fits.
- Two Realities: cards stack vertically, no pin, both visible.
- Numbers: 1-column instead of 2x2.
- Demo: form + console stack.
- Use cases: 1-column.
- SDK: code block + side panel stack.
- Momentum: 3 columns become 3 stacked.
- Closing CTA: looks fine.
- Dashboard: sidebar collapses (if needed) — for v1 keep sidebar always visible at 240px; below 640px the page can scroll horizontally — acceptable for the MVP.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/
git commit -m "$(cat <<'EOF'
fix: Disable Two Realities pin on mobile; verify mobile layouts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 30: Accessibility pass

**Files:**
- Modify: `frontend/src/app/layout.tsx` (skip-link target id check), various components

- [ ] **Step 1: Confirm skip link target exists**

Open `src/app/page.tsx`. Confirm `<main id="main">` is present (already added in Task 11). Same for dashboard layout — add `id="main-content"` to the main wrapper if missing:

```tsx
<div id="main-content" className="flex-1 min-h-screen bg-[var(--color-canvas)]">{children}</div>
```

(Update `globals.css` skip-to-content href if needed — currently `href="#main"`. Use `#main` consistently or add a second anchor for dashboard.)

- [ ] **Step 2: Verify keyboard nav**

`pnpm dev`. Tab through landing: Skip-link → Logo → nav links → CTAs → into sections → into demo form. All focusable items show forest 2px outline. Enter activates buttons. Esc does nothing harmful.

- [ ] **Step 3: Verify screen reader labels**

Open landing in Chrome with the Lighthouse a11y audit:

```bash
pnpm dlx lighthouse http://localhost:3000 --only-categories=accessibility --view
```

Fix any flagged issues (missing alt, low contrast). Expected score ≥ 95.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "$(cat <<'EOF'
chore: A11y pass — skip link target, focus states verified

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 7 — Pitch ready

## Task 31: OG image + favicon polish + SEO metadata

**Files:**
- Create: `frontend/public/og.png` (1200×630)
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Create OG image**

Generate a 1200×630 PNG with:
- Background: `#0C3D2E` (forest)
- Centered Seal logo + wordmark in `#FAFAF7`
- Subline below: `Compliance-grade rails for stablecoin settlement.` in Georgia 56px

Either: (a) draw in any vector tool and export, or (b) write a one-off Node script using `@napi-rs/canvas`. Save to `frontend/public/og.png`.

If skipping the image asset for now, fall back to a route-handler:

Create `frontend/src/app/og/route.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", background: "#0C3D2E", color: "#FAFAF7",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 400 }}>ZKSettle</div>
        <div style={{ fontSize: 36, marginTop: 24, opacity: 0.85 }}>
          Compliance-grade rails for stablecoin settlement.
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
```

Update `metadata.openGraph.images` in `src/app/layout.tsx` to `["/og"]`.

- [ ] **Step 2: Verify OG**

`pnpm dev`. Visit `/og` directly. Confirm an image renders. Submit `http://localhost:3000` to <https://www.opengraph.xyz/> — confirm preview correct.

- [ ] **Step 3: Commit**

```bash
git add frontend/public/ frontend/src/app/
git commit -m "$(cat <<'EOF'
feat: Add OG image route and wire into metadata

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 32: Lighthouse pass + performance fixes

- [ ] **Step 1: Run Lighthouse on landing**

```bash
pnpm build && pnpm start &
sleep 3
pnpm dlx lighthouse http://localhost:3000 --output=html --output-path=./lighthouse-landing.html --view
```

Targets per spec §6.4:
- Performance ≥ 85
- A11y ≥ 95
- SEO ≥ 95
- LCP < 2.5s
- INP < 200ms

- [ ] **Step 2: Fix anything below targets**

Common quick wins:
- Add `loading="lazy"` to below-fold images.
- Ensure `next/font` `display: swap` is set (it is by default for Geist + Google fonts).
- Check Three.js bundle isn't dragging dead code — confirm `import * as THREE from "three"` is tree-shaken; if not, switch to named imports for what's used.
- Confirm `next.config.ts` has `experimental: { optimizePackageImports: ["iconoir-react"] }`.

If LCP is high, the hero text (display heading) is likely the LCP element — add `priority` data and ensure font is preloaded:

```tsx
// In layout.tsx, the geist + jetbrains font registrations already preload.
```

- [ ] **Step 3: Run Lighthouse on dashboard**

```bash
pnpm dlx lighthouse http://localhost:3000/dashboard/transactions --output=html --output-path=./lighthouse-dashboard.html --view
```

Same targets. Dashboard should easily pass since no WebGL.

- [ ] **Step 4: Commit fixes**

If any code changes were required:

```bash
git add frontend/
git commit -m "$(cat <<'EOF'
perf: Lighthouse fixes for landing + dashboard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 33: Cross-browser smoke test

- [ ] **Step 1: Manual smoke checklist**

For each of Chrome (latest), Safari (latest macOS), Firefox (latest), iOS Safari 17+, Android Chrome:

- Landing loads, hero canvas renders (or static fallback), no console errors.
- Scroll through all 10 sections — fades + Two Realities pin work.
- Demo flow: click Generate proof, see 4-step animation, submit-to-devnet button appears, link opens Solscan.
- Try expired credential, see danger error.
- Open `/dashboard`, redirect lands on `/dashboard/transactions`. Sidebar nav works. Click each Tier A page. Click each Tier B page.
- Cmd-K visual hint shows but is non-functional.

Document any issues found in a checklist comment in the next commit. Fix blockers; defer cosmetic.

- [ ] **Step 2: Commit any fixes**

```bash
git add frontend/
git commit -m "$(cat <<'EOF'
fix: Cross-browser tweaks from manual smoke

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Skip if no fixes needed.)

---

## Task 34: Vercel deploy + README final

**Files:**
- Modify: `frontend/README.md`

- [ ] **Step 1: Final README**

Update `frontend/README.md`:

```markdown
# ZKSettle Frontend

Marketing landing page + read-only dashboard for ZKSettle, the zero-knowledge compliance API for stablecoins on Solana. Built for Colosseum Frontier 2026.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Three.js · GSAP · motion · Shiki · Iconoir · Geist + Berkeley Mono fallback.

## Run

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Build

```bash
pnpm build
pnpm start
```

## Test

```bash
pnpm test          # vitest
pnpm typecheck     # tsc --noEmit
pnpm lint          # next lint
```

## Deploy

Push to `main` — Vercel auto-deploys. Production: <https://zksettle.com> (or `https://zksettle.vercel.app` fallback).

## Design system

- Spec: `../docs/superpowers/specs/2026-04-18-zksettle-landing-design.md`
- Source of truth: <https://claude.ai/design/p/428580d1-b5d6-429a-bea0-0ba1069a5d96>
```

- [ ] **Step 2: Deploy**

If team has the Vercel CLI configured:

```bash
cd /home/mario/zksettle/frontend
pnpm dlx vercel --prod
```

Otherwise: push branch, open PR, let Vercel preview deploy. Confirm preview URL works.

- [ ] **Step 3: Verify production URL**

Open the deployed URL. Smoke same checklist as Task 33.

- [ ] **Step 4: Commit**

```bash
git add frontend/README.md
git commit -m "$(cat <<'EOF'
docs: Final README with deploy instructions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done

- 10-section editorial landing with Veil hero + Two Realities pinned scroll + interactive simulated demo.
- 8-route dashboard (4 Tier A built fully + 4 Tier B scaffolded) with live-pushing transactions.
- Design system fully aligned: The Seal, Iconoir, forest accent ≤ 8%, voice DO/DON'T enforced.
- Lighthouse all green, cross-browser smoke clean, Vercel deployed.

Submit by 2026-05-11.

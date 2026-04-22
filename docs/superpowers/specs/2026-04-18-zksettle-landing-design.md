# ZKSettle Landing + Dashboard — Design Spec

**Date:** 2026-04-18
**Owner:** Mario
**Status:** Approved (pre-implementation)
**Scope:** Frontend marketing surface (landing) + navigable read-only dashboard for the Colosseum Frontier 2026 submission.
**Deadline alignment:** PRD §12 plan, submit by 2026-05-11.

---

## 0. Context

ZKSettle is a zero-knowledge compliance API for stablecoins on Solana (see [`zksettle_prd.md`](../../../zksettle_prd.md), [`zksettle_pitch.md`](../../../zksettle_pitch.md)). The frontend has two surfaces:

1. **Landing page** — sells the product to Colosseum judges, investors, and stablecoin fintechs. Optimized for the 2–3 minute pitch video and cold inbound.
2. **Dashboard** — a navigable read-only product preview using mocked data, lets investors and devs *feel* the product without backend dependencies.

This spec freezes design, copy, IA, stack, and scope before writing the implementation plan.

---

## 1. Goals & Non-Goals

### Goals

- Land an opinionated, single-claim hero that judges remember: **"Settle in 181ms, audit for life."**
- Make the ZK-vs-no-ZK paradox viscerally legible in one scrollable section ("Two Realities").
- Ship a high-fidelity simulated demo that survives technical scrutiny without requiring the backend SDK to be production-ready by 2026-05-11.
- Give investors a clickable dashboard that proves operational thinking, not just marketing.
- Hit Awwwards-tier visual quality in the editorial / cinematic tradition (Apple, Anthropic, OpenAI DevDay), not generic SaaS.

### Non-Goals (explicit)

- Real authentication, sessions, or persistent state.
- Real backend API or WebSocket. All data is local mock.
- Dark mode toggle. Bone canvas is the brand.
- Internationalization toggle. EN-only for v1.
- MDX docs site. Footer links to GitHub README.
- Real CSV/JSON export. Buttons exist; clicks land on "request access" copy.
- Pricing page. PRD §10 covers tiering; landing references it but doesn't dedicate a route.
- Vercel Analytics, Plausible, or any tracking. Add 1-line in v0.2 if needed.
- Automated E2E tests. Manual smoke before submit.

---

## 2. Decisions log (locked, no re-litigation)

| # | Decision | Rationale |
|---|---|---|
| D1 | Landing-first scope; dashboard is a navigable preview | Optimizes for Colosseum judges + pitch video; PRD lists dashboard as "Importante" not "Crítico" |
| D2 | Cinematic editorial direction (Apple / Anthropic / OpenAI DevDay) | Pinned scroll narrative wins editorial trust; max two WebGL "moments" keeps it shippable |
| D3 | Demo simulated with high fidelity (real timer, real proof bytes, real devnet tx link) | Decouples landing from SDK readiness; honest framing avoids "fake" perception |
| D4 | EN-only copy | Single source of truth; Colosseum is global English-first; PT-BR deferred |
| D5 | Stack: Next.js 15 App Router · Tailwind v4 · shadcn/ui (heavy custom) · GSAP · Three.js vanilla · motion v11 · Shiki · pnpm | Modern + ship-fast + bundle-controllable |
| D6 | Visual metaphor: "The Veil" hero (particles → commitment glyph) + "Two Realities" pedagogical split | Carries ZK concept visually; novel in Solana ecosystem |
| D7 | IA-1 fused (problem-led 10-section sequence with hero CTA jumping to demo) | Pitch-friendly narrative; demo accessible from hero |
| D8 | Typography: Georgia 400 (display, system) · Geist (body) · Berkeley Mono (mono/code/proof bytes). Path to upgrade display to PP Editorial New via single CSS variable. | Display serif = regulatory authority; Georgia ships zero font-licensing risk and zero FOUT for v1 |
| D9 | Color: bone canvas (`#FAFAF7`) + 5-step text greys (Ink/Quill/Stone/Muted/Ghost) + Forest accent (`#0C3D2E`) ≤ 8% + Warning/Danger/Info semantic states ≤ 2% combined | Restraint = Awwwards discipline; forest carries compliance/regulatory authority without crypto cliché |
| D10 | Dashboard chrome follows the design system's 8-route IA across 3 groups (Overview/Controls/Account); 4 routes Tier A built fully, 4 routes Tier B scaffolded as empty states | Honors design-system canon while keeping build effort near the original 4-page estimate |
| D11 | Adopt the team's published design system (claude.ai/design/p/428580d1) as the source of truth: The Seal logo, Iconoir v7 iconography, all token names, voice DO/DON'T | Avoids re-inventing decisions already made; keeps frontend coherent with team-approved system |

---

## 3. Identity & design system

### 3.1 Logo — "The Seal"

The brand mark is **The Seal**: a circular hairline forest seal struck through by a horizontal settlement bar that cancels a serif `Z`. Built like an engraver's plate, with registration ticks at 12, 3, 6, and 9 o'clock.

- **Construction:** thin forest ring (1.25px stroke at default), with a serif `Z` centered, and a forest settlement bar (2.5px) horizontal across its midpoint. Registration ticks at the four cardinal points sit on the ring.
- **Hairline + bold strokes deliberately:** reads at 16px (favicon) and carves correctly at 200px (hero placement).
- **Three usage variants** (all maintain ≤8% forest discipline):
  - **Canvas · Ink** — default: canvas bg, ink seal + ink wordmark
  - **Surface · Forest** — secondary: surface bg, forest seal + ink wordmark
  - **Forest · Surface** — inverted: forest bg, surface-color seal + surface wordmark (closing CTA panel, OG image)
- **Wordmark** sits to the right of the seal: `ZKSettle` in display serif (Georgia until brand fonts uploaded; see §3.4), regular weight, tracking -1%.
- **Lockup spacing:** seal-to-wordmark gap = seal diameter × 0.4.
- **Asset location:** `src/components/icons/logo.tsx` (React component, props for variant + size).
- **Files:** `public/favicon.svg` (seal only) · `public/og.png` (lockup, Forest · Surface variant).

### 3.2 Brand voice

**Institutional. Specific. Anti-crypto-bro.** Built for treasuries, not traders.

- Headlines are sentences with a period. Periods make claims.
- Numbers are facts: `<5s`, `<$0.001`, `0`, `256 bytes`, `$9T`, `$650B`. Never rounded vaguely.
- Italic forest "em" on numeric or named primitives within display copy (e.g. *181ms*, *Groth16*, *settlement*).

**Do**

- "Settle in 181ms. Audit for life."
- "Every payment ships with its proof attached."
- "Built for treasuries, not traders."
- "Compliance-grade rails for stablecoin settlement."

**Don't**

- "Revolutionary on-chain infrastructure 🚀"
- "Disrupting the future of money, wagmi."
- "Web3-native, blockchain-powered payments."
- "The only crypto platform you'll ever need."

No emoji in product UI. No "Web3" / "wagmi" / "to the moon" / "revolutionary" / "disrupting." If a sentence could appear unchanged on a generic crypto landing, rewrite it.

### 3.3 Color tokens (CSS custom properties)

Backgrounds & borders — warm whites, never pure `#FFF`:

```
--canvas         #FAFAF7    page background
--surface        #F5F3EE    cards, sections
--surface-deep   #EFEDE8    nested cards, code blocks
--border-subtle  #E8E5DF    hairlines inside cards
--border         #C8C4BC    section dividers, table separators
```

Text — five grey levels, named by editorial weight:

```
--ink            #1A1917    body text (highest contrast)
--quill          #4A4640    strong secondary, table headers
--stone          #6B6762    secondary text, captions
--muted          #8A8880    tertiary, axis labels
--ghost          #B4B0A8    placeholders, disabled
```

Forest accent — the ≤ 8% pixel rule applies to *every* page:

```
--forest         #0C3D2E    CTA, verified, eyebrow, link
--forest-hover   #0F4D38    primary button hover
--emerald        #1A6B4A    success dot, verified hash
--mint           #E8F2EE    success bg, active nav state
```

Semantic — for cards, inline alerts, and toast states (≤ 2% combined):

```
--warning-bg     #FBF4E8    consent expiring, stale issuer
--warning-text   #7A5C1E
--danger-bg      #FAF0EF    proof failed, blocked tx
--danger-text    #BC2A24
--info-bg        #EEF4FC    webhook info, neutral notice
--info-text      #2563A8
```

Semantic states always carry an Iconoir glyph next to their text — never a colored dot alone.

### 3.4 Typography scale

**Display:** Georgia 400 (system serif). The design system explicitly chose Georgia over a licensed serif for two reasons: zero font-licensing risk, zero font-loading FOUT on the hero. If the team licenses **PP Editorial New** later, swap by replacing the `--font-display` CSS variable — no other changes needed.

**Body & UI:** Geist (regular + medium). Self-hosted via `next/font`.

**Mono:** Berkeley Mono (preferred) or **JetBrains Mono** as free fallback. Mono is *obligatory* for any financial datum: hashes, proof bytes, amounts, slot numbers, CU costs, addresses.

| Token | Font | Size | Line | Tracking | Use |
|---|---|---|---|---|---|
| display-xl | Georgia 400 | clamp(56px, 7vw, 128px) | 0.95 | -3.5% | Hero |
| display-l | Georgia 400 | clamp(40px, 5vw, 72px) | 1.03 | -3.5% | Section heads |
| display-m | Georgia 400 | 32–48px | 1.05 | -2% | Card heads |
| body-l | Geist Regular | 22px | 1.45 | normal | Editorial paragraph |
| body | Geist Regular | 16px | 1.55 | normal | UI |
| body-s | Geist Regular | 14px | 1.5 | normal | Captions, table cells |
| eyebrow | Berkeley Mono Medium | 12px UPPER | 1.2 | +8% | Section eyebrow, sits above a 20px forest rule, color forest |
| mono | Berkeley Mono Regular | 14px | 1.5 | normal | Proof bytes, hashes, code, financial data |
| mono-l | Berkeley Mono Regular | 18–22px | 1.4 | normal | Big number sub-labels |

Display "em" — italic in `--forest` — is the brand's emphasis primitive. Use sparingly: one *em* per headline maximum.

### 3.5 Spacing, radii & elevation

**Spacing scale** (base 4 · 12 steps): `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160 · 200`.

**Radii:** `2 · 3 · 6 · 10 · full`.
- `2` — input borders, status pills
- `3` — buttons
- `6` — cards
- `10` — modals, large surfaces
- `full` — only avatars

**Elevation: borders do the work, not shadows.** Stack uses `--border-subtle` and `--border` to separate content. Drop shadows allowed only for: (a) modal scrim, (b) sticky nav `0 1px 0 var(--border-subtle)` on scroll. Otherwise prohibited.

**Layout grid**
- Editorial column max-width 720px (paragraphs).
- Wide content max-width 1200px.
- Section vertical rhythm 160px desktop / 96px mobile.
- Outer page gutter 32px desktop / 20px mobile.

### 3.6 Iconography

**Library:** [Iconoir](https://iconoir.com) v7 via `iconoir-react` — MIT-licensed hairline set, 1.5px stroke on a 24px grid. Editorial feel, slightly eccentric geometry. Pairs naturally with Georgia display.

- Color inherits from `currentColor` so semantic tokens drive icon color.
- Sizes: `14px` inline · `20px` UI default · `24px` section accents · `32px` empty-states.
- Status pills always carry an Iconoir glyph next to text — never a colored dot alone. (Forest dots ARE allowed in the Live Feed sidebar marker, see §5.)
- Custom icons (the wordmark seal, the §1 commitment glyph): bespoke SVGs in `src/components/icons/` matching Iconoir's 1.5px stroke convention so they read as part of the same family.

**Anti-patterns (never use):**

- Other icon libraries: Lucide, Heroicons, Phosphor, Feather, Material Symbols
- Crypto clichés: padlocks, shields, 3D coins, hexagon grids, connected nodes, "blockchain cubes"
- Emoji in product UI
- Filled icons (only stroked variants)

### 3.7 Motion philosophy

- Default easing `cubic-bezier(0.32, 0.72, 0, 1)` (Apple-style).
- Durations: micro 200ms · standard 480ms · scroll-locked 800ms+.
- Scroll-locked pin via GSAP ScrollTrigger.
- WebGL via Three.js vanilla (no R3F).
- `prefers-reduced-motion` disables all pin/scrub and WebGL; replaces shaders with static rendered frame; keeps fade-in.
- 60fps target on M1-mid laptop. Below 50fps for 2s → auto-downgrade particle count.

---

## 4. Landing — sections, copy, visual & motion

The 10 sections in render order.

### §1 Hero · The Veil

- **Eyebrow:** `ZKSETTLE · COMPLIANCE INFRASTRUCTURE`
- **Headline:** Settle in 181ms, audit for life.
- **Sub:** Zero-knowledge proofs for stablecoin compliance on Solana. Travel rule, sanctions, jurisdiction — proven on-chain, never revealed.
- **CTAs:** `Try the demo →` (forest primary, smooth-scroll to §6) · `Read the spec` (ghost link to GitHub README).
- **Visual:** Three.js full-bleed canvas behind the text. ~12k warm-ash particles drifting on canvas-bg color. As scroll progress crosses the section, particles converge into a single small forest commitment glyph at the screen center, mid-text height. Concept: "input dust → public commitment."
- **Motion:** Hero pinned for first 100vh of scroll. Headline fades in word-by-word; sub fades after 600ms; CTAs after 1200ms. WebGL scroll progress drives particle convergence (0→1 over the pin).

### §2 The Paradox

- **Eyebrow:** `THE PROBLEM`
- **Headline:** A paradox worth nine trillion dollars.
- **Body (~720px column):** Stablecoins moved $9T in 2025. Every fintech that enters the market spends six months and half a million dollars rebuilding the same compliance pipeline. The reason is structural: travel rule demands disclosure on a public ledger. Privacy law forbids it. Until 2025, there was no way out.
- **Visual:** Pure typography. Canvas color, no chrome.
- **Motion:** Pinned. Headline pins at top; body paragraphs fade in line-by-line as scroll progresses through the pin window.

### §3 Two Realities

- **Eyebrow:** `WITH ZK · WITHOUT ZK`
- **Headline:** Same transaction. Two realities.
- **Layout:** Pinned scroll, two-column split.
  - **Left ("Without ZK")** card on `surface`: rows reading `Recipient: Maria Silva` · `Tax ID: 123.456.789-00` · `Country: BR` · `Amount: $5,200 USDC`. Below: Danger pill (Iconoir `Warning triangle` + label `VIOLATES GDPR · LGPD · MiCA`, `--danger-bg` / `--danger-text`).
  - **Right ("With ZK")** card on `surface`: same field labels, but values rendered as redacted blocks `▓▓▓▓▓▓▓`. Below the fields: `Proof: 0xa3f8...c91b` in mono forest, with an Iconoir `Check` glyph. Below: Forest pill (Iconoir `Check` + label `COMPLIANT · VERIFIED`, `--mint` bg, `--forest` text).
- **Caption beneath both:** Both prove the user is verified. Only one can stand in court.
- **Motion:** Section pins. As scroll progresses, the left card's PII characters dissolve top-down into redacted blocks (text-mask reveal), morphing into the right state. Pin releases when both states are fully visible side-by-side.
- **Mobile fallback:** stacked, no pin. Cards animate in sequentially on scroll.

### §4 How it works

- **Eyebrow:** `HOW IT WORKS`
- **Headline:** Verify once. Prove anywhere.
- **Three steps, vertical with hairline divider between:**
  - `01 · Verify once.` User completes KYC with an issuer. The issuer signs a credential and adds the wallet to a private Merkle tree. Only the root is published on-chain.
  - `02 · Prove anywhere.` When transferring, the user generates a Groth16 proof in the browser. No data leaves the device. Average proving time: under five seconds.
  - `03 · Verify on-chain.` A Transfer Hook intercepts the SPL transfer, verifies the proof via `alt_bn128` syscalls, and writes a ComplianceAttestation. Cost: under $0.001.
- **Visual:** Inline SVG diagram per step (Merkle tree silhouette, browser → wallet glyph, hook chain). Forest hairline connects all three steps vertically.
- **Motion:** Each step fades in sequentially as it enters viewport. SVG diagrams animate with `stroke-dasharray` reveal.

### §5 Live numbers · Benchmarks

- **Eyebrow:** `BENCHMARKS`
- **Headline:** Math, measured.
- **Layout:** 4 numbers in 2×2 grid, each in display-xl with mono-l sub-label below.
  - `<5s` · `In-browser proving · Groth16 BN254`
  - `<$0.001` · `On-chain verification · Devnet`
  - `0` · `PII written to the ledger`
  - `256 bytes` · `Proof size · Constant`
- **Motion:** Each number counts up from 0 on scroll-in (CountUp component). The `<5s` and `0` cases tease (e.g. `9.99 → <5s`) instead of straight count.

### §6 Demo · simulated

- **Eyebrow:** `TRY IT`
- **Headline:** Generate a compliant transfer.
- **Layout:** Two-column.
  - **Left (form):** `Recipient wallet: 5g8H4nP3eR...` (pre-filled, editable). `Amount: 1,200 USDC` (slider, 100–10,000). `Jurisdiction: US ▾` (dropdown US/EU/UK/BR). Forest button `Generate proof`.
  - **Right (proof console):** Berkeley Mono terminal-style block on `surface-deep`. Initially shows `// Click "Generate proof" to begin`.
- **Generate flow on click:**
  ```
  [1/4] Loading credential ......... ok
  [2/4] Building Merkle path ....... ok
  [3/4] Computing Poseidon hashes .. ok
  [4/4] Generating Groth16 proof ... ok

  proof: 0x8a3f7e2c4b1d9f0a... (256 bytes)
  nullifier: 0x4c91...8e2f
  duration: 4.71s
  ```
  - Steps appear sequentially over real 4.71s wall-clock (sleeps are real, not animated).
  - Hex bytes loaded from `src/lib/proof-bytes.ts` — a pre-generated valid Groth16 proof (delivered by Mario from Noir+Barretenberg Week 2).
- **After proof generation:** button morphs to `Submit to devnet →`. Click → 1.5s pause → terminal appends `Transaction confirmed · 5g8H...nP3e · View on Solscan ↗`. The Solscan link points to a real pre-existing devnet transaction; the tx hash is coordinated with the backend team and stored as a constant in `src/lib/demo-script.ts`.
- **Toggle** below form: `Try with expired credential`. Repeats the flow but [3/4] fails in `--danger-text` `proof rejected · credential expired (block 287,901,433)`.
- **Honesty footer (mono `--muted`, small):** `Simulation. Click "View on Solscan" to verify the hash is real on-chain.`

### §7 Use cases · Beyond travel rule

- **Eyebrow:** `USE CASES`
- **Headline:** One primitive. Five markets.
- **Grid:** 5 cards, layout 3+2.
  - `Travel rule` · $9T stablecoin volume · GENIUS Act · MiCA Q3
  - `Proof of solvency` · Unlock undercollateralized lending in DeFi · $5T addressable
  - `ZK credit score` · Borrow on history, not identity · zero solutions live
  - `AML by behavior` · Prove a clean trail without doxxing the user
  - `Proof of reserves` · Solvency claims without revealing positions · $300B
- **Card style:** `surface` bg, 1px `border-subtle`, padding 32px. Hover lifts 4px with forest 2px `border-bottom`.

### §8 Developers · SDK

- **Eyebrow:** `SDK`
- **Headline:** Three lines of code.
- **Code block (Shiki SSR, custom theme):**
  ```typescript
  import { zksettle } from "@zksettle/sdk";

  const proof = await zksettle.prove(credential);
  const tx    = zksettle.wrap(transferIx, proof);
  await connection.sendTransaction(tx);
  ```
- **Tabs:** `TypeScript · Rust · Anchor CPI` (only TypeScript live in v1; others show "Coming soon · TypeScript first").
- **Side panel:** install command `npm i @zksettle/sdk` (copy button) · version `v0.1.0` · GitHub link · "MIT licensed · Open source from day one"

### §9 Momentum · Why now

- **Eyebrow:** `WHY NOW`
- **Headline:** Three things converged in 2025.
- **Three columns (no card chrome, just hairline divider):**
  - **Regulation** — GENIUS Act signed 2025. MiCA Travel Rule live Q3 2026. Federal compliance obligation, no opt-out.
  - **Stack** — Solana shipped `alt_bn128` syscalls. Verification dropped from millions of CUs to under 200,000. ZK became economically viable.
  - **Volume** — $650B in stablecoins on Solana in February 2026. Growing 14% MoM. Forty-plus fintechs identified, zero with native ZK compliance.
- **Footnote (`--muted` mono small):** `Sources: Solana Foundation · Visa Onchain Analytics · ZKSettle research`

### §10 Closing CTA + Footer

- **Forest full-width panel:**
  - Headline (canvas color on forest bg): Compliance is no longer a six-month moat.
  - Sub: It's an SDK. Integrate in an afternoon. Pay per proof.
  - CTAs: `Start integrating →` (canvas-on-forest inverted) · `View on GitHub` (ghost canvas-outlined)
- **Footer (canvas bg, `--stone` text):**
  - Wordmark · `Built for Colosseum Frontier 2026.`
  - Links row: `Docs · GitHub · X · Spec · Privacy`
  - Bottom mono line: `SOL devnet · v0.1.0 · MIT`

---

## 5. Dashboard — read-only navigable preview

### 5.1 Sitemap

```
/dashboard                     → redirect to /dashboard/transactions
OVERVIEW
  /dashboard/transactions      live feed of settlement events (default)
  /dashboard/attestations      verified compliance attestations
  /dashboard/counterparties    registered issuers + their roots
CONTROLS
  /dashboard/policies          per-mint compliance policies (mock)
  /dashboard/api-keys          api key management (mock)
  /dashboard/audit-log         exportable audit history
ACCOUNT
  /dashboard/team              team members (mock)
  /dashboard/billing           tier + usage
```

### 5.2 Chrome (all pages)

- **Sidebar fixed** (240px, surface bg, border-right):
  - Top: mini wordmark (Seal · Surface variant) + workspace switcher (`Acme Stablecoin ▾` mock).
  - Three section groups, each headed by an eyebrow label (Berkeley Mono Medium 11px UPPER tracking +10%, color `--muted`):
    - **OVERVIEW** — Transactions · Attestations · Counterparties
    - **CONTROLS** — Policies · API keys · Audit log
    - **ACCOUNT** — Team · Billing
  - Nav items: Geist Medium 14px, `--quill` text, with Iconoir 20px glyph at left (`Activity · Check · User · Page · Key · Clock · Group · Receipt`).
  - Active state: `--surface-deep` row bg + 2px forest vertical rule on left edge (no fill swap, no mint bg). Active text becomes `--ink`.
  - Bottom: env switcher (`Devnet ▾`) + build tag mono `v0.1.0`.
- **Top bar** (56px, canvas bg, hairline border-bottom only on scroll):
  - Page title in display-m (Georgia 32px) left, with a 1-line `--stone` editorial subtitle below (e.g. on Transactions: "Live feed of settlement events. Every row carries a proof; every proof is replayable six months from now.").
  - Right: search hint `⌘K` (visual only) · Iconoir notif bell with forest dot when events exist · avatar mock circle.
- **Main content:** max-width 1280px, padding 32px.

### 5.3 Page priority — what gets fully built vs scaffolded

To stay within the "dashboard simple" scope decision (D10) while honoring the design system's 8-route IA, pages split into two tiers:

- **Tier A — fully built (4):** `transactions`, `counterparties`, `audit-log`, `billing`. These carry the most narrative weight in a pitch demo.
- **Tier B — scaffolded (4):** `attestations`, `policies`, `api-keys`, `team`. Same chrome, page header with subtitle, and a centered empty state: a 64px Iconoir glyph + display-m headline + one-line `--stone` body + `Available in private beta` ghost button. Routes navigate; content is intentionally minimal.

This keeps total dashboard work close to the original 4-page estimate (~3 days fully built + ~0.5 day for 4 scaffolded empties = ~3.5 days).

### 5.4 `/dashboard/transactions` (Tier A · default)

- **Page subtitle:** "Live feed of settlement events. Every row carries a proof; every proof is replayable six months from now."
- **Header strip:** 4 stat cards on `surface` with `border-subtle`:
  - `1,847` proofs verified (last 24h) · sub-mono `+12% vs yesterday`
  - `23` blocked · sub-mono `1.2% rejection rate`
  - `4.7s` avg proving time · sub `p95 6.2s`
  - `$0.00091` avg verify cost · sub `Devnet`
- **Filter bar:** `All · Verified · Blocked` toggles + date range picker.
- **Transaction row component (no dot, side rule instead):**
  - Each row has a 2px vertical rule on the left edge: `--emerald` for verified, `--danger-text` for blocked, `--muted` for pending.
  - Columns: `Time · Wallet · Issuer · Status pill · Amount · Jurisdiction · Tx`.
  - Status pill carries an Iconoir glyph (`Check` for verified, `Xmark` for blocked) — never a colored dot in the cell.
  - Hover row: `--surface-deep` bg + reveal `View proof bytes ▾` action.
- **Pseudo-realtime:** `setInterval` pushes a new event to the top every 3–8s (deterministic by seed). New row fades in. Cap at 100 rows in DOM.

### 5.5 `/dashboard/counterparties` (Tier A)

- **Page subtitle:** "Issuers that have published a Merkle root your policies trust."
- Table columns: `Name · Pubkey · Merkle root · Users · Last update · Status pill`.
- 6 mock entries (Persona, Sumsub, Onfido, Jumio, Veriff, MockKYC).
- Status pills (Iconoir glyph + label, no dot): `● Active` is rendered as `Check + Active` forest pill; `Stale (>24h)` as `Warning triangle + Stale` warning pill; `Test mode` as `Sparks + Test` muted pill.
- CTA top right: `Register issuer →` (forest button) opens a modal scaffold with `Available in private beta` footer.

### 5.6 `/dashboard/audit-log` (Tier A)

- **Page subtitle:** "Every attestation, exportable on request."
- Filter bar: date range, issuer dropdown, status, jurisdiction.
- Table columns: `Time · Wallet · Issuer · Status pill · Amount · Jurisdiction · Proof hash · Block · Slot · CU consumed · Tx`.
- Export bar top right: `Export CSV · Export JSON · Webhook digest` (ghost buttons; on click → toast `Available in private beta · request access ↗`).
- Pagination Berkeley Mono `← 1 2 3 ... 47 →`.
- Footer line: `Showing 50 of 23,481 attestations · Last 30 days`.

### 5.7 `/dashboard/billing` (Tier A)

- **Page subtitle:** "Pay for what you prove."
- Three cards stacked:
  - **Current tier**: `Startup · 50,000 proofs/mo · $0.05/proof` + `Used this month: 18,432 (37%)` with forest progress bar.
  - **Usage chart**: 30-day line chart of daily proofs (Berkeley Mono axis labels in `--muted`, line in `--forest`, no fill, hairline `--border-subtle` grid).
  - **Invoices**: small table of last 3 invoices (mock) with `Download PDF` ghost buttons that toast `Available in private beta`.

### 5.8 Tier B scaffolded pages

For each of `attestations`, `policies`, `api-keys`, `team`:
- Same chrome (sidebar, topbar with page title + 1-line subtitle).
- Centered empty state in main content:
  - 64px Iconoir glyph (`Check` · `Page` · `Key` · `Group` respectively) in `--ghost`.
  - display-m headline (e.g. `Attestation explorer · coming soon`).
  - One-line `--stone` body (e.g. `Filter, search, and inspect every ComplianceAttestation. Available to private-beta participants.`).
  - Ghost button: `Request access ↗`.

### 5.9 Mock data layer

- All mock data in `src/lib/mock-data.ts` as typed JSON arrays.
- Live feed events generated from a seeded PRNG so the same scroll yields the same sequence (URL `?seed=N` overrides).
- Pre-generated valid Groth16 proof bytes in `src/lib/proof-bytes.ts` (delivered by backend Week 2).
- Zero `fetch`. No API routes. No server actions.

---

## 6. Architecture

### 6.1 Stack (final)

| Area | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript strict | 5.x |
| Styling | Tailwind v4 | 4.x |
| Primitives | shadcn/ui (heavily customized via tokens) | latest |
| Scroll-locked motion | GSAP + ScrollTrigger | 3.x |
| Component motion | motion (ex-Framer) | 11.x |
| WebGL | Three.js vanilla | latest |
| Code highlight | Shiki | latest |
| Icons | [Iconoir](https://iconoir.com) (`iconoir-react`) | latest |
| Package manager | pnpm | 9.x |

### 6.2 Folder structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              root: fonts, metadata, providers
│   │   ├── page.tsx                landing (composes 10 sections)
│   │   ├── globals.css             tailwind v4 + tokens + font-face
│   │   └── dashboard/
│   │       ├── layout.tsx          chrome: sidebar + topbar
│   │       ├── page.tsx            redirect → /dashboard/transactions
│   │       ├── transactions/page.tsx     Tier A · default
│   │       ├── attestations/page.tsx     Tier B · scaffold
│   │       ├── counterparties/page.tsx   Tier A
│   │       ├── policies/page.tsx         Tier B · scaffold
│   │       ├── api-keys/page.tsx         Tier B · scaffold
│   │       ├── audit-log/page.tsx        Tier A
│   │       ├── team/page.tsx             Tier B · scaffold
│   │       └── billing/page.tsx          Tier A
│   ├── components/
│   │   ├── landing/
│   │   │   ├── nav.tsx
│   │   │   ├── hero/
│   │   │   │   ├── hero.tsx
│   │   │   │   ├── veil-canvas.tsx       Three.js scene
│   │   │   │   └── veil-shaders.ts       GLSL strings
│   │   │   ├── paradox-section.tsx
│   │   │   ├── two-realities-section.tsx
│   │   │   ├── how-it-works-section.tsx
│   │   │   ├── numbers-section.tsx
│   │   │   ├── demo-section.tsx
│   │   │   ├── proof-console.tsx         simulated terminal
│   │   │   ├── use-cases-section.tsx
│   │   │   ├── developers-section.tsx
│   │   │   ├── momentum-section.tsx
│   │   │   └── closing-cta.tsx
│   │   ├── dashboard/
│   │   │   ├── sidebar.tsx
│   │   │   ├── top-bar.tsx
│   │   │   ├── stat-card.tsx
│   │   │   ├── status-pill.tsx           Iconoir glyph + label, no dot
│   │   │   ├── transaction-row.tsx       2px side rule, no dot
│   │   │   ├── transactions-table.tsx
│   │   │   ├── counterparties-table.tsx
│   │   │   ├── audit-table.tsx
│   │   │   ├── billing-cards.tsx
│   │   │   └── tier-b-scaffold.tsx       shared empty-state component
│   │   ├── ui/                            shadcn customized
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── code-block.tsx             Shiki SSR
│   │   ├── motion/
│   │   │   ├── pinned-section.tsx         GSAP wrapper
│   │   │   ├── fade-in.tsx
│   │   │   └── count-up.tsx
│   │   └── icons/
│   │       └── logo.tsx                   ZKSettle wordmark SVG
│   ├── lib/
│   │   ├── mock-data.ts                   issuers, feed events, audit
│   │   ├── proof-bytes.ts                 pre-generated Groth16 hex
│   │   ├── demo-script.ts                 deterministic flow steps
│   │   ├── gsap.ts                        plugin registration, MM
│   │   ├── shiki.ts                       custom theme
│   │   ├── cn.ts                          class merger
│   │   └── format.ts                      truncate-wallet, fmt-amount
│   ├── hooks/
│   │   ├── use-scroll-progress.ts
│   │   ├── use-reduced-motion.ts
│   │   └── use-mounted.ts
│   └── content/
│       ├── copy.ts                        all landing copy, single source
│       └── use-cases.ts
├── public/
│   ├── fonts/
│   │   ├── geist-regular.woff2
│   │   ├── geist-medium.woff2
│   │   └── berkeley-mono-regular.woff2     (or jetbrains-mono-regular.woff2 fallback)
│   │   # Display: Georgia (system) — no file. Optional PP Editorial drop-in later.
│   ├── og.png                             1200×630 OG image
│   └── favicon.svg
├── next.config.ts
├── tsconfig.json
├── postcss.config.js
├── package.json
└── README.md
```

### 6.3 Architectural decisions

1. **Three.js vanilla, not R3F.** Saves ~140KB bundle. Cost: manual mount/unmount/dispose lifecycle in a `useVeilCanvas` hook. Acceptable.
2. **GSAP for scroll-locked, motion for component-level.** Clean separation: GSAP owns `pin/scrub/timeline`; motion owns `enter/exit/layout`. They don't fight when the boundary holds.
3. **All copy in `src/content/copy.ts`.** Single source of truth, easy iteration, primes for future i18n.
4. **Mock data 100% client-side and deterministic.** Seeded PRNG; `?seed=N` URL param overrides. Same screenshot every time.
5. **Demo simulated, not real.** `proof-bytes.ts` holds one valid Groth16 byte sequence. Timer is `await sleep(4710)`, real wall-clock. Solscan link points to a real pre-existing devnet transaction.
6. **Static export viable.** No server-side dependencies. `output: 'export'` works if we want to host anywhere.
7. **No analytics, CMS, login.** Out of scope. Vercel deploy default.

### 6.4 Performance targets

- Lighthouse landing: Performance ≥ 85, Accessibility ≥ 95, SEO ≥ 95
- LCP < 2.5s on M1-mid laptop. INP < 200ms.
- Landing first-load JS ≤ 220KB gzipped (Three.js dominates).
- Dashboard first-load JS ≤ 120KB gzipped (no WebGL).
- Hero canvas: 60fps on integrated graphics; auto-downgrades to 4k particles on tablet, static SVG on mobile.

### 6.5 Accessibility

- Contrast: ink on canvas ≈ 13:1 · forest on canvas ≈ 10:1 (AA exceeded).
- Focus rings: 2px forest outline, 2px offset.
- `prefers-reduced-motion`: GSAP MatchMedia disables pin and scrub; WebGL canvas renders a single static frame; motion library respects by default.
- Demo: aria-live region announces state changes ("Generating proof... Done. 4.71 seconds").
- Sidebar/topbar: full keyboard nav. Skip link "Skip to content" at page top.

### 6.6 Deployment

- Vercel default. Preview per PR, prod from `main`.
- Domain: `zksettle.com` if owned by team; fallback `zksettle.vercel.app`.
- OG image generated statically at `public/og.png` (1200×630). No `next/og` to keep server cold-start light.

---

## 7. Risks & mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Veil canvas drops below 60fps on integrated graphics | High | Adaptive particle count (12k desktop / 4k tablet / SVG static mobile). FPS monitor; auto-downgrade if <50fps for 2s. |
| R2 | Three.js + GSAP + Shiki overshoot 220KB target | Medium | Tree-shake Three.js to `core / BufferGeometry / ShaderMaterial`. Shiki SSR-only (no client JS, HTML pre-rendered). Code-split `/dashboard` from landing chunks. |
| R3 | Display font swap (Georgia → PP Editorial New) needed late in cycle | Low | Display is set via `--font-display` CSS variable. To upgrade: drop the .woff2 files in `public/fonts/`, register via `next/font`, change one CSS variable. No layout changes required because Georgia metrics were used as the design baseline. |
| R4 | Simulated demo perceived as fake | Medium | Real wall-clock timer, real proof bytes, real Solscan link. Honesty footer below the demo. Honesty > deception. |
| R5 | Backend can't deliver proof bytes by Week 2 | Medium | Generation is standalone via `barretenberg` CLI. Mario produces 2 byte pairs (valid + expired, matching the demo's two flows) Week 2 independently. |
| R6 | Two Realities pin breaks on iOS Safari | Medium | GSAP MatchMedia: viewport <768px swaps pin for stacked horizontal slide. Test on real iOS device. |
| R7 | Live feed appears static in screenshots | Low | Deterministic with seed exposed via `?seed=N`. Default seed produces interesting state. |
| R8 | "$9T" or "$650B" numbers contested | Low | Footnote in §9 with sources. Trivial swap in `content/copy.ts`. |

---

## 8. Checkpoints (aligned with PRD §12)

- **Week 1 (apr 11–17) — Foundation visual.** Repo init, Geist + Berkeley Mono self-hosted, Tailwind v4 tokens published in `globals.css`, hero static (no WebGL yet), Seal logo SVG component, Iconoir installed. **Demo gate:** open `/`, see correct hero in Georgia display + forest CTA + Seal logo in nav.
- **Week 2 (apr 18–24) — WebGL hero + Two Realities.** Veil canvas at 60fps desktop. Two Realities split scroll-locked desktop. Mobile fallbacks running. **Demo gate:** scroll full landing without jank on M1 laptop.
- **Week 3 (apr 25–may 1) — Demo + remaining sections.** Proof console terminal animated. `proof-bytes.ts` with real bytes (Mario delivers Week 2). Use cases, developers, momentum, closing CTA. **Demo gate:** end-to-end landing flow runs, demo simulation completes.
- **Week 4 (may 2–8) — Dashboard + polish.** All 4 dashboard pages with mock data. Sidebar + topbar functional. Live feed pseudo-realtime. Polish: micro-interactions, focus states, reduced-motion paths. Cross-browser test (Chrome, Safari, Firefox; iOS+Android). **Demo gate:** Lighthouse run hits all targets.
- **Week 5 (may 9–11) — Pitch + buffer.** OG image, favicon, SEO metadata. Record technical demo (2–3 min) navigating landing + dashboard. Vercel deploy stable. Buffer for regressions. **Submit by may 11.**

---

## 9. Definition of Done

- Lighthouse: Performance ≥ 85 · Accessibility ≥ 95 · SEO ≥ 95 (mobile + desktop).
- Works in Chrome, Safari, Firefox (latest), iOS Safari 17+, Android Chrome.
- `prefers-reduced-motion` disables pins and shaders without breaking layout.
- Demo simulation runs end-to-end deterministically in <10s wall-clock.
- Dashboard navigates 4 pages with zero console errors.
- README documents `pnpm dev` and the stack.
- Domain configured and Vercel preview green.

---

## 10. Deferred to v0.2

- PT-BR i18n toggle
- Dark mode
- Real auth + dashboard backend
- MDX `/docs` site
- Blog / case studies
- Pricing page
- Analytics (Vercel/Plausible)
- Real WebSocket on live feed
- Functional issuer registration form
- Real CSV/JSON export

---

## Appendix A — References

- [`zksettle_prd.md`](../../../zksettle_prd.md) — product requirements, stack rationale
- [`zksettle_pitch.md`](../../../zksettle_pitch.md) — voice, positioning, copy tone
- [`zksettle_adr.md`](../../../zksettle_adr.md) — architecture decisions backing the demo bytes
- **Design system (canonical):** `https://claude.ai/design/p/428580d1-b5d6-429a-bea0-0ba1069a5d96` — 27 cards across Type, Colors, Spacing, Components, Brand. Source of truth for all decisions in §3 and component patterns in §4–§5. 
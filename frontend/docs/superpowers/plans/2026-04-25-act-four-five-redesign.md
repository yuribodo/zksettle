# Act 4 / Act 5 Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `ActFourMove` (terminal + cramped grid + closer in one pinned scene with scroll-driven typing) with two acts: a typographic "Three Lines." moment and a full-width Six Markets blueprint grid with dashed SVG borders and hover ink-in.

**Architecture:** Two new components (`ActFourThreeLines`, `ActFiveMarkets`) that reuse `useActPin` for rhythm but stop subscribing to scroll progress. Entrances trigger once on view via GSAP `ScrollTrigger.onEnter`. The grid uses one SVG `<rect>` per cell for the dashed border (animated via stroke attributes) plus four corner-bracket paths. Hover state runs a per-cell GSAP timeline (border solid + brackets thicken + descriptor slide-up + adjacent dim). All scroll-driven typing/reveals are removed.

**Tech Stack:** Next.js 15 App Router, React 19, GSAP 3.15 + `@gsap/react` `useGSAP`, Tailwind v4, TypeScript. Lenis smooth-scroll already wired via `SmoothScrollProvider` (no changes).

**Spec:** `docs/superpowers/specs/2026-04-25-act-four-five-redesign.md`

**Working tree note:** The repo currently has unrelated modifications in `src/app/globals.css`, `src/components/landing/acts/act-one-hero.tsx`, `src/components/landing/hero/hero.tsx`, `src/components/landing/smooth-scroll-provider.tsx`, and `src/content/copy.ts`. **Do not commit those.** Each task below explicitly lists which files to `git add`. Use targeted `git add <path>` — never `git add .` or `git add -A`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/content/copy.ts` | Modify | Add `markets: readonly Market[]` field to `MoveCopy`, populate in `COPY.move`. Remove `useCases` after Task 7. |
| `src/components/landing/acts/act-four-three-lines.tsx` | Create | Act 4 — typographic "Three Lines." moment |
| `src/components/landing/acts/act-five-markets.tsx` | Create | Act 5 — section shell, eyebrow, grid layout, divider, closer card, entrance timeline, `useActPin` |
| `src/components/landing/acts/market-cell.tsx` | Create | Single-cell blueprint component: SVG dashed border + corner brackets + content + hover timeline |
| `src/components/landing/acts/act-four-move.tsx` | Delete | Old combined act, removed in Task 7 |
| `src/components/landing/acts/index.ts` | Modify | Export new acts, remove `ActFourMove` |
| `src/app/page.tsx` | Modify | Swap `<ActFourMove />` for `<ActFourThreeLines />` + `<ActFiveMarkets />` |

---

## Task 1: Add `markets` data + `Market` type to copy.ts

**Files:**
- Modify: `src/content/copy.ts` (lines 64-79 — `MoveCopy` interface; lines 162-187 — `move` data)

This is additive: `markets` is added alongside the existing `useCases` field so the current `ActFourMove` keeps compiling until Task 7 removes it. Removing `useCases` in this task would break the page.

- [ ] **Step 1: Add `Market` interface and update `MoveCopy`**

In `src/content/copy.ts`, replace the Act 4 section (currently lines 64-79):

```ts
// ── Act 4 ────────────────────────────────────────────────────────────────────
export interface Market {
  readonly name: string;
  readonly descriptor: string;
}

export interface MoveCopy {
  readonly code: {
    readonly label: string;
    readonly lines: readonly [string, string, string];
  };
  /** @deprecated removed after act-four-move.tsx is deleted */
  readonly useCases: readonly string[];
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
```

- [ ] **Step 2: Add `markets` to `COPY.move`**

In the same file, replace the `move:` block (currently lines 161-187) with:

```ts
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
        primary: { label: "Read the docs →", href: "/docs" },
        secondary: { label: "Talk to founders", href: "mailto:hello@zksettle.dev" },
      },
    },
  },
```

- [ ] **Step 3: Run typecheck**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Expected: PASS (no errors). The existing `ActFourMove` still references `useCases` — that's why we kept it.

- [ ] **Step 4: Commit**

```bash
git -C /home/mario/zksettle/frontend add src/content/copy.ts
git -C /home/mario/zksettle/frontend commit -m "feat(landing): add markets array + Market type to copy

Adds the new markets data with descriptors for the upcoming Act 5
blueprint grid. Keeps the deprecated useCases field temporarily so
ActFourMove keeps compiling until it's removed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Build `ActFourThreeLines` (static composition, no animation, not yet wired)

**Files:**
- Create: `src/components/landing/acts/act-four-three-lines.tsx`

The component is built static-first so layout/typography can be visually verified before adding motion.

- [ ] **Step 1: Create the component file**

Write `src/components/landing/acts/act-four-three-lines.tsx`:

```tsx
"use client";

import { useRef } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { useActPin } from "./use-act-pin";

const ACT_DURATION = "+=80%";

const STEP_LABELS = ["install", "prove", "wrap"] as const;

export function ActFourThreeLines() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, { duration: ACT_DURATION });

  const { lines } = COPY.move.code;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-four-heading"
      className="relative isolate min-h-screen overflow-hidden bg-ink text-canvas"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 25% 35%, rgba(12,61,46,0.45), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 75%, rgba(12,61,46,0.25), transparent 65%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-10 px-6 py-24 md:px-8">
        <DisplayHeading
          id="act-four-heading"
          level="l"
          className="text-center text-canvas"
        >
          Three lines.
        </DisplayHeading>

        <div className="w-full max-w-3xl">
          <hr className="border-0 border-t border-forest/30" data-three-lines-rule="top" />

          <ol className="my-10 flex flex-col gap-6 md:gap-7">
            {lines.map((line, i) => (
              <li
                key={line}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 md:gap-x-10"
                data-three-lines-step
              >
                <div className="flex items-baseline gap-3 font-mono text-xs uppercase tracking-[0.16em] text-canvas/55 tabular-nums">
                  <span className="text-canvas/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden className="text-canvas/30">─</span>
                  <span>{STEP_LABELS[i]}</span>
                </div>
                <code
                  className={
                    i === 0
                      ? "font-mono text-base text-canvas/55 md:text-lg"
                      : "font-mono text-base text-[#5fb88f] md:text-lg"
                  }
                >
                  {line}
                </code>
              </li>
            ))}
          </ol>

          <hr className="border-0 border-t border-forest/30" data-three-lines-rule="bottom" />

          <p
            className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[#5fb88f]"
            data-three-lines-footer
          >
            ✓ ready · 0 PII leaked
          </p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Temporarily render at the END of the page for visual check**

Place the new act AFTER the existing `ActFourMove` so it sits at the bottom of the page during the staged rollout — this matches its final position (since `ActFourMove` is deleted in Task 7) and lets you compare old vs new in scroll order.

Modify `src/app/page.tsx`:

```tsx
import { Footer } from "@/components/landing/footer";
import { ActOneHero, ActTwoParadox, ActThreeEngine, ActFourMove } from "@/components/landing/acts";
import { ActFourThreeLines } from "@/components/landing/acts/act-four-three-lines";
import { Nav } from "@/components/landing/nav";
import { SmoothScrollProvider } from "@/components/landing/smooth-scroll-provider";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <Nav />
      <main id="main-content">
        <ActOneHero />
        <ActTwoParadox />
        <ActThreeEngine />
        <ActFourMove />
        <ActFourThreeLines />
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
```

- [ ] **Step 3: Run typecheck + dev server visual check**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Expected: PASS.

```bash
cd /home/mario/zksettle/frontend && pnpm dev
```

Open `http://localhost:3000`, scroll all the way down past the existing Act 4 (`ActFourMove`) — the new Three Lines section appears at the bottom of the page. Verify:
- Headline "Three lines." centered, large display font
- Three rows: `01 ─ install` / `02 ─ prove` / `03 ─ wrap` on the left, code on the right
- Two thin horizontal hairlines bracket the steps
- Footer "✓ ready · 0 PII leaked" in muted green caps
- No mac-style dots, no terminal chrome, no `~/your-app` label
- Section pins on desktop scroll (because we passed `useActPin`)

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git -C /home/mario/zksettle/frontend add src/components/landing/acts/act-four-three-lines.tsx src/app/page.tsx
git -C /home/mario/zksettle/frontend commit -m "feat(landing): add ActFourThreeLines static composition

New typographic 'Three Lines.' act: display headline, three numbered
steps (install / prove / wrap) with mono code, hairline rules above
and below, minimal ready footer. Wired to useActPin for scroll rhythm.
Rendered alongside the old ActFourMove temporarily for visual review;
old act will be removed in a later commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add entrance animation to `ActFourThreeLines`

**Files:**
- Modify: `src/components/landing/acts/act-four-three-lines.tsx`

GSAP timeline triggered once when the section enters the viewport. No scroll progress hookup.

- [ ] **Step 1: Add `useGSAP` + entrance timeline**

Replace the entire `src/components/landing/acts/act-four-three-lines.tsx` with:

```tsx
"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { useActPin } from "./use-act-pin";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const ACT_DURATION = "+=80%";

const STEP_LABELS = ["install", "prove", "wrap"] as const;

export function ActFourThreeLines() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, { duration: ACT_DURATION });

  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const headline = root.querySelector("[data-three-lines-headline]");
        const ruleTop = root.querySelector('[data-three-lines-rule="top"]');
        const steps = root.querySelectorAll("[data-three-lines-step]");
        const ruleBottom = root.querySelector('[data-three-lines-rule="bottom"]');
        const footer = root.querySelector("[data-three-lines-footer]");

        gsap.set([headline, ...Array.from(steps), footer], { opacity: 0, y: 12 });
        gsap.set([ruleTop, ruleBottom], { scaleX: 0, transformOrigin: "left center" });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top 70%",
            once: true,
          },
          defaults: { ease: "power2.out" },
        });

        tl.to(headline, { opacity: 1, y: 0, duration: 0.35 })
          .to(ruleTop, { scaleX: 1, duration: 0.28 }, "-=0.15")
          .to(steps, { opacity: 1, y: 0, duration: 0.28, stagger: 0.08 }, "-=0.1")
          .to(ruleBottom, { scaleX: 1, duration: 0.22 }, "-=0.1")
          .to(footer, { opacity: 1, y: 0, duration: 0.2 }, "-=0.05");
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );

  const { lines } = COPY.move.code;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-four-heading"
      className="relative isolate min-h-screen overflow-hidden bg-ink text-canvas"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 25% 35%, rgba(12,61,46,0.45), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 75%, rgba(12,61,46,0.25), transparent 65%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-10 px-6 py-24 md:px-8">
        <DisplayHeading
          id="act-four-heading"
          level="l"
          className="text-center text-canvas"
          data-three-lines-headline
        >
          Three lines.
        </DisplayHeading>

        <div className="w-full max-w-3xl">
          <hr className="border-0 border-t border-forest/30" data-three-lines-rule="top" />

          <ol className="my-10 flex flex-col gap-6 md:gap-7">
            {lines.map((line, i) => (
              <li
                key={line}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 md:gap-x-10"
                data-three-lines-step
              >
                <div className="flex items-baseline gap-3 font-mono text-xs uppercase tracking-[0.16em] text-canvas/55 tabular-nums">
                  <span className="text-canvas/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden className="text-canvas/30">─</span>
                  <span>{STEP_LABELS[i]}</span>
                </div>
                <code
                  className={
                    i === 0
                      ? "font-mono text-base text-canvas/55 md:text-lg"
                      : "font-mono text-base text-[#5fb88f] md:text-lg"
                  }
                >
                  {line}
                </code>
              </li>
            ))}
          </ol>

          <hr className="border-0 border-t border-forest/30" data-three-lines-rule="bottom" />

          <p
            className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[#5fb88f]"
            data-three-lines-footer
          >
            ✓ ready · 0 PII leaked
          </p>
        </div>
      </div>
    </section>
  );
}
```

Note: `DisplayHeading` may not pass arbitrary `data-*` props through to its DOM node. If it doesn't, wrap it in a `<div data-three-lines-headline>` and target the wrapper instead. Check by reading `src/components/ui/display-heading.tsx` before running the dev server.

- [ ] **Step 2: Verify `DisplayHeading` forwards `data-*` attrs (or fix)**

```bash
cd /home/mario/zksettle/frontend && grep -n "data-\|\\.\\.\\.props\|\\.\\.\\.rest" src/components/ui/display-heading.tsx
```

If it does NOT spread props, wrap the headline:

```tsx
<div data-three-lines-headline>
  <DisplayHeading id="act-four-heading" level="l" className="text-center text-canvas">
    Three lines.
  </DisplayHeading>
</div>
```

And update the GSAP query target accordingly (it already queries `[data-three-lines-headline]`, so the wrapper works).

- [ ] **Step 3: Run typecheck**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Visual check**

```bash
cd /home/mario/zksettle/frontend && pnpm dev
```

Open `http://localhost:3000`, scroll all the way down past Act 4 (`ActFourMove`) to the new Three Lines section at the bottom of the page. Verify:
- Section is initially blank (or below view)
- When the section scrolls into view (top crosses 70% of viewport), the headline fades up first, then top hairline draws left-to-right, then the three steps stagger in, then the bottom hairline draws, then the footer appears
- Total duration feels ~700ms
- Reload and try scrolling fast — animation still plays once when triggered, doesn't replay on subsequent scrolls
- Test reduced motion: in DevTools Rendering panel, set "Emulate CSS prefers-reduced-motion: reduce". Reload — content appears instantly with no animation

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git -C /home/mario/zksettle/frontend add src/components/landing/acts/act-four-three-lines.tsx
git -C /home/mario/zksettle/frontend commit -m "feat(landing): add entrance timeline to ActFourThreeLines

Headline + hairlines + steps + footer animate in once when the section
enters viewport (top 70%), via GSAP ScrollTrigger.onEnter. No scroll
progress hookup. Reduced motion skips the timeline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Build `ActFiveMarkets` shell (eyebrow, empty grid layout, divider, closer card, no cells yet)

**Files:**
- Create: `src/components/landing/acts/act-five-markets.tsx`

The shell is built first with placeholder cell boxes so the layout, divider, and closer can be verified before the SVG cell work in Task 5.

- [ ] **Step 1: Create the component file**

Write `src/components/landing/acts/act-five-markets.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { cn } from "@/lib/cn";

import { useActPin } from "./use-act-pin";

const ACT_DURATION = "+=120%";

export function ActFiveMarkets() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, { duration: ACT_DURATION });

  const { markets, closer } = COPY.move;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-five-heading"
      className="relative isolate min-h-screen overflow-hidden bg-ink text-canvas"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 75% 25%, rgba(12,61,46,0.40), transparent 70%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(12,61,46,0.22), transparent 65%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-14 px-6 py-24 md:px-8">
        <p
          className="font-mono text-xs uppercase tracking-[0.18em] text-canvas/55"
          data-markets-eyebrow
        >
          One primitive. Six markets.
        </p>

        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          data-markets-grid
        >
          {markets.map((m, i) => (
            <div
              key={m.name}
              className="min-h-[200px] rounded-[8px] border border-forest/30 p-6 text-canvas"
              data-markets-cell
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-canvas/40">
                {String(i + 1).padStart(2, "0")}/06
              </p>
              <p className="mt-10 font-display text-2xl text-canvas md:text-3xl">{m.name}</p>
            </div>
          ))}
        </div>

        <div
          className="h-px w-full bg-forest/30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, rgba(12,61,46,0.5) 0 8px, transparent 8px 14px)",
            backgroundColor: "transparent",
          }}
          data-markets-divider
        />

        <div data-markets-closer>
          <DisplayHeading
            id="act-five-heading"
            level="m"
            className="max-w-[20ch] text-canvas"
          >
            {closer.headline}
          </DisplayHeading>
          <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-canvas/65">
            {closer.sub}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={closer.ctas.primary.href}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "shadow-[0_8px_30px_-10px_rgba(12,61,46,0.6)]",
              )}
            >
              {closer.ctas.primary.label}
            </Link>
            <Link
              href={closer.ctas.secondary.href}
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "border border-canvas/15 text-canvas hover:bg-canvas/5",
              )}
            >
              {closer.ctas.secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render at the END alongside the existing layout**

Add `<ActFiveMarkets />` immediately after `<ActFourThreeLines />` — both new acts stay at the END of the page (after `<ActFourMove />`) during transition.

Modify `src/app/page.tsx`:

```tsx
import { Footer } from "@/components/landing/footer";
import { ActOneHero, ActTwoParadox, ActThreeEngine, ActFourMove } from "@/components/landing/acts";
import { ActFourThreeLines } from "@/components/landing/acts/act-four-three-lines";
import { ActFiveMarkets } from "@/components/landing/acts/act-five-markets";
import { Nav } from "@/components/landing/nav";
import { SmoothScrollProvider } from "@/components/landing/smooth-scroll-provider";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <Nav />
      <main id="main-content">
        <ActOneHero />
        <ActTwoParadox />
        <ActThreeEngine />
        <ActFourMove />
        <ActFourThreeLines />
        <ActFiveMarkets />
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
```

- [ ] **Step 3: Run typecheck + visual check**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Expected: PASS.

```bash
cd /home/mario/zksettle/frontend && pnpm dev
```

Open browser, scroll to the bottom — the new Markets section appears immediately after the new Three Lines section (both at the end of the page, after the existing `ActFourMove`). Verify:
- Eyebrow "One primitive. Six markets." top
- 3×2 grid (single col on mobile, 2-col on tablet, 3-col on desktop)
- Each cell shows `01/06`, `02/06`, etc. and the market name
- Cells have a solid forest/30 border (this is the placeholder — gets replaced with SVG dashed in next task)
- Dashed divider below the grid (made via repeating-linear-gradient)
- Closer card below: "Compliance is no longer a six-month moat." headline + sub + two CTAs

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git -C /home/mario/zksettle/frontend add src/components/landing/acts/act-five-markets.tsx src/app/page.tsx
git -C /home/mario/zksettle/frontend commit -m "feat(landing): add ActFiveMarkets shell

Section shell with eyebrow, 3x2 placeholder grid, dashed divider, and
the closer card moved out of the old combined act. Cells are temporary
solid-bordered boxes; replaced with SVG blueprint cells in the next
commit. Wired into page.tsx alongside the existing acts for staged
rollout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Build `MarketCell` component (idle SVG blueprint composition, no hover yet)

**Files:**
- Create: `src/components/landing/acts/market-cell.tsx`
- Modify: `src/components/landing/acts/act-five-markets.tsx`

Replace the placeholder cell `<div>` with a real `MarketCell` that renders the dashed SVG border, four corner brackets, and the content layer.

- [ ] **Step 1: Create `market-cell.tsx`**

Write `src/components/landing/acts/market-cell.tsx`:

```tsx
"use client";

import { type CSSProperties } from "react";

import { type Market } from "@/content/copy";

const DASH_PATTERN = "8 6";
const BORDER_RX = 8;
const BRACKET_LEN = 12;

export function MarketCell({
  market,
  index,
  total,
}: {
  market: Market;
  index: number;
  total: number;
}) {
  return (
    <div
      data-markets-cell
      className="group relative isolate min-h-[220px] overflow-hidden rounded-[8px] p-6"
    >
      {/* Background tint layer (used by hover later) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[8px] bg-forest/0 transition-colors duration-200"
        data-cell-tint
      />

      {/* SVG border. width/height as % work on rect; vectorEffect keeps the stroke 1px regardless of SVG scaling. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <rect
          data-cell-border-dashed
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={BORDER_RX}
          ry={BORDER_RX}
          fill="none"
          stroke="rgb(12 61 46 / 0.55)"
          strokeWidth="1"
          strokeDasharray={DASH_PATTERN}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Corner brackets — 4 separate SVGs, each positioned with top/right/bottom/left
          (NOT transform:translate(100%,...) — CSS % in translate is self-relative, would break alignment). */}
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      {/* Content */}
      <div className="relative flex h-full min-h-[180px] flex-col">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-canvas/45">
          {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
        </p>

        <div className="mt-auto">
          <p className="font-display text-2xl text-canvas md:text-3xl" data-cell-name>
            {market.name}
          </p>

          <div
            className="mt-3 overflow-hidden"
            data-cell-descriptor-wrap
            style={{ height: 0, opacity: 0 }}
          >
            <div
              aria-hidden
              className="mb-2 h-px w-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, rgba(250,250,247,0.45) 0 4px, transparent 4px 8px)",
              }}
            />
            <p className="font-mono text-[12px] leading-snug text-canvas/65">
              {market.descriptor}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

type CornerPosition = "tl" | "tr" | "bl" | "br";

const CORNER_POSITION_STYLE: Record<CornerPosition, CSSProperties> = {
  tl: { top: 6, left: 6, transform: "none" },
  tr: { top: 6, right: 6, transform: "scaleX(-1)" },
  bl: { bottom: 6, left: 6, transform: "scaleY(-1)" },
  br: { bottom: 6, right: 6, transform: "scale(-1, -1)" },
};

function CornerBracket({ position }: { position: CornerPosition }) {
  const positionStyle = CORNER_POSITION_STYLE[position];

  return (
    <svg
      aria-hidden
      width={BRACKET_LEN}
      height={BRACKET_LEN}
      className="pointer-events-none absolute"
      style={{ ...positionStyle[position], transformOrigin: "center" }}
    >
      <path
        data-cell-bracket
        d={`M 0 0 L ${BRACKET_LEN} 0 M 0 0 L 0 ${BRACKET_LEN}`}
        stroke="rgb(12 61 46 / 0.65)"
        strokeWidth="1"
        fill="none"
        strokeLinecap="square"
      />
    </svg>
  );
}
```

If corner brackets are misaligned, the issue is almost always container positioning — confirm the cell root has `position: relative` (it does via `relative` Tailwind class). Each bracket SVG positions itself with `top`/`left` etc. relative to that root.

- [ ] **Step 2: Replace placeholder cells in `ActFiveMarkets`**

In `src/components/landing/acts/act-five-markets.tsx`, replace the cell mapping inside `[data-markets-grid]` with:

```tsx
        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          data-markets-grid
        >
          {markets.map((m, i) => (
            <MarketCell key={m.name} market={m} index={i} total={markets.length} />
          ))}
        </div>
```

Add the import at the top:

```tsx
import { MarketCell } from "./market-cell";
```

- [ ] **Step 3: Run typecheck + visual check**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Expected: PASS.

```bash
cd /home/mario/zksettle/frontend && pnpm dev
```

Open browser, scroll to the Markets section. Verify:
- Each cell now has a **dashed SVG border** (not solid CSS border)
- Each cell has **4 corner brackets** — short L-shapes at each corner that look like blueprint markers
- `01/06` etc. in the top-left
- Market name in the bottom area, display font
- Descriptor is **NOT visible yet** (will be revealed on hover in next task)
- Cells look like blueprints in idle state

If corner brackets land in wrong corners, double-check the `transform` direction in `CORNER_POSITION_STYLE` (the L-shape paths point right+down by default; flips mirror them).

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git -C /home/mario/zksettle/frontend add src/components/landing/acts/market-cell.tsx src/components/landing/acts/act-five-markets.tsx
git -C /home/mario/zksettle/frontend commit -m "feat(landing): MarketCell with dashed SVG border + corner brackets

Each market cell is now a proper blueprint composition: SVG dashed
rect border, four corner brackets at the cell's corners, and
content layer with the index/total label and market name. Descriptor
is rendered but height-collapsed; the next commit wires hover to
reveal it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Add hover treatment to `MarketCell` + adjacent-cell dimming

**Files:**
- Modify: `src/components/landing/acts/market-cell.tsx`
- Modify: `src/components/landing/acts/act-five-markets.tsx`

Hover runs a per-cell GSAP timeline (border ink + brackets thicken + tint + descriptor slide-up). Adjacent cells dim via parent React state.

- [ ] **Step 1: Add hover state to `ActFiveMarkets` and pass down**

Replace the grid block in `src/components/landing/acts/act-five-markets.tsx`. First add `useState` import:

```tsx
import { useRef, useState } from "react";
```

Then in the component body, add the state and update the cell render:

```tsx
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // ... inside the JSX, replace the grid mapping:
        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          data-markets-grid
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {markets.map((m, i) => (
            <MarketCell
              key={m.name}
              market={m}
              index={i}
              total={markets.length}
              isDimmed={hoveredIndex !== null && hoveredIndex !== i}
              onHoverChange={(hovering) => setHoveredIndex(hovering ? i : (prev) => (prev === i ? null : prev))}
            />
          ))}
        </div>
```

Note: the `onHoverChange` setter pattern above is wrong — `setHoveredIndex` accepts a value or updater function. Correct form:

```tsx
              onHoverChange={(hovering) => {
                if (hovering) setHoveredIndex(i);
                else setHoveredIndex((prev) => (prev === i ? null : prev));
              }}
```

- [ ] **Step 2: Rewrite `MarketCell` with CSS-driven hover (two-rect overlay + group-hover + grid-rows trick)**

CSS-only hover is more reliable than tweening `stroke-dasharray` (GSAP can't smoothly interpolate dash patterns). The dashed → solid effect uses **two stacked rects** (dashed visible at idle, solid revealed on hover via opacity). Brackets, tint, and descriptor reveal all run via `group-hover:` Tailwind utilities with per-element `transition-delay` for the hand-staggered feel.

Replace the entire `src/components/landing/acts/market-cell.tsx` with:

```tsx
"use client";

import { type CSSProperties } from "react";

import { type Market } from "@/content/copy";
import { cn } from "@/lib/cn";

const DASH_PATTERN = "8 6";
const STROKE_IDLE = "rgb(12 61 46 / 0.55)";
const STROKE_HOVER = "rgb(12 61 46 / 0.95)";
const BORDER_RX = 8;
const BRACKET_LEN = 12;

type CornerPosition = "tl" | "tr" | "bl" | "br";

const CORNER_POSITION_STYLE: Record<CornerPosition, CSSProperties> = {
  tl: { top: 6, left: 6, transform: "none" },
  tr: { top: 6, right: 6, transform: "scaleX(-1)" },
  bl: { bottom: 6, left: 6, transform: "scaleY(-1)" },
  br: { bottom: 6, right: 6, transform: "scale(-1, -1)" },
};

export function MarketCell({
  market,
  index,
  total,
  isDimmed,
  onHoverChange,
}: {
  market: Market;
  index: number;
  total: number;
  isDimmed: boolean;
  onHoverChange: (hovering: boolean) => void;
}) {
  return (
    <div
      data-markets-cell
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className={cn(
        "group relative isolate min-h-[220px] overflow-hidden rounded-[8px] p-6 transition-opacity duration-200",
        isDimmed ? "opacity-60" : "opacity-100",
      )}
    >
      {/* Tint layer — fades in on hover (delay 100ms) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[8px] bg-forest/0 transition-colors duration-200 group-hover:bg-forest/[0.06]"
        style={{ transitionDelay: "100ms" }}
      />

      {/* Border layer — TWO rects stacked. Dashed is visible at idle; solid fades in on hover. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        {/* Dashed (idle) — fades to invisible on hover */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={BORDER_RX}
          ry={BORDER_RX}
          fill="none"
          stroke={STROKE_IDLE}
          strokeWidth="1"
          strokeDasharray={DASH_PATTERN}
          vectorEffect="non-scaling-stroke"
          className="opacity-100 transition-opacity duration-200 group-hover:opacity-0"
        />
        {/* Solid (hover) — fades in on hover, slightly delayed */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={BORDER_RX}
          ry={BORDER_RX}
          fill="none"
          stroke={STROKE_HOVER}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
      </svg>

      {/* Corner brackets — color shifts on hover (delay 50ms) */}
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      {/* Content */}
      <div className="relative flex h-full min-h-[180px] flex-col">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-canvas/45">
          {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
        </p>

        <div className="mt-auto">
          <p className="font-display text-2xl text-canvas md:text-3xl">{market.name}</p>

          {/*
            Descriptor reveal uses the grid-rows trick:
            grid-rows-[0fr] → group-hover:grid-rows-[1fr] animates intrinsic height.
            Inner div has overflow-hidden so content clips during animation.
          */}
          <div
            className="mt-3 grid grid-rows-[0fr] transition-[grid-template-rows,opacity] duration-200 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 opacity-0"
            style={{ transitionDelay: "150ms" }}
          >
            <div className="overflow-hidden">
              <div
                aria-hidden
                className="mb-2 h-px w-full"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, rgba(250,250,247,0.45) 0 4px, transparent 4px 8px)",
                }}
              />
              <p className="font-mono text-[12px] leading-snug text-canvas/65">
                {market.descriptor}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CornerBracket({ position }: { position: CornerPosition }) {
  const positionStyle = CORNER_POSITION_STYLE[position];

  return (
    <svg
      aria-hidden
      width={BRACKET_LEN}
      height={BRACKET_LEN}
      className="pointer-events-none absolute"
      style={{ ...positionStyle, transformOrigin: "center", transitionDelay: "50ms" }}
    >
      <path
        d={`M 0 0 L ${BRACKET_LEN} 0 M 0 0 L 0 ${BRACKET_LEN}`}
        stroke={STROKE_IDLE}
        strokeWidth="1"
        fill="none"
        strokeLinecap="square"
        className="transition-[stroke,stroke-width] duration-200 [.group:hover_&]:stroke-[1.5] [.group:hover_&]:[stroke:rgb(12_61_46_/_0.95)]"
      />
    </svg>
  );
}
```

Notes on the CSS-driven approach:
- **Stagger via `transitionDelay`**: the spec calls for border (0ms) → brackets (50ms) → tint (100ms) → descriptor (150ms). Each element sets its own `transitionDelay` inline — no JS timeline needed.
- **Why `grid-rows-[0fr] → grid-rows-[1fr]` instead of `height: auto`**: CSS can't transition `height: auto`. The grid-rows fr-unit trick is the modern CSS-only way to animate intrinsic height. Supported in Chrome 117+, Safari 17+, Firefox 119+. On older browsers the descriptor still appears — just without the height animation.
- **Brackets via arbitrary-variant `[.group:hover_&]:`**: SVG `<path>` doesn't get a `group-hover:stroke-...` Tailwind variant cleanly because Tailwind's stroke utility maps to CSS `stroke` property which works on SVG. The arbitrary-variant `[.group:hover_&]:` selector cascades the hover state from the `.group` ancestor.
- **`vectorEffect="non-scaling-stroke"`** on the rects keeps the stroke crisp at 1px regardless of how the SVG container is scaled.
- The border stroke at the rect edge is half-clipped (0.5px outside the SVG viewport) — at 1px stroke this is invisible. The previous `calc(100% - 1px)` width attribute was non-standard SVG and didn't work.

- [ ] **Step 3: Run typecheck + visual check**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Expected: PASS.

```bash
cd /home/mario/zksettle/frontend && pnpm dev
```

Open browser, scroll to Markets section, hover over each cell:
- The dashed border **crossfades to solid** (slightly thicker + darker forest) — both rects sit on top of each other, dashed fades out as solid fades in
- Corner brackets shift to thicker + darker stroke
- Background tint fades in (subtle forest wash) at ~100ms delay
- A **dashed leader line + descriptor text** expands down from below the market name (height grows from 0 to natural via grid-rows trick) at ~150ms delay
- All other cells fade to **opacity 60%** while one is hovered
- On mouse leave, all transitions reverse smoothly back to idle
- Move between cells fast — adjacent dim retargets to follow the hovered cell

If the descriptor doesn't animate height (only fades in instantly) on Firefox 118 or older Safari, that's the grid-rows-[fr] CSS feature unsupported there — descriptor still appears, just no height animation. Acceptable degradation.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git -C /home/mario/zksettle/frontend add src/components/landing/acts/market-cell.tsx src/components/landing/acts/act-five-markets.tsx
git -C /home/mario/zksettle/frontend commit -m "feat(landing): hover treatment for MarketCell

On hover, each cell crossfades a stacked solid SVG rect over the
dashed idle border, shifts the corner brackets to a heavier stroke,
fades in a forest tint, and expands a dashed leader line + descriptor
via the grid-rows-[0fr→1fr] CSS trick. Per-element transitionDelay
gives the staggered hand-built feel without a JS timeline. Adjacent
cells dim to 60% via parent isDimmed prop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Add `ActFiveMarkets` entrance animation, swap page, delete old act, cleanup copy

**Files:**
- Modify: `src/components/landing/acts/act-five-markets.tsx` (add entrance timeline)
- Modify: `src/app/page.tsx` (remove old act render, remove old import)
- Modify: `src/components/landing/acts/index.ts` (export new acts, remove old)
- Modify: `src/content/copy.ts` (remove `useCases` field)
- Delete: `src/components/landing/acts/act-four-move.tsx`

This is the final integration task. Done in one commit because the parts are interlocked — keeping the old act would leave dead code; removing it without removing `useCases` from the type breaks the type; removing `useCases` without removing the act breaks the build.

- [ ] **Step 1: Add entrance timeline to `ActFiveMarkets`**

Modify `src/components/landing/acts/act-five-markets.tsx`. Add imports at the top:

```tsx
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
```

Add the registration block right after the imports (mirror the pattern in `use-act-pin.ts`):

```tsx
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}
```

Inside the component body, after the `useActPin` call, add:

```tsx
  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const eyebrow = root.querySelector("[data-markets-eyebrow]");
        const cells = root.querySelectorAll("[data-markets-cell]");
        const divider = root.querySelector("[data-markets-divider]");
        const closer = root.querySelector("[data-markets-closer]");

        gsap.set(eyebrow, { opacity: 0, y: 8 });
        gsap.set(cells, { opacity: 0, y: 12 });
        gsap.set(divider, { scaleX: 0, transformOrigin: "left center" });
        gsap.set(closer, { opacity: 0, y: 12 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top 65%",
            once: true,
          },
          defaults: { ease: "power2.out" },
        });

        tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.3 })
          .to(cells, { opacity: 1, y: 0, duration: 0.32, stagger: 0.06 }, "-=0.1")
          .to(divider, { scaleX: 1, duration: 0.3 }, "-=0.1")
          .to(closer, { opacity: 1, y: 0, duration: 0.4 }, "-=0.15");
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );
```

- [ ] **Step 2: Update `page.tsx` to remove old act**

Replace `src/app/page.tsx` with:

```tsx
import { Footer } from "@/components/landing/footer";
import { ActOneHero, ActTwoParadox, ActThreeEngine, ActFourThreeLines, ActFiveMarkets } from "@/components/landing/acts";
import { Nav } from "@/components/landing/nav";
import { SmoothScrollProvider } from "@/components/landing/smooth-scroll-provider";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <Nav />
      <main id="main-content">
        <ActOneHero />
        <ActTwoParadox />
        <ActThreeEngine />
        <ActFourThreeLines />
        <ActFiveMarkets />
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
```

- [ ] **Step 3: Update `acts/index.ts`**

Replace `src/components/landing/acts/index.ts` with:

```ts
export { useActPin } from "./use-act-pin";
export { ActOneHero } from "./act-one-hero";
export { ActTwoParadox } from "./act-two-paradox";
export { ActThreeEngine } from "./act-three-engine";
export { ActFourThreeLines } from "./act-four-three-lines";
export { ActFiveMarkets } from "./act-five-markets";
```

- [ ] **Step 4: Delete the old act file**

```bash
rm /home/mario/zksettle/frontend/src/components/landing/acts/act-four-move.tsx
```

- [ ] **Step 5: Remove `useCases` from `MoveCopy` type and from the data**

In `src/content/copy.ts`, in the `MoveCopy` interface, remove the line:

```ts
  /** @deprecated removed after act-four-move.tsx is deleted */
  readonly useCases: readonly string[];
```

In the `move:` block of `COPY`, remove the entire `useCases: [...] as const,` array.

- [ ] **Step 6: Run typecheck + lint**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Expected: PASS. If any error like "ActFourMove not found" or "useCases referenced", grep for the offending name and remove the reference:

```bash
grep -rn "ActFourMove\|useCases" /home/mario/zksettle/frontend/src
```

```bash
cd /home/mario/zksettle/frontend && pnpm lint
```

Expected: PASS (or warnings only, no new errors).

- [ ] **Step 7: Visual check**

```bash
cd /home/mario/zksettle/frontend && pnpm dev
```

Open `http://localhost:3000` and scroll all the way through. Verify:
- Acts 1, 2, 3 unchanged
- **Act 4 (Three Lines)**: new typographic moment, headline + 3 numbered steps + footer, animates in once on view
- **Act 5 (Markets)**: eyebrow + 3×2 grid of blueprint cells + dashed divider + closer card. Cells stagger in on scroll into view. Hover any cell to verify ink-in + descriptor reveal still works
- **Old combined act is gone** — no second terminal, no second grid
- Footer renders below Act 5
- No console errors

Test reduced motion (DevTools Rendering panel → "Emulate CSS prefers-reduced-motion: reduce"): both new acts render content fully, no entrance animations, hover still works.

Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git -C /home/mario/zksettle/frontend add \
  src/components/landing/acts/act-five-markets.tsx \
  src/components/landing/acts/index.ts \
  src/app/page.tsx \
  src/content/copy.ts
git -C /home/mario/zksettle/frontend rm src/components/landing/acts/act-four-move.tsx
git -C /home/mario/zksettle/frontend commit -m "feat(landing): ship Act 4/5 redesign, retire ActFourMove

Adds entrance timeline to ActFiveMarkets (eyebrow + cells stagger +
divider + closer), swaps page composition to render the two new
acts in place of ActFourMove, deletes the old combined act file,
and drops the deprecated useCases field from MoveCopy now that
nothing references it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

**Spec coverage check:**
- Architecture (split into two acts, useActPin without progress) → Tasks 2, 3, 4, 7
- Act 4 composition + animation → Tasks 2, 3
- Act 5 composition + grid layout + closer → Task 4
- MarketCell idle blueprint anatomy → Task 5
- MarketCell hover treatment → Task 6
- Adjacent cell dimming → Task 6
- Act 5 entrance animation → Task 7
- Markets copy data → Task 1
- Cleanup of `ActFourMove` and `useCases` → Task 7
- Shared dashed visual language (8/6 pattern, tabular nums) → enforced consistently across Tasks 4–7
- `useActPin` reused without modification (already accepts optional `onUpdate`) → Tasks 2, 4
- Reduced-motion handling on entrance timelines → Tasks 3, 7 (via `gsap.matchMedia` wrapping the whole timeline). On hover → all hover transitions are CSS-only (Tailwind `transition-*` utilities + `group-hover:`); for reduced-motion users they should be disabled at the project level via a global `@media (prefers-reduced-motion: reduce)` rule that zeroes out transition-duration. If `globals.css` doesn't already have one, a follow-up commit can add it (out of scope for this plan — the user has unrelated pending edits to `globals.css` that we're not touching)

**Decisions punted to implementation (per spec "Open questions"):**
- Crosshair-follows-cursor on hover — not in plan, defer until visual feedback after Task 6
- `pathLength="1"` SVG draw-in for cell borders — replaced with simpler approach (cells fade-up with stagger, dashed borders are present from start). The "blueprint emerging" feel comes from the dashed pattern being visible from the moment each cell appears, not from drawing each rect's stroke. If after Task 7 the entrance feels flat, a follow-up commit can add the `pathLength`+`stroke-dashoffset` draw-in.

**Type/name consistency check:**
- `Market` interface defined Task 1, imported in Task 5 ✓
- Data attribute names consistent: `[data-three-lines-*]`, `[data-markets-*]`, `[data-cell-*]` ✓
- `useActPin` signature unchanged; called with `{ duration }` only in both new acts ✓

**Working tree safety:**
- Every commit step uses targeted `git add <path>`; no `git add .` or `git add -A` anywhere in the plan
- The user's pre-existing modifications to `globals.css`, `act-one-hero.tsx`, `hero.tsx`, `smooth-scroll-provider.tsx`, and `copy.ts` are not touched. Task 1 modifies `copy.ts` — the engineer should `git diff src/content/copy.ts` before staging to confirm the diff is only the additive `markets`/`Market` change, not unrelated edits from the user's working tree

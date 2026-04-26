# Act 4 / Act 5 Redesign — Three Lines + Six Markets Blueprint

**Status:** Approved design, ready for implementation plan
**Date:** 2026-04-25
**Scope:** Landing page closing acts — `src/components/landing/acts/act-four-move.tsx`

## Problem

The current `ActFourMove` packs three competing elements into one pinned scene: a scroll-driven typing terminal, a 2×3 markets grid squeezed into a 5-column gutter, and the closing CTA card. The scroll-driven typing feels strange (user controls animation with their finger), the terminal aesthetic is generic ("yet another fake terminal with mac dots"), and the grid — the section's strongest narrative beat ("one primitive, six markets") — is starved of space and treated as a bonus rather than a moment.

## Goals

1. Give the markets grid its own moment, full-width, with a hand-crafted blueprint aesthetic.
2. Replace the terminal with something tonally distinctive that doesn't read as a generic SDK demo.
3. Eliminate scroll-driven content reveals (typing, line-by-line). Entrances trigger once on view.
4. Maintain the pinned-act rhythm consistent with Acts 1–3 so the page cadence holds.

## Non-goals

- Rewriting the act-pin infrastructure (`use-act-pin.ts`).
- Changing the page-level scroll provider (Lenis stays).
- Modifying the closing CTA copy or destinations.
- Touching Acts 1–3.

## Architecture

Split the current single act into two sequential pinned acts:

- **`ActFourThreeLines`** — terminal moment. New file: `src/components/landing/acts/act-four-three-lines.tsx`.
- **`ActFiveMarkets`** — markets grid + closing card. New file: `src/components/landing/acts/act-five-markets.tsx`.

The current `act-four-move.tsx` is deleted. The acts index exports both new components in order. The page-level composition adds the new act after the old slot.

Both acts continue to use `useActPin` for consistency with the rest of the page, but stop subscribing to `progress`. Each act's content uses a single GSAP `ScrollTrigger` with `onEnter` to play its entrance timeline once. Reduced motion: timeline is set to its end state immediately, entrance is skipped.

### File layout

```
src/components/landing/acts/
  act-four-three-lines.tsx    (new — replaces act-four-move.tsx)
  act-five-markets.tsx         (new)
  index.ts                     (export both)
src/content/copy.ts            (add `markets` array with descriptors,
                                 keep `move.code` & `move.closer` references)
```

## Act 4 — Three Lines (terminal replacement)

The number "three" becomes the structure, not a metaphor.

### Composition

- Section: full viewport height, `bg-ink text-canvas`, atmospheric forest gradient inherited from current treatment.
- Centered max-w container (~`max-w-4xl`).
- Display headline: **"THREE LINES."** in display font, large (~`level="l"` of `DisplayHeading`).
- Hairline `<hr>` (1px, forest/30) above and below the steps block.
- Three rows, each:
  - Left column (`~80px`): step number in mono (`01`, `02`, `03`), separator dash, step label uppercase tracking-wide (`install` / `prove` / `wrap`).
  - Right column: code line in mono, larger size (~`text-lg md:text-xl`), accent color (`#5fb88f` for the SDK calls, canvas/55 for the prompt line).
- Footer line below the second `<hr>`: mono micro caps "✓ ready · 0 PII leaked" — affirmation, not terminal output.

### Copy (uses existing `COPY.move.code`)

```
01 ─ install   $ npm i @zksettle/sdk
02 ─ prove     zksettle.prove(credential)
03 ─ wrap      zksettle.wrap(transferIx, proof)
```

Labels `install` / `prove` / `wrap` are derived from each line — added inline in the component, not stored in copy (they describe the line, they aren't separate copy).

### Animation

Single GSAP timeline triggered `onEnter`:

1. Headline: y(20) → 0, opacity 0 → 1, 350ms, ease `power2.out`.
2. Top hairline: scaleX 0 → 1, transform-origin left, 280ms.
3. Three steps: stagger 80ms, y(12) → 0, opacity 0 → 1, 280ms each.
4. Bottom hairline: scaleX 0 → 1, 220ms.
5. Footer line: opacity 0 → 1, 200ms.

Total: ~700ms. No scroll progress hookup. No typing. No blinking cursor.

Reduced motion: skip timeline, render final state.

## Act 5 — Six Markets (the blueprint grid)

### Composition

- Section: full viewport height, `bg-ink text-canvas`, same atmospheric gradient.
- Container: `max-w-6xl mx-auto px-8 py-24`.
- Eyebrow: mono uppercase tracking-wide, "ONE PRIMITIVE. SIX MARKETS." — top of section.
- Grid: full container width, **3 columns × 2 rows**, `gap-px` is NOT used here (gap is real gap, ~`gap-6`), each cell is its own SVG-bordered card.
- Below grid: dashed full-width divider (matches grid border pattern).
- Closer card below divider: existing structure (headline + sub + 2 CTAs), no major changes other than living below the divider in the same act.

### Markets cell anatomy

Each cell is a positioned container roughly `~280×200px` (responsive). Inside (z-stacked):

1. **SVG layer** (absolute, full size of cell, `pointer-events-none`):
   - Single `<rect>` with `stroke-dasharray="8 6"`, `stroke="rgb(forest/30)"`, `fill="transparent"`, `stroke-width="1"`, rounded corners `rx="8"`. This is the dashed border.
   - Four corner brackets: short `<path>` strokes at each corner forming an L-bracket (~12px arms), same stroke color/width.
2. **Content layer** (relative, padded `p-6`):
   - Top row: `01/06` in mono micro caps (`text-[10px] tracking-[0.14em] font-mono text-canvas/40`), tabular nums.
   - Vertical spacer.
   - Market name: display font, `text-2xl md:text-3xl`, `text-canvas`, line-height tight.
   - Hidden by default — descriptor block: dashed leader line (CSS) + descriptor text (`text-[13px] font-mono text-canvas/55`).

Drop the `[live]` / `[soon]` top-right tag from the brainstorm (keep cells clean — the corner brackets carry enough top-right weight).

### Hover (per cell)

GSAP timeline created once on mount, replayed on enter / reversed on leave. Timeline duration ~400ms total, micro-staggered:

1. **t=0ms** — Border `<rect>`: stroke transitions to solid (`stroke-dasharray` animates to `"1 0"`), color shifts to forest/70, stroke-width to 1.5px. Use GSAP `to()` on stroke attributes (~250ms).
2. **t=50ms** — Corner brackets thicken to 1.5px, ~150ms.
3. **t=100ms** — Background tint: `bg-forest/[0.06]` fades in via opacity on a positioned div, 200ms.
4. **t=150ms** — Descriptor block (leader line + text): y(8) → 0, opacity 0 → 1, 200ms ease-out.

Adjacent cells: when any cell is hovered, the parent grid sets `data-hovering="true"`, and non-hovered cells receive `opacity-70` via CSS (transition 200ms). Achieved by a `:hover ~ *` style or, simpler, a React state in the grid container that passes `isDimmed` to each cell.

Reduced motion: hover transitions are CSS-only and instant; descriptor reveal still works (no motion just no slide-up).

### Entrance animation

Single GSAP timeline triggered `onEnter` on the section:

1. Eyebrow: opacity + y(8), 250ms.
2. Each cell, staggered 60ms in row-major order:
   - Border `<rect>`: stroke draws via `stroke-dashoffset` (set to path length, animated to 0), 350ms ease `power1.inOut`. The rect actually stays dashed at end — the draw-in just reveals the dashes one segment at a time. Implementation: set initial `stroke-dasharray` to the rect perimeter, transition to the final `"8 6"` via interpolation. Alternative simpler approach: use `pathLength="1"` on the rect, animate `stroke-dashoffset` from 1 to 0 with `stroke-dasharray="1"` initial, then on complete swap to final `"8 6"` dasharray. Choose the second approach for simplicity.
   - Corner brackets: opacity 0 → 1, 200ms, starts at 60% of border draw.
   - Cell content: opacity + y(8), 250ms, starts at 80% of border draw.
3. Divider below grid: scaleX 0 → 1, 280ms.
4. Closer card: opacity + y(12), 350ms.

Total: ~1.2s. Reduced motion skips and renders final state.

### Markets copy (new — added to `COPY.move`)

Replace `useCases: ReadonlyArray<string>` with `markets: ReadonlyArray<{ name: string; descriptor: string }>`:

```ts
markets: [
  { name: "Remittances",   descriptor: "Cross-border value, sub-second." },
  { name: "Payroll",       descriptor: "Salaries on-chain, amounts off-record." },
  { name: "DEX",           descriptor: "Private flow, public proof." },
  { name: "Bridges",       descriptor: "One identity, every chain." },
  { name: "Institutional", descriptor: "Desk-grade compliance, retail UX." },
  { name: "Settlements",   descriptor: "Batch clearing, zero PII." },
] as const,
```

The `MoveCopy` type in `copy.ts` updates accordingly. The old `useCases` field is removed (no longer referenced after the refactor).

## Shared visual language

All dashed strokes in both acts use the same pattern: `stroke-dasharray="8 6"`, `stroke-width="1"`, `stroke="rgb(forest / 0.30)"` idle. This becomes the "blueprint vocabulary" of the closing acts:

- Act 4 hairlines (top + bottom of steps block): solid 1px forest/30 (these are anchors, not dashed — the dashed motif is reserved for the grid where it carries meaning).
- Act 5 cell borders, corner brackets, leader lines, divider above closer: dashed `8 6`.

Tabular numerals enabled site-wide for these acts via `font-feature-settings: "tnum"` on the mono font usages where numbers appear (`01`, `02`, `03`, `01/06`).

## Pinning behavior

Both acts call `useActPin` with the same `duration` parameter (current value `+=150%`). Neither passes `onUpdate` — `useActPin` already accepts it as optional, no hook change needed. The pin still creates the "stops scroll while you take in the scene" beat that matches Acts 1–3, but the content inside is static-once-revealed.

`useActPin` only pins on `(min-width: 768px) and (prefers-reduced-motion: no-preference)` — so on mobile and on users with reduced motion, the section flows naturally with no pin. The entrance animations also need their own reduced-motion guard inside the components (see Animation sections above), since the pin's media query and the animation's media query are separate concerns.

## Performance

- All hover and entrance animations are GPU-friendly (transform, opacity, stroke attrs). No layout thrashing.
- Each market cell mounts its own hover timeline once via `useGSAP`. No timeline recreated on hover events.
- SVG borders use a single `<rect>` per cell + 4 short `<path>` brackets. ~60 SVG nodes total for 6 cells. Negligible.
- The atmospheric gradient + faint grid texture overlay carry over from current implementation (already optimized).

## Accessibility

- Section landmarks preserved: `aria-labelledby` on each section.
- Headlines keep their semantic levels.
- Hover content (descriptors) must also be visible on focus — cells are not interactive in idle, so add `tabindex="0"` to each cell wrapper, with a `:focus-within` style that mirrors hover state. Cells without a navigation target don't need to be keyboard-focusable; the descriptors aren't critical info, they're flavor. **Decision:** cells stay non-focusable. Descriptors are visual delight, not load-bearing content. Accept the accessibility tradeoff explicitly — the market name (the load-bearing info) is always visible.
- Reduced motion: respected on all entrance and hover timelines.
- Color contrast: descriptor text at canvas/55 on ink — verify ≥ 3:1 in implementation; if not, bump to canvas/65.

## Open questions deferred to implementation

- **Crosshair-follows-cursor on hover** — mentioned in brainstorm as "decide after seeing in browser". Default: skip. Add only if the cell feels visually inert at idle once we see it live.
- **Tabular nums implementation** — likely already configured on the mono font; verify rather than re-add.
- **Exact `stroke-dashoffset` initial value for entrance draw** — depends on rect perimeter; use `pathLength="1"` trick to avoid measuring at runtime.

## Files changed

- `src/components/landing/acts/act-four-move.tsx` — deleted
- `src/components/landing/acts/act-four-three-lines.tsx` — new
- `src/components/landing/acts/act-five-markets.tsx` — new
- `src/components/landing/acts/index.ts` — export both new components
- `src/content/copy.ts` — `MoveCopy` type updated, `useCases` → `markets`
- `src/app/page.tsx` — swap `<ActFourMove />` for `<ActFourThreeLines />` + `<ActFiveMarkets />`, update import

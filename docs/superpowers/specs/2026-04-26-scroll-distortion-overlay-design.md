# Scroll-Velocity Distortion Overlay — Design Spec

## Overview

Add a dedicated WebGL shader pass (`ScrollDistortion`) that renders a subtle grain + chromatic aberration + noise distortion overlay on the last two landing sections (Act Three Engine, Act Five Markets). The effect is driven entirely by scroll velocity — idle shows near-zero visual noise; fast scrolling intensifies grain, chromatic split, and UV displacement.

## Motivation

Reference: [Codrops — On-Scroll Image Distortion and Grain Effect](https://tympanus.net/Tutorials/ShaderOnScroll/). The original demo applies per-image WebGL distortion driven by scroll velocity and mouse hover. We adapt only the scroll-velocity component as a fullscreen overlay, since our sections are card-based layouts (not standalone images) and we only want the scroll-driven behavior.

## Architecture

### New files

| File | Purpose |
|------|---------|
| `canvas/passes/scroll-distortion.ts` | `ScrollDistortion` class — fullscreen triangle mesh with `RawShaderMaterial`, same pattern as `LensWhisper` |
| `canvas/shaders/scroll-distortion.frag.ts` | Fragment shader — grain, chromatic aberration, FBM UV displacement, all proportional to `u_scrollVelocity` |

### Modified files

| File | Change |
|------|--------|
| `canvas/types.ts` | Add `scrollVelocity`, `actThreeProgress`, `actFiveProgress` to `ScrollState` |
| `canvas/persistent-canvas.tsx` | Instantiate `ScrollDistortion`, compute scroll velocity, compute visibility for Act Three/Five, pipe uniforms each frame |
| `acts/act-three-engine.tsx` | Write `actThreeProgress` to `scrollStateRef` from existing `useActPin` `onUpdate` |
| `acts/act-five-markets.tsx` | Add `onUpdate` to `useActPin`, write `actFiveProgress` to `scrollStateRef` |

## Scroll Velocity Pipeline

### Calculation (in `persistent-canvas.tsx` tick loop)

```
rawVelocity = abs(scrollY - lastScrollY) / dt
normalizedVelocity = clamp(rawVelocity / 1500, 0, 1)
smoothVelocity += (normalizedVelocity - smoothVelocity) * (1 - exp(-dt * 6))
```

- `1500 px/s` is the normalization ceiling — fast flick scroll hits ~1.0, normal scroll ~0.2–0.4
- Exponential lerp with factor 6 gives snappy attack (~170ms to peak) and smooth decay (~300ms to settle)
- `scrollY` is read from `window.scrollY` (already used in the tick loop)

### Storage

Added to `ScrollState`:
- `scrollVelocity: number` — smoothed 0–1 value, written by `persistent-canvas.tsx`
- `actThreeProgress: number` — 0–1 pin progress, written by `act-three-engine.tsx`
- `actFiveProgress: number` — 0–1 pin progress, written by `act-five-markets.tsx`

## ScrollDistortion Pass

### Class API

```ts
class ScrollDistortion {
  constructor()
  addToScene(scene: Scene): void
  setSize(w: number, h: number, pixelRatio: number): void
  setOpacity(o: number): void
  setScrollVelocity(v: number): void
  step(time: number): void
  dispose(): void
}
```

Same pattern as `LensWhisper`. Uses `fullscreen.vert.ts` (existing). Mesh has `renderOrder = 1` (above LensWhisper at default 0).

### Uniforms

| Uniform | Type | Range | Source |
|---------|------|-------|--------|
| `u_time` | float | seconds | `performance.now() * 0.001` |
| `u_res` | vec2 | pixels | `w * pixelRatio, h * pixelRatio` |
| `u_opacity` | float | 0–1 | visibility calculation |
| `u_scrollVelocity` | float | 0–1 | smoothed scroll velocity |

### Fragment Shader Effects

All effects scale with `u_scrollVelocity` (called `vel` below):

**Grain:**
- `hash2(gl_FragCoord.xy + fract(u_time * 43.0) * 1000.0) - 0.5`
- Intensity: `mix(0.02, 0.08, vel)` — barely visible at rest, pronounced when scrolling fast

**Chromatic aberration:**
- Offset R channel by `vec2(-amount, amount * 0.5)`, B channel by `vec2(amount, -amount * 0.5)`, G stays centered
- `amount = vel * 0.012` — zero at rest, ~12px split at max velocity (at 1080p)

**FBM UV displacement:**
- `displacement = fbm(uv * 4.0 + u_time * 0.1) * vel * 0.003`
- Applied to UV before sampling grain/aberration — adds organic wobble during fast scroll

**Output composition:**
- Base color is transparent black `vec4(0.0)`
- Grain is additive
- Chromatic aberration renders as colored fringe on the grain/noise pattern
- Final alpha = `u_opacity * max(vel * 1.5, grain_floor)` where `grain_floor ≈ 0.015` provides the idle-state minimal grain

## Visibility Logic (in tick loop)

```
// Act Three visibility
actThreeProgress = scrollStateRef.current.actThreeProgress
if actThreeProgress > 0 && actThreeProgress < 1:
  if actThreeProgress < 0.05: actThreeVis = actThreeProgress / 0.05
  else if actThreeProgress > 0.9: actThreeVis = (1 - actThreeProgress) / 0.1
  else: actThreeVis = 1.0

// Act Five visibility — same pattern
actFiveProgress = scrollStateRef.current.actFiveProgress
// ...identical fade-in/out ramp

scrollDistortionVis = max(actThreeVis, actFiveVis)
// Smooth via exponential lerp (same as existing visibilityOpacity)
scrollDistortionOpacity += (scrollDistortionVis - scrollDistortionOpacity) * (1 - exp(-dt * 7))

scrollDistortion.setOpacity(scrollDistortionOpacity)
scrollDistortion.setScrollVelocity(smoothVelocity)
```

## Component Integration

### act-three-engine.tsx

Already has `useActPin` with `onUpdate`. Add:
- Import `useCanvasStage`
- In `onUpdate`: `scrollStateRef.current.actThreeProgress = progress`
- Cleanup: reset to 0 (in the `useGSAP` cleanup, same pattern as `act-two-paradox.tsx`)

### act-five-markets.tsx

Currently calls `useActPin` without `onUpdate`. Add:
- Import `useCanvasStage`
- Add `onUpdate` callback: `scrollStateRef.current.actFiveProgress = progress`
- Cleanup: reset to 0

## Reduced Motion / Mobile

The `CanvasStageProvider` already disables the entire canvas on `prefers-reduced-motion` and mobile (<768px). The new pass inherits this behavior — no additional checks needed.

## Performance

- The shader is intentionally minimal: 1 FBM call (4 octaves), 3 texture-coordinate offsets, 1 hash. Well under 0.5ms per frame on integrated GPUs.
- When `u_opacity ≈ 0` AND `u_scrollVelocity ≈ 0`, the fragment shader is essentially a no-op (early multiply by near-zero).
- Existing tier downgrade system (FPS monitoring) covers regression if somehow the pass is too heavy — it will reduce DPR.

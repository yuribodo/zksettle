# Act 2 — Hologram Theater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 3-phase pinned slideshow Act 2 with a single fullbleed scene: hologram-glitch WebGL shader background + fullbleed video + animated headline overlay.

**Architecture:** Three stacked layers (shader canvas z-0, video z-10, text z-20) in a 100vh unpinned section. WebGL canvas runs a custom fragment shader with scan lines, RGB chromatic aberration, and periodic micro-glitches. IntersectionObserver triggers video autoplay and headline transition. Graceful fallbacks for no-WebGL, prefers-reduced-motion, and TBD video asset.

**Tech Stack:** React 19, Three.js (RawShaderMaterial, fullscreen quad), GLSL, IntersectionObserver, CSS transitions, Tailwind

---

## File Structure

```
frontend/src/components/landing/canvas/shaders/
  hologram-glitch.vert.ts    (CREATE) — fullscreen quad vertex shader (reuses FULLSCREEN_VERT pattern)
  hologram-glitch.frag.ts    (CREATE) — fragment shader: scan lines, RGB split, micro-glitch, vignette, grain

frontend/src/components/landing/acts/
  hologram-canvas.tsx         (CREATE) — React component: standalone WebGL canvas with IO pause/resume
  act-two-paradox.tsx         (REWRITE) — section composition: 3 layers, IO, state, text animation

frontend/src/content/
  copy.ts                     (MODIFY) — simplify ParadoxActCopy: remove recap fields, add closer
```

---

### Task 1: Hologram Glitch Shaders

**Files:**
- Create: `frontend/src/components/landing/canvas/shaders/hologram-glitch.vert.ts`
- Create: `frontend/src/components/landing/canvas/shaders/hologram-glitch.frag.ts`

- [ ] **Step 1: Create the vertex shader**

Create `frontend/src/components/landing/canvas/shaders/hologram-glitch.vert.ts`:

```ts
export const HOLOGRAM_GLITCH_VERT = /* glsl */ `
precision highp float;
attribute vec3 position;
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
```

This is identical to `fullscreen.vert.ts` — a separate file keeps the hologram shader self-contained.

- [ ] **Step 2: Create the fragment shader**

Create `frontend/src/components/landing/canvas/shaders/hologram-glitch.frag.ts`:

```ts
export const HOLOGRAM_GLITCH_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uGlitchSeed;
uniform float uReducedMotion;

// --- noise ---
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float t = uTime;
  float live = 1.0 - uReducedMotion;

  // --- base gradient: dark with teal tint ---
  vec3 col = mix(vec3(0.02, 0.04, 0.05), vec3(0.04, 0.10, 0.09), uv.y);

  // --- grain ---
  vec2 grainSeed = gl_FragCoord.xy + fract(t * 43.0) * vec2(1973.0, 9277.0);
  float grain = (hash(grainSeed) - 0.5) * 0.04;
  col += grain;

  // --- scan lines (roll upward) ---
  float scanSpeed = 30.0;
  float scanDensity = 1.8;
  float scan = sin((gl_FragCoord.y + t * scanSpeed * live) * scanDensity) * 0.5 + 0.5;
  scan = smoothstep(0.3, 0.7, scan);
  col *= 0.92 + scan * 0.08;

  // --- secondary fine scan lines ---
  float fineScan = sin((gl_FragCoord.y + t * 15.0 * live) * 6.0) * 0.5 + 0.5;
  fineScan = smoothstep(0.4, 0.6, fineScan);
  col *= 0.96 + fineScan * 0.04;

  // --- RGB chromatic aberration (constant ±2px offset) ---
  float caOffset = 2.0 / uResolution.x;
  float rShift = hash(vec2(floor(gl_FragCoord.y), 0.0) + fract(t * 0.1) * 100.0);
  col.r *= 1.0 + (rShift - 0.5) * 0.03;
  vec2 uvR = vec2(uv.x + caOffset, uv.y);
  vec2 uvB = vec2(uv.x - caOffset, uv.y);
  float rNoise = noise(uvR * 8.0 + t * 0.5);
  float bNoise = noise(uvB * 8.0 + t * 0.5);
  col.r += (rNoise - 0.5) * 0.015;
  col.b += (bNoise - 0.5) * 0.015;

  // --- micro-glitch (horizontal band displacement every 3-5s) ---
  float glitchCycle = uGlitchSeed;
  float glitchBand = step(0.85, fract(glitchCycle * 0.27 + uv.y * 3.7));
  float glitchIntensity = step(0.92, fract(sin(glitchCycle * 43758.5453)));
  float glitch = glitchBand * glitchIntensity * live;
  float displacement = (hash(vec2(floor(gl_FragCoord.y * 0.1), glitchCycle)) - 0.5) * 0.06;
  vec2 glitchUv = uv + vec2(displacement * glitch, 0.0);
  float glitchNoise = noise(glitchUv * 12.0 + t);
  col += vec3(0.04, 0.12, 0.10) * glitch * glitchNoise;

  // --- teal glow at center ---
  float centerGlow = exp(-length((uv - 0.5) * vec2(1.6, 1.0)) * 2.5);
  col += vec3(0.02, 0.06, 0.05) * centerGlow;

  // --- vignette ---
  float vd = length((uv - 0.5) * vec2(1.4, 1.0));
  float vignette = 1.0 - smoothstep(0.4, 1.0, vd);
  col *= vignette;

  // --- clamp ---
  col = max(col, vec3(0.0));

  gl_FragColor = vec4(col, 1.0);
}
`;
```

- [ ] **Step 3: Verify shaders compile (visual test later)**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: no errors related to the new shader files (they're just exported string constants).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/canvas/shaders/hologram-glitch.vert.ts frontend/src/components/landing/canvas/shaders/hologram-glitch.frag.ts
git commit -m "feat(landing): add hologram-glitch GLSL shaders"
```

---

### Task 2: HologramCanvas React Component

**Files:**
- Create: `frontend/src/components/landing/acts/hologram-canvas.tsx`
- Reference: `frontend/src/components/landing/canvas/passes/lens-whisper.ts` (pattern to follow)

- [ ] **Step 1: Create HologramCanvas component**

Create `frontend/src/components/landing/acts/hologram-canvas.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";

import { HOLOGRAM_GLITCH_VERT } from "../canvas/shaders/hologram-glitch.vert";
import { HOLOGRAM_GLITCH_FRAG } from "../canvas/shaders/hologram-glitch.frag";

function probeWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function HologramCanvas({ paused = false }: { paused?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!probeWebGL()) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "default",
      });
    } catch {
      return;
    }

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.0 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    renderer.setClearColor(0x050505, 1);
    container.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 10);
    camera.position.z = 5;

    const material = new RawShaderMaterial({
      vertexShader: HOLOGRAM_GLITCH_VERT,
      fragmentShader: HOLOGRAM_GLITCH_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Vector2(w * dpr, h * dpr) },
        uGlitchSeed: { value: 0 },
        uReducedMotion: { value: reducedMotion ? 1.0 : 0.0 },
      },
    });

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mesh = new Mesh(geo, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const onResize = () => {
      const rw = container.clientWidth || window.innerWidth;
      const rh = container.clientHeight || window.innerHeight;
      renderer.setSize(rw, rh);
      (material.uniforms.uResolution!.value as Vector2).set(rw * dpr, rh * dpr);
    };
    window.addEventListener("resize", onResize);

    let glitchTimer = 0;
    let glitchSeed = Math.random() * 1000;
    const GLITCH_INTERVAL = isMobile ? 6.0 : 3.5;

    let rafId = 0;
    let lastTime = performance.now();

    const tick = () => {
      if (pausedRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();
      const dt = Math.min(now - lastTime, 64) / 1000;
      lastTime = now;
      const t = now * 0.001;

      glitchTimer += dt;
      if (glitchTimer >= GLITCH_INTERVAL) {
        glitchTimer = 0;
        glitchSeed = Math.random() * 1000;
      }

      material.uniforms.uTime!.value = t;
      material.uniforms.uGlitchSeed!.value = glitchSeed;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      geo.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="absolute inset-0 z-0"
      style={{ contain: "strict" }}
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/acts/hologram-canvas.tsx
git commit -m "feat(landing): add HologramCanvas WebGL component"
```

---

### Task 3: Simplify Copy Types

**Files:**
- Modify: `frontend/src/content/copy.ts`

- [ ] **Step 1: Simplify ParadoxActCopy interface and data**

In `frontend/src/content/copy.ts`:

Replace the `RecapField` interface and `ParadoxActCopy` interface (lines 17-33) with:

```ts
export interface ParadoxActCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly closer: string;
}
```

Replace the `paradoxAct` data (lines 92-114) with:

```ts
  paradoxAct: {
    eyebrow: "$9T moved in 2025. Until now, only one option.",
    headline: "Same transaction. Two realities.",
    closer: "Compliance and privacy — one proof.",
  },
```

Remove the `RecapField` interface entirely (lines 17-21). Remove its import/usage if referenced elsewhere (currently only in `act-two-paradox.tsx` which gets rewritten in Task 4).

Update the `LandingCopy` interface — `paradoxAct` already points to `ParadoxActCopy`, so no change needed there.

- [ ] **Step 2: Type-check**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: errors in `act-two-paradox.tsx` (it still references `headline` as array, `leftLabel`, `rightLabel`, `recap`). These are expected and will be fixed in Task 4. No other files should error.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/content/copy.ts
git commit -m "refactor(landing): simplify ParadoxActCopy, remove recap fields"
```

---

### Task 4: Rewrite ActTwoParadox

**Files:**
- Rewrite: `frontend/src/components/landing/acts/act-two-paradox.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `frontend/src/components/landing/acts/act-two-paradox.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { HologramCanvas } from "./hologram-canvas";

export function ActTwoParadox() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStarted, setVideoStarted] = useState(false);
  const [canvasOff, setCanvasOff] = useState(false);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const triggerVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || videoStarted) return;
    if (reducedMotion) return;
    video.play().then(() => setVideoStarted(true)).catch(() => {});
  }, [videoStarted, reducedMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry!.isIntersecting) {
          triggerVideo();
          setCanvasOff(false);
        } else {
          setCanvasOff(true);
        }
      },
      { threshold: 0.5 },
    );

    io.observe(section);
    return () => io.disconnect();
  }, [triggerVideo]);

  const { eyebrow, headline, closer } = COPY.paradoxAct;

  return (
    <section
      ref={sectionRef}
      id="act-two-paradox"
      aria-labelledby="act-two-heading"
      className="relative isolate h-screen w-full overflow-hidden bg-[#050505]"
    >
      {/* Layer 0 — Shader */}
      <HologramCanvas paused={canvasOff} />

      {/* Layer 1 — Video */}
      <div className="absolute inset-0 z-10">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          loop
          preload="metadata"
          poster=""
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Layer 2 — Text */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-5 md:px-8">
        {/* Eyebrow — fades out when video starts */}
        <p
          className="font-mono text-xs uppercase tracking-[0.08em] text-stone transition-opacity duration-[400ms]"
          style={{ opacity: videoStarted ? 0 : 1 }}
        >
          {eyebrow}
        </p>

        {/* Headline — centered initially, migrates to top when video starts */}
        <DisplayHeading
          id="act-two-heading"
          level="xl"
          className="mt-4 max-w-[18ch] text-center text-white transition-all duration-[600ms] ease-out"
          style={{
            textShadow: "0 2px 24px rgba(0,0,0,0.6)",
            transform: videoStarted ? "translateY(-40vh) scale(0.8)" : "translateY(0) scale(1)",
            ...(videoStarted ? { position: "absolute", top: "50%" } : {}),
          }}
        >
          {headline}
        </DisplayHeading>

        {/* Closer — always visible (video TBD), fades in with delay once video plays */}
        <p
          className="absolute bottom-12 font-mono text-sm tracking-[0.06em] text-white/80 transition-opacity duration-[800ms]"
          style={{
            opacity: videoStarted ? 1 : 0.8,
            transitionDelay: videoStarted ? "1500ms" : "0ms",
          }}
        >
          {closer}
        </p>
      </div>

      {/* Unmute toggle — bottom-right corner */}
      {videoStarted && (
        <UnmuteToggle videoRef={videoRef} />
      )}

      {/* Reduced-motion fallback: manual play button */}
      {reducedMotion && !videoStarted && (
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (video) video.play().then(() => setVideoStarted(true)).catch(() => {});
          }}
          className="absolute inset-0 z-30 flex items-center justify-center"
          aria-label="Play video"
        >
          <span className="rounded-full border border-white/40 bg-black/50 p-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
              <path d="M12 8L26 16L12 24V8Z" fill="white" fillOpacity="0.8" />
            </svg>
          </span>
        </button>
      )}
    </section>
  );
}
function UnmuteToggle({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [muted, setMuted] = useState(true);

  return (
    <button
      type="button"
      className="absolute bottom-4 right-4 z-30 rounded-full border border-white/20 bg-black/40 p-2 text-white/50 transition-colors hover:bg-black/60 hover:text-white/80"
      aria-label={muted ? "Unmute video" : "Mute video"}
      onClick={() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setMuted(video.muted);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        {muted ? (
          <path d="M8 2L4 6H1v4h3l4 4V2zm3 3.5v5m2.5-7.5v10" stroke="currentColor" strokeWidth="1.2" fill="none" />
        ) : (
          <path d="M8 2L4 6H1v4h3l4 4V2zm3 4.5c.5.5.5 1.5 0 2m1.5-4c1.2 1.2 1.2 3.8 0 5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        )}
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: PASS — no errors.

- [ ] **Step 3: Verify barrel export**

Check `frontend/src/components/landing/acts/index.ts` — it already exports `ActTwoParadox` from `"./act-two-paradox"`. No changes needed since the component name and file path are the same.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/acts/act-two-paradox.tsx
git commit -m "feat(landing): rewrite Act 2 as Hologram Theater — fullbleed shader + video"
```

---

### Task 5: CSS Fallback for No-WebGL

**Files:**
- Modify: `frontend/src/components/landing/acts/hologram-canvas.tsx`

- [ ] **Step 1: Add CSS fallback when WebGL is unavailable**

In `hologram-canvas.tsx`, the `probeWebGL()` check returns early if WebGL is missing. The canvas `<div>` renders but stays empty. Add a fallback by changing the return JSX to:

```tsx
  const [webglAvailable, setWebglAvailable] = useState(true);

  useEffect(() => {
    if (!probeWebGL()) setWebglAvailable(false);
    // ... rest of existing useEffect (wrap the WebGL init in the check)
  }, []);
```

Actually, a simpler approach: keep the existing `useEffect` which already returns early if WebGL is missing. Add a CSS fallback as a sibling that shows when canvas has no child:

Replace the return in `HologramCanvas` with:

```tsx
  return (
    <div
      ref={containerRef}
      aria-hidden
      className="absolute inset-0 z-0"
      style={{ contain: "strict" }}
    >
      {/* CSS fallback — hidden once WebGL canvas is appended */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(10,40,35,0.4) 0%, rgba(5,5,5,1) 70%)",
          backgroundSize: "100% 100%",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,0.015) 2px, rgba(0,255,200,0.015) 4px)",
          }}
        />
      </div>
    </div>
  );
```

The CSS fallback `<div>` lives inside the container. When WebGL initializes, the canvas element is appended after it — and since the WebGL canvas fills the container with `position: absolute` styling via Three.js, it naturally covers the CSS fallback. If WebGL fails, the CSS fallback is all that shows.

- [ ] **Step 2: Type-check**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/acts/hologram-canvas.tsx
git commit -m "feat(landing): add CSS fallback for HologramCanvas when WebGL unavailable"
```

---

### Task 6: Visual Verification and Polish

**Files:**
- Possibly tweak: `frontend/src/components/landing/acts/act-two-paradox.tsx`
- Possibly tweak: `frontend/src/components/landing/canvas/shaders/hologram-glitch.frag.ts`

- [ ] **Step 1: Start dev server**

Run: `cd /home/mario/zksettle/frontend && npm run dev`

- [ ] **Step 2: Open browser and verify Act 2**

Navigate to `http://localhost:3000` and scroll to Act 2. Verify:

1. Hologram-glitch shader renders as background (dark teal gradient, scan lines rolling, occasional micro-glitch)
2. Headline "Same transaction. Two realities." is centered with eyebrow above it
3. Since no video file is set yet, the video layer should be transparent/empty — shader shows through clearly
4. Closer text appears at the bottom
5. Section is exactly one viewport height, no pin
6. Scrolling past is smooth (no scroll-jacking)

- [ ] **Step 3: Test reduced-motion**

In Chrome DevTools → Rendering → check "Emulate CSS media feature prefers-reduced-motion: reduce":

1. Shader should show static base (no scan line animation, no glitch)
2. Headline should be at the top already (no transition)
3. Play button should appear if a video source were set

- [ ] **Step 4: Test WebGL fallback**

In Chrome DevTools Console, temporarily add before reload:

```js
HTMLCanvasElement.prototype.getContext = function() { return null; };
```

Verify the CSS fallback gradient + scan lines render instead of the WebGL canvas.

- [ ] **Step 5: Tune shader parameters if needed**

If the shader feels too intense or too subtle, adjust these values in `hologram-glitch.frag.ts`:

- Scan line speed: `scanSpeed` (currently `30.0`)
- Scan line visibility: the `0.92 + scan * 0.08` multiplier
- Glitch frequency: `GLITCH_INTERVAL` in `hologram-canvas.tsx` (currently `3.5` seconds)
- RGB split strength: `caOffset` (currently `2.0 / uResolution.x`)
- Vignette: `smoothstep(0.4, 1.0, vd)` range
- Teal tint: base gradient colors `vec3(0.02, 0.04, 0.05)` and `vec3(0.04, 0.10, 0.09)`

- [ ] **Step 6: Tune headline animation if needed**

If the headline transition feels off:
- Duration: `duration-[600ms]` in the className
- Easing: `ease-out` — try `cubic-bezier(0.16, 1, 0.3, 1)` for a snappier feel
- Y offset: `-40vh` — adjust if headline ends up too high or low at top
- Scale: `0.8` — adjust for readability at final position

- [ ] **Step 7: Commit any polish tweaks**

```bash
git add -u
git commit -m "fix(landing): tune hologram shader and headline animation"
```

---

### Task 7: Cleanup Dead Code

**Files:**
- Modify: `frontend/src/content/copy.ts` (verify already done in Task 3)
- Verify: `frontend/src/components/landing/acts/act-two-paradox.tsx` (old code gone)

- [ ] **Step 1: Verify no dead references remain**

Run: `cd /home/mario/zksettle/frontend && grep -rn "RecapField\|RecapColumn\|PhaseLayer\|ActTwoRecap\|ActTwoVideoCenterpiece\|PlayGlyph\|fadeWindow\|clamp01\|leftLabel\|rightLabel\|leftFields\|rightFields" src/ --include="*.ts" --include="*.tsx" 2>&1 | grep -v node_modules`

Expected: no matches. All old code was removed in Tasks 3 and 4.

- [ ] **Step 2: Verify useActPin is not imported in act-two**

Run: `grep -n "useActPin" frontend/src/components/landing/acts/act-two-paradox.tsx`

Expected: no matches (the new component doesn't use pinning).

- [ ] **Step 3: Full type-check**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit --pretty`

Expected: PASS — zero errors.

- [ ] **Step 4: Build check**

Run: `cd /home/mario/zksettle/frontend && npm run build 2>&1 | tail -20`

Expected: build succeeds.

- [ ] **Step 5: Commit if any cleanup was needed**

```bash
git add -u
git commit -m "chore(landing): remove dead Act 2 code"
```

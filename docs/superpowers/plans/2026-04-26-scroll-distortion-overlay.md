# Scroll-Velocity Distortion Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight fullscreen WebGL overlay (grain + chromatic aberration + FBM UV displacement) that activates during Act Three and Act Five sections, driven by scroll velocity.

**Architecture:** New `ScrollDistortion` pass (same pattern as existing `LensWhisper`) with its own fragment shader. Scroll velocity is computed in the `PersistentCanvas` tick loop and piped as a uniform. Act progress values are written by the section components into `ScrollState` via `scrollStateRef`.

**Tech Stack:** Three.js (`RawShaderMaterial`, `BufferGeometry`, `Mesh`), GLSL, GSAP ScrollTrigger, React refs

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/components/landing/canvas/types.ts` | Modify | Add `scrollVelocity`, `actThreeProgress`, `actFiveProgress` to `ScrollState` |
| `frontend/src/components/landing/canvas/shaders/scroll-distortion.frag.ts` | Create | Fragment shader: grain, chromatic aberration, FBM UV displacement |
| `frontend/src/components/landing/canvas/passes/scroll-distortion.ts` | Create | `ScrollDistortion` class: fullscreen mesh, uniform setters |
| `frontend/src/components/landing/canvas/persistent-canvas.tsx` | Modify | Instantiate pass, compute velocity + visibility, pipe uniforms per frame |
| `frontend/src/components/landing/acts/act-three-engine.tsx` | Modify | Write `actThreeProgress` to `scrollStateRef` |
| `frontend/src/components/landing/acts/act-five-markets.tsx` | Modify | Write `actFiveProgress` to `scrollStateRef` |

---

### Task 1: Extend ScrollState with new fields

**Files:**
- Modify: `frontend/src/components/landing/canvas/types.ts:1-21`

- [ ] **Step 1: Add new fields to `ScrollState` type and `createScrollState`**

In `frontend/src/components/landing/canvas/types.ts`, add three new fields after `breachProgress`:

```ts
export type ScrollState = {
  global: number;
  mouseTarget: { x: number; y: number };
  mouse: { x: number; y: number };
  rippleProgress: number;
  targetLuminance: number;
  actTwoProgress: number;
  breachProgress: number;
  scrollVelocity: number;
  actThreeProgress: number;
  actFiveProgress: number;
};

export function createScrollState(): ScrollState {
  return {
    global: 0,
    mouseTarget: { x: 0, y: 0 },
    mouse: { x: 0, y: 0 },
    rippleProgress: 0,
    targetLuminance: 0,
    actTwoProgress: 0,
    breachProgress: 0,
    scrollVelocity: 0,
    actThreeProgress: 0,
    actFiveProgress: 0,
  };
}
```

- [ ] **Step 2: Verify the project still compiles**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit`
Expected: No errors (new fields are additive, all existing code still works)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/canvas/types.ts
git commit -m "feat(canvas): add scrollVelocity and act progress fields to ScrollState"
```

---

### Task 2: Create the scroll-distortion fragment shader

**Files:**
- Create: `frontend/src/components/landing/canvas/shaders/scroll-distortion.frag.ts`

- [ ] **Step 1: Write the fragment shader**

Create `frontend/src/components/landing/canvas/shaders/scroll-distortion.frag.ts`:

```ts
export const SCROLL_DISTORTION_FRAG = /* glsl */ `
precision highp float;

uniform float u_time;
uniform vec2 u_res;
uniform float u_opacity;
uniform float u_scrollVelocity;

varying vec2 vUv;

float hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float vel = u_scrollVelocity;

  // FBM UV displacement — organic wobble during fast scroll
  float displaceAmount = vel * 0.003;
  vec2 displace = vec2(
    fbm(uv * 4.0 + u_time * 0.1) - 0.5,
    fbm(uv * 4.0 + u_time * 0.1 + 100.0) - 0.5
  ) * displaceAmount;
  vec2 distortedUv = uv + displace;

  // Chromatic aberration — offset R and B channels
  float chromAmount = vel * 0.012;
  vec2 uvR = distortedUv + vec2(-chromAmount, chromAmount * 0.5);
  vec2 uvB = distortedUv + vec2(chromAmount, -chromAmount * 0.5);

  // Grain per channel (time-varying so it shimmers)
  float grainIntensity = mix(0.02, 0.08, vel);
  float grainR = (hash2(floor(uvR * u_res) + fract(u_time * 43.0) * 1000.0) - 0.5) * grainIntensity;
  float grainG = (hash2(floor(distortedUv * u_res) + fract(u_time * 43.0) * 1000.0) - 0.5) * grainIntensity;
  float grainB = (hash2(floor(uvB * u_res) + fract(u_time * 43.0) * 1000.0) - 0.5) * grainIntensity;

  vec3 color = vec3(grainR, grainG, grainB);

  // Alpha: ramp with velocity, with a subtle floor so idle state has minimal grain
  float grainFloor = 0.015;
  float alpha = u_opacity * max(vel * 1.5, grainFloor);

  gl_FragColor = vec4(color, alpha);
}
`;
```

- [ ] **Step 2: Verify the export is valid TypeScript**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/canvas/shaders/scroll-distortion.frag.ts
git commit -m "feat(canvas): add scroll-distortion fragment shader"
```

---

### Task 3: Create the ScrollDistortion pass class

**Files:**
- Create: `frontend/src/components/landing/canvas/passes/scroll-distortion.ts`

- [ ] **Step 1: Write the ScrollDistortion class**

Create `frontend/src/components/landing/canvas/passes/scroll-distortion.ts`:

```ts
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  RawShaderMaterial,
  Scene,
  Vector2,
} from "three";

import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { SCROLL_DISTORTION_FRAG } from "../shaders/scroll-distortion.frag";

export class ScrollDistortion {
  private readonly material: RawShaderMaterial;
  private readonly mesh: Mesh;

  constructor() {
    this.material = new RawShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: SCROLL_DISTORTION_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        u_time: { value: 0 },
        u_res: { value: new Vector2(1, 1) },
        u_opacity: { value: 0 },
        u_scrollVelocity: { value: 0 },
      },
    });

    const geo = new BufferGeometry();
    const verts = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    geo.setAttribute("position", new BufferAttribute(verts, 3));

    this.mesh = new Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  setSize(w: number, h: number, pixelRatio: number) {
    (this.material.uniforms.u_res!.value as Vector2).set(
      w * pixelRatio,
      h * pixelRatio,
    );
  }

  setOpacity(o: number) {
    this.material.uniforms.u_opacity!.value = o;
  }

  setScrollVelocity(v: number) {
    this.material.uniforms.u_scrollVelocity!.value = v;
  }

  step(time: number) {
    this.material.uniforms.u_time!.value = time;
  }

  addToScene(scene: Scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/canvas/passes/scroll-distortion.ts
git commit -m "feat(canvas): add ScrollDistortion pass class"
```

---

### Task 4: Wire ScrollDistortion into PersistentCanvas

**Files:**
- Modify: `frontend/src/components/landing/canvas/persistent-canvas.tsx`

- [ ] **Step 1: Add import for ScrollDistortion**

Add after the existing `LensWhisper` import (line 6):

```ts
import { ScrollDistortion } from "./passes/scroll-distortion";
```

- [ ] **Step 2: Instantiate ScrollDistortion alongside LensWhisper**

After line 90 (`lw.setSize(initialW, initialH, pixelRatio);`), add:

```ts
    const sd = new ScrollDistortion();
    sd.addToScene(scene);
    sd.setSize(initialW, initialH, pixelRatio);
```

- [ ] **Step 3: Update fitCamera to resize ScrollDistortion**

In the `fitCamera` function, after `lw.setSize(w, h, renderer.getPixelRatio());` (line 100), add:

```ts
      sd.setSize(w, h, renderer.getPixelRatio());
```

- [ ] **Step 4: Update downgrade to resize ScrollDistortion**

In the `downgrade` function, after `lw.setSize(w, h, newDpr);` (line 129), add:

```ts
      sd.setSize(w, h, newDpr);
```

- [ ] **Step 5: Add scroll velocity tracking state**

After `let visibilityOpacity = 0;` (line 116), add:

```ts
    let lastScrollY = window.scrollY;
    let smoothVelocity = 0;
    let scrollDistortionOpacity = 0;
```

- [ ] **Step 6: Add scroll velocity computation in tick loop**

Inside the `tick` function, after `const t = now * 0.001;` (line 151), add the velocity calculation:

```ts
      const currentScrollY = window.scrollY;
      const rawVelocity = Math.abs(currentScrollY - lastScrollY) / Math.max(dt, 0.001);
      lastScrollY = currentScrollY;
      const normalizedVelocity = Math.min(rawVelocity / 1500, 1);
      smoothVelocity += (normalizedVelocity - smoothVelocity) * (1 - Math.exp(-dt * 6));
```

- [ ] **Step 7: Add ScrollDistortion visibility logic**

After the `breachVis` block (after line 176 `}`), and before the `const targetVisibility` line (line 178), add the scroll distortion visibility calculation:

```ts
      const a3p = scrollStateRef.current.actThreeProgress;
      let actThreeVis = 0;
      if (a3p > 0 && a3p < 1) {
        if (a3p < 0.05) actThreeVis = a3p / 0.05;
        else if (a3p > 0.9) actThreeVis = (1 - a3p) / 0.1;
        else actThreeVis = 1;
      }

      const a5p = scrollStateRef.current.actFiveProgress;
      let actFiveVis = 0;
      if (a5p > 0 && a5p < 1) {
        if (a5p < 0.05) actFiveVis = a5p / 0.05;
        else if (a5p > 0.9) actFiveVis = (1 - a5p) / 0.1;
        else actFiveVis = 1;
      }

      const scrollDistortionTarget = Math.max(actThreeVis, actFiveVis);
      scrollDistortionOpacity += (scrollDistortionTarget - scrollDistortionOpacity) * (1 - Math.exp(-dt * 7));
```

- [ ] **Step 8: Pipe uniforms to ScrollDistortion each frame**

After `lw.setBreachProgress(bprog);` (line 185), add:

```ts
      sd.setOpacity(scrollDistortionOpacity);
      sd.setScrollVelocity(smoothVelocity);
      sd.step(t);
```

- [ ] **Step 9: Dispose ScrollDistortion in cleanup**

In the cleanup function, after `lw.dispose();` (line 207), add:

```ts
      sd.dispose();
```

- [ ] **Step 10: Verify compilation**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/landing/canvas/persistent-canvas.tsx
git commit -m "feat(canvas): wire ScrollDistortion pass into PersistentCanvas tick loop"
```

---

### Task 5: Pipe actThreeProgress from ActThreeEngine

**Files:**
- Modify: `frontend/src/components/landing/acts/act-three-engine.tsx`

- [ ] **Step 1: Add useCanvasStage import**

After the existing import of `StepDiagram` (line 13), add:

```ts
import { useCanvasStage } from "@/components/landing/canvas/use-canvas-stage";
```

- [ ] **Step 2: Get scrollStateRef in component body**

Inside `ActThreeEngine`, after `const [done, setDone] = useState(false);` (line 56), add:

```ts
  const { scrollStateRef } = useCanvasStage();
```

- [ ] **Step 3: Write actThreeProgress in useActPin onUpdate**

Modify the existing `useActPin` call (lines 58-65). Add the progress write inside the existing `onUpdate` callback:

Replace:
```ts
  useActPin(containerRef, {
    duration: "+=200%",
    scrub: 0.5,
    onUpdate: (progress) => {
      const next = Math.min(2, Math.floor(progress * 3));
      setScrollStep((cur) => (cur === next ? cur : next));
    },
  });
```

With:
```ts
  useActPin(containerRef, {
    duration: "+=200%",
    scrub: 0.5,
    onUpdate: (progress) => {
      scrollStateRef.current.actThreeProgress = progress;
      const next = Math.min(2, Math.floor(progress * 3));
      setScrollStep((cur) => (cur === next ? cur : next));
    },
  });
```

- [ ] **Step 4: Reset actThreeProgress on cleanup**

In the `useGSAP` cleanup (line 103: `return () => mm.revert();`), add the reset before mm.revert():

Replace:
```ts
      return () => mm.revert();
```

With:
```ts
      return () => {
        scrollStateRef.current.actThreeProgress = 0;
        mm.revert();
      };
```

- [ ] **Step 5: Verify compilation**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/landing/acts/act-three-engine.tsx
git commit -m "feat(landing): pipe actThreeProgress to scrollStateRef"
```

---

### Task 6: Pipe actFiveProgress from ActFiveMarkets

**Files:**
- Modify: `frontend/src/components/landing/acts/act-five-markets.tsx`

- [ ] **Step 1: Add useCanvasStage import**

After the existing import of `cn` (line 13), add:

```ts
import { useCanvasStage } from "@/components/landing/canvas/use-canvas-stage";
```

- [ ] **Step 2: Get scrollStateRef in component body**

Inside `ActFiveMarkets`, after `const containerRef = useRef<HTMLDivElement>(null);` (line 25), add:

```ts
  const { scrollStateRef } = useCanvasStage();
```

- [ ] **Step 3: Add onUpdate to useActPin**

Replace the existing `useActPin` call (line 27):

```ts
  useActPin(containerRef, { duration: ACT_DURATION });
```

With:
```ts
  useActPin(containerRef, {
    duration: ACT_DURATION,
    onUpdate: (progress) => {
      scrollStateRef.current.actFiveProgress = progress;
    },
  });
```

- [ ] **Step 4: Reset actFiveProgress on cleanup**

In the `useGSAP` cleanup (line 61: `return () => mm.revert();`), add the reset:

Replace:
```ts
      return () => mm.revert();
```

With:
```ts
      return () => {
        scrollStateRef.current.actFiveProgress = 0;
        mm.revert();
      };
```

- [ ] **Step 5: Verify compilation**

Run: `cd /home/mario/zksettle/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/landing/acts/act-five-markets.tsx
git commit -m "feat(landing): pipe actFiveProgress to scrollStateRef"
```

---

### Task 7: Visual verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `cd /home/mario/zksettle/frontend && npm run dev`
Expected: Server starts on localhost (likely port 3000)

- [ ] **Step 2: Verify effect on Act Three**

Open the landing page in a browser. Scroll to the Act Three Engine section ("How it works"). Scroll quickly up and down while in the pinned section.

Expected:
- Subtle grain overlay is barely visible when idle
- Grain intensifies + chromatic color fringe appears during fast scroll
- Slight organic UV displacement visible on fast scroll
- Effect fades in when entering the section and fades out when leaving

- [ ] **Step 3: Verify effect on Act Five**

Continue scrolling to the Act Five Markets section ("One primitive. Six markets."). Scroll quickly up and down while in the pinned section.

Expected: Same behavior as Act Three — grain + chromatic aberration + displacement on fast scroll

- [ ] **Step 4: Verify no effect on other sections**

Scroll through the Hero, Act Two, and Portal Breach sections.

Expected: The scroll distortion overlay is NOT visible on these sections. The existing LensWhisper effect continues to work normally.

- [ ] **Step 5: Verify reduced motion**

Enable `prefers-reduced-motion` in browser dev tools (or via system settings). Reload the page.

Expected: No canvas at all — the `CanvasStageProvider` disables the entire canvas system, including the new pass.

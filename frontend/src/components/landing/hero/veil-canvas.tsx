"use client";

import { useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { createPrng } from "@/lib/prng";

import {
  FRAGMENT_SHADER,
  HALO_FRAGMENT_SHADER,
  HALO_VERTEX_SHADER,
  VERTEX_SHADER,
} from "./veil-shaders";

const DESKTOP_MIN_WIDTH = 768;
const MAX_PARTICLES = 12_000;
const PARTICLE_TIERS = [12_000, 6_000, 3_000, 3_000] as const;
// At the final tier the halo pass switches off — same particle count, fewer draws.
const HALO_OFF_TIER = 3;

// Stride distribution (mod 25). Keeps proportions roughly stable across tiers.
const STRIDE = 25;
const STRIDE_RING = 14; // 56% — commitment ring
const STRIDE_BAR = 4; //  16% — settlement bar
const STRIDE_ORBITAL = 2; //  8% — orbital halo (idle hint)
// Remainder (5/25 = 20%) — regular ambient drift

const ASH_COLOR = new Color(0x6b6762);
const FOREST_COLOR = new Color(0x0d4732);

function buildGeometry(): BufferGeometry {
  const prng = createPrng(0x5e1); // deterministic seal
  const starts = new Float32Array(MAX_PARTICLES * 3);
  const targets = new Float32Array(MAX_PARTICLES * 3);
  const phases = new Float32Array(MAX_PARTICLES);
  const sizes = new Float32Array(MAX_PARTICLES);
  const kinds = new Float32Array(MAX_PARTICLES);

  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    const sx = (prng.next() - 0.5) * 3.6;
    const sy = (prng.next() - 0.5) * 2.4;
    starts[i * 3] = sx;
    starts[i * 3 + 1] = sy;
    starts[i * 3 + 2] = 0;

    const m = i % STRIDE;
    let tx: number;
    let ty: number;
    let kind: number;

    if (m < STRIDE_RING) {
      // commitment ring
      const angle = prng.next() * Math.PI * 2;
      const r = 0.46 + (prng.next() - 0.5) * 0.025;
      tx = Math.cos(angle) * r;
      ty = Math.sin(angle) * r;
      kind = 2.0;
    } else if (m < STRIDE_RING + STRIDE_BAR) {
      // settlement bar across the ring
      tx = (prng.next() - 0.5) * 0.9;
      ty = (prng.next() - 0.5) * 0.03;
      kind = 2.0;
    } else if (m < STRIDE_RING + STRIDE_BAR + STRIDE_ORBITAL) {
      // orbital ambient — vertex shader overrides position from aPhase + uTime
      tx = sx * 0.85;
      ty = sy * 0.85;
      kind = 1.0;
      // Burn a PRNG draw so downstream determinism doesn't shift between kinds.
      prng.next();
    } else {
      // regular ambient — drifts in flow field, never converges
      tx = sx * 0.85;
      ty = sy * 0.85;
      kind = 0.0;
      prng.next();
    }

    targets[i * 3] = tx;
    targets[i * 3 + 1] = ty;
    targets[i * 3 + 2] = 0;

    phases[i] = prng.next() * Math.PI * 2;
    // Wider size range gives perceived depth.
    sizes[i] = 0.6 + prng.next() * 2.6;
    kinds[i] = kind;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("aStart", new BufferAttribute(starts, 3));
  geometry.setAttribute("aTarget", new BufferAttribute(targets, 3));
  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aKind", new BufferAttribute(kinds, 1));
  // Three requires `position` for bounding-box maths even though the vertex shader ignores it.
  geometry.setAttribute("position", new BufferAttribute(starts, 3));

  return geometry;
}

function computeScrollProgress(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const viewport = window.innerHeight || 1;
  const total = rect.height + viewport;
  if (total <= 0) return 0;
  const traveled = viewport - rect.top;
  if (traveled <= 0) return 0;
  if (traveled >= total) return 1;
  return traveled / total;
}

type VeilCanvasProps = {
  className?: string;
};

export function VeilCanvas({ className }: VeilCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < DESKTOP_MIN_WIDTH);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!mounted || isMobile) return;
    const container = containerRef.current;
    if (!container) return;

    const initialWidth = container.clientWidth;
    const initialHeight = container.clientHeight;
    if (initialWidth === 0 || initialHeight === 0) return;

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    camera.position.z = 5;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(initialWidth, initialHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const geometry = buildGeometry();
    let tierIndex = 0;
    geometry.setDrawRange(0, PARTICLE_TIERS[tierIndex]!);

    // Uniform containers held by reference — strict indexed access stays happy
    // and updates propagate to both materials that share these references.
    const uProgress = { value: 0 };
    const uTime = { value: 0 };
    const uPixelRatio = { value: pixelRatio };
    const uScale = { value: 1 };
    const uAshColor = { value: ASH_COLOR };
    const uForestColor = { value: FOREST_COLOR };
    const uOpacity = { value: 0.88 };
    const uVelocity = { value: 0 };

    const coreMaterial = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uProgress,
        uTime,
        uPixelRatio,
        uScale,
        uAshColor,
        uForestColor,
        uOpacity,
        uVelocity,
      },
    });

    // Halo pass renders larger soft discs at low alpha — simulates ink bleed
    // on a light background, where additive blending would wash to white.
    const haloMaterial = new ShaderMaterial({
      vertexShader: HALO_VERTEX_SHADER,
      fragmentShader: HALO_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uProgress,
        uTime,
        uPixelRatio,
        uScale,
        uForestColor,
      },
    });

    const haloPoints = new Points(geometry, haloMaterial);
    haloPoints.frustumCulled = false;
    haloPoints.renderOrder = 0;
    const corePoints = new Points(geometry, coreMaterial);
    corePoints.frustumCulled = false;
    corePoints.renderOrder = 1;
    scene.add(haloPoints);
    scene.add(corePoints);

    const fitCamera = (width: number, height: number) => {
      const aspect = width / height;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      uScale.value = Math.min(aspect, 1) * 0.9 + 0.1;
      renderer.setSize(width, height);
    };
    fitCamera(initialWidth, initialHeight);

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      fitCamera(w, h);
    };
    window.addEventListener("resize", onResize);

    let targetProgress = computeScrollProgress(container);
    uProgress.value = targetProgress;
    const onScroll = () => {
      targetProgress = computeScrollProgress(container);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let rafId = 0;
    let lastTick = performance.now();
    let windowStart = lastTick;
    let frameCount = 0;
    let smoothedVelocity = 0;
    let isVisible = true;

    const tick = () => {
      const now = performance.now();
      frameCount += 1;

      if (now - windowStart >= 2000) {
        const fps = (frameCount * 1000) / (now - windowStart);
        if (fps < 50 && tierIndex < PARTICLE_TIERS.length - 1) {
          tierIndex += 1;
          geometry.setDrawRange(0, PARTICLE_TIERS[tierIndex]!);
          if (tierIndex >= HALO_OFF_TIER) {
            haloPoints.visible = false;
          }
        }
        frameCount = 0;
        windowStart = now;
      }

      const dt = Math.min(now - lastTick, 64) / 1000;
      lastTick = now;

      uTime.value = now * 0.001;

      // Critically-damped interpolation toward scroll progress.
      const step = 1 - Math.exp(-dt * 6);
      const prevProgress = uProgress.value;
      uProgress.value += (targetProgress - uProgress.value) * step;

      // Velocity = change in progress per second, smoothed for the stretch effect.
      const instantVelocity = dt > 0 ? (uProgress.value - prevProgress) / dt : 0;
      const velStep = 1 - Math.exp(-dt * 8);
      smoothedVelocity += (instantVelocity - smoothedVelocity) * velStep;
      uVelocity.value = smoothedVelocity;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafId !== 0) return;
      lastTick = performance.now();
      windowStart = lastTick;
      frameCount = 0;
      rafId = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (rafId === 0) return;
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    // Pause the render loop while the hero is fully off-screen — saves a
    // continuous rAF tick + GPU draw across the rest of the page.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const wasVisible = isVisible;
        isVisible = entry.isIntersecting;
        if (!wasVisible && isVisible && !reduceMotion) {
          startLoop();
        } else if (wasVisible && !isVisible) {
          stopLoop();
        }
      },
      { threshold: 0 },
    );
    observer.observe(container);

    if (reduceMotion) {
      uProgress.value = targetProgress;
      uTime.value = 0;
      uVelocity.value = 0;
      renderer.render(scene, camera);
    } else {
      startLoop();
    }

    return () => {
      stopLoop();
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      scene.remove(corePoints);
      scene.remove(haloPoints);
      geometry.dispose();
      coreMaterial.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mounted, isMobile, reduceMotion]);

  if (!mounted) return null;

  if (isMobile || webglUnavailable) {
    return <VeilStaticFallback className={className} />;
  }

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}

function VeilStaticFallback({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <circle
        cx="100"
        cy="100"
        r="46"
        fill="none"
        stroke="var(--color-forest)"
        strokeWidth="0.8"
        opacity="0.4"
      />
      <line
        x1="56"
        y1="100"
        x2="144"
        y2="100"
        stroke="var(--color-forest)"
        strokeWidth="1.2"
        opacity="0.4"
      />
    </svg>
  );
}

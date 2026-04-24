"use client";

import { useEffect, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { createPrng } from "@/lib/prng";

import { FRAGMENT_SHADER, VERTEX_SHADER } from "./veil-shaders";

const DESKTOP_MIN_WIDTH = 768;
const MAX_PARTICLES = 12_000;
const PARTICLE_TIERS = [12_000, 6_000, 3_000] as const;
const GLYPH_SHARE = 0.7;

const ASH_COLOR = new Color(0x6b6762);
const FOREST_COLOR = new Color(0x0c3d2e);

function buildGeometry(): BufferGeometry {
  const prng = createPrng(0x5e1); // deterministic seal
  const starts = new Float32Array(MAX_PARTICLES * 3);
  const targets = new Float32Array(MAX_PARTICLES * 3);
  const phases = new Float32Array(MAX_PARTICLES);
  const sizes = new Float32Array(MAX_PARTICLES);

  const glyphCount = Math.floor(MAX_PARTICLES * GLYPH_SHARE);
  const ringCount = Math.floor(glyphCount * 0.82);

  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    const sx = (prng.next() - 0.5) * 3.6;
    const sy = (prng.next() - 0.5) * 2.4;
    starts[i * 3] = sx;
    starts[i * 3 + 1] = sy;
    starts[i * 3 + 2] = 0;

    let tx: number;
    let ty: number;
    let isGlyph: boolean;

    if (i < ringCount) {
      // commitment ring
      const angle = prng.next() * Math.PI * 2;
      const r = 0.46 + (prng.next() - 0.5) * 0.025;
      tx = Math.cos(angle) * r;
      ty = Math.sin(angle) * r;
      isGlyph = true;
    } else if (i < glyphCount) {
      // settlement bar across the ring
      tx = (prng.next() - 0.5) * 0.9;
      ty = (prng.next() - 0.5) * 0.03;
      isGlyph = true;
    } else {
      // ambient — stay near start so convergence is elegant, not total
      tx = sx * 0.85;
      ty = sy * 0.85;
      isGlyph = false;
    }

    targets[i * 3] = tx;
    targets[i * 3 + 1] = ty;
    targets[i * 3 + 2] = 0;

    phases[i] = prng.next() * Math.PI * 2;
    // encode glyph membership via sign on aSize (shader reads step(0.0, aSize))
    const baseSize = 1.1 + prng.next() * 1.4;
    sizes[i] = isGlyph ? baseSize : -baseSize;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("aStart", new BufferAttribute(starts, 3));
  geometry.setAttribute("aTarget", new BufferAttribute(targets, 3));
  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
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
    // Start at the highest tier; the FPS monitor downgrades as needed.
    let tierIndex = 0;
    geometry.setDrawRange(0, PARTICLE_TIERS[tierIndex]!);

    // Hold direct references to each uniform so strict indexed access can't
    // mark them `undefined` on every frame tick.
    const uProgress = { value: 0 };
    const uTime = { value: 0 };
    const uPixelRatio = { value: pixelRatio };
    const uScale = { value: 1 };
    const uAshColor = { value: ASH_COLOR };
    const uForestColor = { value: FOREST_COLOR };
    const uOpacity = { value: 0.75 };

    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uProgress,
        uTime,
        uPixelRatio,
        uScale,
        uAshColor,
        uForestColor,
        uOpacity,
      },
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    const fitCamera = (width: number, height: number) => {
      const aspect = width / height;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      // Keep the glyph around 40% of the shorter viewport edge.
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

    const tick = () => {
      const now = performance.now();
      frameCount += 1;

      if (now - windowStart >= 2000) {
        const fps = (frameCount * 1000) / (now - windowStart);
        if (fps < 50 && tierIndex < PARTICLE_TIERS.length - 1) {
          tierIndex += 1;
          geometry.setDrawRange(0, PARTICLE_TIERS[tierIndex]!);
        }
        frameCount = 0;
        windowStart = now;
      }

      const dt = Math.min(now - lastTick, 64) / 1000;
      lastTick = now;

      uTime.value = now * 0.001;
      // critically-damped interpolation toward scroll progress
      const step = 1 - Math.exp(-dt * 6);
      uProgress.value += (targetProgress - uProgress.value) * step;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };

    if (reduceMotion) {
      // short-circuit to a single rendered frame — no rAF loop, no drift
      uProgress.value = targetProgress;
      uTime.value = 0;
      renderer.render(scene, camera);
    } else {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      scene.remove(points);
      geometry.dispose();
      material.dispose();
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
        opacity="0.35"
      />
      <line
        x1="56"
        y1="100"
        x2="144"
        y2="100"
        stroke="var(--color-forest)"
        strokeWidth="1.2"
        opacity="0.35"
      />
    </svg>
  );
}

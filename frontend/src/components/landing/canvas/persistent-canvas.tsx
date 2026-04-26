"use client";

import { useEffect, useRef } from "react";
import { OrthographicCamera, Scene, WebGLRenderer } from "three";

import { LedgerParticles } from "./passes/ledger-particles";
import { TIER_PARAMS, type CanvasTier } from "./types";
import { useCanvasStage } from "./use-canvas-stage";

const FPS_WINDOW_MS = 2000;
const FPS_THRESHOLD_MID = 50;
const FPS_THRESHOLD_LOW = 38;

type WebGLAvailability =
  | { ok: true; supportsHighp: boolean }
  | { ok: false };

function probeWebGL(): WebGLAvailability {
  try {
    const test = document.createElement("canvas");
    const gl =
      (test.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (test.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) return { ok: false };
    const fragmentHigh = gl.getShaderPrecisionFormat(
      gl.FRAGMENT_SHADER,
      gl.HIGH_FLOAT,
    );
    const supportsHighp = !!fragmentHigh && fragmentHigh.precision > 0;
    const lose = gl.getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return { ok: true, supportsHighp };
  } catch {
    return { ok: false };
  }
}

function pickInitialTier(supportsHighp: boolean): CanvasTier {
  if (!supportsHighp) return "low";
  const cores = navigator.hardwareConcurrency ?? 4;
  type WithDeviceMemory = Navigator & { deviceMemory?: number };
  const memory = (navigator as WithDeviceMemory).deviceMemory ?? 4;
  if (cores >= 8 && memory >= 6) return "high";
  if (cores >= 4 && memory >= 3) return "mid";
  return "low";
}

export function PersistentCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollStateRef, onCanvasReady } = useCanvasStage();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const probe = probeWebGL();
    if (!probe.ok) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        premultipliedAlpha: false,
      });
    } catch {
      return;
    }

    const initialW = container.clientWidth || window.innerWidth;
    const initialH = container.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(initialW, initialH);
    renderer.setClearColor(0xfafaf7, 1);
    container.appendChild(renderer.domElement);

    let tier: CanvasTier = pickInitialTier(probe.supportsHighp);
    let tierParams = TIER_PARAMS[tier];
    document.documentElement.dataset.canvasTier = tier;

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 10);
    camera.position.z = 5;

    // Wordmark sits on the right side of the hero (positive X in NDC, slightly below center).
    // Ledger column sits in roughly the same area but taller and narrower.
    const particles = new LedgerParticles(renderer, {
      fboSize: tierParams.fbo,
      pointSize: 2.4,
      wordmark: "ZKSETTLE",
      wordmarkCenter: { x: 0.42, y: 0.0 },
      wordmarkScale: { x: 0.78, y: 0.22 },
      ledgerCenter: { x: 0.42, y: -0.05 },
      ledgerScale: { x: 0.55, y: 0.55 },
    });
    particles.setPixelRatio(pixelRatio);
    particles.addToScene(scene);

    const fitCamera = (w: number, h: number) => {
      const aspect = w / Math.max(h, 1);
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    fitCamera(initialW, initialH);

    const onPointerMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      // Pointer lives in NDC. Multiply by aspect so it lines up with particle space.
      const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
      scrollStateRef.current.mouseTarget.x = x * aspect;
      scrollStateRef.current.mouseTarget.y = y;
      // Tween up the pull strength on movement (decays naturally below).
      scrollStateRef.current.rippleProgress = 1;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      fitCamera(w, h);
    };
    window.addEventListener("resize", onResize);

    let rafId = 0;
    let lastTick = performance.now();
    let windowStart = lastTick;
    let frames = 0;
    let firstFrameRendered = false;
    let pullStrength = 0;
    let visibilityOpacity = 0;
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition = "none";

    const downgrade = (target: CanvasTier) => {
      if (tier === target) return;
      if (tier === "low") return;
      tier = target;
      tierParams = TIER_PARAMS[tier];
      document.documentElement.dataset.canvasTier = tier;
    };

    const tick = () => {
      const now = performance.now();
      frames += 1;

      if (now - windowStart >= FPS_WINDOW_MS) {
        const fps = (frames * 1000) / (now - windowStart);
        if (fps < FPS_THRESHOLD_LOW && tier === "mid") {
          downgrade("low");
        } else if (fps < FPS_THRESHOLD_MID && tier === "high") {
          downgrade("mid");
        }
        frames = 0;
        windowStart = now;
      }

      const dt = Math.min(now - lastTick, 64) / 1000;
      lastTick = now;

      const t = now * 0.001;
      const state = scrollStateRef.current;

      // Compute global scroll progress from document scroll.
      const docEl = document.documentElement;
      const scrollable = Math.max(docEl.scrollHeight - window.innerHeight, 1);
      state.global = Math.min(Math.max(window.scrollY / scrollable, 0), 1);

      // Hero-bound visibility: canvas fades to 0 once user scrolls past hero
      // so it doesn't compete with subsequent acts. Hero ≈ first 1.2 viewport
      // heights (the pin duration).
      const heroExtent = window.innerHeight * 1.2;
      const heroProgress = Math.min(window.scrollY / heroExtent, 1.4);
      const targetVisibility = heroProgress < 0.7
        ? 1
        : Math.max(1 - (heroProgress - 0.7) / 0.3, 0);
      visibilityOpacity += (targetVisibility - visibilityOpacity)
        * (1 - Math.exp(-dt * 7));

      // Morph disabled for now — wordmark is the wow element. Particles drift
      // upward (out of frame) as the user scrolls past the hero; fade-out
      // handles the rest.
      particles.setTargetMix(0);
      particles.setUniform("uGlobal", state.global);
      particles.setUniform("uOpacity", visibilityOpacity);

      // Mouse position lerp for smooth follow.
      const lerpStep = 1 - Math.exp(-dt * 7);
      state.mouse.x += (state.mouseTarget.x - state.mouse.x) * lerpStep;
      state.mouse.y += (state.mouseTarget.y - state.mouse.y) * lerpStep;

      // Pull strength decays smoothly when not refreshed.
      const target = state.rippleProgress;
      pullStrength += (target - pullStrength) * (1 - Math.exp(-dt * 3));
      // Decay the trigger so the effect fades naturally between movements.
      state.rippleProgress *= Math.exp(-dt * 1.4);

      particles.setMouse(state.mouse.x, state.mouse.y, pullStrength);
      particles.step(t, 1);

      renderer.render(scene, camera);

      if (!firstFrameRendered) {
        firstFrameRendered = true;
        renderer.domElement.style.opacity = "1";
        renderer.domElement.style.transition = "opacity 600ms ease-out";
        onCanvasReady();
      }

      rafId = requestAnimationFrame(tick);
    };

    document.documentElement.dataset.canvasOn = "true";
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      delete document.documentElement.dataset.canvasOn;
      delete document.documentElement.dataset.canvasTier;
      particles.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [scrollStateRef, onCanvasReady]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ contain: "strict" }}
    />
  );
}

export default PersistentCanvas;

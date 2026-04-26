"use client";

import { useEffect, useRef } from "react";
import { OrthographicCamera, Scene, WebGLRenderer } from "three";

import { LensWhisper } from "./passes/lens-whisper";
import { ScrollDistortion } from "./passes/scroll-distortion";
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

    let tier: CanvasTier = pickInitialTier(probe.supportsHighp);
    let tierParams = TIER_PARAMS[tier];
    const pixelRatio = Math.min(window.devicePixelRatio || 1, tierParams.dpr);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(initialW, initialH);
    renderer.setClearColor(0x0a0a0a, 1);
    container.appendChild(renderer.domElement);

    document.documentElement.dataset.canvasTier = tier;

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 10);
    camera.position.z = 5;

    const lw = new LensWhisper();
    lw.addToScene(scene);
    lw.setSize(initialW, initialH, pixelRatio);

    const sd = new ScrollDistortion();
    sd.addToScene(scene);
    sd.setSize(initialW, initialH, pixelRatio);

    const fitCamera = (w: number, h: number) => {
      const aspect = w / Math.max(h, 1);
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      lw.setSize(w, h, renderer.getPixelRatio());
      sd.setSize(w, h, renderer.getPixelRatio());
    };
    fitCamera(initialW, initialH);

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
    let visibilityOpacity = 0;
    let lastScrollY = window.scrollY;
    let smoothVelocity = 0;
    let scrollDistortionOpacity = 0;
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition = "none";

    const downgrade = (target: CanvasTier) => {
      if (tier === target || tier === "low") return;
      tier = target;
      tierParams = TIER_PARAMS[tier];
      const newDpr = Math.min(window.devicePixelRatio || 1, tierParams.dpr);
      renderer.setPixelRatio(newDpr);
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      lw.setSize(w, h, newDpr);
      sd.setSize(w, h, newDpr);
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

      const currentScrollY = window.scrollY;
      const rawVelocity = Math.abs(currentScrollY - lastScrollY) / Math.max(dt, 0.001);
      lastScrollY = currentScrollY;
      const normalizedVelocity = Math.min(rawVelocity / 1500, 1);
      smoothVelocity += (normalizedVelocity - smoothVelocity) * (1 - Math.exp(-dt * 6));

      const heroExtent = window.innerHeight * 1.2;
      const heroProgress = Math.min(Math.max(window.scrollY / heroExtent, 0), 1);

      const targetHeroVis =
        heroProgress < 0.7
          ? 1
          : Math.max(1 - (heroProgress - 0.7) / 0.3, 0);

      const atp = scrollStateRef.current.actTwoProgress;
      let actTwoVis = 0;
      if (atp > 0 && atp < 1) {
        if (atp < 0.05) actTwoVis = atp / 0.05;
        else if (atp > 0.88) actTwoVis = (1 - atp) / 0.12;
        else actTwoVis = 1;
        actTwoVis *= 0.75;
      }

      const bprog = scrollStateRef.current.breachProgress;
      let breachVis = 0;
      if (bprog > 0) {
        if (bprog < 0.05) breachVis = 0.85 * (bprog / 0.05);
        else if (bprog < 0.55) breachVis = 0.85;
        else breachVis = 0.85 * Math.max(0, 1 - (bprog - 0.55) / 0.35);
      }

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

      const targetVisibility = Math.max(targetHeroVis, actTwoVis, breachVis);
      visibilityOpacity +=
        (targetVisibility - visibilityOpacity) * (1 - Math.exp(-dt * 7));

      lw.setOpacity(visibilityOpacity);
      lw.step(t);
      lw.setActTwoProgress(atp);
      lw.setBreachProgress(bprog);

      sd.setOpacity(scrollDistortionOpacity);
      sd.setScrollVelocity(smoothVelocity);
      sd.step(t);

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
      delete document.documentElement.dataset.canvasOn;
      delete document.documentElement.dataset.canvasTier;
      lw.dispose();
      sd.dispose();
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

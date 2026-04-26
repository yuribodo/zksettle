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
}

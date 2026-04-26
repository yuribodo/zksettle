"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";

import { PersistentCanvasLazy } from "./persistent-canvas-lazy";
import { CanvasStageContext, type CanvasStageValue } from "./use-canvas-stage";
import { createScrollState } from "./types";

const DESKTOP_MIN_WIDTH = 768;
const MIN_LOADING_MS = 2200;

function probeWebGL(): boolean {
  try {
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl2") ?? test.getContext("webgl");
    if (!gl) return false;
    const lose = (gl as WebGLRenderingContext).getExtension(
      "WEBGL_lose_context",
    );
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function CanvasStageProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const scrollStateRef = useRef(createScrollState());

  useEffect(() => {
    if (reduceMotion) {
      setEnabled(false);
      return;
    }
    const isMobile = window.matchMedia(
      `(max-width: ${DESKTOP_MIN_WIDTH - 1}px)`,
    ).matches;
    if (isMobile) {
      setEnabled(false);
      return;
    }
    if (!probeWebGL()) {
      setEnabled(false);
      return;
    }
    setEnabled(true);
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_LOADING_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const onCanvasReady = useCallback(() => setCanvasReady(true), []);

  const ready = canvasReady && minTimeElapsed;

  const value = useMemo<CanvasStageValue>(
    () => ({ scrollStateRef, enabled, onCanvasReady }),
    [enabled, onCanvasReady],
  );

  return (
    <CanvasStageContext.Provider value={value}>
      {enabled ? <PersistentCanvasLazy /> : null}
      {enabled ? <CanvasLoadingOverlay visible={!ready} /> : null}
      {children}
    </CanvasStageContext.Provider>
  );
}

function CanvasLoadingOverlay({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setMounted(false), 1000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center gap-10"
      style={{
        background: "#0a0a0a",
        opacity: visible ? 1 : 0,
        filter: visible ? "blur(0px)" : "blur(12px)",
        transform: visible ? "scale(1)" : "scale(1.04)",
        transition: "opacity 900ms cubic-bezier(0.32,0.72,0,1), filter 900ms cubic-bezier(0.32,0.72,0,1), transform 900ms cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      <div className="relative flex items-center justify-center">
        {/* Outer dashed ring — slow clockwise */}
        <svg
          className="absolute"
          width="112"
          height="112"
          viewBox="0 0 112 112"
          fill="none"
          style={{ animation: "proof-ring-spin 12s linear infinite" }}
        >
          <circle
            cx="56"
            cy="56"
            r="52"
            stroke="white"
            strokeWidth="0.5"
            strokeDasharray="4 8"
            opacity="0.12"
          />
        </svg>

        {/* Middle trace ring — fills like proof verification */}
        <svg
          className="absolute -rotate-90"
          width="88"
          height="88"
          viewBox="0 0 88 88"
          fill="none"
        >
          <circle
            cx="44"
            cy="44"
            r="40"
            stroke="white"
            strokeWidth="0.75"
            opacity="0.06"
          />
          <circle
            cx="44"
            cy="44"
            r="40"
            stroke="white"
            strokeWidth="0.75"
            strokeLinecap="round"
            strokeDasharray="251"
            strokeDashoffset="251"
            opacity="0.25"
            style={{ animation: "proof-trace 3s ease-in-out infinite" }}
          />
        </svg>

        {/* Inner dashed ring — counter-clockwise */}
        <svg
          className="absolute"
          width="68"
          height="68"
          viewBox="0 0 68 68"
          fill="none"
          style={{ animation: "proof-ring-reverse 8s linear infinite" }}
        >
          <circle
            cx="34"
            cy="34"
            r="30"
            stroke="white"
            strokeWidth="0.5"
            strokeDasharray="2 6"
            opacity="0.1"
          />
        </svg>

        {/* ZKSettle seal */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          shapeRendering="geometricPrecision"
          style={{ animation: "proof-seal-breathe 3s ease-in-out infinite", color: "white" }}
        >
          <rect x="6" y="6" width="36" height="36" rx="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M15 16H32.5L15 32H33" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M18 24H30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" opacity="0.45" />
          <circle cx="15" cy="16" r="2" fill="currentColor" />
          <circle cx="33" cy="32" r="2" fill="currentColor" />
        </svg>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
        compiling proof
        <span className="ml-2 inline-block animate-veil-cursor">▍</span>
      </p>
    </div>
  );
}

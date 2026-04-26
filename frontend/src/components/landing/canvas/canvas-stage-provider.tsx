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
  const [ready, setReady] = useState(false);
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
  }, [reduceMotion]);

  const onCanvasReady = useCallback(() => setReady(true), []);

  const value = useMemo<CanvasStageValue>(
    () => ({ scrollStateRef, enabled, onCanvasReady }),
    [enabled, onCanvasReady],
  );

  return (
    <CanvasStageContext.Provider value={value}>
      {enabled ? <PersistentCanvasLazy /> : null}
      {enabled && !ready ? <CanvasLoadingOverlay /> : null}
      {children}
    </CanvasStageContext.Provider>
  );
}

function CanvasLoadingOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] flex items-end justify-end bg-canvas px-8 pb-12 transition-opacity duration-500 md:px-12 md:pb-16"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone">
        compiling proof
        <span className="ml-2 inline-block animate-veil-cursor">▍</span>
      </p>
    </div>
  );
}

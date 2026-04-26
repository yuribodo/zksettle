"use client";

import { createContext, useContext, type MutableRefObject } from "react";

import { type ScrollState } from "./types";

export type CanvasStageValue = {
  scrollStateRef: MutableRefObject<ScrollState>;
  enabled: boolean;
  onCanvasReady: () => void;
};

export const CanvasStageContext = createContext<CanvasStageValue | null>(null);

export function useCanvasStage(): CanvasStageValue {
  const ctx = useContext(CanvasStageContext);
  if (!ctx) {
    throw new Error("useCanvasStage must be used inside <CanvasStageProvider>");
  }
  return ctx;
}

export type ScrollState = {
  global: number;
  mouseTarget: { x: number; y: number };
  mouse: { x: number; y: number };
  rippleProgress: number;
  targetLuminance: number;
};

export function createScrollState(): ScrollState {
  return {
    global: 0,
    mouseTarget: { x: 0, y: 0 },
    mouse: { x: 0, y: 0 },
    rippleProgress: 0,
    targetLuminance: 0,
  };
}

export type CanvasTier = "high" | "mid" | "low";

export const TIER_PARAMS = {
  high: { particles: 50_176, fbo: 224, dither: "full", ripple: true },
  mid: { particles: 25_600, fbo: 160, dither: "full", ripple: false },
  low: { particles: 12_544, fbo: 112, dither: "static", ripple: false },
} as const;

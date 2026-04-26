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

export type CanvasTier = "high" | "mid" | "low";

export const TIER_PARAMS = {
  high: { dpr: 2.0 },
  mid: { dpr: 1.5 },
  low: { dpr: 1.0 },
} as const;

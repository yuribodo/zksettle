export const DITHER_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uPaperLuminance;
uniform float uForestAccent;
uniform float uDitherScale;
uniform vec2  uMouse;
uniform float uRippleProgress;
uniform vec2  uResolution;
uniform float uStaticDither;

varying vec2 vUv;

const vec3 PAPER  = vec3(0.980, 0.980, 0.969);   // #fafaf7
const vec3 INK    = vec3(0.102, 0.098, 0.090);   // #1a1917
const vec3 FOREST = vec3(0.047, 0.239, 0.180);   // #0c3d2e

float bayer8(vec2 p) {
  int x = int(mod(p.x, 8.0));
  int y = int(mod(p.y, 8.0));
  int idx = y * 8 + x;
  // Standard 8x8 Bayer matrix, normalized to [0..1)
  if (idx ==  0) return  0.0/64.0;
  if (idx ==  1) return 32.0/64.0;
  if (idx ==  2) return  8.0/64.0;
  if (idx ==  3) return 40.0/64.0;
  if (idx ==  4) return  2.0/64.0;
  if (idx ==  5) return 34.0/64.0;
  if (idx ==  6) return 10.0/64.0;
  if (idx ==  7) return 42.0/64.0;
  if (idx ==  8) return 48.0/64.0;
  if (idx ==  9) return 16.0/64.0;
  if (idx == 10) return 56.0/64.0;
  if (idx == 11) return 24.0/64.0;
  if (idx == 12) return 50.0/64.0;
  if (idx == 13) return 18.0/64.0;
  if (idx == 14) return 58.0/64.0;
  if (idx == 15) return 26.0/64.0;
  if (idx == 16) return 12.0/64.0;
  if (idx == 17) return 44.0/64.0;
  if (idx == 18) return  4.0/64.0;
  if (idx == 19) return 36.0/64.0;
  if (idx == 20) return 14.0/64.0;
  if (idx == 21) return 46.0/64.0;
  if (idx == 22) return  6.0/64.0;
  if (idx == 23) return 38.0/64.0;
  if (idx == 24) return 60.0/64.0;
  if (idx == 25) return 28.0/64.0;
  if (idx == 26) return 52.0/64.0;
  if (idx == 27) return 20.0/64.0;
  if (idx == 28) return 62.0/64.0;
  if (idx == 29) return 30.0/64.0;
  if (idx == 30) return 54.0/64.0;
  if (idx == 31) return 22.0/64.0;
  if (idx == 32) return  3.0/64.0;
  if (idx == 33) return 35.0/64.0;
  if (idx == 34) return 11.0/64.0;
  if (idx == 35) return 43.0/64.0;
  if (idx == 36) return  1.0/64.0;
  if (idx == 37) return 33.0/64.0;
  if (idx == 38) return  9.0/64.0;
  if (idx == 39) return 41.0/64.0;
  if (idx == 40) return 51.0/64.0;
  if (idx == 41) return 19.0/64.0;
  if (idx == 42) return 59.0/64.0;
  if (idx == 43) return 27.0/64.0;
  if (idx == 44) return 49.0/64.0;
  if (idx == 45) return 17.0/64.0;
  if (idx == 46) return 57.0/64.0;
  if (idx == 47) return 25.0/64.0;
  if (idx == 48) return 15.0/64.0;
  if (idx == 49) return 47.0/64.0;
  if (idx == 50) return  7.0/64.0;
  if (idx == 51) return 39.0/64.0;
  if (idx == 52) return 13.0/64.0;
  if (idx == 53) return 45.0/64.0;
  if (idx == 54) return  5.0/64.0;
  if (idx == 55) return 37.0/64.0;
  if (idx == 56) return 63.0/64.0;
  if (idx == 57) return 31.0/64.0;
  if (idx == 58) return 55.0/64.0;
  if (idx == 59) return 23.0/64.0;
  if (idx == 60) return 61.0/64.0;
  if (idx == 61) return 29.0/64.0;
  if (idx == 62) return 53.0/64.0;
  return 21.0/64.0;
}

// Cheap 2-channel value-noise replacement for tiny low-power GPUs.
// Smooth, periodic, no textures.
float smoothNoise(vec2 p) {
  float a = sin(p.x * 1.7 + p.y * 2.3) * 0.5 + 0.5;
  float b = sin(p.x * 2.9 - p.y * 1.4) * 0.5 + 0.5;
  return mix(a, b, 0.5);
}

void main() {
  vec2 uv = vUv;
  vec2 px = gl_FragCoord.xy;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 aspectUv = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  // Slow drifting noise field, OR static for LOW tier.
  float n = (uStaticDither > 0.5)
    ? 0.42
    : smoothNoise(aspectUv * uDitherScale * 4.0 + uTime * 0.04);

  // Cursor ripple — additive, dissipates over progress 0..1.
  vec2 mUv = vec2((uMouse.x * 0.5 + 0.5 - 0.5) * aspect, uMouse.y * 0.5);
  float dist = length(aspectUv - mUv);
  float rippleAmt = sin((dist - uRippleProgress * 1.2) * 18.0)
                  * exp(-dist * 4.0)
                  * (1.0 - uRippleProgress)
                  * 0.35;
  n += rippleAmt;

  // Bayer threshold yields a 1-bit dot. uForestAccent biases dot density.
  float threshold = bayer8(px);
  float dotMask = step(threshold, n + uForestAccent);

  // Vignette so edges quiet down — keeps the page legible at the corners.
  float vig = 1.0 - smoothstep(0.55, 0.95, length(aspectUv));
  dotMask *= vig;

  vec3 paper  = mix(PAPER, INK, uPaperLuminance);
  vec3 accent = FOREST;

  vec3 color = mix(paper, accent, dotMask);
  gl_FragColor = vec4(color, 1.0);
}
`;

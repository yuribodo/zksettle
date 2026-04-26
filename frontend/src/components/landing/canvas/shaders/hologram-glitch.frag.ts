export const HOLOGRAM_GLITCH_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uGlitchSeed;
uniform float uReducedMotion;
uniform float uProgress;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float t = uTime;
  float live = 1.0 - uReducedMotion;
  float p = uProgress;

  // intensity builds with scroll progress (0 → 1)
  float intensity = smoothstep(0.0, 0.4, p);

  // --- base gradient: brighter teal, driven by progress ---
  vec3 baseA = vec3(0.01, 0.02, 0.03);
  vec3 baseB = vec3(0.06, 0.18, 0.14);
  vec3 col = mix(baseA, baseB, uv.y * 0.6 + intensity * 0.4);

  // --- grain (always on, slight boost with progress) ---
  vec2 grainSeed = gl_FragCoord.xy + fract(t * 43.0) * vec2(1973.0, 9277.0);
  float grain = (hash(grainSeed) - 0.5) * (0.04 + intensity * 0.03);
  col += grain;

  // --- scan lines: thicker, more visible, speed tied to progress ---
  float scanSpeed = 40.0 + intensity * 20.0;
  float scanDensity = 2.5;
  float scan = sin((gl_FragCoord.y + t * scanSpeed * live) * scanDensity) * 0.5 + 0.5;
  scan = smoothstep(0.25, 0.75, scan);
  float scanStrength = 0.15 + intensity * 0.15;
  col *= (1.0 - scanStrength) + scan * scanStrength;

  // --- fine scan lines ---
  float fineScan = sin((gl_FragCoord.y + t * 20.0 * live) * 8.0) * 0.5 + 0.5;
  fineScan = smoothstep(0.35, 0.65, fineScan);
  col *= 0.94 + fineScan * 0.06;

  // --- RGB chromatic aberration: stronger with progress ---
  float caOffset = (3.0 + intensity * 4.0) / uResolution.x;
  float rShift = hash(vec2(floor(gl_FragCoord.y * 0.5), 0.0) + fract(t * 0.15) * 100.0);
  col.r *= 1.0 + (rShift - 0.5) * 0.06 * intensity;
  vec2 uvR = vec2(uv.x + caOffset, uv.y);
  vec2 uvB = vec2(uv.x - caOffset, uv.y);
  float rNoise = noise(uvR * 6.0 + t * 0.4);
  float bNoise = noise(uvB * 6.0 + t * 0.4);
  col.r += (rNoise - 0.5) * 0.04 * intensity;
  col.b += (bNoise - 0.5) * 0.04 * intensity;

  // --- micro-glitch: more aggressive with progress ---
  float glitchCycle = uGlitchSeed;
  float glitchBand = step(0.75 - intensity * 0.15, fract(glitchCycle * 0.27 + uv.y * 3.7));
  float glitchIntensity = step(0.85 - intensity * 0.1, fract(sin(glitchCycle * 43758.5453)));
  float glitch = glitchBand * glitchIntensity * live * intensity;
  float displacement = (hash(vec2(floor(gl_FragCoord.y * 0.1), glitchCycle)) - 0.5) * (0.08 + intensity * 0.06);
  vec2 glitchUv = uv + vec2(displacement * glitch, 0.0);
  float glitchNoise = noise(glitchUv * 10.0 + t);
  col += vec3(0.08, 0.22, 0.16) * glitch * glitchNoise;

  // --- horizontal glitch bars (new: visible displaced color bands) ---
  float barY = fract(uv.y * 12.0 + glitchCycle * 0.13);
  float bar = step(0.92, barY) * glitch;
  col.g += bar * 0.15;
  col.r -= bar * 0.05;

  // --- teal glow at center: much stronger with progress ---
  float glowStrength = 0.08 + intensity * 0.18;
  float centerGlow = exp(-length((uv - 0.5) * vec2(1.4, 0.9)) * 2.0);
  col += vec3(0.04, 0.14, 0.10) * centerGlow * glowStrength / 0.08;

  // --- pulsing edge glow (new: gives life to edges) ---
  float edgePulse = sin(t * 1.5) * 0.5 + 0.5;
  float edgeGlow = smoothstep(0.35, 0.0, abs(uv.x - 0.5)) * 0.0 +
                   smoothstep(0.0, 0.15, abs(uv.x - 0.5)) *
                   smoothstep(0.5, 0.15, abs(uv.x - 0.5));
  float topBottomEdge = smoothstep(0.4, 0.0, uv.y) + smoothstep(0.6, 1.0, uv.y);
  col += vec3(0.02, 0.08, 0.06) * topBottomEdge * edgePulse * intensity * live * 0.5;

  // --- vignette: softer ---
  float vd = length((uv - 0.5) * vec2(1.3, 0.9));
  float vignette = 1.0 - smoothstep(0.5, 1.1, vd);
  col *= vignette;

  col = max(col, vec3(0.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

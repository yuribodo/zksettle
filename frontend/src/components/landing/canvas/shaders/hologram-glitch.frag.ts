export const HOLOGRAM_GLITCH_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uGlitchSeed;
uniform float uReducedMotion;

// --- noise ---
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

  // --- base gradient: dark with teal tint ---
  vec3 col = mix(vec3(0.02, 0.04, 0.05), vec3(0.04, 0.10, 0.09), uv.y);

  // --- grain ---
  vec2 grainSeed = gl_FragCoord.xy + fract(t * 43.0) * vec2(1973.0, 9277.0);
  float grain = (hash(grainSeed) - 0.5) * 0.04;
  col += grain;

  // --- scan lines (roll upward) ---
  float scanSpeed = 30.0;
  float scanDensity = 1.8;
  float scan = sin((gl_FragCoord.y + t * scanSpeed * live) * scanDensity) * 0.5 + 0.5;
  scan = smoothstep(0.3, 0.7, scan);
  col *= 0.92 + scan * 0.08;

  // --- secondary fine scan lines ---
  float fineScan = sin((gl_FragCoord.y + t * 15.0 * live) * 6.0) * 0.5 + 0.5;
  fineScan = smoothstep(0.4, 0.6, fineScan);
  col *= 0.96 + fineScan * 0.04;

  // --- RGB chromatic aberration (constant ±2px offset) ---
  float caOffset = 2.0 / uResolution.x;
  float rShift = hash(vec2(floor(gl_FragCoord.y), 0.0) + fract(t * 0.1) * 100.0);
  col.r *= 1.0 + (rShift - 0.5) * 0.03;
  vec2 uvR = vec2(uv.x + caOffset, uv.y);
  vec2 uvB = vec2(uv.x - caOffset, uv.y);
  float rNoise = noise(uvR * 8.0 + t * 0.5);
  float bNoise = noise(uvB * 8.0 + t * 0.5);
  col.r += (rNoise - 0.5) * 0.015;
  col.b += (bNoise - 0.5) * 0.015;

  // --- micro-glitch (horizontal band displacement every 3-5s) ---
  float glitchCycle = uGlitchSeed;
  float glitchBand = step(0.85, fract(glitchCycle * 0.27 + uv.y * 3.7));
  float glitchIntensity = step(0.92, fract(sin(glitchCycle * 43758.5453)));
  float glitch = glitchBand * glitchIntensity * live;
  float displacement = (hash(vec2(floor(gl_FragCoord.y * 0.1), glitchCycle)) - 0.5) * 0.06;
  vec2 glitchUv = uv + vec2(displacement * glitch, 0.0);
  float glitchNoise = noise(glitchUv * 12.0 + t);
  col += vec3(0.04, 0.12, 0.10) * glitch * glitchNoise;

  // --- teal glow at center ---
  float centerGlow = exp(-length((uv - 0.5) * vec2(1.6, 1.0)) * 2.5);
  col += vec3(0.02, 0.06, 0.05) * centerGlow;

  // --- vignette ---
  float vd = length((uv - 0.5) * vec2(1.4, 1.0));
  float vignette = 1.0 - smoothstep(0.4, 1.0, vd);
  col *= vignette;

  // --- clamp ---
  col = max(col, vec3(0.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

// Shared GLSL helpers — `precision` lives at the top of each shader so we can
// concatenate this block after it without violating WebGL's pragma ordering.
const SHARED_GLSL = /* glsl */ `
float brandEase(float t) {
  float c = 1.0 - t;
  return 1.0 - c * c * c * c * c;
}

// Cheap pseudo curl-noise: two orthogonal sine fields mixed by xy/time.
// No textures, no derivatives — fits the perf budget on low-power GPUs.
vec2 flow(vec2 p, float t) {
  float a = sin(p.x * 1.7 + t * 0.6) * cos(p.y * 1.3 - t * 0.45);
  float b = cos(p.x * 1.5 - t * 0.5) * sin(p.y * 1.9 + t * 0.4);
  return vec2(a, b);
}

// Particle position by kind:
//   aKind > 1.5  → glyph (converges to rotated aTarget)
//   aKind > 0.5  → orbital ambient (slow halo near glyph radius, idle hint)
//   else         → regular ambient (drifts in flow field, never converges)
vec3 particlePosition(
  vec3 aStart,
  vec3 aTarget,
  float aPhase,
  float aKind,
  float p,
  float uTime
) {
  float flowAmp = (1.0 - p) * 0.18;
  vec2 flowOffset = flow(aStart.xy * 1.6, uTime) * flowAmp;

  vec3 start;
  vec3 target;

  if (aKind > 1.5) {
    start = aStart + vec3(flowOffset, 0.0);
    float rotAngle = p * 0.45;
    float c = cos(rotAngle);
    float s = sin(rotAngle);
    mat2 rot = mat2(c, -s, s, c);
    vec2 rotTarget = rot * aTarget.xy;
    target = vec3(rotTarget, aTarget.z);
  } else if (aKind > 0.5) {
    float radius = 0.46 + sin(aPhase * 3.1) * 0.14;
    float theta = aPhase * 2.0 + uTime * 0.18;
    vec2 orbital = vec2(cos(theta), sin(theta)) * radius;
    start = vec3(orbital + flowOffset * 0.4, 0.0);
    target = start;
  } else {
    start = aStart + vec3(flowOffset, 0.0);
    target = vec3(aStart.xy + flowOffset * 0.6, 0.0);
  }

  return mix(start, target, p);
}
`;

export const VERTEX_SHADER = /* glsl */ `
precision highp float;

${SHARED_GLSL}

uniform float uProgress;
uniform float uTime;
uniform float uPixelRatio;
uniform float uScale;

attribute vec3 aStart;
attribute vec3 aTarget;
attribute float aPhase;
attribute float aSize;
attribute float aKind;

varying float vProgress;
varying float vGlyph;
varying float vPhase;
varying float vRadius;

void main() {
  float p = brandEase(clamp(uProgress, 0.0, 1.0));

  vec3 pos = particlePosition(aStart, aTarget, aPhase, aKind, p, uTime) * uScale;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // Particles tighten as they converge.
  float size = aSize * mix(1.0, 0.7, p) * uPixelRatio;
  gl_PointSize = max(size, 1.0);

  vGlyph = step(1.5, aKind);
  vPhase = aPhase;
  vProgress = p;
  vRadius = length(pos.xy);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec3 uAshColor;
uniform vec3 uForestColor;
uniform float uOpacity;
uniform float uTime;
uniform float uVelocity;

varying float vProgress;
varying float vGlyph;
varying float vPhase;
varying float vRadius;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  // Anisotropic stretch based on scroll velocity — particles streak vertically
  // while the user scrolls fast through the hero.
  float stretch = clamp(uVelocity * 6.0, -0.7, 0.7);
  uv.y /= (1.0 + abs(stretch) * 1.5);
  float r = length(uv);

  float alpha = smoothstep(0.5, 0.0, r);

  // Glyph particles shift ash → forest as they converge.
  float shift = vGlyph * vProgress;
  vec3 color = mix(uAshColor, uForestColor, shift);

  // Ambient particles fade as the glyph forms so it reads cleanly.
  float ambientFade = mix(1.0, 0.25, (1.0 - vGlyph) * vProgress);

  // Shockwave: radial pulse traveling through glyph particles past 75% progress.
  float wave = sin(vRadius * 9.0 - uTime * 3.0);
  float shockwave = smoothstep(0.75, 1.0, vProgress) * smoothstep(0.2, 0.85, wave) * vGlyph;

  // Sparkle: random bright pulses that keep the glyph alive post-convergence.
  float sparkleEnv = smoothstep(0.85, 1.0, sin(uTime * 1.3 + vPhase * 7.3));
  float sparkle = sparkleEnv * vGlyph * smoothstep(0.78, 1.0, vProgress);

  float brightness = 1.0 + shockwave * 0.45 + sparkle * 0.7;
  color = clamp(color * brightness, 0.0, 1.0);

  gl_FragColor = vec4(color, alpha * uOpacity * ambientFade);
}
`;

export const HALO_VERTEX_SHADER = /* glsl */ `
precision highp float;

${SHARED_GLSL}

uniform float uProgress;
uniform float uTime;
uniform float uPixelRatio;
uniform float uScale;

attribute vec3 aStart;
attribute vec3 aTarget;
attribute float aPhase;
attribute float aSize;
attribute float aKind;

varying float vProgress;
varying float vGlyph;
varying float vPhase;

void main() {
  float p = brandEase(clamp(uProgress, 0.0, 1.0));

  vec3 pos = particlePosition(aStart, aTarget, aPhase, aKind, p, uTime) * uScale;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // Halo pass uses much larger soft discs to fake ink-bleed glow on a light bg.
  float size = aSize * 4.5 * uPixelRatio;
  gl_PointSize = max(size, 4.0);

  vGlyph = step(1.5, aKind);
  vPhase = aPhase;
  vProgress = p;
}
`;

export const HALO_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec3 uForestColor;
uniform float uTime;

varying float vProgress;
varying float vGlyph;
varying float vPhase;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  // Pow curve gives a softer center and a longer falloff — reads as atmosphere.
  float alpha = smoothstep(0.5, 0.0, r);
  alpha = pow(alpha, 1.8);

  // Halo only ramps in for glyph particles past the midpoint.
  float glyphHalo = vGlyph * smoothstep(0.4, 1.0, vProgress);

  // Sparkle drives the most visible halo bursts post-convergence.
  float sparkleEnv = smoothstep(0.85, 1.0, sin(uTime * 1.3 + vPhase * 7.3));
  float sparkle = sparkleEnv * vGlyph * smoothstep(0.7, 1.0, vProgress);

  float intensity = glyphHalo * 0.22 + sparkle * 0.55;
  if (intensity < 0.005) discard;

  gl_FragColor = vec4(uForestColor, alpha * intensity);
}
`;

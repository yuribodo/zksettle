export const PARTICLES_VERT = /* glsl */ `
precision highp float;

uniform sampler2D tPositions;
uniform float uPixelRatio;
uniform float uPointSize;
uniform float uGlobal;

attribute vec2 aRefUv;
attribute float aSizeJitter;

varying float vDepth;

void main() {
  vec3 pos = texture2D(tPositions, aRefUv).xyz;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // Per-particle size jitter gives perceived depth in 2D.
  // Particles tighten slightly as scroll progress increases.
  float baseSize = uPointSize * (0.7 + aSizeJitter * 0.6);
  float scrollScale = mix(1.0, 0.85, smoothstep(0.0, 0.6, uGlobal));
  gl_PointSize = max(baseSize * scrollScale * uPixelRatio, 1.0);
  vDepth = pos.z;
}
`;

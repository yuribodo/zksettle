export const PARTICLES_FRAG = /* glsl */ `
precision highp float;

uniform float uPaperLuminance;
uniform float uOpacity;

varying float vDepth;

const vec3 FOREST_DEEP = vec3(0.027, 0.149, 0.110);   // ~#072719 — slightly darker than --color-forest for punch
const vec3 INK         = vec3(0.102, 0.098, 0.090);   // #1a1917
const vec3 PAPER       = vec3(0.980, 0.980, 0.969);   // #fafaf7

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  if (r > 0.5) discard;

  // Near-binary disc with hairline AA — each particle is a solid dot.
  float alpha = smoothstep(0.5, 0.46, r);

  // Mix forest with ink for a richer, more contrast-y particle on light bg.
  vec3 darkBase = mix(FOREST_DEEP, INK, 0.18);
  vec3 base = mix(darkBase, PAPER, uPaperLuminance);

  // Subtle depth shading.
  float depthShade = 1.0 - vDepth * 0.18;
  vec3 color = base * depthShade;

  gl_FragColor = vec4(color, alpha * uOpacity);
}
`;

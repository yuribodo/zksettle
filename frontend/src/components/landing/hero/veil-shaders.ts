export const VERTEX_SHADER = /* glsl */ `
precision highp float;

uniform float uProgress;
uniform float uTime;
uniform float uPixelRatio;
uniform float uScale;

attribute vec3 aStart;
attribute vec3 aTarget;
attribute float aPhase;
attribute float aSize;

varying float vProgress;
varying float vGlyph;

// brand-ease cubic-bezier(0.32, 0.72, 0, 1) — approximated by smoothstep'd ease-out-quint
float brandEase(float t) {
  float c = 1.0 - t;
  return 1.0 - c * c * c * c * c;
}

void main() {
  float p = brandEase(clamp(uProgress, 0.0, 1.0));

  // idle drift while scattered — fades out as particles converge
  float drift = (1.0 - p) * 0.05;
  vec3 start = aStart + vec3(
    sin(uTime * 0.25 + aPhase) * drift,
    cos(uTime * 0.27 + aPhase * 1.13) * drift,
    0.0
  );

  vec3 pos = mix(start, aTarget, p) * uScale;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // particles shrink slightly as they converge — tighter commitment glyph
  // aSize is negative for ambient particles (sign encodes glyph membership) —
  // take abs() here so gl_PointSize stays > 0.
  float size = abs(aSize) * mix(1.0, 0.65, p) * uPixelRatio;
  gl_PointSize = max(size, 1.0);

  // vGlyph is 1.0 for particles whose target lies on the glyph silhouette,
  // 0.0 for ambient particles that never participate in the glyph.
  // It is encoded in aSize's sign: negative = ambient, positive = glyph.
  vGlyph = step(0.0, aSize);
  vProgress = p;
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec3 uAshColor;
uniform vec3 uForestColor;
uniform float uOpacity;

varying float vProgress;
varying float vGlyph;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  // soft disc — anti-aliased edges without MSAA
  float alpha = smoothstep(0.5, 0.0, r);

  // glyph particles shift from warm ash to forest as they converge;
  // ambient particles stay warm ash throughout.
  float shift = vGlyph * vProgress;
  vec3 color = mix(uAshColor, uForestColor, shift);

  // ambient particles fade out at full convergence to let the glyph read clean
  float ambientFade = mix(1.0, 0.15, (1.0 - vGlyph) * vProgress);

  gl_FragColor = vec4(color, alpha * uOpacity * ambientFade);
}
`;

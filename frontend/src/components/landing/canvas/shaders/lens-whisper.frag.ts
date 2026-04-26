export const LENS_WHISPER_FRAG = /* glsl */ `
precision highp float;

uniform float u_time;
uniform vec2 u_res;
uniform float u_glitchIntensity;
uniform float u_scanSpeed;
uniform float u_opacity;
uniform float u_actTwoProgress;
uniform float u_breachProgress;

#define PI 3.14159265359

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

float glitchEnvelope(float t) {
  float slow = sin(t * 0.7) * sin(t * 1.1);
  float med = sin(t * 3.3) * 0.5 + 0.5;
  float fast = step(0.88, hash(floor(t * 12.0)));
  float envelope = smoothstep(0.15, 0.5, slow) * (0.5 + 0.5 * med);
  envelope += fast * 0.7;
  return clamp(envelope, 0.0, 1.0);
}

float glitchBand(float y, float t, float intensity) {
  float env = glitchEnvelope(t);
  if (env < 0.1) return 0.0;

  float band1 = step(0.8, vnoise(vec2(y * 15.0, floor(t * 8.0)))) * 0.14;
  float band2 = step(0.85, vnoise(vec2(y * 40.0, floor(t * 15.0)))) * 0.07;
  float band3 = step(0.82, vnoise(vec2(y * 5.0, floor(t * 4.0)))) * 0.25;

  float dir = sign(vnoise(vec2(y * 20.0, floor(t * 6.0))) - 0.5);

  return (band1 + band2 + band3) * dir * env * intensity;
}

float noiseBurst(vec2 uv, float t) {
  float env = glitchEnvelope(t + 1.5);
  if (env < 0.3) return 0.0;

  float blockT = floor(t * 6.0);
  float bx = hash(blockT * 7.3) * 0.8 - 0.4;
  float by = hash(blockT * 11.7) * 0.8 - 0.4;
  float bw = hash(blockT * 3.1) * 0.3 + 0.05;
  float bh = hash(blockT * 5.9) * 0.1 + 0.02;

  float inBlock = step(bx, uv.x) * step(uv.x, bx + bw) *
    step(by, uv.y) * step(uv.y, by + bh);

  float n = hash2(floor(uv * 300.0) + blockT * 100.0);
  return inBlock * n * env * 1.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 centeredUV = (gl_FragCoord.xy - u_res * 0.5) / u_res.y;
  float t = u_time;
  float glitchI = u_glitchIntensity;
  float scanS = u_scanSpeed;

  // Membrane scroll modulation
  float mp = u_actTwoProgress;
  float fbmScale = mix(1.0, 0.4, mp);
  float chromDampen = mix(1.0, 0.1, mp);
  float scanDampen = mix(1.0, 0.2, mp);
  float glitchDampen = mix(1.0, 0.0, smoothstep(0.3, 0.7, mp));

  // Breach: re-escalate chaos as portal opens, then fade to white
  float bp = u_breachProgress;
  float breachEsc = smoothstep(0.0, 0.4, bp);
  float breachFade = smoothstep(0.4, 0.7, bp);
  fbmScale = mix(fbmScale, 1.8, breachEsc * (1.0 - breachFade));
  chromDampen = mix(chromDampen, 3.0, breachEsc * (1.0 - breachFade));
  scanDampen = mix(scanDampen, 2.0, breachEsc * (1.0 - breachFade));
  glitchDampen = mix(glitchDampen, 2.5, breachEsc * (1.0 - breachFade));

  float bandOffset = glitchBand(uv.y, t, glitchI * glitchDampen);
  vec2 glitchedUV = uv;
  glitchedUV.x += bandOffset;

  float chromBase = 0.008 + 0.006 * sin(t * 1.2);
  float chromSpike = glitchEnvelope(t) * 0.035 * glitchI * chromDampen;
  float chromJump = step(0.92, hash(floor(t * 5.0))) * 0.05 * glitchI * chromDampen;
  float chromAmount = chromBase + chromSpike + chromJump;

  vec2 uvR = glitchedUV + vec2(-chromAmount, chromAmount * 0.5);
  vec2 uvG = glitchedUV;
  vec2 uvB = glitchedUV + vec2(chromAmount, -chromAmount * 0.5);

  float slowT = t * 0.15;

  float patR = fbm(uvR * 3.0 * fbmScale + vec2(slowT, slowT * 0.7));
  patR += fbm(uvR * 5.0 * fbmScale - vec2(slowT * 0.5, slowT * 1.2)) * 0.5;
  patR += fbm(uvR * 1.5 * fbmScale + vec2(slowT * 0.3, -slowT * 0.4)) * 0.7;
  patR += fbm(uvR * 10.0 * fbmScale + vec2(slowT * 1.5, -slowT * 0.8)) * 0.15;

  float patG = fbm(uvG * 3.0 * fbmScale + vec2(slowT, slowT * 0.7));
  patG += fbm(uvG * 5.0 * fbmScale - vec2(slowT * 0.5, slowT * 1.2)) * 0.5;
  patG += fbm(uvG * 1.5 * fbmScale + vec2(slowT * 0.3, -slowT * 0.4)) * 0.7;
  patG += fbm(uvG * 10.0 * fbmScale + vec2(slowT * 1.5, -slowT * 0.8)) * 0.15;

  float patB = fbm(uvB * 3.0 * fbmScale + vec2(slowT, slowT * 0.7));
  patB += fbm(uvB * 5.0 * fbmScale - vec2(slowT * 0.5, slowT * 1.2)) * 0.5;
  patB += fbm(uvB * 1.5 * fbmScale + vec2(slowT * 0.3, -slowT * 0.4)) * 0.7;
  patB += fbm(uvB * 10.0 * fbmScale + vec2(slowT * 1.5, -slowT * 0.8)) * 0.15;

  patR = smoothstep(0.35, 0.55, patR / 2.45);
  patG = smoothstep(0.35, 0.55, patG / 2.45);
  patB = smoothstep(0.35, 0.55, patB / 2.45);

  patR = patR * patR * (3.0 - 2.0 * patR);
  patG = patG * patG * (3.0 - 2.0 * patG);
  patB = patB * patB * (3.0 - 2.0 * patB);

  float hueShift = t * 0.2;
  float hue1 = sin(hueShift) * 0.5 + 0.5;
  float hue2 = sin(hueShift + 2.094) * 0.5 + 0.5;
  float hue3 = sin(hueShift + 4.189) * 0.5 + 0.5;

  float spatialHue = sin(centeredUV.x * 4.0 + centeredUV.y * 3.0 + t * 0.3) * 0.5 + 0.5;

  vec3 col1 = vec3(0.0, 1.0, 1.2);
  vec3 col2 = vec3(1.2, 0.1, 0.9);
  vec3 col3 = vec3(1.2, 1.25, 1.3);
  vec3 col4 = vec3(1.0, 0.95, 0.2);

  vec3 palette = mix(col1, col2, hue1 * spatialHue);
  palette = mix(palette, col3, hue2 * 0.3);
  palette = mix(palette, col4, hue3 * spatialHue * 0.4);

  vec3 baseColor;
  baseColor.r = patR * palette.r;
  baseColor.g = patG * palette.g;
  baseColor.b = patB * palette.b;

  float alignment = patR * patG * patB;
  baseColor += vec3(0.9, 0.95, 1.0) * pow(alignment, 1.5) * 1.2;

  float scanY = gl_FragCoord.y;

  float fineScan = sin(scanY * PI * 0.8) * 0.5 + 0.5;
  fineScan = pow(fineScan, 1.5);

  float medScanR = sin((scanY + t * 60.0 * scanS * scanDampen) * 0.15) * 0.5 + 0.5;
  float medScanG = sin((scanY + t * 75.0 * scanS * scanDampen) * 0.15) * 0.5 + 0.5;
  float medScanB = sin((scanY + t * 55.0 * scanS * scanDampen) * 0.15) * 0.5 + 0.5;

  float broadScan = sin((scanY + t * 30.0 * scanS * scanDampen) * 0.03) * 0.5 + 0.5;
  broadScan = smoothstep(0.3, 0.7, broadScan);

  float scanR = mix(0.45, 1.0, fineScan) * mix(0.7, 1.0, medScanR) * mix(0.6, 1.0, broadScan);
  float scanG = mix(0.45, 1.0, fineScan) * mix(0.7, 1.0, medScanG) * mix(0.6, 1.0, broadScan);
  float scanB = mix(0.45, 1.0, fineScan) * mix(0.7, 1.0, medScanB) * mix(0.6, 1.0, broadScan);

  float brightScanPos = mod(t * 40.0 * scanS * scanDampen, u_res.y);
  float brightScan = exp(-abs(scanY - brightScanPos) * 0.12) * 0.7;

  baseColor.r *= scanR;
  baseColor.g *= scanG;
  baseColor.b *= scanB;
  baseColor += vec3(0.3, 0.8, 1.0) * brightScan;

  float interlace = mod(scanY + floor(t * 30.0), 2.0);
  float interlaceFlicker = mix(0.78, 1.0, interlace);
  float lineFlicker = 1.0 - step(0.95, hash(floor(scanY * 0.5) + floor(t * 20.0) * 100.0)) * 0.5;
  baseColor *= interlaceFlicker * lineFlicker;

  float burst = noiseBurst(centeredUV, t);
  baseColor += vec3(0.5, 0.9, 1.0) * burst * glitchI;

  float patCenter = fbm(glitchedUV * 3.0 + vec2(slowT, slowT * 0.7));
  float patDx = fbm((glitchedUV + vec2(0.005, 0.0)) * 3.0 + vec2(slowT, slowT * 0.7));
  float patDy = fbm((glitchedUV + vec2(0.0, 0.005)) * 3.0 + vec2(slowT, slowT * 0.7));
  float edgeStrength = length(vec2(patDx - patCenter, patDy - patCenter)) * 20.0;
  edgeStrength = smoothstep(0.2, 0.8, edgeStrength);
  vec3 edgeColor = mix(vec3(0.2, 0.9, 1.2), vec3(1.2, 0.3, 1.0), spatialHue) * edgeStrength * 0.6;
  baseColor += edgeColor;

  float shimmer = sin(centeredUV.x * 20.0 + centeredUV.y * 15.0 + t * 2.0) * 0.15 + 0.85;
  shimmer *= sin(centeredUV.x * 8.0 - centeredUV.y * 12.0 + t * 1.3) * 0.1 + 0.9;
  baseColor *= shimmer;

  float clarity = sin(t * 0.4) * 0.15 + 0.85;
  baseColor *= clarity;

  float vDist = length(centeredUV * vec2(1.0, 0.85));
  float vignette = 1.0 - smoothstep(0.45, 1.1, vDist);
  vec3 vignetteColor = vec3(0.02, 0.03, 0.06);
  baseColor = mix(vignetteColor, baseColor, vignette);

  float grain = (hash2(gl_FragCoord.xy + fract(t * 43.0) * 1000.0) - 0.5) * 0.06;
  baseColor += grain;

  // Forest green tint as membrane progress increases
  vec3 forestTint = vec3(0.047, 0.24, 0.18);
  baseColor = mix(baseColor, baseColor + forestTint * 0.3, smoothstep(0.4, 0.8, mp));

  // Portal breach: brightness surge → radial white flood
  if (bp > 0.0) {
    baseColor *= 1.0 + breachEsc * (1.0 - breachFade) * 1.2;

    float floodPhase = smoothstep(0.35, 0.7, bp);
    float dist = length(centeredUV);
    float floodRadius = mix(1.8, 0.0, floodPhase);
    float flood = smoothstep(floodRadius + 0.4, floodRadius, dist);
    vec3 canvasWhite = vec3(0.98, 0.98, 0.965);
    baseColor = mix(baseColor, canvasWhite, flood * floodPhase);

    float whiteout = smoothstep(0.6, 0.9, bp);
    baseColor = mix(baseColor, canvasWhite, whiteout);
  }

  baseColor = baseColor / (baseColor + vec3(0.65));
  baseColor = pow(baseColor, vec3(0.95));
  baseColor = max(baseColor, vec3(0.0));

  gl_FragColor = vec4(baseColor, u_opacity);
}
`;

export const SCROLL_DISTORTION_FRAG = /* glsl */ `
precision highp float;

uniform float u_time;
uniform vec2 u_res;
uniform float u_opacity;
uniform float u_scrollVelocity;

varying vec2 vUv;

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

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float vel = u_scrollVelocity;

  // FBM UV displacement — organic wobble during fast scroll
  float displaceAmount = vel * 0.003;
  vec2 displace = vec2(
    fbm(uv * 4.0 + u_time * 0.1) - 0.5,
    fbm(uv * 4.0 + u_time * 0.1 + 100.0) - 0.5
  ) * displaceAmount;
  vec2 distortedUv = uv + displace;

  // Chromatic aberration — offset R and B channels
  float chromAmount = vel * 0.012;
  vec2 uvR = distortedUv + vec2(-chromAmount, chromAmount * 0.5);
  vec2 uvB = distortedUv + vec2(chromAmount, -chromAmount * 0.5);

  // Grain per channel (time-varying so it shimmers)
  float grainIntensity = mix(0.02, 0.08, vel);
  float grainR = (hash2(floor(uvR * u_res) + fract(u_time * 43.0) * 1000.0) - 0.5) * grainIntensity;
  float grainG = (hash2(floor(distortedUv * u_res) + fract(u_time * 43.0) * 1000.0) - 0.5) * grainIntensity;
  float grainB = (hash2(floor(uvB * u_res) + fract(u_time * 43.0) * 1000.0) - 0.5) * grainIntensity;

  vec3 color = vec3(grainR, grainG, grainB);

  // Alpha: ramp with velocity, with a subtle floor so idle state has minimal grain
  float grainFloor = 0.015;
  float alpha = u_opacity * max(vel * 1.5, grainFloor);

  gl_FragColor = vec4(color, alpha);
}
`;

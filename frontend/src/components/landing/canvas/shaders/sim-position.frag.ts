export const SIM_POSITION_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tPositions;
uniform sampler2D tCurrentTarget;
uniform sampler2D tNextTarget;
uniform float uTargetMix;
uniform float uTime;
uniform float uDamp;
uniform float uIdleScatter;
uniform vec2  uMouse;          // NDC ish, -1..1
uniform float uMousePull;      // strength of cursor gravity (0..1)
uniform float uBreatheAmp;     // amplitude of idle Y breathing

varying vec2 vUv;

vec2 curl(vec2 p, float t) {
  float a = sin(p.x * 1.7 + t * 0.6) * cos(p.y * 1.3 - t * 0.45);
  float b = cos(p.x * 1.5 - t * 0.5) * sin(p.y * 1.9 + t * 0.4);
  return vec2(a, b);
}

void main() {
  vec3 pos = texture2D(tPositions, vUv).xyz;
  vec3 t0  = texture2D(tCurrentTarget, vUv).xyz;
  vec3 t1  = texture2D(tNextTarget, vUv).xyz;

  // Smooth ease on the mix so transitions don't look mechanical.
  float mixT = smoothstep(0.0, 1.0, uTargetMix);
  vec3 baseTarget = mix(t0, t1, mixT);

  // Subtle idle breathing — particles oscillate gently along Y around their target.
  float breathe = sin(uTime * 0.6 + vUv.x * 6.28) * uBreatheAmp;
  vec3 target = baseTarget + vec3(0.0, breathe, 0.0);

  // Cursor as a soft attractor — particles within radius drift toward mouse.
  // Deflects the position not the target, so the wordmark "responds" but
  // doesn't permanently distort.
  vec2 toMouse = uMouse - pos.xy;
  float dist = length(toMouse);
  float falloff = exp(-dist * 2.6);
  vec2 pull = toMouse * falloff * uMousePull * 0.18;

  // Gentle curl drift adds life — keeps particles from looking frozen.
  vec2 drift = curl(pos.xy * 0.7 + vUv * 3.0, uTime * 0.4) * uIdleScatter;

  vec3 toward = target - pos;
  pos.xy += (toward.xy * 0.07 + drift + pull) * uDamp;
  pos.z = mix(pos.z, target.z, 0.05);

  gl_FragColor = vec4(pos, 1.0);
}
`;

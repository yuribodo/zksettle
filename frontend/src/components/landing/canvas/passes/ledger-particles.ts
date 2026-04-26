import {
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  Points,
  RawShaderMaterial,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";

import { createPrng } from "@/lib/prng";

import { bakeLedgerAtlas, type LedgerAtlas } from "../glyphs/bake-ledger-atlas";
import { bakeWordmarkAtlas } from "../glyphs/bake-wordmark-atlas";
import { PARTICLES_FRAG } from "../shaders/particles.frag";
import { PARTICLES_VERT } from "../shaders/particles.vert";
import { SIM_POSITION_FRAG } from "../shaders/sim-position.frag";
import { GpgpuSim } from "./gpgpu-sim";

export type LedgerParticlesOptions = {
  fboSize: number;
  pointSize: number;
  wordmark: string;
  /** NDC center where the wordmark sits — paired with positive X = right side. */
  wordmarkCenter: { x: number; y: number };
  wordmarkScale: { x: number; y: number };
  ledgerCenter: { x: number; y: number };
  ledgerScale: { x: number; y: number };
};

export class LedgerParticles {
  readonly points: Points;
  private readonly material: ShaderMaterial;
  private readonly sim: GpgpuSim;
  private wordmark: LedgerAtlas;
  private ledger: LedgerAtlas;
  private readonly options: LedgerParticlesOptions;

  constructor(renderer: WebGLRenderer, opts: LedgerParticlesOptions) {
    this.options = opts;
    this.wordmark = bakeWordmarkAtlas({
      text: opts.wordmark,
      fboSize: opts.fboSize,
      centerX: opts.wordmarkCenter.x,
      centerY: opts.wordmarkCenter.y,
      scaleX: opts.wordmarkScale.x,
      scaleY: opts.wordmarkScale.y,
    });
    this.ledger = bakeLedgerAtlas({
      seed: 0xa1c3f7,
      fboSize: opts.fboSize,
      centerX: opts.ledgerCenter.x,
      centerY: opts.ledgerCenter.y,
      scaleX: opts.ledgerScale.x,
      scaleY: opts.ledgerScale.y,
    });

    this.sim = new GpgpuSim(renderer, {
      size: opts.fboSize,
      fragmentShader: SIM_POSITION_FRAG,
      uniforms: {
        tPositions: { value: null },
        tCurrentTarget: { value: this.wordmark.texture },
        tNextTarget: { value: this.ledger.texture },
        uTargetMix: { value: 0 },
        uTime: { value: 0 },
        uDamp: { value: 1 },
        uIdleScatter: { value: 0.0005 },
        uMouse: { value: new Vector2(0, 0) },
        uMousePull: { value: 0 },
        uBreatheAmp: { value: 0.002 },
      },
      initialPositions: this.wordmark.texture,
    });

    const geometry = buildPointsGeometry(opts.fboSize);
    // ShaderMaterial (not Raw) so Three.js auto-injects modelViewMatrix +
    // projectionMatrix used by the vertex shader.
    this.material = new ShaderMaterial({
      vertexShader: PARTICLES_VERT,
      fragmentShader: PARTICLES_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        tPositions: { value: this.sim.getCurrentTexture() },
        uPixelRatio: { value: 1 },
        uPointSize: { value: opts.pointSize },
        uGlobal: { value: 0 },
        uPaperLuminance: { value: 0 },
        uOpacity: { value: 0.95 },
      },
    });

    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  setUniform(name: string, value: unknown) {
    const u = this.material.uniforms[name];
    if (u) u.value = value;
  }

  setSimUniform(name: string, value: unknown) {
    this.sim.setUniform(name, value);
  }

  setMouse(x: number, y: number, pull: number) {
    const mu = this.sim["material"].uniforms.uMouse;
    if (mu && mu.value instanceof Vector2) mu.value.set(x, y);
    const pu = this.sim["material"].uniforms.uMousePull;
    if (pu) pu.value = pull;
  }

  setTargetMix(t: number) {
    const u = this.sim["material"].uniforms.uTargetMix;
    if (u) u.value = Math.min(Math.max(t, 0), 1);
  }

  setPixelRatio(pr: number) {
    const u = this.material.uniforms.uPixelRatio;
    if (u) u.value = pr;
  }

  step(time: number, damp: number) {
    this.sim.setUniform("uTime", time);
    this.sim.setUniform("uDamp", damp);
    this.sim.step({});
    const u = this.material.uniforms.tPositions;
    if (u) u.value = this.sim.getCurrentTexture();
  }

  addToScene(scene: Scene) {
    scene.add(this.points);
  }

  dispose() {
    this.material.dispose();
    this.points.geometry.dispose();
    this.sim.dispose();
    this.wordmark.texture.dispose();
    this.ledger.texture.dispose();
  }
}

function buildPointsGeometry(size: number): BufferGeometry {
  const count = size * size;
  const refUv = new Float32Array(count * 2);
  const sizeJitter = new Float32Array(count);
  const positions = new Float32Array(count * 3);
  const prng = createPrng(0xb33f);

  for (let i = 0; i < count; i += 1) {
    const x = (i % size) / size + 0.5 / size;
    const y = Math.floor(i / size) / size + 0.5 / size;
    refUv[i * 2] = x;
    refUv[i * 2 + 1] = y;
    sizeJitter[i] = prng.next();
  }

  const g = new BufferGeometry();
  g.setAttribute("aRefUv", new BufferAttribute(refUv, 2));
  g.setAttribute("aSizeJitter", new BufferAttribute(sizeJitter, 1));
  g.setAttribute("position", new BufferAttribute(positions, 3));
  g.setDrawRange(0, count);
  return g;
}

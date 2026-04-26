import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  RawShaderMaterial,
  Scene,
  Vector2,
} from "three";

import { DITHER_FRAG } from "../shaders/dither.frag";
import { DITHER_VERT } from "../shaders/dither.vert";

export class DitherPass {
  readonly mesh: Mesh;
  readonly material: RawShaderMaterial;

  constructor() {
    this.material = new RawShaderMaterial({
      vertexShader: DITHER_VERT,
      fragmentShader: DITHER_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPaperLuminance: { value: 0 },
        uForestAccent: { value: 0.18 },
        uDitherScale: { value: 1.0 },
        uMouse: { value: new Vector2(0, 0) },
        uRippleProgress: { value: 1 },
        uResolution: { value: new Vector2(1, 1) },
        uStaticDither: { value: 0 },
      },
    });

    const g = new BufferGeometry();
    const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
    g.setAttribute("position", new BufferAttribute(verts, 2));
    this.mesh = new Mesh(g, this.material);
    this.mesh.frustumCulled = false;
  }

  setUniform(name: string, value: unknown) {
    const u = this.material.uniforms[name];
    if (u) u.value = value;
  }

  setResolution(width: number, height: number) {
    const u = this.material.uniforms.uResolution;
    if (u && u.value instanceof Vector2) u.value.set(width, height);
  }

  setMouse(x: number, y: number) {
    const u = this.material.uniforms.uMouse;
    if (u && u.value instanceof Vector2) u.value.set(x, y);
  }

  addToScene(scene: Scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

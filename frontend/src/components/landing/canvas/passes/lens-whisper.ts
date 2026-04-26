import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  RawShaderMaterial,
  Scene,
  Vector2,
} from "three";

import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { LENS_WHISPER_FRAG } from "../shaders/lens-whisper.frag";

export class LensWhisper {
  private readonly material: RawShaderMaterial;
  private readonly mesh: Mesh;

  constructor() {
    this.material = new RawShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: LENS_WHISPER_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        u_time: { value: 0 },
        u_res: { value: new Vector2(1, 1) },
        u_glitchIntensity: { value: 1.0 },
        u_scanSpeed: { value: 1.0 },
        u_opacity: { value: 1 },
        u_actTwoProgress: { value: 0 },
        u_breachProgress: { value: 0 },
      },
    });

    const geo = new BufferGeometry();
    const verts = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    geo.setAttribute("position", new BufferAttribute(verts, 3));

    this.mesh = new Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  setSize(w: number, h: number, pixelRatio: number) {
    (this.material.uniforms.u_res!.value as Vector2).set(
      w * pixelRatio,
      h * pixelRatio,
    );
  }

  setOpacity(o: number) {
    this.material.uniforms.u_opacity!.value = o;
  }

  setActTwoProgress(p: number) {
    this.material.uniforms.u_actTwoProgress!.value = p;
  }

  setBreachProgress(p: number) {
    this.material.uniforms.u_breachProgress!.value = p;
  }

  step(time: number) {
    this.material.uniforms.u_time!.value = time;
  }

  addToScene(scene: Scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

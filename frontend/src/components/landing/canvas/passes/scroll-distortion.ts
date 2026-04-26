import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  RawShaderMaterial,
  Scene,
  Vector2,
} from "three";

import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { SCROLL_DISTORTION_FRAG } from "../shaders/scroll-distortion.frag";

export class ScrollDistortion {
  private readonly material: RawShaderMaterial;
  private readonly mesh: Mesh;

  constructor() {
    this.material = new RawShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: SCROLL_DISTORTION_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        u_time: { value: 0 },
        u_res: { value: new Vector2(1, 1) },
        u_opacity: { value: 0 },
        u_scrollVelocity: { value: 0 },
      },
    });

    const geo = new BufferGeometry();
    const verts = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    geo.setAttribute("position", new BufferAttribute(verts, 3));

    this.mesh = new Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
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

  setScrollVelocity(v: number) {
    this.material.uniforms.u_scrollVelocity!.value = v;
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

import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  FloatType,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RGBAFormat,
  RawShaderMaterial,
  Scene,
  Texture,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";

const SIM_VERT = /* glsl */ `
precision highp float;
attribute vec3 position;
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export type GpgpuSimOptions = {
  size: number;
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
  initialPositions: Texture;
};

export class GpgpuSim {
  private readonly renderer: WebGLRenderer;
  private readonly size: number;
  private readonly material: RawShaderMaterial;
  private readonly scene: Scene;
  private readonly camera: OrthographicCamera;
  private rtA: WebGLRenderTarget;
  private rtB: WebGLRenderTarget;
  private current: 0 | 1 = 0;
  private readonly initMaterial: RawShaderMaterial;

  constructor(renderer: WebGLRenderer, opts: GpgpuSimOptions) {
    this.renderer = renderer;
    this.size = opts.size;

    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = makeFullscreenTri();
    this.material = new RawShaderMaterial({
      vertexShader: SIM_VERT,
      fragmentShader: opts.fragmentShader,
      uniforms: opts.uniforms as RawShaderMaterial["uniforms"],
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, this.material);
    this.scene.add(mesh);

    this.rtA = makeRT(opts.size);
    this.rtB = makeRT(opts.size);

    // Initialize both RTs from the supplied initial positions texture.
    this.initMaterial = new RawShaderMaterial({
      vertexShader: SIM_VERT,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tInitial;
        varying vec2 vUv;
        void main() { gl_FragColor = texture2D(tInitial, vUv); }
      `,
      uniforms: { tInitial: { value: opts.initialPositions } },
      depthTest: false,
      depthWrite: false,
    });
    this.seedFromInitial();
  }

  private seedFromInitial() {
    const initScene = new Scene();
    initScene.add(new Mesh(makeFullscreenTri(), this.initMaterial));

    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.rtA);
    this.renderer.render(initScene, this.camera);
    this.renderer.setRenderTarget(this.rtB);
    this.renderer.render(initScene, this.camera);
    this.renderer.setRenderTarget(prevTarget);
  }

  /** Run one step. The output texture is then available via `getCurrentTexture()`. */
  step(uniformsToSet?: Record<string, unknown>) {
    if (uniformsToSet) {
      for (const [k, v] of Object.entries(uniformsToSet)) {
        const u = this.material.uniforms[k];
        if (u) u.value = v;
      }
    }
    // Read from current, write to the other.
    const read = this.current === 0 ? this.rtA : this.rtB;
    const write = this.current === 0 ? this.rtB : this.rtA;

    const positionsUniform = this.material.uniforms.tPositions;
    if (positionsUniform) positionsUniform.value = read.texture;

    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(write);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prev);

    this.current = this.current === 0 ? 1 : 0;
  }

  getCurrentTexture(): Texture {
    return (this.current === 0 ? this.rtA : this.rtB).texture;
  }

  setUniform(name: string, value: unknown) {
    const u = this.material.uniforms[name];
    if (u) u.value = value;
  }

  resize(size: number) {
    if (size === this.size) return;
    this.rtA.dispose();
    this.rtB.dispose();
    this.rtA = makeRT(size);
    this.rtB = makeRT(size);
    this.seedFromInitial();
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.material.dispose();
    this.initMaterial.dispose();
  }
}

function makeRT(size: number): WebGLRenderTarget {
  return new WebGLRenderTarget(size, size, {
    type: FloatType,
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

function makeFullscreenTri(): BufferGeometry {
  const g = new BufferGeometry();
  // Single triangle covering NDC [-1..1] in clip space (overshoots so 1 tri = full screen).
  // 3-component positions (z=0) keep Three.js's bounding-sphere math happy.
  const verts = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
  g.setAttribute("position", new BufferAttribute(verts, 3));
  return g;
}

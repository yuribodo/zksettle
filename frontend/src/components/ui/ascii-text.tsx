"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const VERTEX_SHADER = `
varying vec2 vUv;
uniform float uTime;
uniform float uEnableWaves;

void main() {
  vUv = uv;
  float time = uTime * 5.0;
  float waveFactor = uEnableWaves;
  vec3 transformed = position;
  transformed.x += sin(time + position.y) * 0.12 * waveFactor;
  transformed.y += cos(time + position.z) * 0.04 * waveFactor;
  transformed.z += sin(time + position.x) * 0.2 * waveFactor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

const FRAGMENT_SHADER = `
varying vec2 vUv;
uniform float uTime;
uniform sampler2D uTexture;

void main() {
  float time = uTime;
  vec2 pos = vUv;
  vec4 texel = texture2D(uTexture, pos + cos(time * 2.0 + pos.x) * 0.001);
  float luma = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(vec3(luma), texel.a);
}
`;

class AsciiFilter {
  domElement: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private pre: HTMLPreElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private cols = 0;
  private rows = 0;
  private fontSize: number;
  private fontFamily: string;
  private charset: string;
  private invert: boolean;

  constructor(
    renderer: THREE.WebGLRenderer,
    opts: {
      fontSize?: number;
      fontFamily?: string;
      charset?: string;
      invert?: boolean;
    } = {},
  ) {
    this.renderer = renderer;
    this.fontSize = opts.fontSize ?? 12;
    this.fontFamily = opts.fontFamily ?? "'Courier New', monospace";
    this.charset = opts.charset ?? " .:-=+*#%@";
    this.invert = opts.invert ?? true;

    this.domElement = document.createElement("div");
    this.domElement.style.position = "absolute";
    this.domElement.style.top = "0";
    this.domElement.style.left = "0";
    this.domElement.style.width = "100%";
    this.domElement.style.height = "100%";

    this.pre = document.createElement("pre");
    this.domElement.appendChild(this.pre);

    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d")!;
    this.domElement.appendChild(this.canvas);

    this.context.imageSmoothingEnabled = false;
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.reset();
  }

  private reset() {
    this.context.font = `${this.fontSize}px ${this.fontFamily}`;
    const charWidth = this.context.measureText("A").width;
    this.cols = Math.floor(
      this.width / (this.fontSize * (charWidth / this.fontSize)),
    );
    this.rows = Math.floor(this.height / this.fontSize);
    this.canvas.width = this.cols;
    this.canvas.height = this.rows;
    this.pre.style.fontFamily = this.fontFamily;
    this.pre.style.fontSize = `${this.fontSize}px`;
    this.pre.style.margin = "0";
    this.pre.style.padding = "0";
    this.pre.style.lineHeight = "1em";
    this.pre.style.position = "absolute";
    this.pre.style.left = "0";
    this.pre.style.top = "0";
    this.pre.style.zIndex = "9";
    this.pre.style.userSelect = "none";
    this.pre.style.fontWeight = "bold";
    this.pre.style.color = "#ffffff";
    this.pre.style.textShadow = "0 0 8px rgba(255,255,255,0.3)";
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer.render(scene, camera);
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.context.clearRect(0, 0, w, h);
    if (w && h) {
      this.context.drawImage(this.renderer.domElement, 0, 0, w, h);
    }
    this.asciify(w, h);
  }

  private asciify(w: number, h: number) {
    if (!w || !h) return;
    const imgData = this.context.getImageData(0, 0, w, h).data;
    let str = "";
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (x + y * w) * 4;
        const r = imgData[i]!;
        const g = imgData[i + 1]!;
        const b = imgData[i + 2]!;
        const a = imgData[i + 3]!;
        if (a === 0) {
          str += " ";
          continue;
        }
        const gray = (0.3 * r + 0.6 * g + 0.1 * b) / 255;
        let idx = Math.floor((1 - gray) * (this.charset.length - 1));
        if (this.invert) idx = this.charset.length - idx - 1;
        str += this.charset[idx];
      }
      str += "\n";
    }
    this.pre.textContent = str;
  }

  dispose() {
    // nothing external to clean up
  }
}

class CanvasTxt {
  canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private txt: string;
  private font: string;
  private color: string;

  constructor(
    txt: string,
    opts: { fontSize?: number; fontFamily?: string; color?: string } = {},
  ) {
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d")!;
    this.txt = txt;
    this.color = opts.color ?? "#fdf9f3";
    const fontSize = opts.fontSize ?? 200;
    const fontFamily = opts.fontFamily ?? "Arial";
    this.font = `600 ${fontSize}px ${fontFamily}`;
  }

  resize() {
    this.context.font = this.font;
    const metrics = this.context.measureText(this.txt);
    this.canvas.width = Math.ceil(metrics.width) + 20;
    this.canvas.height =
      Math.ceil(
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      ) + 20;
  }

  render() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.fillStyle = this.color;
    this.context.font = this.font;
    const metrics = this.context.measureText(this.txt);
    this.context.fillText(this.txt, 10, 10 + metrics.actualBoundingBoxAscent);
  }
}

class CanvAscii {
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private filter!: AsciiFilter;
  private mesh!: THREE.Mesh;
  private textCanvas!: CanvasTxt;
  private texture!: THREE.CanvasTexture;
  private material!: THREE.ShaderMaterial;
  private geometry!: THREE.PlaneGeometry;
  private container: HTMLElement;
  private width: number;
  private height: number;
  private animationFrameId = 0;
  private textString: string;
  private asciiFontSize: number;
  private textFontSize: number;
  private textColor: string;
  private planeBaseHeight: number;
  private enableWaves: boolean;
  private fontFamily: string;

  constructor(
    opts: {
      text: string;
      asciiFontSize: number;
      textFontSize: number;
      textColor: string;
      planeBaseHeight: number;
      enableWaves: boolean;
      fontFamily: string;
    },
    container: HTMLElement,
    width: number,
    height: number,
  ) {
    this.textString = opts.text;
    this.asciiFontSize = opts.asciiFontSize;
    this.textFontSize = opts.textFontSize;
    this.textColor = opts.textColor;
    this.planeBaseHeight = opts.planeBaseHeight;
    this.enableWaves = opts.enableWaves;
    this.fontFamily = opts.fontFamily;
    this.container = container;
    this.width = width;
    this.height = height;

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.width / this.height,
      1,
      1000,
    );
    this.camera.position.z = 30;
    this.scene = new THREE.Scene();
  }

  async init() {
    await document.fonts.ready;
    this.setMesh();
    this.setRenderer();
  }

  private setMesh() {
    this.textCanvas = new CanvasTxt(this.textString, {
      fontSize: this.textFontSize,
      fontFamily: this.fontFamily,
      color: this.textColor,
    });
    this.textCanvas.resize();
    this.textCanvas.render();

    this.texture = new THREE.CanvasTexture(this.textCanvas.canvas);
    this.texture.minFilter = THREE.NearestFilter;

    const textAspect =
      this.textCanvas.canvas.width / this.textCanvas.canvas.height;
    const planeW = this.planeBaseHeight * textAspect;

    this.geometry = new THREE.PlaneGeometry(planeW, this.planeBaseHeight, 36, 36);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uTexture: { value: this.texture },
        uEnableWaves: { value: this.enableWaves ? 1.0 : 0.0 },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  private setRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);

    this.filter = new AsciiFilter(this.renderer, {
      fontFamily: this.fontFamily,
      fontSize: this.asciiFontSize,
      invert: true,
    });

    this.container.appendChild(this.filter.domElement);
    this.filter.setSize(this.width, this.height);
  }

  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.filter.setSize(w, h);
  }

  load() {
    const tick = () => {
      this.animationFrameId = requestAnimationFrame(tick);
      this.step();
    };
    tick();
  }

  private step() {
    const time = performance.now() * 0.001;
    this.textCanvas.render();
    this.texture.needsUpdate = true;
    this.material.uniforms.uTime!.value = Math.sin(time);
    this.filter.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.animationFrameId);
    if (this.filter) {
      this.filter.dispose();
      if (this.filter.domElement.parentNode) {
        this.container.removeChild(this.filter.domElement);
      }
    }
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (m.material instanceof THREE.Material) m.material.dispose();
      }
    });
    this.scene.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }
}

export type ASCIITextProps = {
  text?: string;
  asciiFontSize?: number;
  textFontSize?: number;
  textColor?: string;
  planeBaseHeight?: number;
  enableWaves?: boolean;
  className?: string;
};

export function ASCIIText({
  text = "Hello",
  asciiFontSize = 8,
  textFontSize = 200,
  textColor = "#ffffff",
  planeBaseHeight = 8,
  enableWaves = true,
  className,
}: ASCIITextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const asciiRef = useRef<CanvAscii | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let ro: ResizeObserver | null = null;
    const container = containerRef.current;

    const fontFamily =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-jetbrains-mono")
        .trim() || "'JetBrains Mono', monospace";

    const createAndInit = async (el: HTMLElement, w: number, h: number) => {
      const instance = new CanvAscii(
        {
          text,
          asciiFontSize,
          textFontSize,
          textColor,
          planeBaseHeight,
          enableWaves,
          fontFamily,
        },
        el,
        w,
        h,
      );
      await instance.init();
      return instance;
    };

    const setup = async () => {
      const { width, height } = container.getBoundingClientRect();

      if (width === 0 || height === 0) {
        observer = new IntersectionObserver(
          async ([entry]) => {
            if (cancelled || !entry) return;
            if (
              entry.isIntersecting &&
              entry.boundingClientRect.width > 0 &&
              entry.boundingClientRect.height > 0
            ) {
              const { width: w, height: h } = entry.boundingClientRect;
              observer!.disconnect();
              observer = null;
              if (!cancelled) {
                asciiRef.current = await createAndInit(container, w, h);
                if (!cancelled && asciiRef.current) asciiRef.current.load();
              }
            }
          },
          { threshold: 0.1 },
        );
        observer.observe(container);
        return;
      }

      asciiRef.current = await createAndInit(container, width, height);
      if (!cancelled && asciiRef.current) {
        asciiRef.current.load();
        ro = new ResizeObserver((entries) => {
          if (!entries[0] || !asciiRef.current) return;
          const { width: w, height: h } = entries[0].contentRect;
          if (w > 0 && h > 0) asciiRef.current.setSize(w, h);
        });
        ro.observe(container);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
      if (ro) ro.disconnect();
      if (asciiRef.current) {
        asciiRef.current.dispose();
        asciiRef.current = null;
      }
    };
  }, [text, asciiFontSize, textFontSize, textColor, planeBaseHeight, enableWaves]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .ascii-text-host canvas {
              position: absolute;
              left: 0; top: 0;
              width: 100%; height: 100%;
              image-rendering: pixelated;
            }
          `,
        }}
      />
    </div>
  );
}

import { DataTexture, FloatType, RGBAFormat } from "three";

import { createPrng } from "@/lib/prng";

const HEX = "0123456789abcdef";

export type LedgerAtlas = {
  texture: DataTexture;
  count: number;
  size: number;
};

const ATLAS_W = 1024;
const ATLAS_H = 1280;
const HEX_LEN = 12;
const LINE_COUNT = 7;

let bakerCanvas: HTMLCanvasElement | null = null;
let bakerCtx: CanvasRenderingContext2D | null = null;

function getBaker(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!bakerCanvas) {
    bakerCanvas = document.createElement("canvas");
    bakerCanvas.width = ATLAS_W;
    bakerCanvas.height = ATLAS_H;
  }
  if (!bakerCtx) {
    const ctx = bakerCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("bake-ledger-atlas: 2D context unavailable");
    bakerCtx = ctx;
  }
  return { canvas: bakerCanvas, ctx: bakerCtx };
}

function hexLine(prng: ReturnType<typeof createPrng>): string {
  let out = "0x";
  for (let i = 0; i < HEX_LEN; i += 1) {
    const idx = Math.floor(prng.next() * HEX.length);
    out += HEX[idx];
  }
  return out;
}

export type BakeLedgerOptions = {
  seed: number;
  fboSize: number;
  centerX: number;
  centerY: number;
  scaleX: number;
  scaleY: number;
};

export function bakeLedgerAtlas(opts: BakeLedgerOptions): LedgerAtlas {
  const { seed, fboSize, centerX, centerY, scaleX, scaleY } = opts;
  const { ctx } = getBaker();

  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = "bold 88px Menlo, Consolas, 'Courier New', monospace";

  const prng = createPrng(seed >>> 0);
  const lineHeight = ATLAS_H / (LINE_COUNT + 1);

  for (let i = 0; i < LINE_COUNT; i += 1) {
    const text = hexLine(prng);
    const y = lineHeight * (i + 1);
    const w = ctx.measureText(text).width;
    const x = (ATLAS_W - w) / 2;
    ctx.fillText(text, x, y);
  }

  const imageData = ctx.getImageData(0, 0, ATLAS_W, ATLAS_H).data;
  const lit: number[] = [];
  for (let y = 0; y < ATLAS_H; y += 1) {
    for (let x = 0; x < ATLAS_W; x += 1) {
      const idx = (y * ATLAS_W + x) * 4;
      const a = imageData[idx + 3] ?? 0;
      if (a > 140) {
        lit.push(x);
        lit.push(y);
      }
    }
  }

  const total = fboSize * fboSize;
  const positions = new Float32Array(total * 4);
  const litCount = lit.length / 2;
  const sampler = createPrng((seed * 31 + 7) >>> 0);

  for (let i = 0; i < total; i += 1) {
    let nx: number;
    let ny: number;
    let nz: number;

    if (litCount > 0) {
      const pick = Math.floor(sampler.next() * litCount) * 2;
      const px = lit[pick] ?? 0;
      const py = lit[pick + 1] ?? 0;
      const jitterX = (sampler.next() - 0.5) * 0.8;
      const jitterY = (sampler.next() - 0.5) * 0.8;
      const ax = (px + jitterX) / ATLAS_W - 0.5;
      const ay = (py + jitterY) / ATLAS_H - 0.5;
      nx = centerX + ax * scaleX * 2;
      ny = centerY - ay * scaleY * 2;
      nz = (sampler.next() - 0.5) * 0.12;
    } else {
      nx = centerX + (sampler.next() - 0.5) * scaleX * 2;
      ny = centerY + (sampler.next() - 0.5) * scaleY * 2;
      nz = 0;
    }

    const o = i * 4;
    positions[o] = nx;
    positions[o + 1] = ny;
    positions[o + 2] = nz;
    positions[o + 3] = 1;
  }

  const texture = new DataTexture(
    positions,
    fboSize,
    fboSize,
    RGBAFormat,
    FloatType,
  );
  texture.needsUpdate = true;

  return { texture, count: total, size: fboSize };
}

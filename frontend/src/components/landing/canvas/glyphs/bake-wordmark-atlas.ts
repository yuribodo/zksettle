import { DataTexture, FloatType, RGBAFormat } from "three";

import { createPrng } from "@/lib/prng";

import type { LedgerAtlas } from "./bake-ledger-atlas";

const ATLAS_W = 2048;
const ATLAS_H = 768;

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
    if (!ctx) throw new Error("bake-wordmark-atlas: 2D context unavailable");
    bakerCtx = ctx;
  }
  return { canvas: bakerCanvas, ctx: bakerCtx };
}

export type BakeWordmarkOptions = {
  text: string;
  fboSize: number;
  /** NDC-space horizontal center for the wordmark. 0 = screen center, 0.45 = right side. */
  centerX: number;
  /** NDC-space vertical center. */
  centerY: number;
  /** Half-width of the wordmark in NDC units. */
  scaleX: number;
  /** Half-height of the wordmark in NDC units. */
  scaleY: number;
};

export function bakeWordmarkAtlas(opts: BakeWordmarkOptions): LedgerAtlas {
  const { text, fboSize, centerX, centerY, scaleX, scaleY } = opts;
  const { ctx } = getBaker();

  // Leave the canvas transparent so we can detect text via luminance + alpha.
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);

  // Pick a font size that fills ~80% of atlas width. Use display serif so the
  // wordmark reads as the brand mark, not as a code identifier.
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  // Binary search for a font size that fits ~88% of atlas width.
  const targetWidth = ATLAS_W * 0.88;
  let lo = 80;
  let hi = 600;
  let chosen = lo;
  for (let i = 0; i < 12; i += 1) {
    const mid = (lo + hi) / 2;
    ctx.font = `600 ${mid}px Georgia, "Times New Roman", serif`;
    const measured = ctx.measureText(text).width;
    if (measured > targetWidth) {
      hi = mid;
    } else {
      lo = mid;
      chosen = mid;
    }
  }
  ctx.font = `600 ${chosen}px Georgia, "Times New Roman", serif`;
  ctx.fillText(text, ATLAS_W / 2, ATLAS_H / 2);

  // Sample lit pixels — high alpha threshold so we only land in solid letter
  // bodies, not their anti-aliased edges (which bleed adjacent letters together).
  const imageData = ctx.getImageData(0, 0, ATLAS_W, ATLAS_H).data;

  const lit: number[] = [];
  for (let y = 0; y < ATLAS_H; y += 1) {
    for (let x = 0; x < ATLAS_W; x += 1) {
      const idx = (y * ATLAS_W + x) * 4;
      const a = imageData[idx + 3] ?? 0;
      if (a > 200) {
        lit.push(x);
        lit.push(y);
      }
    }
  }

  const total = fboSize * fboSize;
  const positions = new Float32Array(total * 4);
  const litCount = lit.length / 2;
  const seed = createPrng(0xa1c3);

  for (let i = 0; i < total; i += 1) {
    let nx: number;
    let ny: number;
    let nz: number;

    if (litCount > 0) {
      const pick = Math.floor(seed.next() * litCount) * 2;
      const px = lit[pick] ?? 0;
      const py = lit[pick + 1] ?? 0;
      const jitterX = (seed.next() - 0.5) * 0.8;
      const jitterY = (seed.next() - 0.5) * 0.8;
      // Map atlas px → [-1..1] (atlas-relative), then scale to NDC half-extents and translate.
      const ax = (px + jitterX) / ATLAS_W - 0.5; // [-0.5..0.5]
      const ay = (py + jitterY) / ATLAS_H - 0.5; // [-0.5..0.5]
      nx = centerX + ax * scaleX * 2;
      ny = centerY - ay * scaleY * 2; // flip Y (canvas grows down, NDC grows up)
      // Slight depth jitter for parallax + breathing illusion.
      nz = (seed.next() - 0.5) * 0.18;
    } else {
      nx = centerX + (seed.next() - 0.5) * scaleX * 2;
      ny = centerY + (seed.next() - 0.5) * scaleY * 2;
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

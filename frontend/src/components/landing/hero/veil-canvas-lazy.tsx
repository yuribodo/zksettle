"use client";

import dynamic from "next/dynamic";

// Split Three.js (~120 kB gz) out of the landing's first-load bundle.
// The veil is purely decorative, so SSR isn't needed — render nothing until
// the chunk arrives client-side.
export const VeilCanvasLazy = dynamic(
  () => import("./veil-canvas").then((m) => m.VeilCanvas),
  { ssr: false },
);

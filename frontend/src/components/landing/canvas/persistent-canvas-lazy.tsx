"use client";

import dynamic from "next/dynamic";

// Three.js + GPGPU sim live in their own client chunk. SSR is meaningless for
// the canvas — the page paints paper-and-headline first, then this fades in.
export const PersistentCanvasLazy = dynamic(
  () => import("./persistent-canvas").then((m) => m.PersistentCanvas),
  { ssr: false, loading: () => null },
);

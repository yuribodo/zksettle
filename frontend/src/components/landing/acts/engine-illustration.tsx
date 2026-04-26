"use client";

import React from "react";

import { cn } from "@/lib/cn";

type EngineIllustrationProps = {
  activeStep: number;
};

type Node = {
  label: string;
  value: string;
  meta: string;
  x: string;
  y: string;
  anchorX: number;
  anchorY: number;
  tone?: "root" | "proof" | "hook";
};

const STAGES = ["root stored", "proof portable", "settlement final"] as const;

const SCENES = [
  {
    title: "Verify once",
    kicker: "identity intake",
    details: ["issuer signature", "merkle root"],
    nodes: [
      { label: "issuer signature", value: "ed25519: verified", meta: "KYC issuer", x: "6%", y: "48%", anchorX: 190, anchorY: 348 },
      { label: "credential leaf", value: "sha256(...)", meta: "PII sealed", x: "38%", y: "34%", anchorX: 500, anchorY: 260 },
      { label: "merkle root", value: "0x9a41...77e2", meta: "On-chain", x: "70%", y: "48%", anchorX: 810, anchorY: 348, tone: "root" },
    ],
    path: "M 190 348 C 300 348 328 260 500 260 C 672 260 700 348 810 348",
  },
  {
    title: "Prove anywhere",
    kicker: "local proving",
    details: ["private inputs", "groth16 proof"],
    nodes: [
      { label: "private inputs", value: "amount + jurisdiction", meta: "Local only", x: "6%", y: "50%", anchorX: 190, anchorY: 360 },
      { label: "wasm prover", value: "browser sandbox", meta: "<5s compute", x: "38%", y: "31%", anchorX: 500, anchorY: 245, tone: "proof" },
      { label: "groth16 proof", value: "192 bytes", meta: "Portable artifact", x: "70%", y: "51%", anchorX: 810, anchorY: 368, tone: "root" },
    ],
    path: "M 190 360 C 310 360 326 245 500 245 C 674 245 690 368 810 368",
  },
  {
    title: "Settle forever",
    kicker: "on-chain verification",
    details: ["transfer hook", "audit trail"],
    nodes: [
      { label: "transfer hook", value: "Solana extension", meta: "Policy gate", x: "6%", y: "48%", anchorX: 190, anchorY: 348, tone: "hook" },
      { label: "proof check", value: "$0.001 compute", meta: "Verifier only", x: "38%", y: "34%", anchorX: 500, anchorY: 260, tone: "proof" },
      { label: "audit trail", value: "no PII leaked", meta: "Final record", x: "70%", y: "48%", anchorX: 810, anchorY: 348, tone: "root" },
    ],
    path: "M 190 348 C 300 348 328 260 500 260 C 672 260 700 348 810 348",
  },
] satisfies readonly {
  title: string;
  kicker: string;
  details: readonly string[];
  nodes: readonly Node[];
  path: string;
}[];

export function EngineIllustration({ activeStep }: EngineIllustrationProps) {
  return (
    <div className="mt-7 overflow-hidden rounded-[10px] border border-border-subtle bg-surface-deep p-2 shadow-[0_18px_54px_color-mix(in_srgb,var(--color-ink)_9%,transparent)]">
      <div className="relative min-h-[330px] overflow-hidden rounded-[8px] bg-[linear-gradient(180deg,var(--color-canvas),var(--color-surface))] lg:min-h-[360px]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
            maskImage: "linear-gradient(to bottom, black, transparent 86%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--color-forest)_10%,transparent),transparent_70%)]"
        />

        {SCENES.map((scene, index) => (
          <Scene key={scene.title} scene={scene} sceneIndex={index} isActive={activeStep === index} />
        ))}
      </div>
    </div>
  );
}

function Scene({
  scene,
  sceneIndex,
  isActive,
}: {
  scene: (typeof SCENES)[number];
  sceneIndex: number;
  isActive: boolean;
}) {
  return (
    <div
      aria-label={scene.title}
      aria-hidden={!isActive}
      className={cn(
        "absolute inset-0 transition-[opacity,transform,filter] duration-700 ease-[var(--ease-brand)]",
        isActive
          ? "translate-y-0 opacity-100 blur-0"
          : "pointer-events-none translate-y-3 opacity-0 blur-[2px]",
      )}
    >
      <div className="absolute left-6 top-6 z-20 md:left-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone">
          {scene.kicker}
        </p>
        <h3 className="mt-2 font-display text-[clamp(1.45rem,2.4vw,2.25rem)] leading-none text-ink">
          {scene.title}
        </h3>
      </div>

      <div className="absolute right-6 top-6 z-20 hidden gap-2 sm:flex">
        {scene.details.map((detail) => (
          <span
            key={detail}
            className="rounded-full border border-border-subtle bg-canvas/75 px-3 py-1 font-mono text-[10px] text-quill shadow-sm backdrop-blur-sm"
          >
            {detail}
          </span>
        ))}
      </div>

      <svg
        aria-hidden
        viewBox="0 0 1000 520"
        className="absolute inset-0 z-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={scene.path}
          fill="none"
          stroke="color-mix(in srgb, var(--color-forest) 26%, transparent)"
          strokeWidth="1.5"
          strokeDasharray="4 9"
          strokeLinecap="round"
        />
        <path
          d={scene.path}
          fill="none"
          stroke="var(--color-forest)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 18"
          opacity="0.52"
        />
        {scene.nodes.map((node, index) => (
          <g key={node.label}>
            <circle
              cx={node.anchorX}
              cy={node.anchorY}
              r={index === 1 ? 4 : 3.5}
              fill="var(--color-canvas)"
              stroke="var(--color-forest)"
              strokeWidth="1.5"
            />
            <circle
              cx={node.anchorX}
              cy={node.anchorY}
              r={index === 1 ? 1.8 : 1.5}
              fill="var(--color-forest)"
            />
          </g>
        ))}
      </svg>

      {scene.nodes.map((node, index) => (
        <DiagramNode key={node.label} node={node} index={index} />
      ))}

      <div className="absolute bottom-5 left-6 right-6 z-20 grid grid-cols-3 gap-2 md:left-7 md:right-7">
        {STAGES.map((label, index) => (
          <div
            key={label}
            className={cn(
              "h-1 rounded-full bg-border-subtle",
              index <= sceneIndex && "bg-forest/70",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function DiagramNode({ node, index }: { node: Node; index: number }) {
  const accent =
    node.tone === "proof"
      ? "var(--color-stone)"
      : node.tone === "hook"
        ? "var(--color-quill)"
        : "var(--color-forest)";

  return (
    <div
      className="absolute z-10 w-[clamp(106px,25vw,170px)] rounded-[10px] border border-border bg-canvas/90 p-2.5 shadow-[0_12px_32px_color-mix(in_srgb,var(--color-ink)_8%,transparent)] backdrop-blur-[2px] transition-transform duration-500 ease-[var(--ease-brand)] sm:p-3"
      style={{
        left: node.x,
        top: node.y,
        transitionDelay: `${index * 55}ms`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[7px] sm:size-7"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-forest) 10%, transparent)",
          }}
        >
          <span
            className="block size-2 rounded-full sm:size-2.5"
            style={{ backgroundColor: accent }}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-stone sm:text-[10px]">
            {node.label}
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-ink sm:text-[13px]">
            {node.value}
          </p>
          <p className="mt-1.5 truncate font-mono text-[9px] text-muted sm:text-[10px]">
            {node.meta}
          </p>
        </div>
      </div>
    </div>
  );
}

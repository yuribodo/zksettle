"use client";

import { CountUp } from "@/components/motion/count-up";

interface BenchmarkConfig {
  target: number;
  teaseTo: number;
  formatter: (value: number) => string;
}

const CONFIGS: Record<string, BenchmarkConfig> = {
  "Proving time": {
    target: 5,
    teaseTo: 9.99,
    formatter: (v) => (v <= 5.005 ? "<5s" : `${v.toFixed(2)}s`),
  },
  "Verify cost": {
    target: 0.001,
    teaseTo: 0.01,
    formatter: (v) => (v <= 0.00105 ? "<$0.001" : `$${v.toFixed(3)}`),
  },
  "PII leaked": {
    target: 0,
    teaseTo: 99,
    formatter: (v) => Math.round(v).toString(),
  },
  "Proof size": {
    target: 256,
    teaseTo: 0,
    formatter: (v) => `${Math.round(v)} bytes`,
  },
};

export interface BenchmarkNumberProps {
  label: string;
  fallback: string;
}

export function BenchmarkNumber({ label, fallback }: BenchmarkNumberProps) {
  const config = CONFIGS[label];
  if (!config) {
    return <>{fallback}</>;
  }
  return (
    <CountUp target={config.target} teaseTo={config.teaseTo} formatter={config.formatter} />
  );
}

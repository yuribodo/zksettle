import { BILLING_USAGE } from "@/lib/mock-data";

const WIDTH = 720;
const HEIGHT = 200;
const PADDING = { top: 12, right: 16, bottom: 26, left: 40 };

export function BillingUsageChart() {
  const days = BILLING_USAGE;
  const values = days.map((d) => d.proofs);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const scaleX = (index: number) =>
    PADDING.left + (index / Math.max(1, days.length - 1)) * innerWidth;
  const scaleY = (value: number) =>
    PADDING.top + innerHeight - ((value - min) / Math.max(1, range)) * innerHeight;

  const pathD = days
    .map((d, i) => `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(2)} ${scaleY(d.proofs).toFixed(2)}`)
    .join(" ");

  const gridLines = 4;
  const gridYs = Array.from({ length: gridLines + 1 }, (_, i) =>
    PADDING.top + (innerHeight / gridLines) * i,
  );
  const gridValues = gridYs.map((y) => Math.round(max - ((y - PADDING.top) / innerHeight) * range));

  const labelIndices = [0, Math.floor(days.length / 2), days.length - 1];
  const firstDay = days[0]!;
  const midDay = days[labelIndices[1]!]!;
  const lastDay = days[days.length - 1]!;

  const monthLabel = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(new Date(iso));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`30-day usage chart, peaking at ${max.toLocaleString("en-US")} proofs`}
      className="w-full"
    >
      {gridYs.map((y, i) => (
        <line
          key={`grid-${i}`}
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={y}
          y2={y}
          stroke="var(--color-border-subtle)"
          strokeWidth="1"
        />
      ))}
      {gridValues.map((value, i) => (
        <text
          key={`label-${i}`}
          x={PADDING.left - 8}
          y={gridYs[i]! + 4}
          textAnchor="end"
          fontFamily='var(--font-mono, "JetBrains Mono", monospace)'
          fontSize="10"
          fill="var(--color-muted)"
        >
          {value.toLocaleString("en-US")}
        </text>
      ))}
      <path d={pathD} fill="none" stroke="var(--color-forest)" strokeWidth="1.75" strokeLinejoin="round" />
      {days.map((d, i) => (
        <circle
          key={d.date}
          cx={scaleX(i)}
          cy={scaleY(d.proofs)}
          r="1.5"
          fill="var(--color-forest)"
        />
      ))}
      <text
        x={scaleX(0)}
        y={HEIGHT - 8}
        fontFamily='var(--font-mono, "JetBrains Mono", monospace)'
        fontSize="10"
        fill="var(--color-muted)"
      >
        {monthLabel(firstDay.date)}
      </text>
      <text
        x={scaleX(labelIndices[1]!)}
        y={HEIGHT - 8}
        textAnchor="middle"
        fontFamily='var(--font-mono, "JetBrains Mono", monospace)'
        fontSize="10"
        fill="var(--color-muted)"
      >
        {monthLabel(midDay.date)}
      </text>
      <text
        x={scaleX(days.length - 1)}
        y={HEIGHT - 8}
        textAnchor="end"
        fontFamily='var(--font-mono, "JetBrains Mono", monospace)'
        fontSize="10"
        fill="var(--color-muted)"
      >
        {monthLabel(lastDay.date)}
      </text>
    </svg>
  );
}

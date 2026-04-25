import type { DailyUsage } from "@/lib/api/schemas";

const WIDTH = 720;
const HEIGHT = 200;
const PADDING = { top: 12, right: 16, bottom: 26, left: 40 };

export interface BillingUsageChartProps {
  data: readonly DailyUsage[];
}

export function BillingUsageChart({ data }: BillingUsageChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center font-mono text-xs text-muted">
        No usage data yet.
      </div>
    );
  }

  const values = data.map((d) => d.count);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const scaleX = (index: number) =>
    PADDING.left + (index / Math.max(1, data.length - 1)) * innerWidth;
  const scaleY = (value: number) =>
    PADDING.top + innerHeight - ((value - min) / Math.max(1, range)) * innerHeight;

  const pathD = data
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(2)} ${scaleY(d.count).toFixed(2)}`,
    )
    .join(" ");

  const gridLines = 4;
  const gridYs = Array.from(
    { length: gridLines + 1 },
    (_, i) => PADDING.top + (innerHeight / gridLines) * i,
  );
  const gridValues = gridYs.map((y) =>
    Math.round(max - ((y - PADDING.top) / innerHeight) * range),
  );

  const labelIndices = [0, Math.floor(data.length / 2), data.length - 1];
  const firstDay = data[0]!;
  const midDay = data[labelIndices[1]!]!;
  const lastDay = data[data.length - 1]!;

  const monthLabel = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(
      new Date(iso),
    );

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${data.length}-day usage chart, peaking at ${max.toLocaleString("en-US")} requests`}
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
      <path
        d={pathD}
        fill="none"
        stroke="var(--color-forest)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {data.map((d, i) => (
        <circle
          key={d.date}
          cx={scaleX(i)}
          cy={scaleY(d.count)}
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
        x={scaleX(data.length - 1)}
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

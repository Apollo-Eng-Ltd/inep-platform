"use client";

// Small, quiet charts for the dashboard. Single-series by design: the card
// title names the series, so no legend is needed. Marks are thin, grid is
// recessive, every chart has a hover tooltip. Colors come from design tokens.
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, LabelList,
} from "recharts";

const AXIS = "var(--muted-foreground)";
const GRID = "var(--border)";

interface Point {
  label: string;
  value: number;
}

function TooltipBox({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">
        {v.toLocaleString("en-KE")}
        {unit === "%" ? "%" : ` ${unit ?? ""}`}
      </p>
    </div>
  );
}

export function TrendLine({ data, unit }: { data: Point[]; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: GRID }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--brand)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--brand)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Tiny inline bar trend for stat cards — no axes, no tooltip, just a shape. */
export type Tone = "brand" | "warning" | "danger" | "success" | "muted" | "agent" | "provider";
const TONE_VAR: Record<Tone, string> = {
  brand: "var(--brand)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  success: "var(--success)",
  muted: "var(--muted-foreground)",
  agent: "var(--agent)",
  provider: "var(--provider)",
};

export function MiniBars({
  values,
  tone = "brand",
  tones,
}: {
  values: number[];
  tone?: Tone;
  /** Optional per-bar tone override, same length as `values`. */
  tones?: Tone[];
}) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const w = 6;
  const gap = 3;
  const h = 24;
  return (
    <svg width={values.length * (w + gap) - gap} height={h} className="shrink-0">
      {values.map((v, i) => {
        const barH = Math.max(2, (Math.abs(v) / max) * h);
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - barH}
            width={w}
            height={barH}
            rx={1.5}
            fill={TONE_VAR[tones?.[i] ?? tone]}
            opacity={tones ? 1 : i === values.length - 1 ? 1 : 0.45}
          />
        );
      })}
    </svg>
  );
}

/** Tiny inline line sparkline with a soft fill — for genuine multi-point series only. */
export function Sparkline({
  data,
  tone = "brand",
  width = 64,
  height = 24,
}: {
  data: number[];
  tone?: Tone;
  width?: number;
  height?: number;
}) {
  const color = TONE_VAR[tone];
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="shrink-0">
        <line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={color} strokeWidth={1.5} opacity={0.3} />
      </svg>
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 3) - 1.5;
    return `${x},${y}`;
  });
  const area = `0,${height} ${points.join(" ")} ${width},${height}`;
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={area} fill={color} fillOpacity={0.12} stroke="none" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Small circular completion ring — live-friendly (the stroke animates on change). */
export function RingProgress({
  pct,
  size = 40,
  strokeWidth = 4,
  toneVar = "var(--brand)",
}: {
  pct: number;
  size?: number;
  strokeWidth?: number;
  toneVar?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--muted)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={toneVar}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 300ms ease" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[10px] font-medium tabular-nums">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

export function RankBar({ data, unit }: { data: Point[]; unit?: string }) {
  const height = Math.max(200, data.length * 30 + 20);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={96}
        />
        <Tooltip content={<TooltipBox unit={unit} />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} fill="var(--brand)">
          {data.map((_, i) => (
            <Cell key={i} fill="var(--brand)" />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            className="fill-muted-foreground"
            fontSize={11}
            formatter={(v: unknown) => {
              const n = Number(v ?? 0);
              return unit === "%" ? `${n}%` : n.toLocaleString("en-KE");
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

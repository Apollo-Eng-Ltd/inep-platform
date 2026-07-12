"use client";

// Small, quiet charts for the dashboard. Single-series by design: the card
// title names the series, so no legend is needed. Marks are thin, grid is
// recessive, every chart has a hover tooltip. Colors come from design tokens.
import { useId } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, Legend,
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

/** Small hero-card chart — gradient fill "pooling" under the line. No axes. */
function GradientAreaTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { payload?: { label?: string; v?: number } }[];
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {p.label && <p className="font-medium">{p.label}</p>}
      <p className="text-muted-foreground tabular-nums">
        {(p.v ?? 0).toLocaleString("en-KE")}
        {unit === "%" ? "%" : unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

export function GradientArea({
  data,
  labels,
  unit,
  tone = "brand",
  height = 56,
  showTooltip = false,
}: {
  data: number[];
  /** Optional per-point label (e.g. year) shown in the hover tooltip. */
  labels?: string[];
  unit?: string;
  tone?: Tone;
  height?: number;
  showTooltip?: boolean;
}) {
  const rid = useId().replace(/[:]/g, "");
  const color = TONE_VAR[tone];
  const points = data.map((v, i) => ({ i, v, label: labels?.[i] }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${rid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showTooltip && (
          <Tooltip
            content={<GradientAreaTooltip unit={unit} />}
            cursor={{ stroke: color, strokeOpacity: 0.3 }}
            wrapperStyle={{ zIndex: 50 }}
          />
        )}
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${rid})`}
          isAnimationActive={false}
          activeDot={{ r: 3.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Small hero-card chart — gradient bars, same "pooling" fade as GradientArea. */
export function GradientBars({
  data,
  labels,
  unit,
  tone = "brand",
  height = 56,
  showTooltip = false,
}: {
  data: number[];
  /** Optional per-point label (e.g. year) shown in the hover tooltip. */
  labels?: string[];
  unit?: string;
  tone?: Tone;
  height?: number;
  showTooltip?: boolean;
}) {
  const rid = useId().replace(/[:]/g, "");
  const color = TONE_VAR[tone];
  const points = data.map((v, i) => ({ i, v, label: labels?.[i] }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="25%">
        <defs>
          <linearGradient id={`gradbar-${rid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.15} />
          </linearGradient>
        </defs>
        {showTooltip && (
          <Tooltip
            content={<GradientAreaTooltip unit={unit} />}
            cursor={{ fill: color, fillOpacity: 0.08 }}
            wrapperStyle={{ zIndex: 50 }}
          />
        )}
        <Bar dataKey="v" fill={`url(#gradbar-${rid})`} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MultiTooltipBox({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md space-y-1 max-w-56">
      <p className="font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground truncate">{p.name}</span>
          <span className="font-medium tabular-nums ml-auto">
            {(p.value ?? 0).toLocaleString("en-KE")}
            {unit === "%" ? "%" : ""}
          </span>
        </p>
      ))}
    </div>
  );
}

export interface AreaSeriesDef {
  key: string;
  label: string;
  color: string;
}

/** Large multi-county comparison chart — layered gradient fills, one per series. */
export function MultiCountyArea({
  data,
  series,
  unit,
}: {
  data: Record<string, number | string>[];
  series: AreaSeriesDef[];
  unit?: string;
}) {
  const rid = useId().replace(/[:]/g, "");
  return (
    <ResponsiveContainer width="100%" height={360}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`ma-${rid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<MultiTooltipBox unit={unit} />} cursor={{ stroke: GRID }} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#ma-${rid}-${s.key})`}
            dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Ranked horizontal bars, colored on a gradient from top performer to bottom. */
export function GradientRankBar({ data, unit }: { data: Point[]; unit?: string }) {
  const height = Math.max(220, data.length * 26 + 20);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={104} />
        <Tooltip content={<TooltipBox unit={unit} />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
          {data.map((_, i) => {
            const t = data.length > 1 ? i / (data.length - 1) : 0;
            return (
              <Cell
                key={i}
                fill={`color-mix(in oklab, var(--brand) ${Math.round((1 - t) * 100)}%, var(--warning) ${Math.round(t * 100)}%)`}
              />
            );
          })}
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

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

function DonutTooltip({
  active,
  payload,
  unit,
  total,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number }[];
  unit?: string;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pct = total ? Math.round(((p.value ?? 0) / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{p.name}</p>
      <p className="text-muted-foreground">
        {(p.value ?? 0).toLocaleString("en-KE")}
        {unit === "%" ? "%" : ""} · {pct}%
      </p>
    </div>
  );
}

/** Donut with a soft glow behind the ring — for a technology/fuel-type split. */
export function DonutChart({
  data,
  unit,
  centerLabel,
  height = 220,
}: {
  data: DonutSlice[];
  unit?: string;
  /** Shown in the middle of the ring — typically the real total. */
  centerLabel?: { value: string; caption?: string };
  height?: number;
}) {
  const rid = useId().replace(/[:]/g, "");
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <defs>
            <filter id={`glow-${rid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="8" floodColor="var(--brand)" floodOpacity="0.22" />
            </filter>
          </defs>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="85%"
            paddingAngle={2}
            isAnimationActive={false}
            filter={`url(#glow-${rid})`}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} stroke="var(--card)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip unit={unit} total={total} />} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <p className="text-xl font-semibold tabular-nums leading-tight">{centerLabel.value}</p>
            {centerLabel.caption && <p className="text-[11px] text-muted-foreground">{centerLabel.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Large full-width area chart with axes — the "top of the report" hero chart. */
export function BigGradientArea({
  data,
  unit,
  tone = "brand",
  height = 320,
}: {
  data: Point[];
  unit?: string;
  tone?: Tone;
  height?: number;
}) {
  const rid = useId().replace(/[:]/g, "");
  const color = TONE_VAR[tone];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id={`big-${rid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={52} />
        <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: GRID }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#big-${rid})`}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface MonthlyPoint {
  label: string;
  actual: number;
  target: number;
}

function MonthlyTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md space-y-1">
      <p className="font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums ml-auto">
            {(p.value ?? 0).toLocaleString("en-KE")}
            {unit ? ` ${unit}` : ""}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Twelve months of actuals against a target/benchmark line, EPRA-report style. */
export function MonthlyBenchmarkChart({
  data,
  unit,
  tone = "brand",
  height = 280,
}: {
  data: MonthlyPoint[];
  unit?: string;
  tone?: Tone;
  height?: number;
}) {
  const rid = useId().replace(/[:]/g, "");
  const color = TONE_VAR[tone];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id={`mb-${rid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<MonthlyTooltip unit={unit} />} cursor={{ stroke: GRID }} />
        <Legend verticalAlign="top" align="right" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#mb-${rid})`}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="target"
          name="Target"
          stroke="var(--muted-foreground)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
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

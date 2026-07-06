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

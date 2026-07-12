"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { GradientBars, type Tone } from "@/components/charts";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

export const TONE_ICON_BG: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  provider: "bg-provider-soft text-provider",
  warning: "bg-warning-soft text-warning",
  agent: "bg-agent-soft text-agent",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  muted: "bg-muted text-muted-foreground",
};

/** One "Year at a Glance" style stat card — icon, big number, delta, gradient-bar trend. */
export function HeroStatCard({
  icon: Icon,
  tone,
  latest,
  unit,
  name,
  delta,
  series,
  labels,
  digits,
}: {
  icon: LucideIcon;
  tone: Tone;
  latest: number | null;
  unit: string;
  name: string;
  delta: number | null;
  series: number[];
  labels: string[];
  digits?: number;
}) {
  return (
    <Card className="p-6 gap-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("size-10 rounded-xl grid place-items-center shrink-0", TONE_ICON_BG[tone])}>
          <Icon className="size-5" />
        </div>
        {delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium shrink-0 mt-1",
              delta >= 0 ? "text-success" : "text-danger"
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums">
            {latest != null ? fmtNum(latest, digits ?? (unit === "%" ? 1 : 0)) : "—"}
          </span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{name}</p>
      </div>

      <GradientBars data={series.length ? series : [0, 0]} labels={labels} unit={unit} tone={tone} height={64} showTooltip />
    </Card>
  );
}

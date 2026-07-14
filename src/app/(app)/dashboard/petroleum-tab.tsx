"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BigGradientArea, DonutChart, type DonutSlice } from "@/components/charts";
import { NationalContextBadge } from "@/components/national-context-badge";
import { fmtNum } from "@/lib/format";
import { PETROLEUM_TREND_SLUGS, PUMP_PRICE_SLUGS, OMC_SHARE_SLUGS } from "./epra-config";
import { epraSeriesFor, epraSnapshot, type Indicator, type EpraRow } from "./dashboard-types";
import { EXPLORATION_BLOCKS } from "./petroleum-context";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const TREND_LABELS: Record<string, string> = {
  petroleum_import_volume_kt: "Import volume",
  pipeline_throughput_kt: "Pipeline throughput",
  crude_oil_price_usd_bbl: "Crude oil price",
};

const PUMP_TONES = ["brand", "warning", "danger"] as const;

const STATUS_TONE: Record<string, string> = {
  Active: "bg-success-soft text-success",
  "Under review": "bg-warning-soft text-warning",
  Relinquished: "bg-muted text-muted-foreground",
};

export function PetroleumTab({ epraRows, indicators }: { epraRows: EpraRow[]; indicators: Indicator[] }) {
  const indicatorBySlug = useMemo(() => new Map(indicators.map((i) => [i.slug, i])), [indicators]);
  const [trendSlug, setTrendSlug] = useState<string>(PETROLEUM_TREND_SLUGS[0]);

  const trendIndicator = indicatorBySlug.get(trendSlug);
  const trendData = useMemo(
    () => epraSeriesFor(epraRows, indicatorBySlug, trendSlug).map((r) => ({ label: String(r.year), value: r.value })),
    [epraRows, indicatorBySlug, trendSlug]
  );

  const pumpSeries = PUMP_PRICE_SLUGS.map((slug, i) => {
    const ind = indicatorBySlug.get(slug);
    if (!ind) return null;
    const rows = epraSeriesFor(epraRows, indicatorBySlug, slug);
    const latest: number | null = rows[rows.length - 1]?.value ?? null;
    return { name: ind.name, latest, tone: PUMP_TONES[i % PUMP_TONES.length] };
  }).filter((x) => x != null);

  const omcData: DonutSlice[] = useMemo(
    () =>
      OMC_SHARE_SLUGS.map((slug, i) => {
        const ind = indicatorBySlug.get(slug);
        if (!ind) return null;
        const value = epraSnapshot(epraRows, indicatorBySlug, slug) ?? 0;
        return { label: ind.name, value, color: CHART_COLORS[i % CHART_COLORS.length] };
      }).filter((x): x is DonutSlice => x != null),
    [epraRows, indicatorBySlug]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <CardTitle className="text-base">{TREND_LABELS[trendSlug] ?? trendIndicator?.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{trendIndicator?.unit}, by year</p>
            </div>
            <NationalContextBadge />
          </div>
          <Select
            value={trendSlug}
            onValueChange={(v) => setTrendSlug(String(v))}
            items={PETROLEUM_TREND_SLUGS.map((s) => ({ value: s, label: TREND_LABELS[s] }))}
          >
            <SelectTrigger size="sm" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PETROLEUM_TREND_SLUGS.map((s) => (
                <SelectItem key={s} value={s}>
                  {TREND_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <BigGradientArea data={trendData} unit={trendIndicator?.unit} tone="danger" height={280} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Pump prices</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent className="space-y-3">
            {pumpSeries.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.name}</span>
                <span className="font-semibold tabular-nums">{p.latest != null ? fmtNum(p.latest, 1) : "—"} KES/L</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">OMC market share</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <DonutChart data={omcData} unit="%" height={200} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exploration blocks</CardTitle>
            <p className="text-xs text-muted-foreground">Reference list — no verified block-boundary map data available</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {EXPLORATION_BLOCKS.map((b) => (
              <div key={b.code} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium truncate">{b.code}</p>
                  <p className="text-muted-foreground truncate">{b.basin} · {b.operator}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_TONE[b.status])}>{b.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

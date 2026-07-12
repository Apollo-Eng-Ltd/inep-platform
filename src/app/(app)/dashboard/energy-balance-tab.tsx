"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChart, MultiCountyArea, type DonutSlice, type AreaSeriesDef } from "@/components/charts";
import { NationalContextBadge } from "@/components/national-context-badge";
import { fmtNum } from "@/lib/format";
import { FINAL_CONSUMPTION_SLUGS } from "./epra-config";
import { epraSeriesFor, type Indicator, type EpraRow } from "./dashboard-types";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function EnergyBalanceTab({
  epraRows,
  indicators,
  mixData,
  mixTotal,
}: {
  epraRows: EpraRow[];
  indicators: Indicator[];
  mixData: DonutSlice[];
  mixTotal: number;
}) {
  const indicatorBySlug = useMemo(() => new Map(indicators.map((i) => [i.slug, i])), [indicators]);

  const consumptionTrendData = useMemo(() => {
    const seriesBySlug = FINAL_CONSUMPTION_SLUGS.map((slug) => epraSeriesFor(epraRows, indicatorBySlug, slug));
    const years = [...new Set(seriesBySlug.flat().map((r) => r.year))].sort();
    return years.map((year) => {
      const row: Record<string, number | string> = { label: String(year) };
      FINAL_CONSUMPTION_SLUGS.forEach((slug, i) => {
        const point = seriesBySlug[i].find((r) => r.year === year);
        if (point) row[slug] = point.value;
      });
      return row;
    });
  }, [epraRows, indicatorBySlug]);

  const consumptionSeries: AreaSeriesDef[] = FINAL_CONSUMPTION_SLUGS.map((slug, i) => ({
    key: slug,
    label: indicatorBySlug.get(slug)?.name ?? slug,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Indigenous production mix</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <DonutChart data={mixData} unit="MW" centerLabel={{ value: fmtNum(mixTotal, 0), caption: "MW total" }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Final consumption trend</CardTitle>
              <p className="text-xs text-muted-foreground">By category, GWh</p>
            </div>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <MultiCountyArea data={consumptionTrendData} series={consumptionSeries} unit="GWh" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

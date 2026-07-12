"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BigGradientArea, DonutChart, GradientRankBar, MonthlyBenchmarkChart, type DonutSlice, type MonthlyPoint } from "@/components/charts";
import { NationalContextBadge } from "@/components/national-context-badge";
import { LPG_TREND_SLUG, LPG_MONTHLY_SLUGS, LPG_ROUTE_SLUGS, LPG_STORAGE_SLUGS, FY_MONTH_LABELS } from "./epra-config";
import { epraSeriesFor, epraSnapshot, type Indicator, type EpraRow } from "./dashboard-types";

const ROUTE_COLORS = ["var(--chart-1)", "var(--chart-3)"];

export function LpgTab({ epraRows, indicators }: { epraRows: EpraRow[]; indicators: Indicator[] }) {
  const indicatorBySlug = useMemo(() => new Map(indicators.map((i) => [i.slug, i])), [indicators]);

  const importTrendIndicator = indicatorBySlug.get(LPG_TREND_SLUG);
  const importTrendData = useMemo(
    () => epraSeriesFor(epraRows, indicatorBySlug, LPG_TREND_SLUG).map((r) => ({ label: String(r.year), value: r.value })),
    [epraRows, indicatorBySlug]
  );

  const monthlyData: MonthlyPoint[] = useMemo(() => {
    const [actualSlug, targetSlug] = LPG_MONTHLY_SLUGS;
    const actualInd = indicatorBySlug.get(actualSlug);
    const targetInd = indicatorBySlug.get(targetSlug);
    if (!actualInd || !targetInd) return [];
    return FY_MONTH_LABELS.map((label, i) => {
      const m = i + 1;
      const actual = epraRows.find((e) => e.indicatorId === actualInd.id && e.year === m)?.value ?? 0;
      const target = epraRows.find((e) => e.indicatorId === targetInd.id && e.year === m)?.value ?? 0;
      return { label, actual, target };
    });
  }, [epraRows, indicatorBySlug]);

  const routeData: DonutSlice[] = useMemo(
    () =>
      LPG_ROUTE_SLUGS.map((slug, i) => {
        const ind = indicatorBySlug.get(slug);
        if (!ind) return null;
        const value = epraSnapshot(epraRows, indicatorBySlug, slug) ?? 0;
        return { label: ind.name, value, color: ROUTE_COLORS[i % ROUTE_COLORS.length] };
      }).filter((x): x is DonutSlice => x != null),
    [epraRows, indicatorBySlug]
  );

  const storageData = useMemo(
    () =>
      LPG_STORAGE_SLUGS.map((slug) => {
        const ind = indicatorBySlug.get(slug);
        if (!ind) return null;
        const value = epraSnapshot(epraRows, indicatorBySlug, slug) ?? 0;
        return { label: ind.name, value };
      })
        .filter((x): x is { label: string; value: number } => x != null)
        .sort((a, b) => b.value - a.value),
    [epraRows, indicatorBySlug]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">LPG import volume</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <BigGradientArea data={importTrendData} unit={importTrendIndicator?.unit} tone="agent" height={260} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Import routes</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <DonutChart data={routeData} unit="%" height={220} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Monthly LPG consumption vs. target</CardTitle>
            <p className="text-xs text-muted-foreground">Current financial year, kt</p>
          </div>
          <NationalContextBadge />
        </CardHeader>
        <CardContent>
          <MonthlyBenchmarkChart data={monthlyData} unit="kt" tone="agent" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Storage capacity by depot</CardTitle>
          <NationalContextBadge />
        </CardHeader>
        <CardContent>
          <GradientRankBar data={storageData} unit="kt" />
        </CardContent>
      </Card>
    </div>
  );
}

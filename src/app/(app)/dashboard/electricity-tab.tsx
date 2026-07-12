"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BigGradientArea, DonutChart, GradientRankBar, type DonutSlice } from "@/components/charts";
import { HeroStatCard } from "@/components/hero-stat-card";
import { NationalContextBadge } from "@/components/national-context-badge";
import { fmtNum } from "@/lib/format";
import {
  EPRA_MIX_SLUGS, ELECTRICITY_TARIFF_SLUG, DAILY_DEMAND_SLUG, FINAL_CONSUMPTION_SLUGS, HOUR_LABELS,
} from "./epra-config";
import { epraSeriesFor, epraLatestAndDelta, type Indicator, type County, type ValueRow, type EpraRow } from "./dashboard-types";
import { Gauge, Zap, BarChart3, CloudFog, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const RELIABILITY_CARDS: { slug: string; icon: LucideIcon; tone: "brand" | "warning" | "danger" | "agent" | "provider" }[] = [
  { slug: "system_losses_pct", icon: TrendingDown, tone: "warning" },
  { slug: "saidi_hours", icon: Gauge, tone: "danger" },
  { slug: "saifi_count", icon: BarChart3, tone: "agent" },
  { slug: "hhi_index", icon: Zap, tone: "provider" },
  { slug: "ghg_emissions_mtco2e", icon: CloudFog, tone: "brand" },
];

export function ElectricityTab({
  epraRows,
  indicators,
  counties,
  valueRows,
}: {
  epraRows: EpraRow[];
  indicators: Indicator[];
  counties: County[];
  valueRows: ValueRow[];
}) {
  const indicatorBySlug = useMemo(() => new Map(indicators.map((i) => [i.slug, i])), [indicators]);

  const reliabilityCards = useMemo(
    () =>
      RELIABILITY_CARDS.map((cfg) => {
        const ind = indicatorBySlug.get(cfg.slug);
        if (!ind) return null;
        const rows = epraSeriesFor(epraRows, indicatorBySlug, cfg.slug);
        const { latest, delta } = epraLatestAndDelta(rows);
        return { indicator: ind, icon: cfg.icon, tone: cfg.tone, latest, delta, series: rows.map((r) => r.value), labels: rows.map((r) => String(r.year)) };
      }).filter((c): c is NonNullable<typeof c> => c != null),
    [epraRows, indicatorBySlug]
  );

  const tariffData = useMemo(
    () => epraSeriesFor(epraRows, indicatorBySlug, ELECTRICITY_TARIFF_SLUG).map((r) => ({ label: String(r.year), value: r.value })),
    [epraRows, indicatorBySlug]
  );
  const tariffUnit = indicatorBySlug.get(ELECTRICITY_TARIFF_SLUG)?.unit;

  const dailyDemandData = useMemo(
    () =>
      epraSeriesFor(epraRows, indicatorBySlug, DAILY_DEMAND_SLUG).map((r) => ({ label: HOUR_LABELS[r.year] ?? String(r.year), value: r.value })),
    [epraRows, indicatorBySlug]
  );

  const capacityMixData: DonutSlice[] = useMemo(
    () =>
      EPRA_MIX_SLUGS.map((slug, i) => {
        const ind = indicatorBySlug.get(slug);
        if (!ind) return null;
        const row = epraRows.find((e) => e.indicatorId === ind.id);
        return { label: ind.name, value: row?.value ?? 0, color: CHART_COLORS[i % CHART_COLORS.length] };
      }).filter((x): x is DonutSlice => x != null),
    [epraRows, indicatorBySlug]
  );
  const capacityMixTotal = capacityMixData.reduce((a, b) => a + b.value, 0);

  const consumptionByCategory = useMemo(
    () =>
      FINAL_CONSUMPTION_SLUGS.map((slug) => {
        const ind = indicatorBySlug.get(slug);
        if (!ind) return null;
        const rows = epraSeriesFor(epraRows, indicatorBySlug, slug);
        const latest = rows[rows.length - 1]?.value ?? 0;
        return { label: ind.name, value: Math.round(latest) };
      }).filter((x): x is { label: string; value: number } => x != null),
    [epraRows, indicatorBySlug]
  );

  // Consumption by region — real platform output: sums each county's own
  // reported installed capacity (electricity sector) by region, latest year on file.
  const consumptionByRegion = useMemo(() => {
    const capacityIndicator = indicators.find((i) => i.slug === "installed_capacity_mw");
    if (!capacityIndicator) return [];
    const rows = valueRows.filter((v) => v.indicatorId === capacityIndicator.id);
    const latestYear = rows.reduce((max, r) => Math.max(max, r.year), 0);
    const regionByCounty = new Map(counties.map((c) => [c.id, c.region]));
    const totals = new Map<string, number>();
    rows
      .filter((r) => r.year === latestYear)
      .forEach((r) => {
        const region = regionByCounty.get(r.countyId) ?? "—";
        totals.set(region, (totals.get(region) ?? 0) + r.value);
      });
    return [...totals.entries()]
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [valueRows, indicators, counties]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Reliability &amp; market structure</h2>
        <NationalContextBadge />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {reliabilityCards.map((c) => (
          <HeroStatCard
            key={c.indicator.id}
            icon={c.icon}
            tone={c.tone}
            latest={c.latest}
            unit={c.indicator.unit}
            name={c.indicator.name}
            delta={c.delta}
            series={c.series}
            labels={c.labels}
            digits={1}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Tariff evolution</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <BigGradientArea data={tariffData} unit={tariffUnit} tone="warning" height={280} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Daily demand profile</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <BigGradientArea data={dailyDemandData} unit="MW" tone="provider" height={280} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Installed capacity by technology</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <DonutChart data={capacityMixData} unit="MW" centerLabel={{ value: fmtNum(capacityMixTotal, 0), caption: "MW total" }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Consumption by category</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <GradientRankBar data={consumptionByCategory} unit="GWh" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumption by region</CardTitle>
            <p className="text-xs text-muted-foreground">Installed capacity, MW — reported by counties</p>
          </CardHeader>
          <CardContent>
            <GradientRankBar data={consumptionByRegion} unit="MW" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

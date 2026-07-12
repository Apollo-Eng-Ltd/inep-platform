"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BigGradientArea, DonutChart, GradientRankBar, type DonutSlice } from "@/components/charts";
import { NationalContextBadge } from "@/components/national-context-badge";
import { fmtNum } from "@/lib/format";
import { RENEWABLE_MIX_SLUGS, RENEWABLE_GEN_SLUGS, EAC_ACCESS_SLUGS } from "./epra-config";
import { epraSeriesFor, epraSnapshot, type Indicator, type EpraRow } from "./dashboard-types";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

const GEN_OPTIONS = [
  { slug: "gen_geothermal_gwh", label: "Geothermal" },
  { slug: "gen_hydro_gwh", label: "Hydro" },
  { slug: "gen_wind_gwh", label: "Wind" },
  { slug: "gen_solar_gwh", label: "Solar" },
];

export function RenewableTab({ epraRows, indicators }: { epraRows: EpraRow[]; indicators: Indicator[] }) {
  const indicatorBySlug = useMemo(() => new Map(indicators.map((i) => [i.slug, i])), [indicators]);
  const [genSlug, setGenSlug] = useState(GEN_OPTIONS[0].slug);

  const capacityMixData: DonutSlice[] = useMemo(
    () =>
      RENEWABLE_MIX_SLUGS.map((slug, i) => {
        const ind = indicatorBySlug.get(slug);
        if (!ind) return null;
        const value = epraSnapshot(epraRows, indicatorBySlug, slug) ?? 0;
        return { label: ind.name, value, color: CHART_COLORS[i % CHART_COLORS.length] };
      }).filter((x): x is DonutSlice => x != null),
    [epraRows, indicatorBySlug]
  );
  const capacityMixTotal = capacityMixData.reduce((a, b) => a + b.value, 0);

  const genIndicator = indicatorBySlug.get(genSlug);
  const genData = useMemo(
    () => epraSeriesFor(epraRows, indicatorBySlug, genSlug).map((r) => ({ label: String(r.year), value: r.value })),
    [epraRows, indicatorBySlug, genSlug]
  );

  const eacData = useMemo(
    () =>
      EAC_ACCESS_SLUGS.map((slug) => {
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
            <CardTitle className="text-base">Renewable capacity mix</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <DonutChart data={capacityMixData} unit="MW" centerLabel={{ value: fmtNum(capacityMixTotal, 0), caption: "MW total" }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <CardTitle className="text-base">Per-source generation trend</CardTitle>
                <p className="text-xs text-muted-foreground">{genIndicator?.unit}, by year</p>
              </div>
              <NationalContextBadge />
            </div>
            <Select value={genSlug} onValueChange={(v) => setGenSlug(String(v))} items={GEN_OPTIONS.map((o) => ({ value: o.slug, label: o.label }))}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEN_OPTIONS.map((o) => (
                  <SelectItem key={o.slug} value={o.slug}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <BigGradientArea data={genData} unit={genIndicator?.unit} tone="success" height={260} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">EAC regional comparison</CardTitle>
            <p className="text-xs text-muted-foreground">Electricity access rate, %</p>
          </div>
          <NationalContextBadge label="Regional context" />
        </CardHeader>
        <CardContent>
          <GradientRankBar data={eacData} unit="%" />
        </CardContent>
      </Card>
    </div>
  );
}

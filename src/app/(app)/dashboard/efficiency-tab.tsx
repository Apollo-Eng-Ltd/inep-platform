"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BigGradientArea, GradientRankBar } from "@/components/charts";
import { NationalContextBadge } from "@/components/national-context-badge";
import { EFFICIENCY_APPLIANCE_SLUG } from "./epra-config";
import { epraSeriesFor, type Indicator, type County, type ValueRow, type EpraRow } from "./dashboard-types";

export function EfficiencyTab({
  epraRows,
  indicators,
  counties,
  valueRows,
  yearTo,
}: {
  epraRows: EpraRow[];
  indicators: Indicator[];
  counties: County[];
  valueRows: ValueRow[];
  yearTo: number;
}) {
  const indicatorBySlug = useMemo(() => new Map(indicators.map((i) => [i.slug, i])), [indicators]);
  const countyNameById = useMemo(() => new Map(counties.map((c) => [c.id, c.name])), [counties]);

  const applianceData = useMemo(
    () => epraSeriesFor(epraRows, indicatorBySlug, EFFICIENCY_APPLIANCE_SLUG).map((r) => ({ label: String(r.year), value: r.value })),
    [epraRows, indicatorBySlug]
  );

  const rankedFor = (slug: string) => {
    const ind = indicatorBySlug.get(slug);
    if (!ind) return { data: [] as { label: string; value: number }[], unit: undefined as string | undefined, name: "" };
    const rows = valueRows.filter((v) => v.indicatorId === ind.id && v.year === yearTo);
    const data = rows
      .map((r) => ({ label: countyNameById.get(r.countyId) ?? "—", value: Math.round(r.value * 10) / 10 }))
      .sort((a, b) => b.value - a.value);
    return { data, unit: ind.unit, name: ind.name };
  };

  const savings = rankedFor("efficiency_savings_gwh");
  const audits = rankedFor("energy_audits_done");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Average appliance star rating</CardTitle>
          <NationalContextBadge />
        </CardHeader>
        <CardContent>
          <BigGradientArea data={applianceData} unit="stars" tone="agent" height={260} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{savings.name || "Energy audit savings"}</CardTitle>
            <p className="text-xs text-muted-foreground">By county, {yearTo}</p>
          </CardHeader>
          <CardContent>
            <GradientRankBar data={savings.data} unit={savings.unit} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{audits.name || "Energy audits completed"}</CardTitle>
            <p className="text-xs text-muted-foreground">By county, {yearTo}</p>
          </CardHeader>
          <CardContent>
            <GradientRankBar data={audits.data} unit={audits.unit} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

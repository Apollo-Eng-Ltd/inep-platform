"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MultiCountyArea, GradientRankBar, DonutChart, BigGradientArea, MonthlyBenchmarkChart,
  type AreaSeriesDef, type DonutSlice, type Tone, type MonthlyPoint,
} from "@/components/charts";
import { HeroStatCard } from "@/components/hero-stat-card";
import { NationalContextBadge } from "@/components/national-context-badge";
import { runDashboardInsight, type DashboardInsightChip } from "@/lib/agents";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EPRA_MIX_SLUGS, FY_MONTH_LABELS, GDP_GROWTH_SLUG, PER_CAPITA_CONSUMPTION_SLUG } from "./epra-config";
import { epraSeriesFor, type Sector, type Indicator, type County, type ValueRow, type EpraRow } from "./dashboard-types";
import { ChoroplethMap, ChoroplethLegend, type ChoroplethCounty } from "./choropleth-map";
import { PointMap, PointMapLegend, type MapPoint } from "./point-map";
import { ElectricityTab } from "./electricity-tab";
import { RenewableTab } from "./renewable-tab";
import { EfficiencyTab } from "./efficiency-tab";
import { PetroleumTab } from "./petroleum-tab";
import { LpgTab } from "./lpg-tab";
import { EnergyBalanceTab } from "./energy-balance-tab";
import { ConsumerProtectionTab } from "./consumer-protection-tab";
import {
  Download, ArrowUpRight, ArrowDownRight, Activity,
  Zap, Leaf, Gauge, PiggyBank, Flame, Fuel, TrendingUp, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type { Sector, Indicator, County, ValueRow, EpraRow };

// EPRA "Year at a Glance" hero row — fixed order, icon, and accent per card.
// These are national context figures (see scripts/data.ts EPRA_INDICATORS),
// independent of the sector filter below. The slug list itself lives in
// epra-config.ts (a plain module) so the server page can import it too.
const EPRA_HERO: { slug: string; icon: LucideIcon; tone: Tone }[] = [
  { slug: "energy_generated_gwh", icon: Zap, tone: "brand" },
  { slug: "renewable_share_pct", icon: Leaf, tone: "success" },
  { slug: "peak_demand_mw", icon: Gauge, tone: "provider" },
  { slug: "tou_savings_kes_m", icon: PiggyBank, tone: "agent" },
  { slug: "lpg_demand_growth_pct", icon: Flame, tone: "warning" },
  { slug: "petroleum_demand_growth_pct", icon: Fuel, tone: "danger" },
];
// Representative metric per sector — direct if the unit is %, otherwise
// min-max normalized across counties. `invert` means "lower is better."
const PRIMARY_BY_SECTOR: Record<string, { slug: string; invert?: boolean }> = {
  electricity: { slug: "electricity_access_pct" },
  energy_access: { slug: "clean_cooking_pct" },
  bioenergy: { slug: "firewood_dependency_pct", invert: true },
  efficiency: { slug: "efficiency_savings_gwh" },
  resource_dev: { slug: "rd_budget_kes_m" },
};

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

// Options for the big top-of-report area chart — the four EPRA "level" hero
// metrics (excludes the two growth-rate indicators, which don't read well as
// a big multi-year level chart).
const AREA_METRIC_OPTIONS = [
  { slug: "energy_generated_gwh", label: "Energy Generated" },
  { slug: "peak_demand_mw", label: "Peak Demand" },
  { slug: "renewable_share_pct", label: "Renewable Share of Capacity" },
  { slug: "tou_savings_kes_m", label: "TOU Savings" },
];

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function DashboardClient({
  sectors,
  indicators,
  counties,
  valueRows,
  epraRows,
  countySubmissionIds,
  mapPoints,
  missingLocationCount,
}: {
  sectors: Sector[];
  indicators: Indicator[];
  counties: County[];
  valueRows: ValueRow[];
  epraRows: EpraRow[];
  countySubmissionIds: Record<string, string>;
  mapPoints: MapPoint[];
  missingLocationCount: number;
}) {
  const years = useMemo(() => [...new Set(valueRows.map((v) => v.year))].sort(), [valueRows]);
  const minYear = years[0] ?? new Date().getFullYear();
  const maxYear = years[years.length - 1] ?? new Date().getFullYear();

  const [sectorSlug, setSectorSlug] = useState("all");
  const [yearFrom, setYearFrom] = useState(minYear);
  const [yearTo, setYearTo] = useState(maxYear);
  const [compareCounties, setCompareCounties] = useState<string[] | null>(null);
  const [sortCol, setSortCol] = useState("score");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [areaMetricSlug, setAreaMetricSlug] = useState("energy_generated_gwh");

  const indicatorBySlug = useMemo(() => new Map(indicators.map((i) => [i.slug, i])), [indicators]);
  const countyNameById = useMemo(() => new Map(counties.map((c) => [c.id, c.name])), [counties]);

  const valueMap = useMemo(() => {
    const m = new Map<string, number>();
    valueRows.forEach((v) => m.set(`${v.countyId}|${v.indicatorId}|${v.year}`, v.value));
    return m;
  }, [valueRows]);

  // National aggregate per indicator/year, derived live from every county's own
  // reported values (average for a %, total otherwise) — always covers every
  // year on file, including the current in-progress cycle.
  const nationalByIndicatorYear = useMemo(() => {
    const groups = new Map<string, number[]>();
    valueRows.forEach((v) => {
      const key = `${v.indicatorId}|${v.year}`;
      const arr = groups.get(key) ?? [];
      arr.push(v.value);
      groups.set(key, arr);
    });
    const indById = new Map(indicators.map((i) => [i.id, i]));
    const out = new Map<string, number>();
    groups.forEach((vals, key) => {
      const indicatorId = key.split("|")[0];
      const isPct = indById.get(indicatorId)?.unit === "%";
      const agg = isPct ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0);
      out.set(key, Math.round(agg * 10) / 10);
    });
    return out;
  }, [valueRows, indicators]);

  const indicatorsBySector = useMemo(() => {
    const m = new Map<string, Indicator[]>();
    indicators.forEach((i) => {
      const list = m.get(i.sectorId) ?? [];
      list.push(i);
      m.set(i.sectorId, list);
    });
    return m;
  }, [indicators]);

  const activeSectors = sectorSlug === "all" ? sectors : sectors.filter((s) => s.slug === sectorSlug);
  const currentSector = sectors.find((s) => s.slug === sectorSlug) ?? null;

  // the indicator(s) driving the heatmap / ranking / insight for the current selection
  const primaryIndicatorsForSelection = useMemo(() => {
    return activeSectors
      .map((s) => {
        const cfg = PRIMARY_BY_SECTOR[s.slug];
        const ind = cfg ? indicatorBySlug.get(cfg.slug) : indicatorsBySector.get(s.id)?.[0];
        return ind ? { sector: s, indicator: ind, invert: cfg?.invert ?? false } : null;
      })
      .filter((x): x is { sector: Sector; indicator: Indicator; invert: boolean } => !!x);
  }, [activeSectors, indicatorBySlug, indicatorsBySector]);

  const singlePrimary = sectorSlug !== "all" ? primaryIndicatorsForSelection[0] ?? null : null;

  // min-max normalization cache per indicator/year (for non-% primaries)
  const rangeCache = useMemo(() => {
    const cache = new Map<string, { min: number; max: number }>();
    primaryIndicatorsForSelection.forEach(({ indicator }) => {
      if (indicator.unit === "%") return;
      years.forEach((y) => {
        const vals = counties
          .map((c) => valueMap.get(`${c.id}|${indicator.id}|${y}`))
          .filter((v): v is number => v != null);
        if (vals.length) cache.set(`${indicator.id}|${y}`, { min: Math.min(...vals), max: Math.max(...vals) });
      });
    });
    return cache;
  }, [primaryIndicatorsForSelection, years, counties, valueMap]);

  const scoreFor = useCallback((countyId: string, ind: { indicator: Indicator; invert: boolean }, year: number): number | null => {
    const raw = valueMap.get(`${countyId}|${ind.indicator.id}|${year}`);
    if (raw == null) return null;
    if (ind.indicator.unit === "%") return ind.invert ? 100 - raw : raw;
    const range = rangeCache.get(`${ind.indicator.id}|${year}`);
    if (!range || range.max === range.min) return 50;
    const norm = ((raw - range.min) / (range.max - range.min)) * 100;
    return ind.invert ? 100 - norm : norm;
  }, [valueMap, rangeCache]);

  const countyScores = useMemo(() => {
    return counties.map((c) => {
      const perSector = primaryIndicatorsForSelection
        .map((ind) => scoreFor(c.id, ind, yearTo))
        .filter((s): s is number => s != null);
      const score = perSector.length ? perSector.reduce((a, b) => a + b, 0) / perSector.length : null;
      const rawPrimary = singlePrimary ? valueMap.get(`${c.id}|${singlePrimary.indicator.id}|${yearTo}`) ?? null : null;
      return { county: c, score, rawPrimary };
    });
  }, [counties, primaryIndicatorsForSelection, yearTo, singlePrimary, valueMap, scoreFor]);

  const rankedCounties = useMemo(
    () =>
      countyScores
        .filter((c) => c.score != null)
        .sort((a, b) => (b.score as number) - (a.score as number)),
    [countyScores]
  );

  // ---- choropleth map: same score pipeline as the heatmap, real county
  // shapes instead of squares, no-data counties left honestly unshaded. ------
  const choroplethData: ChoroplethCounty[] = useMemo(
    () =>
      countyScores.map(({ county, score, rawPrimary }) => ({
        name: county.name,
        score,
        rawValue: singlePrimary ? rawPrimary : score,
        submissionId: countySubmissionIds[county.id] ?? null,
      })),
    [countyScores, singlePrimary, countySubmissionIds]
  );

  // Population-weighted national average — uses the real `population_served`
  // indicator as a size proxy (no census population column exists in the
  // schema) so a large county doesn't count the same as a tiny one.
  const populationIndicator = indicatorBySlug.get("population_served");
  const populationWeightedAvg = useMemo(() => {
    if (!singlePrimary || !populationIndicator) return null;
    let weightedSum = 0;
    let weightTotal = 0;
    counties.forEach((c) => {
      const value = valueMap.get(`${c.id}|${singlePrimary.indicator.id}|${yearTo}`);
      const weight = valueMap.get(`${c.id}|${populationIndicator.id}|${yearTo}`);
      if (value == null || weight == null) return;
      weightedSum += value * weight;
      weightTotal += weight;
    });
    return weightTotal > 0 ? weightedSum / weightTotal : null;
  }, [singlePrimary, populationIndicator, counties, valueMap, yearTo]);

  // ---- hero row: EPRA "Year at a Glance" — real national context figures,
  // fixed order/icon/accent, independent of the sector filter above. --------
  const heroCards = useMemo(
    () =>
      EPRA_HERO.map((cfg) => {
        const ind = indicatorBySlug.get(cfg.slug);
        if (!ind) return null;
        const rowsForIndicator = epraRows.filter((e) => e.indicatorId === ind.id).sort((a, b) => a.year - b.year);
        const series = rowsForIndicator.map((r) => r.value);
        const labels = rowsForIndicator.map((r) => String(r.year));
        const latest = series[series.length - 1] ?? null;
        const prev = series.length > 1 ? series[series.length - 2] : null;
        const delta =
          latest != null && prev != null && prev !== 0 ? Math.round(((latest - prev) / prev) * 1000) / 10 : null;
        return { indicator: ind, icon: cfg.icon, tone: cfg.tone, series, labels, latest, delta };
      }).filter((h): h is NonNullable<typeof h> => h != null),
    [indicatorBySlug, epraRows]
  );

  // ---- insight banner ---------------------------------------------------------
  const insight = useMemo(() => {
    if (!singlePrimary) {
      const first = primaryIndicatorsForSelection[0];
      if (!first) return null;
      return computeInsight(first, "All sectors", yearTo, nationalByIndicatorYear, rankedCounties, countyNameById, valueMap);
    }
    return computeInsight(
      singlePrimary,
      currentSector?.name ?? "",
      yearTo,
      nationalByIndicatorYear,
      rankedCounties,
      countyNameById,
      valueMap
    );
  }, [singlePrimary, primaryIndicatorsForSelection, currentSector, yearTo, nationalByIndicatorYear, rankedCounties, countyNameById, valueMap]);

  // ---- main area chart: compare counties over time on the primary metric ------
  const defaultCompare = rankedCounties.slice(0, 4).map((r) => r.county.id);
  const activeCompare = compareCounties ?? defaultCompare;
  const compareIndicator = singlePrimary?.indicator ?? primaryIndicatorsForSelection[0]?.indicator ?? null;

  const areaData = useMemo(() => {
    if (!compareIndicator) return [];
    return years
      .filter((y) => y >= yearFrom && y <= yearTo)
      .map((y) => {
        const row: Record<string, number | string> = { label: String(y) };
        activeCompare.forEach((cid) => {
          const v = valueMap.get(`${cid}|${compareIndicator.id}|${y}`);
          if (v != null) row[cid] = v;
        });
        return row;
      });
  }, [years, yearFrom, yearTo, activeCompare, compareIndicator, valueMap]);

  const areaSeries: AreaSeriesDef[] = activeCompare.map((cid, i) => ({
    key: cid,
    label: countyNameById.get(cid) ?? "—",
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // ---- main chart set: EPRA "Year at a Glance" report charts ----------------
  const areaMetricIndicator = indicatorBySlug.get(areaMetricSlug);
  const areaChartData = useMemo(() => {
    if (!areaMetricIndicator) return [];
    return epraRows
      .filter((e) => e.indicatorId === areaMetricIndicator.id)
      .sort((a, b) => a.year - b.year)
      .map((e) => ({ label: String(e.year), value: e.value }));
  }, [epraRows, areaMetricIndicator]);

  const mixData: DonutSlice[] = useMemo(
    () =>
      EPRA_MIX_SLUGS.map((slug, i) => {
        const ind = indicatorBySlug.get(slug);
        if (!ind) return null;
        const row = epraRows.find((e) => e.indicatorId === ind.id);
        return { label: ind.name, value: row?.value ?? 0, color: CHART_COLORS[i % CHART_COLORS.length] };
      }).filter((x): x is DonutSlice => x != null),
    [epraRows, indicatorBySlug]
  );
  const mixTotal = mixData.reduce((a, b) => a + b.value, 0);

  const monthlyData: MonthlyPoint[] = useMemo(() => {
    const actualInd = indicatorBySlug.get("monthly_generation_gwh");
    const targetInd = indicatorBySlug.get("monthly_generation_target_gwh");
    if (!actualInd || !targetInd) return [];
    return FY_MONTH_LABELS.map((label, i) => {
      const m = i + 1;
      const actual = epraRows.find((e) => e.indicatorId === actualInd.id && e.year === m)?.value ?? 0;
      const target = epraRows.find((e) => e.indicatorId === targetInd.id && e.year === m)?.value ?? 0;
      return { label, actual, target };
    });
  }, [epraRows, indicatorBySlug]);

  // ---- Overview: generation growth vs. GDP growth, per-capita consumption ---
  const generationVsGdpData = useMemo(() => {
    const genRows = epraSeriesFor(epraRows, indicatorBySlug, "energy_generated_gwh");
    const gdpRows = epraSeriesFor(epraRows, indicatorBySlug, GDP_GROWTH_SLUG);
    const gdpByYear = new Map(gdpRows.map((r) => [r.year, r.value]));
    return genRows.slice(1).map((r, i) => {
      const prev = genRows[i].value;
      const genGrowth = prev !== 0 ? Math.round(((r.value - prev) / prev) * 1000) / 10 : 0;
      return { label: String(r.year), generation: genGrowth, gdp: gdpByYear.get(r.year) ?? 0 };
    });
  }, [epraRows, indicatorBySlug]);
  const generationVsGdpSeries: AreaSeriesDef[] = [
    { key: "generation", label: "Generation growth", color: "var(--chart-1)" },
    { key: "gdp", label: "GDP growth", color: "var(--chart-2)" },
  ];

  const perCapitaData = useMemo(
    () =>
      epraSeriesFor(epraRows, indicatorBySlug, PER_CAPITA_CONSUMPTION_SLUG).map((r) => ({
        label: String(r.year),
        value: r.value,
      })),
    [epraRows, indicatorBySlug]
  );

  // ---- sortable table -----------------------------------------------------
  const tableIndicators = useMemo(
    () =>
      sectorSlug === "all"
        ? primaryIndicatorsForSelection.map((p) => p.indicator)
        : (indicatorsBySector.get(currentSector?.id ?? "") ?? []),
    [sectorSlug, primaryIndicatorsForSelection, indicatorsBySector, currentSector]
  );

  const tableRows = useMemo(() => {
    const rows = counties.map((c) => {
      const score = countyScores.find((s) => s.county.id === c.id)?.score ?? null;
      const cells = tableIndicators.map((ind) => valueMap.get(`${c.id}|${ind.id}|${yearTo}`) ?? null);
      return { county: c, score, cells };
    });
    const dir = sortDir;
    return rows.sort((a, b) => {
      if (sortCol === "county") return dir * a.county.name.localeCompare(b.county.name);
      if (sortCol === "score") return dir * ((a.score ?? -1) - (b.score ?? -1));
      const idx = tableIndicators.findIndex((i) => i.id === sortCol);
      if (idx === -1) return 0;
      return dir * ((a.cells[idx] ?? -Infinity) - (b.cells[idx] ?? -Infinity));
    });
  }, [counties, countyScores, tableIndicators, valueMap, yearTo, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortCol(col);
      setSortDir(-1);
    }
  };

  const exportCsv = () => {
    const header = ["County", "Score", ...tableIndicators.map((i) => `${i.name} (${i.unit})`)];
    const lines = [header, ...tableRows.map((r) => [r.county.name, r.score != null ? Math.round(r.score) : "", ...r.cells.map((c) => c ?? "")])];
    const csv = lines.map((cols) => cols.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inep-national-dashboard-${sectorSlug}-${yearTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sectorItems = [{ value: "all", label: "All sectors combined" }, ...sectors.map((s) => ({ value: s.slug, label: s.name }))];
  const yearItems = years.map((y) => ({ value: String(y), label: String(y) }));

  return (
    <>
      {/* Header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">National dashboard</h1>
          <span className="rounded-full bg-brand-soft text-brand px-2.5 py-1 text-xs font-medium">
            {yearFrom === yearTo ? `${yearTo}` : `${yearFrom}–${yearTo}`} reporting period
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sectorSlug} onValueChange={(v) => setSectorSlug(String(v))} items={sectorItems}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sectorItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(yearFrom)} onValueChange={(v) => setYearFrom(Number(v))} items={yearItems}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.filter((y) => y <= yearTo).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">–</span>
          <Select value={String(yearTo)} onValueChange={(v) => setYearTo(Number(v))} items={yearItems}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.filter((y) => y >= yearFrom).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-3.5" /> Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="electricity">Electricity</TabsTrigger>
          <TabsTrigger value="renewable">Renewable Energy</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
          <TabsTrigger value="petroleum">Petroleum</TabsTrigger>
          <TabsTrigger value="lpg">LPG</TabsTrigger>
          <TabsTrigger value="energy-balance">Energy Balance</TabsTrigger>
          <TabsTrigger value="consumer-protection">Consumer Protection</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
      {/* Insight banner */}
      {insight && (
        <Card className="mb-4 border-brand/15 bg-linear-to-br from-brand/12 via-success/6 to-transparent overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-brand/15 text-brand grid place-items-center shrink-0">
                <Activity className="size-4" />
              </div>
              <p className="text-sm leading-relaxed pt-1.5">
                {insight.parts.map((p, i) =>
                  typeof p === "string" ? (
                    <span key={i}>{p}</span>
                  ) : (
                    <span
                      key={i}
                      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mx-0.5", chipClasses((p as DashboardInsightChip).tone))}
                    >
                      {(p as DashboardInsightChip).label}
                    </span>
                  )
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hero stat row — EPRA "Year at a Glance" */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-medium text-muted-foreground">Year at a glance</h2>
        <NationalContextBadge />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        {heroCards.map((h) => (
          <HeroStatCard
            key={h.indicator.id}
            icon={h.icon}
            tone={h.tone}
            latest={h.latest}
            unit={h.indicator.unit}
            name={h.indicator.name}
            delta={h.delta}
            series={h.series}
            labels={h.labels}
          />
        ))}
      </div>

      {/* Generation growth vs. GDP growth, per-capita consumption trend */}
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Generation growth vs. GDP growth</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <MultiCountyArea data={generationVsGdpData} series={generationVsGdpSeries} unit="%" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Per capita electricity consumption</CardTitle>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <BigGradientArea data={perCapitaData} unit="kWh" tone="agent" height={300} />
          </CardContent>
        </Card>
      </div>

      {/* Main chart set — the four EPRA "Year at a Glance" report charts */}
      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <CardTitle className="text-base">{AREA_METRIC_OPTIONS.find((o) => o.slug === areaMetricSlug)?.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{areaMetricIndicator?.unit}, by year</p>
            </div>
            <NationalContextBadge />
          </div>
          <Select value={areaMetricSlug} onValueChange={(v) => setAreaMetricSlug(String(v))} items={AREA_METRIC_OPTIONS.map((o) => ({ value: o.slug, label: o.label }))}>
            <SelectTrigger size="sm" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AREA_METRIC_OPTIONS.map((o) => (
                <SelectItem key={o.slug} value={o.slug}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <BigGradientArea data={areaChartData} unit={areaMetricIndicator?.unit} tone="brand" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Generation mix by source</CardTitle>
              <p className="text-xs text-muted-foreground">Installed capacity, MW</p>
            </div>
            <NationalContextBadge />
          </CardHeader>
          <CardContent>
            <DonutChart
              data={mixData}
              unit="MW"
              centerLabel={{ value: fmtNum(mixTotal, 0), caption: "MW total" }}
            />
            <div className="space-y-1.5 mt-2">
              {mixData.map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="size-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-muted-foreground truncate flex-1">{d.label}</span>
                  <span className="font-medium tabular-nums">{fmtNum(d.value, 0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">All counties ranked</CardTitle>
            <p className="text-xs text-muted-foreground">
              {singlePrimary ? singlePrimary.indicator.name : "Composite score"}, {yearTo}
            </p>
          </CardHeader>
          <CardContent>
            <GradientRankBar
              data={rankedCounties.map((r) => ({
                label: r.county.name,
                value: singlePrimary ? Math.round((r.rawPrimary ?? 0) * 10) / 10 : Math.round(r.score ?? 0),
              }))}
              unit={singlePrimary?.indicator.unit}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Monthly generation vs. target</CardTitle>
            <p className="text-xs text-muted-foreground">Current financial year, GWh</p>
          </div>
          <NationalContextBadge />
        </CardHeader>
        <CardContent>
          <MonthlyBenchmarkChart data={monthlyData} unit="GWh" tone="brand" />
        </CardContent>
      </Card>

      {/* Main comparison chart */}
      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              County comparison — {compareIndicator?.name ?? "—"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{compareIndicator?.unit}, by year</p>
          </div>
        </CardHeader>
        <CardContent>
          <MultiCountyArea data={areaData} series={areaSeries} unit={compareIndicator?.unit} />
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            {rankedCounties.slice(0, 12).map((r) => {
              const active = activeCompare.includes(r.county.id);
              const idx = activeCompare.indexOf(r.county.id);
              return (
                <button
                  key={r.county.id}
                  type="button"
                  onClick={() =>
                    setCompareCounties((cur) => {
                      const base = cur ?? defaultCompare;
                      return base.includes(r.county.id)
                        ? base.filter((id) => id !== r.county.id)
                        : base.length >= 5
                          ? base
                          : [...base, r.county.id];
                    })
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors",
                    active ? "border-transparent text-white" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                  style={active ? { backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] } : undefined}
                >
                  {r.county.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Maps */}
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base">County performance map</CardTitle>
              <p className="text-xs text-muted-foreground">
                {singlePrimary ? singlePrimary.indicator.name : "Composite score across sectors"}, {yearTo} · click a county to open its latest submission
              </p>
            </div>
            {populationWeightedAvg != null && (
              <div className="text-right shrink-0">
                <p className="text-lg font-semibold tabular-nums">
                  {fmtNum(populationWeightedAvg, singlePrimary?.indicator.unit === "%" ? 1 : 0)}
                  {singlePrimary?.indicator.unit === "%" ? "%" : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">pop.-weighted avg</p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ChoroplethMap data={choroplethData} unit={singlePrimary?.indicator.unit} />
            <div className="mt-3 pt-3 border-t border-border">
              <ChoroplethLegend />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provider &amp; private-sector sites</CardTitle>
            <p className="text-xs text-muted-foreground">Real GPS coordinates on file</p>
          </CardHeader>
          <CardContent>
            <PointMap points={mapPoints} missingCount={missingLocationCount} />
            <div className="mt-3 pt-3 border-t border-border">
              <PointMapLegend />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data table */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="px-5 pt-5 pb-0">
          <CardTitle className="text-base">All figures</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th
                  className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3 cursor-pointer select-none"
                  onClick={() => toggleSort("county")}
                >
                  County
                </th>
                <th
                  className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3 cursor-pointer select-none text-right"
                  onClick={() => toggleSort("score")}
                >
                  Score
                </th>
                {tableIndicators.map((ind) => (
                  <th
                    key={ind.id}
                    className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3 cursor-pointer select-none text-right whitespace-nowrap"
                    onClick={() => toggleSort(ind.id)}
                  >
                    {ind.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={r.county.id} className={cn("border-b border-border last:border-0", i % 2 === 1 && "bg-muted/25")}>
                  <td className="px-5 py-2.5 font-medium whitespace-nowrap">{r.county.name}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.score != null ? Math.round(r.score) : "—"}
                  </td>
                  {r.cells.map((v, ci) => (
                    <td key={ci} className="px-5 py-2.5 text-right tabular-nums">
                      {v != null ? fmtNum(v, tableIndicators[ci].unit === "%" ? 1 : 0) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="electricity">
          <ElectricityTab epraRows={epraRows} indicators={indicators} counties={counties} valueRows={valueRows} />
        </TabsContent>
        <TabsContent value="renewable">
          <RenewableTab epraRows={epraRows} indicators={indicators} />
        </TabsContent>
        <TabsContent value="efficiency">
          <EfficiencyTab epraRows={epraRows} indicators={indicators} counties={counties} valueRows={valueRows} yearTo={yearTo} />
        </TabsContent>
        <TabsContent value="petroleum">
          <PetroleumTab epraRows={epraRows} indicators={indicators} />
        </TabsContent>
        <TabsContent value="lpg">
          <LpgTab epraRows={epraRows} indicators={indicators} />
        </TabsContent>
        <TabsContent value="energy-balance">
          <EnergyBalanceTab epraRows={epraRows} indicators={indicators} mixData={mixData} mixTotal={mixTotal} />
        </TabsContent>
        <TabsContent value="consumer-protection">
          <ConsumerProtectionTab epraRows={epraRows} indicators={indicators} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function chipClasses(tone: "success" | "danger" | "warning"): string {
  return {
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
  }[tone];
}

function computeInsight(
  primary: { sector: Sector; indicator: Indicator; invert: boolean },
  sectorName: string,
  yearTo: number,
  nationalByIndicatorYear: Map<string, number>,
  rankedCounties: { county: County; score: number | null; rawPrimary: number | null }[],
  countyNameById: Map<string, string>,
  valueMap: Map<string, number>
) {
  const latest = nationalByIndicatorYear.get(`${primary.indicator.id}|${yearTo}`) ?? null;
  const prev = nationalByIndicatorYear.get(`${primary.indicator.id}|${yearTo - 1}`) ?? null;
  const deltaPct = latest != null && prev != null && prev !== 0 ? Math.round(((latest - prev) / prev) * 1000) / 10 : null;

  const top = rankedCounties[0];
  const bottom = rankedCounties[rankedCounties.length - 1];
  const rawFor = (id: string | undefined) =>
    id != null ? valueMap.get(`${id}|${primary.indicator.id}|${yearTo}`) ?? null : null;

  return runDashboardInsight({
    sectorName,
    periodYear: yearTo,
    primaryLabel: primary.indicator.name,
    primaryValue: latest ?? 0,
    primaryUnit: primary.indicator.unit,
    deltaPct,
    topCounty: top ? { name: countyNameById.get(top.county.id) ?? "—", value: rawFor(top.county.id) ?? top.score ?? 0 } : null,
    laggingCounty:
      bottom && bottom.county.id !== top?.county.id
        ? { name: countyNameById.get(bottom.county.id) ?? "—", value: rawFor(bottom.county.id) ?? bottom.score ?? 0 }
        : null,
  }).data;
}

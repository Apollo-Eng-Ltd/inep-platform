"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GradientArea, MultiCountyArea, GradientRankBar, DonutChart,
  type AreaSeriesDef, type DonutSlice, type Tone,
} from "@/components/charts";
import { runDashboardInsight, type DashboardInsightChip } from "@/lib/agents";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Download, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

export interface Sector {
  id: string;
  name: string;
  slug: string;
}
export interface Indicator {
  id: string;
  name: string;
  slug: string;
  unit: string;
  sectorId: string;
}
export interface County {
  id: string;
  name: string;
}
export interface ValueRow {
  countyId: string;
  countyName: string;
  indicatorId: string;
  year: number;
  value: number;
}
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
const HERO_TONES: Tone[] = ["provider", "brand", "warning", "agent"];

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function DashboardClient({
  sectors,
  indicators,
  counties,
  valueRows,
}: {
  sectors: Sector[];
  indicators: Indicator[];
  counties: County[];
  valueRows: ValueRow[];
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

  // the indicator(s) driving hero cards / heatmap / ranking for the current selection
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

  // Real scores tend to cluster in a narrow band — rescale to the observed
  // min/max so the heatmap's color range actually spans teal to red instead
  // of sitting flat in the middle of a fixed 0-100 scale.
  const scoreRange = useMemo(() => {
    const vals = countyScores.map((c) => c.score).filter((s): s is number => s != null);
    return vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : { min: 0, max: 100 };
  }, [countyScores]);

  // ---- hero cards -----------------------------------------------------------
  const heroIndicators = sectorSlug === "all"
    ? primaryIndicatorsForSelection.slice(0, 4).map((p) => p.indicator)
    : (indicatorsBySector.get(currentSector?.id ?? "") ?? []).slice(0, 4);

  const heroCards = heroIndicators.map((ind) => {
    const series = years
      .filter((y) => y >= yearFrom && y <= yearTo)
      .map((y) => nationalByIndicatorYear.get(`${ind.id}|${y}`) ?? null);
    const clean = series.filter((v): v is number => v != null);
    const latest = clean[clean.length - 1] ?? null;
    const prev = clean.length > 1 ? clean[clean.length - 2] : null;
    const delta = latest != null && prev != null && prev !== 0 ? Math.round(((latest - prev) / prev) * 1000) / 10 : null;
    return { indicator: ind, series: clean, latest, delta };
  });

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

  // ---- donut: technology / fuel-type split, or cross-sector split for "all" ---
  const donutData: DonutSlice[] = useMemo(() => {
    if (sectorSlug === "all") {
      return primaryIndicatorsForSelection.map((p, i) => {
        const latest = nationalByIndicatorYear.get(`${p.indicator.id}|${yearTo}`) ?? 0;
        return { label: p.sector.name, value: latest, color: CHART_COLORS[i % CHART_COLORS.length] };
      });
    }
    const sectorIndicators = (indicatorsBySector.get(currentSector?.id ?? "") ?? []).filter((i) => i.unit !== "%");
    return sectorIndicators.map((ind, i) => {
      const latest = nationalByIndicatorYear.get(`${ind.id}|${yearTo}`) ?? 0;
      return { label: ind.name, value: latest, color: CHART_COLORS[i % CHART_COLORS.length] };
    });
  }, [sectorSlug, primaryIndicatorsForSelection, indicatorsBySector, currentSector, nationalByIndicatorYear, yearTo]);

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

      {/* Hero stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        {heroCards.map((h, i) => (
          <Card key={h.indicator.id} className="p-5 gap-2 overflow-hidden">
            <p className="text-xs font-medium text-muted-foreground truncate">{h.indicator.name}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-medium tabular-nums">
                {h.latest != null ? fmtNum(h.latest, h.indicator.unit === "%" ? 1 : 0) : "—"}
              </span>
              {h.indicator.unit && <span className="text-sm text-muted-foreground">{h.indicator.unit}</span>}
            </div>
            {h.delta != null && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium w-fit",
                  h.delta >= 0 ? "text-success" : "text-danger"
                )}
              >
                {h.delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {Math.abs(h.delta)}%
              </span>
            )}
            <GradientArea data={h.series.length ? h.series : [0, 0]} tone={HERO_TONES[i % HERO_TONES.length]} />
          </Card>
        ))}
      </div>

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

      {/* Ranking + donut */}
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {sectorSlug === "all" ? "Split by sector" : "Technology / fuel-type split"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">National total, {yearTo}</p>
          </CardHeader>
          <CardContent>
            <DonutChart data={donutData} />
            <div className="space-y-1.5 mt-2">
              {donutData.map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="size-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-muted-foreground truncate flex-1">{d.label}</span>
                  <span className="font-medium tabular-nums">{fmtNum(d.value, 0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">County performance heatmap</CardTitle>
          <p className="text-xs text-muted-foreground">
            {sectorSlug === "all" ? "Composite score across sectors" : currentSector?.name}, {yearTo} · shaded relative to this year&apos;s spread
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-2">
            {countyScores.map(({ county, score }) => {
              const relative = score != null ? rescale(score, scoreRange) : null;
              return (
                <div
                  key={county.id}
                  title={`${county.name}: ${score != null ? Math.round(score) : "no data"}`}
                  className="aspect-square rounded-lg grid place-items-center text-[10px] font-medium text-center px-1 leading-tight"
                  style={{
                    backgroundColor: relative != null ? heatColor(relative) : "var(--muted)",
                    color: relative != null && relative > 40 ? "white" : "var(--foreground)",
                  }}
                >
                  {county.name}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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

/** Maps a raw score into the observed [min,max] range onto a clean 0-100 scale. */
function rescale(value: number, range: { min: number; max: number }): number {
  if (range.max === range.min) return 50;
  return ((value - range.min) / (range.max - range.min)) * 100;
}

/** Deep teal (strong) fading through amber to soft red (weak) — existing tokens only. */
function heatColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 50) {
    const t = (s - 50) / 50; // 0 (amber) -> 1 (teal)
    return `color-mix(in oklch, var(--brand) ${Math.round(t * 100)}%, var(--warning) ${Math.round((1 - t) * 100)}%)`;
  }
  const t = s / 50; // 0 (red) -> 1 (amber)
  return `color-mix(in oklch, var(--warning) ${Math.round(t * 100)}%, var(--danger) ${Math.round((1 - t) * 100)}%)`;
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

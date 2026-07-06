import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { runInsight, type IndicatorTrend } from "@/lib/agents";
import { PageHeader, StatTile } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendLine, RankBar } from "@/components/charts";
import { AgentTag } from "@/components/badges";
import { fmtNum } from "@/lib/format";
import { Sparkles, Info } from "lucide-react";

export default async function DashboardPage() {
  await requireProfile();
  const supabase = await createClient();

  // --- national summaries (county-sourced) ---
  const { data: sums } = await supabase
    .from("national_summaries")
    .select("period_year, aggregated_value, source, indicator:indicators(slug, name, unit)")
    .eq("source", "county_submission");

  type Row = { period_year: number; aggregated_value: number; slug: string; name: string; unit: string };
  const rows: Row[] = (sums ?? []).map((s) => {
    const ind = one<{ slug: string; name: string; unit: string }>(s.indicator);
    return {
      period_year: s.period_year,
      aggregated_value: s.aggregated_value,
      slug: ind?.slug ?? "",
      name: ind?.name ?? "",
      unit: ind?.unit ?? "",
    };
  });

  const years = [...new Set(rows.map((r) => r.period_year))].sort();
  const latestYear = years[years.length - 1];
  const prevYear = years[years.length - 2];
  const bySlugYear = (slug: string, year: number) =>
    rows.find((r) => r.slug === slug && r.period_year === year);

  const trendSlugs = [
    "electricity_access_pct",
    "grid_connections",
    "clean_cooking_pct",
    "firewood_dependency_pct",
  ];
  const trends: IndicatorTrend[] = trendSlugs
    .map((slug) => {
      const cur = bySlugYear(slug, latestYear);
      const prev = bySlugYear(slug, prevYear);
      if (!cur) return null;
      return {
        slug,
        name: cur.name,
        unit: cur.unit,
        latest: cur.aggregated_value,
        previous: prev?.aggregated_value ?? null,
        isPercent: cur.unit === "%",
      };
    })
    .filter(Boolean) as IndicatorTrend[];

  const insight = runInsight({ periodYear: latestYear, countyCount: 47, trends }).data;

  // --- access-over-time line ---
  const accessLine = years.map((y) => ({
    label: String(y),
    value: bySlugYear("electricity_access_pct", y)?.aggregated_value ?? 0,
  }));

  // --- top counties by electricity access (latest year, per-county) ---
  const { data: countySubs } = await supabase
    .from("submissions")
    .select("id, submitter:submitters!inner(name, type)")
    .eq("submitter.type", "county")
    .eq("submission_type", "annual_report")
    .eq("period_year", latestYear);
  const nameById = new Map(
    (countySubs ?? []).map((s) => [s.id, one<{ name: string }>(s.submitter)?.name ?? "—"])
  );
  const { data: accessVals } = await supabase
    .from("submission_values")
    .select("submission_id, value, indicator:indicators!inner(slug)")
    .eq("indicator.slug", "electricity_access_pct")
    .in("submission_id", [...nameById.keys()].length ? [...nameById.keys()] : ["x"]);
  const ranked = (accessVals ?? [])
    .map((v) => ({ label: nameById.get(v.submission_id) ?? "—", value: Math.round((v.value ?? 0) * 10) / 10 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // --- EPRA-sourced context ---
  const { data: epra } = await supabase
    .from("national_summaries")
    .select("aggregated_value, period_year, indicator:indicators(name, unit)")
    .eq("source", "epra_national");

  const access = trends.find((t) => t.slug === "electricity_access_pct");
  const connections = trends.find((t) => t.slug === "grid_connections");
  const cooking = trends.find((t) => t.slug === "clean_cooking_pct");

  return (
    <>
      <PageHeader
        title="National dashboard"
        description={`Aggregated from approved county submissions for ${latestYear}.`}
      />

      {/* Insight summary */}
      <Card className="mb-6 border-brand/20 bg-brand-soft/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="font-medium">{insight.headline}</h2>
                <AgentTag>insight agent</AgentTag>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{insight.body}</p>
              {insight.highlights.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {insight.highlights.map((h, i) => (
                    <li key={i} className="text-xs rounded-full bg-card border border-border px-2.5 py-1">
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatTile label="Counties reporting" value="47" hint="all counties" accent="brand" />
        <StatTile
          label="Avg electricity access"
          value={access ? fmtNum(access.latest, 1) : "—"}
          unit="%"
          accent="provider"
          hint={`${latestYear}`}
        />
        <StatTile
          label="Households on grid"
          value={connections ? fmtNum(connections.latest) : "—"}
          accent="success"
          hint="national total"
        />
        <StatTile
          label="Clean cooking access"
          value={cooking ? fmtNum(cooking.latest, 1) : "—"}
          unit="%"
          accent="warning"
          hint="widest gap"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Electricity access over time</CardTitle>
            <p className="text-xs text-muted-foreground">National average, % of households</p>
          </CardHeader>
          <CardContent>
            <TrendLine data={accessLine} unit="%" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top counties — electricity access</CardTitle>
            <p className="text-xs text-muted-foreground">{latestYear}, % of households</p>
          </CardHeader>
          <CardContent>
            <RankBar data={ranked} unit="%" />
          </CardContent>
        </Card>
      </div>

      {/* EPRA source distinction */}
      {epra && epra.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="size-4 text-muted-foreground" /> National context (EPRA statistics)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              These figures come from EPRA&apos;s broader national statistics, not county
              submissions — shown separately so nothing is presented as county data when it isn&apos;t.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {epra.map((e, i) => {
              const ind = one<{ name: string; unit: string }>(e.indicator);
              return (
                <div key={i} className="rounded-lg border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">{ind?.name}</p>
                  <p className="text-lg font-medium tabular-nums">
                    {fmtNum(e.aggregated_value, 1)}{" "}
                    <span className="text-sm text-muted-foreground font-normal">{ind?.unit}</span>
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { MiniBars } from "@/components/charts";
import { PendingApprovalsCard } from "@/components/pending-approvals-card";
import { daysUntil, daysBetween } from "@/lib/format";
import { runNationalInsight, type NationalOverviewChip } from "@/lib/agents";
import { getPendingApprovalsFor } from "@/lib/pending-approvals";
import type { Profile } from "@/lib/auth";
import { one } from "@/lib/rel";
import { cn } from "@/lib/utils";
import { CountyStatusTable, type CountyRow } from "./county-status-table";
import {
  KanbanSquare, TriangleAlert, Download, ArrowRight, ArrowUpRight, Activity,
} from "lucide-react";

export async function NationalHome({ profile }: { profile: Profile }) {
  const supabase = await createClient();
  const first = profile.full_name.split(/\s+/)[0];
  const pendingApprovals = await getPendingApprovalsFor(profile);

  const [{ data: cycle }, { data: counties }, { data: providerSubmitters }] = await Promise.all([
    supabase.from("planning_cycles").select("name, plan_due_date").eq("status", "active").maybeSingle(),
    supabase.from("submitters").select("id, name, region").eq("type", "county").order("name"),
    supabase.from("submitters").select("id, type").in("type", ["national_provider", "private_sector"]),
  ]);

  const countyIds = (counties ?? []).map((c) => c.id);
  const periodYear = cycle?.plan_due_date ? new Date(cycle.plan_due_date).getFullYear() : new Date().getFullYear();
  const daysLeft = daysUntil(cycle?.plan_due_date);

  const [
    { data: planRows },
    { data: annualReports },
    { data: providerSubs },
    { count: pipelineInReview },
    { count: totalOpenFlags },
  ] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, submitter_id, status, period_year, created_at, submitted_at")
      .eq("submission_type", "full_plan")
      .in("submitter_id", countyIds)
      .order("period_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("submissions")
      .select("id, submitter_id, period_year")
      .eq("submission_type", "annual_report")
      .in("submitter_id", countyIds),
    supabase
      .from("submissions")
      .select("submitter_id, submitter:submitters(type)")
      .in("submitter_id", (providerSubmitters ?? []).map((p) => p.id))
      .eq("period_year", periodYear)
      .neq("status", "draft"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("status", "in_review"),
    supabase.from("validation_results").select("*", { count: "exact", head: true }).eq("status", "open"),
  ]);

  // latest full_plan per county (already ordered so the first hit per submitter wins)
  const planByCounty = new Map<string, { id: string; status: string; submittedAt: string | null }>();
  (planRows ?? []).forEach((p) => {
    if (!planByCounty.has(p.submitter_id)) {
      planByCounty.set(p.submitter_id, { id: p.id, status: p.status, submittedAt: p.submitted_at });
    }
  });
  const planIds = [...planByCounty.values()].map((p) => p.id);

  // open flags on each county's live plan
  const { data: openFlagRows } = planIds.length
    ? await supabase.from("validation_results").select("submission_id, severity").in("submission_id", planIds).eq("status", "open")
    : { data: [] as { submission_id: string; severity: string }[] };
  const flagsByPlan = new Map<string, { error: number; warning: number }>();
  (openFlagRows ?? []).forEach((f) => {
    const cur = flagsByPlan.get(f.submission_id) ?? { error: 0, warning: 0 };
    if (f.severity === "error") cur.error++;
    else cur.warning++;
    flagsByPlan.set(f.submission_id, cur);
  });

  // real per-county trend: a composite of three real indicators (not just one),
  // so each county's own mix of ups and downs actually shows — a single
  // indicator shares the same rising-with-noise shape for every county, which
  // reads as "the same sparkline" even though the magnitudes differ.
  const TREND_SLUGS = ["electricity_access_pct", "clean_cooking_pct", "firewood_dependency_pct"];
  const { data: trendIndicators } = await supabase.from("indicators").select("id, slug").in("slug", TREND_SLUGS);
  const trendIndicatorIds = (trendIndicators ?? []).map((i) => i.id);
  const slugByIndicatorId = new Map((trendIndicators ?? []).map((i) => [i.id, i.slug]));
  const reportIds = (annualReports ?? []).map((r) => r.id);
  const { data: trendValues } = trendIndicatorIds.length && reportIds.length
    ? await supabase
        .from("submission_values")
        .select("submission_id, indicator_id, value")
        .in("indicator_id", trendIndicatorIds)
        .in("submission_id", reportIds)
    : { data: [] as { submission_id: string; indicator_id: string; value: number | null }[] };

  const valuesByReport = new Map<string, Record<string, number>>();
  (trendValues ?? []).forEach((v) => {
    if (v.value == null) return;
    const slug = slugByIndicatorId.get(v.indicator_id);
    if (!slug) return;
    const rec = valuesByReport.get(v.submission_id) ?? {};
    rec[slug] = v.value;
    valuesByReport.set(v.submission_id, rec);
  });

  const reportsByCounty = new Map<string, { year: number; composite: number }[]>();
  (annualReports ?? []).forEach((r) => {
    const rec = valuesByReport.get(r.id);
    if (!rec) return;
    const parts: number[] = [];
    if (rec.electricity_access_pct != null) parts.push(rec.electricity_access_pct);
    if (rec.clean_cooking_pct != null) parts.push(rec.clean_cooking_pct);
    if (rec.firewood_dependency_pct != null) parts.push(100 - rec.firewood_dependency_pct); // lower is better
    if (!parts.length) return;
    const composite = parts.reduce((a, b) => a + b, 0) / parts.length;
    const list = reportsByCounty.get(r.submitter_id) ?? [];
    list.push({ year: r.period_year, composite });
    reportsByCounty.set(r.submitter_id, list);
  });

  const COMPLETE = new Set(["approved", "published"]);
  const rows: CountyRow[] = (counties ?? []).map((c) => {
    const plan = planByCounty.get(c.id);
    const status = plan?.status ?? "draft";
    const complete = COMPLETE.has(status);
    // "Returned" plans are the real, deliberate minority of overdue counties;
    // the shared deadline only adds to that if it has genuinely passed.
    const overdue = !complete && (status === "returned" || (daysLeft != null && daysLeft < 0));
    const flags = plan ? flagsByPlan.get(plan.id) : undefined;
    const flaggedCount = (flags?.error ?? 0) + (flags?.warning ?? 0);
    const trend = (reportsByCounty.get(c.id) ?? [])
      .sort((a, b) => a.year - b.year)
      .map((r) => r.composite);
    // How many days before (positive) or after (negative) the shared deadline
    // this county actually submitted — null until they have.
    const earlyLateDays =
      plan?.submittedAt && cycle?.plan_due_date ? daysBetween(plan.submittedAt, cycle.plan_due_date) : null;
    return {
      id: c.id,
      name: c.name,
      region: c.region ?? "",
      status,
      overdue,
      earlyLateDays,
      flaggedCount,
      trend,
      viewHref: plan ? `/submissions/${plan.id}` : null,
    };
  });

  const countiesSubmitted = rows.filter((r) => COMPLETE.has(r.status)).length;
  const overdueRows = rows.filter((r) => r.overdue);
  const overdueCount = overdueRows.length;
  const flaggedCounties = rows.filter((r) => r.flaggedCount > 0).length;
  const submittedPct = counties?.length ? (countiesSubmitted / counties.length) * 100 : 0;

  // real breakdown of overdue counties by region — not a fabricated time series
  const overdueByRegion = new Map<string, number>();
  overdueRows.forEach((r) => overdueByRegion.set(r.region, (overdueByRegion.get(r.region) ?? 0) + 1));
  const overdueRegionBars = [...overdueByRegion.values()].slice(0, 6);

  const totalErrorFlags = [...flagsByPlan.values()].reduce((a, b) => a + b.error, 0);
  const totalWarningFlags = [...flagsByPlan.values()].reduce((a, b) => a + b.warning, 0);

  const providersReporting = new Set(
    (providerSubs ?? []).filter((s) => one<{ type: string }>(s.submitter)?.type === "national_provider").map((s) => s.submitter_id)
  ).size;
  const privateReporting = new Set(
    (providerSubs ?? []).filter((s) => one<{ type: string }>(s.submitter)?.type === "private_sector").map((s) => s.submitter_id)
  ).size;
  const providerTotal = (providerSubmitters ?? []).length;
  const providersAndPrivateReporting = providersReporting + privateReporting;

  const insight = runNationalInsight({
    periodLabel: `${periodYear}`,
    countiesSubmitted,
    countiesTotal: counties?.length ?? 0,
    overdueCount,
    flaggedCount: flaggedCounties,
  }).data;

  return (
    <>
      <p className="text-sm text-muted-foreground">Welcome back, {first}.</p>
      <div className="flex items-center gap-3 mt-1 mb-6 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">National overview</h1>
        <span className="rounded-full bg-brand-soft text-brand px-2.5 py-1 text-xs font-medium">
          {periodYear} reporting period
        </span>
        {daysLeft != null && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              daysLeft < 0 ? "bg-danger-soft text-danger" : daysLeft < 7 ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"
            )}
          >
            {daysLeft < 0 ? `Overdue by ${Math.abs(daysLeft)} days` : `${daysLeft} days left until this deadline`}
          </span>
        )}
      </div>

      {/* Hero stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 gap-3 overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground">Counties submitted</p>
          <p className="text-2xl font-medium tabular-nums">
            {countiesSubmitted} <span className="text-base text-muted-foreground">/ {counties?.length ?? 0}</span>
          </p>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand to-success transition-all"
              style={{ width: `${submittedPct}%` }}
            />
          </div>
        </Card>

        <Card className="p-5 gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Overdue</p>
            {overdueRegionBars.length > 1 && <MiniBars values={overdueRegionBars} tone="danger" />}
          </div>
          <p className={cn("text-2xl font-medium tabular-nums", overdueCount > 0 ? "text-danger" : "text-foreground")}>
            {overdueCount}
          </p>
          <p className="text-xs text-muted-foreground">
            {overdueCount > 0 ? "sent back or past deadline" : "nothing overdue"}
          </p>
        </Card>

        <Card className="p-5 gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Flagged for review</p>
            {(totalErrorFlags > 0 || totalWarningFlags > 0) && (
              <MiniBars values={[totalErrorFlags, totalWarningFlags]} tones={["danger", "warning"]} />
            )}
          </div>
          <p className={cn("text-2xl font-medium tabular-nums", flaggedCounties > 0 ? "text-warning" : "text-foreground")}>
            {flaggedCounties}
          </p>
          <p className="text-xs text-muted-foreground">{flaggedCounties > 0 ? "counties with open flags" : "no open flags"}</p>
        </Card>

        <Card className="p-5 gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Providers &amp; private sector</p>
            {(providersReporting > 0 || privateReporting > 0) && (
              <MiniBars values={[providersReporting, privateReporting]} tones={["brand", "agent"]} />
            )}
          </div>
          <p className="text-2xl font-medium tabular-nums">
            {providersAndPrivateReporting} <span className="text-base text-muted-foreground">/ {providerTotal}</span>
          </p>
          <p className="text-xs text-muted-foreground">reporting this cycle</p>
        </Card>
      </div>

      {/* Insight banner */}
      <Card className="mt-4 border-brand/15 bg-linear-to-br from-brand/10 via-success/5 to-transparent overflow-hidden">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
              <Activity className="size-4" />
            </div>
            <p className="text-sm leading-relaxed pt-1.5">
              {insight.parts.map((p, i) =>
                typeof p === "string" ? (
                  <span key={i}>{p}</span>
                ) : (
                  <span
                    key={i}
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mx-0.5",
                      chipClasses((p as NationalOverviewChip).tone)
                    )}
                  >
                    {(p as NationalOverviewChip).label}
                  </span>
                )
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pending approvals */}
      <div className="mt-4">
        <PendingApprovalsCard approvals={pendingApprovals} />
      </div>

      {/* County status table */}
      <div className="mt-6">
        <CountyStatusTable rows={rows} />
      </div>

      {/* Bottom strip */}
      <div className="grid gap-4 sm:grid-cols-3 mt-6">
        <Link href="/pipeline">
          <Card className="p-4 flex-row items-center gap-3 hover:shadow-elevated transition-shadow">
            <div className="size-9 rounded-lg bg-provider-soft text-provider grid place-items-center shrink-0">
              <KanbanSquare className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Plan pipeline board</p>
              <p className="text-xs text-muted-foreground">{pipelineInReview ?? 0} waiting on approval</p>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
          </Card>
        </Link>

        <Link href="/anomalies">
          <Card className="p-4 flex-row items-center gap-3 hover:shadow-elevated transition-shadow">
            <div className="size-9 rounded-lg bg-warning-soft text-warning grid place-items-center shrink-0">
              <TriangleAlert className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Flagged submissions</p>
              <p className="text-xs text-muted-foreground">{totalOpenFlags ?? 0} open anomalies</p>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
          </Card>
        </Link>

        <Link href="/export">
          <Card className="p-4 flex-row items-center gap-3 hover:shadow-elevated transition-shadow">
            <div className="size-9 rounded-lg bg-agent-soft text-agent grid place-items-center shrink-0">
              <Download className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Export</p>
              <p className="text-xs text-muted-foreground">Download the national dataset</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground shrink-0" />
          </Card>
        </Link>
      </div>
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

import Link from "next/link";
import { requireProfile, isNational } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MiniBars } from "@/components/charts";
import { StatusBadge } from "@/components/badges";
import { fmtDate, daysUntil, daysBetween } from "@/lib/format";
import { one } from "@/lib/rel";
import { runCountyInsight, type IndicatorTrend } from "@/lib/agents";
import { getPendingApprovalsFor } from "@/lib/pending-approvals";
import { PendingApprovalsCard } from "@/components/pending-approvals-card";
import {
  FilePlus2,
  ArrowRight,
  FileText,
  Clock,
  AlertTriangle,
  ListChecks,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NationalHome } from "./national-home";

export default async function HomePage() {
  const profile = await requireProfile();
  return isNational(profile.role) ? (
    <NationalHome profile={profile} />
  ) : (
    <CountyHome profile={profile} />
  );
}

/* ----------------------------- County officer ----------------------------- */

const STATUS_TONE = {
  not_started: { label: "Not started", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  in_progress: { label: "In progress", pill: "bg-provider-soft text-provider", dot: "bg-provider" },
  complete: { label: "Complete", pill: "bg-success-soft text-success", dot: "bg-success" },
} as const;

type ActivityItem = {
  id: string;
  label: string;
  date: string;
  dot: string;
};

async function CountyHome({
  profile,
}: {
  profile: Awaited<ReturnType<typeof requireProfile>>;
}) {
  const supabase = await createClient();
  const submitterId = profile.submitter?.id;
  const pendingApprovals = await getPendingApprovalsFor(profile);
  const KEY = ["electricity_access_pct", "grid_connections", "clean_cooking_pct"];

  // last two annual reports for this county, for trend + insight
  const { data: reports } = await supabase
    .from("submissions")
    .select("id, period_year")
    .eq("submission_type", "annual_report")
    .eq("submitter_id", submitterId ?? "")
    .order("period_year", { ascending: false })
    .limit(2);

  const reportIds = (reports ?? []).map((r) => r.id);
  const { data: values } = await supabase
    .from("submission_values")
    .select("submission_id, value, indicator:indicators(slug, name, unit)")
    .in("submission_id", reportIds.length ? reportIds : ["00000000-0000-0000-0000-000000000000"]);

  const latestId = reports?.[0]?.id;
  const prevId = reports?.[1]?.id;
  const pick = (sid: string | undefined, slug: string) =>
    (values ?? []).find(
      (v) => v.submission_id === sid && one<{ slug: string }>(v.indicator)?.slug === slug
    );

  const trends: IndicatorTrend[] = KEY.map((slug) => {
    const cur = pick(latestId, slug);
    const prev = pick(prevId, slug);
    const ind = one<{ name: string; unit: string }>(cur?.indicator);
    return {
      slug,
      name: ind?.name ?? slug,
      unit: ind?.unit ?? "",
      latest: (cur?.value as number) ?? 0,
      previous: (prev?.value as number | undefined) ?? null,
      isPercent: (ind?.unit ?? "") === "%",
    };
  }).filter((t) => pick(latestId, t.slug));

  // this county's live full plan — the one record every other card below ties back to
  const { data: plan } = await supabase
    .from("submissions")
    .select(
      "id, title, status, period_year, submitted_at, updated_at, planning_cycle_id, current_stage:workflow_stages(name, sort_order)"
    )
    .eq("submission_type", "full_plan")
    .eq("submitter_id", submitterId ?? "")
    .order("period_year", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const first = profile.full_name.split(/\s+/)[0];
  const statusKey: keyof typeof STATUS_TONE = !plan
    ? "not_started"
    : plan.status === "approved" || plan.status === "published"
      ? "complete"
      : "in_progress";
  const status = STATUS_TONE[statusKey];

  // the planning cycle that actually governs this plan (falls back to whichever is active
  // if there's no plan yet) — so the deadline shown always matches the plan shown.
  const { data: cycle } = plan?.planning_cycle_id
    ? await supabase
        .from("planning_cycles")
        .select("name, triggered_at, plan_due_date")
        .eq("id", plan.planning_cycle_id)
        .maybeSingle()
    : await supabase
        .from("planning_cycles")
        .select("name, triggered_at, plan_due_date")
        .eq("status", "active")
        .maybeSingle();

  const periodYear = plan?.period_year ?? (cycle?.plan_due_date ? new Date(cycle.plan_due_date).getFullYear() : null);

  const daysLeft = daysUntil(cycle?.plan_due_date);
  const windowTotalDays = daysBetween(cycle?.triggered_at, cycle?.plan_due_date);
  const daysElapsed = daysLeft != null && windowTotalDays != null ? windowTotalDays - daysLeft : null;
  const daysEarly = daysBetween(plan?.submitted_at, cycle?.plan_due_date);
  const daysToSubmit = daysBetween(cycle?.triggered_at, plan?.submitted_at);

  const { count: totalStages } = await supabase
    .from("workflow_stages")
    .select("*", { count: "exact", head: true })
    .eq("submitter_type", "county");

  // fields completed on the live plan vs total indicators expected
  const { count: totalFields } = await supabase
    .from("indicators")
    .select("*", { count: "exact", head: true });
  const { count: completedFields } = plan
    ? await supabase
        .from("submission_values")
        .select("*", { count: "exact", head: true })
        .eq("submission_id", plan.id)
    : { count: 0 };

  // completion trend across this county's real reporting history, oldest to newest
  const { data: historySubs } = await supabase
    .from("submissions")
    .select("id, period_year")
    .eq("submitter_id", submitterId ?? "")
    .in("submission_type", ["annual_report", "full_plan"])
    .order("period_year", { ascending: true })
    .limit(5);
  const historyIds = (historySubs ?? []).map((h) => h.id);
  const { data: historyValueRows } = await supabase
    .from("submission_values")
    .select("submission_id")
    .in("submission_id", historyIds.length ? historyIds : ["00000000-0000-0000-0000-000000000000"]);
  const historyCounts = new Map<string, number>();
  (historyValueRows ?? []).forEach((v) =>
    historyCounts.set(v.submission_id, (historyCounts.get(v.submission_id) ?? 0) + 1)
  );
  const fieldsTrend = (historySubs ?? []).map((h) => historyCounts.get(h.id) ?? 0);

  // open validation flags and recent activity — all scoped to this same plan record
  const { data: flagRows } = plan
    ? await supabase
        .from("validation_results")
        .select("id, message, severity, status, created_at")
        .eq("submission_id", plan.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const openFlagRows = (flagRows ?? []).filter((f) => f.status === "open");
  const errorCount = openFlagRows.filter((f) => f.severity === "error").length;
  const warningCount = openFlagRows.filter((f) => f.severity === "warning").length;
  const openFlags = openFlagRows.length;

  const insight = runCountyInsight({ trends, openFlags }).data;

  const { data: stageMoves } = plan
    ? await supabase
        .from("submission_stage_history")
        .select("id, action, acted_at, stage:workflow_stages(name)")
        .eq("submission_id", plan.id)
        .order("acted_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const ACTION_LABEL: Record<string, { verb: string; dot: string }> = {
    submitted: { verb: "Submitted", dot: "bg-brand" },
    approved: { verb: "Approved", dot: "bg-success" },
    sent_back: { verb: "Returned", dot: "bg-danger" },
    rejected: { verb: "Rejected", dot: "bg-danger" },
  };

  const activity: ActivityItem[] = [
    ...(stageMoves ?? []).map((m) => {
      const stageName = one<{ name: string }>(m.stage)?.name;
      const meta = ACTION_LABEL[m.action] ?? { verb: m.action, dot: "bg-muted-foreground" };
      return {
        id: `stage-${m.id}`,
        label: `${meta.verb}${stageName ? ` (${stageName})` : ""}: ${plan?.title}`,
        date: m.acted_at,
        dot: meta.dot,
      };
    }),
    ...(flagRows ?? []).slice(0, 5).map((f) => ({
      id: `flag-${f.id}`,
      label: `Flagged: ${plan?.title} — ${f.message}`,
      date: f.created_at,
      dot: f.severity === "error" ? "bg-danger" : "bg-warning",
    })),
    ...(plan?.status === "draft"
      ? [{ id: `edit-${plan.id}`, label: `Updated: ${plan.title}`, date: plan.updated_at, dot: "bg-provider" }]
      : []),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  const currentStageOrder = one<{ sort_order: number }>(plan?.current_stage)?.sort_order ?? 0;
  const stageSteps = Array.from({ length: totalStages ?? 0 }, (_, i) => i <= currentStageOrder);

  const fieldsTotal = totalFields ?? 0;
  const fieldsDone = completedFields ?? 0;

  const hasDraft = !!plan && statusKey !== "complete";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">Welcome back, {first}</p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {profile.submitter?.name ?? "Your county"}
            </h1>
            {periodYear && (
              <span className="rounded-full bg-brand-soft text-brand px-2.5 py-1 text-xs font-medium">
                {periodYear} reporting period
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" render={<Link href="/submissions/new" />}>
          <FilePlus2 className="size-4" /> New submission
        </Button>
      </div>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="size-4" />
              <p className="text-xs font-medium">Submission status</p>
            </div>
          </div>
          <span className={cn("w-fit rounded-full px-2.5 py-1 text-xs font-medium", status.pill)}>
            {status.label}
          </span>
          <div className="flex items-center gap-1 pt-1">
            {stageSteps.length > 0 ? (
              stageSteps.map((reached, i) => (
                <span
                  key={i}
                  className={cn("h-1.5 flex-1 rounded-full", reached ? status.dot : "bg-muted")}
                />
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No active plan this cycle</p>
            )}
          </div>
        </Card>

        <Card className="p-5 gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4" />
              <p className="text-xs font-medium">Days left to submit</p>
            </div>
            {statusKey === "complete"
              ? daysEarly != null && (
                  <MiniBars
                    values={[Math.max(daysToSubmit ?? 0, 0), Math.max(Math.abs(daysEarly), 1)]}
                    tones={["muted", daysEarly >= 0 ? "success" : "danger"]}
                  />
                )
              : daysElapsed != null &&
                daysLeft != null && (
                  <MiniBars
                    values={[Math.max(daysElapsed, 0), Math.max(daysLeft, 1)]}
                    tones={["muted", daysLeft < 0 ? "danger" : daysLeft < 7 ? "warning" : "brand"]}
                  />
                )}
          </div>
          {statusKey === "complete" ? (
            <>
              <span className="text-2xl font-medium text-success">Submitted</span>
              <p className="text-xs text-muted-foreground">
                {daysEarly == null
                  ? "No deadline on file for this cycle"
                  : daysEarly >= 0
                    ? `${daysEarly} day${daysEarly === 1 ? "" : "s"} before the deadline`
                    : `${Math.abs(daysEarly)} day${Math.abs(daysEarly) === 1 ? "" : "s"} after the deadline`}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "text-2xl font-medium tabular-nums",
                    daysLeft != null && daysLeft < 7 ? "text-warning" : "text-foreground",
                    daysLeft != null && daysLeft < 0 && "text-danger"
                  )}
                >
                  {daysLeft != null && daysLeft < 0 ? "Overdue" : (daysLeft ?? "—")}
                </span>
                {daysLeft != null && (
                  <span className="text-sm text-muted-foreground">
                    {daysLeft < 0 ? `by ${Math.abs(daysLeft)} days` : "days"}
                  </span>
                )}
              </div>
              {daysLeft == null && <p className="text-xs text-muted-foreground">No active cycle deadline</p>}
            </>
          )}
        </Card>

        <Card className="p-5 gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="size-4" />
              <p className="text-xs font-medium">Open warnings</p>
            </div>
            {openFlags > 0 && (
              <MiniBars values={[errorCount, warningCount]} tones={["danger", "warning"]} />
            )}
          </div>
          <span className={cn("text-2xl font-medium tabular-nums", openFlags > 0 ? "text-danger" : "text-foreground")}>
            {openFlags}
          </span>
          <p className="text-xs text-muted-foreground">
            {openFlags > 0 ? `${openFlags} need review` : "Nothing open right now"}
          </p>
        </Card>

        <Card className="p-5 gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ListChecks className="size-4" />
              <p className="text-xs font-medium">Fields completed</p>
            </div>
            {fieldsTrend.length > 1 && <MiniBars values={fieldsTrend} tone="brand" />}
          </div>
          <span className="text-2xl font-medium tabular-nums">
            {fieldsDone} / {fieldsTotal}
          </span>
          <p className="text-xs text-muted-foreground">across this county&apos;s reporting history</p>
        </Card>
      </div>

      {/* Insight strip */}
      <Card className="mt-4 border-brand/15 bg-brand-soft/30">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
              <Activity className="size-4" />
            </div>
            <p className="text-sm leading-relaxed pt-1.5">{insight.text}</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4">
        <PendingApprovalsCard approvals={pendingApprovals} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={cn("size-2 rounded-full shrink-0", a.dot)} />
                  <p className="text-sm truncate">{a.label}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(a.date)}</span>
              </div>
            ))}
            {!activity.length && (
              <p className="text-sm text-muted-foreground px-3 py-6">No activity yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current plan</CardTitle>
          </CardHeader>
          <CardContent>
            {plan ? (
              <Link href={`/submissions/${plan.id}`} className="block space-y-3">
                <p className="text-sm font-medium">{plan.title}</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={plan.status} />
                  {(() => {
                    const stageName = one<{ name: string }>(plan.current_stage)?.name;
                    const statusLabel = plan.status.replace("_", " ");
                    return stageName && stageName.toLowerCase() !== statusLabel.toLowerCase() ? (
                      <span className="text-xs text-muted-foreground">{stageName}</span>
                    ) : null;
                  })()}
                </div>
                <span className="text-sm text-brand inline-flex items-center gap-1">
                  View on pipeline <ArrowRight className="size-3.5" />
                </span>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No active plan this cycle.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end mt-6">
        <Button
          size="lg"
          className="bg-brand text-white hover:bg-brand/90 active:bg-brand"
          render={<Link href={hasDraft ? `/submissions/${plan!.id}` : "/submissions/new"} />}
        >
          {hasDraft ? "Continue submission" : "Start submission"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </>
  );
}


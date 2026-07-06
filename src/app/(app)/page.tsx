import Link from "next/link";
import { requireProfile, isNational } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatTile } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, SubmitterTypeBadge } from "@/components/badges";
import { fmtValue, pctChange, relativeTime } from "@/lib/format";
import { one } from "@/lib/rel";
import { FilePlus2, ArrowRight } from "lucide-react";

export default async function HomePage() {
  const profile = await requireProfile();
  return isNational(profile.role) ? (
    <NationalHome name={profile.full_name} />
  ) : (
    <CountyHome profile={profile} />
  );
}

/* ----------------------------- County officer ----------------------------- */
async function CountyHome({
  profile,
}: {
  profile: Awaited<ReturnType<typeof requireProfile>>;
}) {
  const supabase = await createClient();
  const KEY = ["electricity_access_pct", "grid_connections", "clean_cooking_pct"];

  // last two annual reports for trend
  const { data: reports } = await supabase
    .from("submissions")
    .select("id, period_year")
    .eq("submission_type", "annual_report")
    .order("period_year", { ascending: false })
    .limit(2);

  const ids = (reports ?? []).map((r) => r.id);
  const { data: values } = await supabase
    .from("submission_values")
    .select("submission_id, value, indicator:indicators(slug, name, unit)")
    .in("submission_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const latestId = reports?.[0]?.id;
  const prevId = reports?.[1]?.id;
  const pick = (sid: string | undefined, slug: string) =>
    (values ?? []).find(
      (v) => v.submission_id === sid && one<{ slug: string }>(v.indicator)?.slug === slug
    );

  const tiles = KEY.map((slug) => {
    const cur = pick(latestId, slug);
    const prev = pick(prevId, slug);
    const ind = one<{ name: string; unit: string }>(cur?.indicator);
    const value = cur?.value as number | undefined;
    const prevVal = (prev?.value as number | undefined) ?? null;
    return {
      slug,
      label: ind?.name ?? slug,
      unit: ind?.unit ?? "",
      value: value ?? null,
      delta: value != null ? pctChange(value, prevVal) : null,
    };
  });

  // live plan on the board
  const { data: plan } = await supabase
    .from("submissions")
    .select("id, title, status, current_stage:workflow_stages(name)")
    .eq("submission_type", "full_plan")
    .order("period_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  // open flags
  const { count: flags } = await supabase
    .from("validation_results")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  // recent submissions
  const { data: recent } = await supabase
    .from("submissions")
    .select("id, title, status, submission_type, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  const first = profile.full_name.split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title={`Welcome, ${first}`}
        description={`${profile.submitter?.name ?? "Your county"} energy snapshot and current plan status.`}
      >
        <Button render={<Link href="/submissions/new" />}>
          <FilePlus2 className="size-4" /> New submission
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatTile
            key={t.slug}
            label={t.label}
            value={t.value != null ? fmtValue(t.value, t.unit).replace("%", "") : "—"}
            unit={t.unit === "%" ? "%" : t.unit}
            delta={t.delta != null ? { value: t.delta, good: t.delta >= 0 } : undefined}
            hint="vs last year"
          />
        ))}
        <StatTile
          label="Open data flags"
          value={flags ?? 0}
          hint="need a look"
          accent={flags ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(recent ?? []).map((r) => (
              <Link
                key={r.id}
                href={`/submissions/${r.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {relativeTime(r.updated_at)}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
            {!recent?.length && (
              <p className="text-sm text-muted-foreground px-3 py-6">No submissions yet.</p>
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
                  <span className="text-xs text-muted-foreground">
                    {one<{ name: string }>(plan.current_stage)?.name}
                  </span>
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
    </>
  );
}

/* ----------------------------- National planner ---------------------------- */
async function NationalHome({ name }: { name: string }) {
  const supabase = await createClient();

  const counts = await Promise.all([
    supabase.from("submitters").select("*", { count: "exact", head: true }).eq("type", "county"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("status", "in_review"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("status", "returned"),
  ]);
  const [counties, inReview, published, returned] = counts.map((c) => c.count ?? 0);

  const { data: recent } = await supabase
    .from("submissions")
    .select("id, title, status, updated_at, submitter:submitters(type)")
    .order("updated_at", { ascending: false })
    .limit(6);

  const first = name.split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title={`Welcome, ${first}`}
        description="The national picture across counties, providers, and private-sector reporters."
      >
        <Button variant="outline" render={<Link href="/dashboard">Open dashboard</Link>} />
        <Button render={<Link href="/pipeline">Pipeline board</Link>} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Counties reporting" value={counties} hint="of 47" accent="brand" />
        <StatTile label="Plans in review" value={inReview} hint="on the board" accent="warning" />
        <StatTile label="Published" value={published} hint="this cycle" accent="success" />
        <StatTile
          label="Returned for changes"
          value={returned}
          hint="awaiting resubmission"
          accent={returned ? "danger" : "success"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {(recent ?? []).map((r) => (
            <Link
              key={r.id}
              href={`/submissions/${r.id}`}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <SubmitterTypeBadge type={one<{ type: string }>(r.submitter)?.type ?? "county"} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground">Updated {relativeTime(r.updated_at)}</p>
                </div>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

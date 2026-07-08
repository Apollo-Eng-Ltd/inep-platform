import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTemplateRows } from "@/lib/submission-template";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startOrContinueSubmission } from "./actions";
import { TemplatePreviewDialog } from "./template-preview-dialog";
import { UploadZone } from "./upload-zone";
import { ClipboardEdit, FileSpreadsheet, Download } from "lucide-react";

const SECTOR_TONE = {
  not_started: { label: "Not started", pill: "bg-muted text-muted-foreground" },
  in_progress: { label: "In progress", pill: "bg-provider-soft text-provider" },
  complete: { label: "Complete", pill: "bg-success-soft text-success" },
} as const;

export default async function NewSubmissionPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const submitterId = profile.submitter?.id;

  const { data: plan } = await supabase
    .from("submissions")
    .select("id, status, period_year, planning_cycle_id")
    .eq("submission_type", "full_plan")
    .eq("submitter_id", submitterId ?? "")
    .order("period_year", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasDraft = !!plan && plan.status !== "approved" && plan.status !== "published";

  const { data: cycle } = plan?.planning_cycle_id
    ? await supabase
        .from("planning_cycles")
        .select("plan_due_date")
        .eq("id", plan.planning_cycle_id)
        .maybeSingle()
    : await supabase.from("planning_cycles").select("plan_due_date").eq("status", "active").maybeSingle();

  const periodYear =
    plan?.period_year ?? (cycle?.plan_due_date ? new Date(cycle.plan_due_date).getFullYear() : null);

  // sector checklist — real progress against the same plan referenced above
  const { data: sectors } = await supabase.from("sectors").select("id, name, sort_order").order("sort_order");
  const { data: indicators } = await supabase.from("indicators").select("id, sector_id");

  const doneIndicatorIds = new Set<string>();
  if (hasDraft && plan) {
    const { data: values } = await supabase
      .from("submission_values")
      .select("indicator_id, value")
      .eq("submission_id", plan.id);
    (values ?? []).forEach((v) => {
      if (v.value != null) doneIndicatorIds.add(v.indicator_id);
    });
  }

  const sectorProgress = (sectors ?? []).map((s) => {
    const inds = (indicators ?? []).filter((i) => i.sector_id === s.id);
    const done = inds.filter((i) => doneIndicatorIds.has(i.id)).length;
    const total = inds.length;
    const key: keyof typeof SECTOR_TONE =
      done === 0 ? "not_started" : done === total && total > 0 ? "complete" : "in_progress";
    return { id: s.id, name: s.name, done, total, key };
  });

  const templateRows = await getTemplateRows(submitterId);
  const actionWord = hasDraft ? "Continue" : "Start";

  return (
    <>
      <div className="space-y-1.5">
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
        <p className="text-sm text-muted-foreground">
          Choose how you&apos;d like to submit your data for this period.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6 items-stretch">
        {/* Form path */}
        <Card className="h-full flex flex-col">
          <CardContent className="flex flex-col flex-1 gap-4 pt-6">
            <div className="size-10 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <ClipboardEdit className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-medium">Fill in the form</h2>
              <p className="text-sm text-muted-foreground">Enter your data directly, section by section.</p>
            </div>
            <div className="flex-1" />
            <form action={startOrContinueSubmission}>
              <Button type="submit" variant="outline" className="w-full">
                {actionWord} with the form
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Excel path */}
        <Card className="h-full flex flex-col">
          <CardContent className="flex flex-col flex-1 gap-4 pt-6">
            <div className="size-10 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-medium">Use Excel instead</h2>
              <p className="text-sm text-muted-foreground">
                Download our template, fill it in, and upload it back.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" render={<a href="/api/submissions/template" download />}>
                <Download className="size-3.5" /> Download template
              </Button>
              <TemplatePreviewDialog rows={templateRows} />
            </div>

            <div className="flex-1" />
            <UploadZone />
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Either way, we check your data the same way before it&apos;s submitted.
      </p>

      {/* Sector checklist */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">What&apos;s left</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {sectorProgress.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <p className="text-sm">{s.name}</p>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {s.done}/{s.total}
                </span>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", SECTOR_TONE[s.key].pill)}>
                {SECTOR_TONE[s.key].label}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

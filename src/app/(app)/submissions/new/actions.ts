"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";

/** Finds this county's live plan, or creates the draft if none is in progress. */
async function ensureDraftPlan(): Promise<string> {
  const profile = await requireProfile();
  const submitterId = profile.submitter?.id;
  if (!submitterId) throw new Error("No county is linked to this account.");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("submissions")
    .select("id, status")
    .eq("submission_type", "full_plan")
    .eq("submitter_id", submitterId)
    .order("period_year", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.status !== "approved" && existing.status !== "published") {
    return existing.id;
  }

  const [{ data: cycle }, { data: stage }, { data: template }] = await Promise.all([
    supabase.from("planning_cycles").select("id, plan_due_date").eq("status", "active").maybeSingle(),
    supabase
      .from("workflow_stages")
      .select("id")
      .eq("submitter_type", "county")
      .eq("stage_key", "draft")
      .maybeSingle(),
    supabase.from("templates").select("id").eq("submission_type", "full_plan").limit(1).maybeSingle(),
  ]);

  const periodYear = cycle?.plan_due_date
    ? new Date(cycle.plan_due_date).getFullYear()
    : new Date().getFullYear();

  const { data: created, error } = await supabase
    .from("submissions")
    .insert({
      submitter_id: submitterId,
      planning_cycle_id: cycle?.id ?? null,
      template_id: template?.id ?? null,
      submission_type: "full_plan",
      title: `${profile.submitter?.name ?? "County"} Energy Plan ${periodYear}`,
      period_year: periodYear,
      status: "draft",
      current_stage_id: stage?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Could not start a new submission.");
  return created.id;
}

/** "Start with the form" / "Continue with the form" — goes straight to the draft. */
export async function startOrContinueSubmission() {
  const id = await ensureDraftPlan();
  revalidatePath("/submissions/new");
  redirect(`/submissions/${id}`);
}

/** Parses an uploaded template (.csv) and writes matched rows onto the draft. */
export async function uploadTemplate(
  formData: FormData
): Promise<{ ok?: true; count?: number; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { error: "That doesn't look like the template — upload the .csv file." };
  }

  const supabase = await createClient();
  const [{ data: indicators }, submissionId] = await Promise.all([
    supabase.from("indicators").select("id, name, unit, sector:sectors(name)"),
    ensureDraftPlan(),
  ]);

  const byKey = new Map(
    (indicators ?? []).map((i) => {
      const sector = one<{ name: string }>(i.sector);
      return [`${sector?.name ?? ""}::${i.name}`.toLowerCase().trim(), i];
    })
  );

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const dataLines = lines.slice(1); // skip header row

  const upserts: { submission_id: string; indicator_id: string; value: number; unit: string }[] = [];
  for (const line of dataLines) {
    const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    const [sector, indicatorName, thisYear] = cols;
    const ind = byKey.get(`${sector}::${indicatorName}`.toLowerCase().trim());
    if (!ind || !thisYear) continue;
    const value = Number(thisYear);
    if (Number.isNaN(value)) continue;
    upserts.push({ submission_id: submissionId, indicator_id: ind.id, value, unit: ind.unit });
  }

  if (upserts.length) {
    const { error } = await supabase
      .from("submission_values")
      .upsert(upserts, { onConflict: "submission_id,indicator_id" });
    if (error) return { error: error.message };
  }

  revalidatePath("/submissions/new");
  revalidatePath(`/submissions/${submissionId}`);
  return { ok: true, count: upserts.length };
}

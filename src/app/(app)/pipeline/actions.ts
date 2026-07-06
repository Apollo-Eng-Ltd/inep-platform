"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isNational } from "@/lib/auth";

/** Move a plan forward one stage (or publish if the next stage is terminal). */
export async function advanceStage(submissionId: string) {
  return move(submissionId, "advance");
}

/** Send a plan back one stage with a comment. */
export async function returnStage(formData: FormData) {
  const submissionId = String(formData.get("submissionId"));
  const comment = String(formData.get("comment") ?? "").trim();
  return move(submissionId, "return", comment);
}

async function move(submissionId: string, dir: "advance" | "return", comment?: string) {
  const profile = await getProfile();
  if (!profile || !isNational(profile.role)) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, submitter:submitters(type), current_stage:workflow_stages(sort_order)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return { error: "Submission not found." };

  const submitterType = (Array.isArray(sub.submitter) ? sub.submitter[0] : sub.submitter)?.type;
  const currentOrder =
    (Array.isArray(sub.current_stage) ? sub.current_stage[0] : sub.current_stage)?.sort_order ?? 0;

  const { data: stages } = await supabase
    .from("workflow_stages")
    .select("id, name, sort_order, is_terminal")
    .eq("submitter_type", submitterType)
    .order("sort_order");
  if (!stages?.length) return { error: "No workflow found." };

  const targetOrder = dir === "advance" ? currentOrder + 1 : Math.max(0, currentOrder - 1);
  const target = stages.find((s) => s.sort_order === targetOrder);
  if (!target) return { error: "No further stage." };

  const status = target.is_terminal ? "published" : dir === "return" ? "returned" : "in_review";

  await supabase
    .from("submissions")
    .update({ current_stage_id: target.id, status })
    .eq("id", submissionId);

  await supabase.from("submission_stage_history").insert({
    submission_id: submissionId,
    stage_id: target.id,
    action: dir === "advance" ? "approved" : "sent_back",
    actor_id: profile.id,
    comment: comment || null,
  });

  await supabase.from("audit_log").insert({
    actor_id: profile.id,
    action: dir === "advance" ? "advance_stage" : "return_stage",
    entity_type: "submission",
    entity_id: submissionId,
    detail: { to_stage: target.name },
  });

  revalidatePath("/pipeline");
  revalidatePath(`/submissions/${submissionId}`);
  return { ok: true };
}

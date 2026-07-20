"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

/**
 * Decide a pending `agent_actions` row — Approve, Edit-then-approve, or
 * Reject. This is the same underlying record the pipeline's approval inbox
 * would show; deciding it here writes to the exact same columns
 * (`status`, `decided_by`, `decided_at`) plus a real `audit_log` comment, so
 * there's exactly one record of the decision, not a duplicate.
 */
export async function decideAgentAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile) return { error: "Not authorized." };

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? ""); // "approved" | "rejected"
  const comment = String(formData.get("comment") ?? "").trim();
  const editedSummary = String(formData.get("editedSummary") ?? "").trim();
  if (!id || !["approved", "rejected"].includes(decision)) return { error: "Invalid decision." };
  if (!comment) return { error: "Add a short comment before confirming." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("agent_actions")
    .select("id, status, proposed_output, submission:submissions(submitter_id)")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Not found." };
  if (row.status !== "proposed") return { error: "This has already been decided." };

  const submission = Array.isArray(row.submission) ? row.submission[0] : row.submission;
  const scoped = profile.submitter_id != null;
  if (scoped && submission?.submitter_id !== profile.submitter_id) {
    return { error: "You're not authorized to decide this." };
  }

  const proposedOutput = editedSummary
    ? { ...(row.proposed_output as Record<string, unknown>), summary: editedSummary }
    : row.proposed_output;

  const { error: updateError } = await supabase
    .from("agent_actions")
    .update({ status: decision, decided_by: profile.id, decided_at: new Date().toISOString(), proposed_output: proposedOutput })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  await supabase.from("audit_log").insert({
    actor_id: profile.id,
    action: decision === "approved" ? "agent_action_approved" : "agent_action_rejected",
    entity_type: "agent_action",
    entity_id: id,
    detail: { comment, edited: !!editedSummary },
  });

  revalidatePath("/agent-pipeline");
  return { ok: true };
}

/**
 * Decide a pending `validation_results` row (an open validation/anomaly/
 * compliance flag) — Approve (resolve, the finding is accepted/handled) or
 * Reject (dismiss, the finding doesn't hold up). Same pattern as above: the
 * row's own `status` column plus a real `audit_log` comment.
 */
export async function decideValidationResult(formData: FormData) {
  const profile = await getProfile();
  if (!profile) return { error: "Not authorized." };

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? ""); // "approved" | "rejected"
  const comment = String(formData.get("comment") ?? "").trim();
  if (!id || !["approved", "rejected"].includes(decision)) return { error: "Invalid decision." };
  if (!comment) return { error: "Add a short comment before confirming." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("validation_results")
    .select("id, status, submission:submissions(submitter_id)")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Not found." };
  if (row.status !== "open") return { error: "This has already been decided." };

  const submission = Array.isArray(row.submission) ? row.submission[0] : row.submission;
  const scoped = profile.submitter_id != null;
  if (scoped && submission?.submitter_id !== profile.submitter_id) {
    return { error: "You're not authorized to decide this." };
  }

  const nextStatus = decision === "approved" ? "resolved" : "dismissed";
  const { error: updateError } = await supabase.from("validation_results").update({ status: nextStatus }).eq("id", id);
  if (updateError) return { error: updateError.message };

  // audit_log INSERT is open to any authenticated user (see migration RLS),
  // so the caller's own session client is enough — no admin client needed.
  await supabase.from("audit_log").insert({
    actor_id: profile.id,
    action: decision === "approved" ? "validation_result_resolved" : "validation_result_dismissed",
    entity_type: "validation_result",
    entity_id: id,
    detail: { comment },
  });

  revalidatePath("/agent-pipeline");
  return { ok: true };
}

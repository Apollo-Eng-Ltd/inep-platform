"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { resolveActingIdentities, canActOnStageAs, STAGE_ROLE } from "@/lib/pipeline-rbac";
import { listActiveDelegationsReceivedBy } from "@/lib/delegations";
import { one } from "@/lib/rel";

/** Approve and move a plan forward one stage (or publish it, if the next stage is terminal). */
export async function advanceStage(formData: FormData) {
  const submissionId = String(formData.get("submissionId"));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) return { error: "Add a short comment before confirming." };
  return move(submissionId, "advance", comment);
}

/** Send a plan back one stage with a required comment explaining why. */
export async function returnStage(formData: FormData) {
  const submissionId = String(formData.get("submissionId"));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) return { error: "Add a short comment before confirming." };
  return move(submissionId, "return", comment);
}

async function move(submissionId: string, dir: "advance" | "return", comment: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, title, submitter_id, submitter:submitters(type), current_stage:workflow_stages(stage_key, sort_order)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return { error: "Submission not found." };

  const submitterType = one<{ type: string }>(sub.submitter)?.type;
  const currentStage = one<{ stage_key: string; sort_order: number }>(sub.current_stage);
  const currentOrder = currentStage?.sort_order ?? 0;
  const currentKey = currentStage?.stage_key ?? "draft";

  // Real, enforced gate — checked here before any write, not just hidden in
  // the UI. Re-fetches the caller's active delegations fresh (never trusts a
  // client-supplied "I'm acting as X" flag) so a borrowed identity is exactly
  // as real as the caller's own. See src/lib/pipeline-rbac.ts for what this
  // can and can't check given the current schema.
  const received = await listActiveDelegationsReceivedBy(profile.id);
  const identities = resolveActingIdentities({ role: profile.role, submitterId: profile.submitter_id }, received);
  const actingAs = canActOnStageAs(identities, currentKey, sub.submitter_id);
  if (!actingAs) {
    return { error: "You're not authorized to act on this stage for this submitter." };
  }
  const finalComment = actingAs.onBehalfOf ? `${comment} (acting on behalf of ${actingAs.onBehalfOf.name})` : comment;

  const { data: stages } = await supabase
    .from("workflow_stages")
    .select("id, name, stage_key, sort_order, is_terminal")
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
    comment: finalComment,
  });

  await supabase.from("audit_log").insert({
    actor_id: profile.id,
    action: dir === "advance" ? "advance_stage" : "return_stage",
    entity_type: "submission",
    entity_id: submissionId,
    detail: actingAs.onBehalfOf
      ? { to_stage: target.name, acted_on_behalf_of: actingAs.onBehalfOf.id }
      : { to_stage: target.name },
  });

  await notifyStageActors(sub.submitter_id, target.stage_key, sub.title, submissionId);

  revalidatePath("/pipeline");
  revalidatePath(`/submissions/${submissionId}`);
  return { ok: true };
}

/**
 * Whoever is authorized to act on the plan's new stage gets a real
 * notification. This deliberately uses the service-role client, not the
 * caller's session: writing a notification for someone ELSE is the entire
 * point, but the `notifications` RLS policy only allows a user to write
 * their own row (`user_id = auth.uid()`), by design — a regular user can't
 * spam other people's inboxes. This is the one narrow, legitimate exception.
 */
async function notifyStageActors(submitterId: string, stageKey: string, title: string, submissionId: string) {
  const admin = createAdminClient();
  const requiredRole = STAGE_ROLE[stageKey];
  if (!requiredRole) {
    // Terminal stage — no next reviewer, but the plan's own county/org owner
    // should hear that it was published.
    const { data: owner } = await admin
      .from("users")
      .select("id")
      .eq("submitter_id", submitterId)
      .eq("role", "county_officer")
      .maybeSingle();
    if (owner) {
      await admin.from("notifications").insert({
        user_id: owner.id,
        type: "published",
        body: `${title} has been published.`,
        link: `/submissions/${submissionId}`,
        read: false,
      });
    }
    return;
  }

  const { data: actors } = await admin
    .from("users")
    .select("id, submitter_id")
    .eq("role", requiredRole)
    .or(`submitter_id.is.null,submitter_id.eq.${submitterId}`);
  if (!actors?.length) return;

  await admin.from("notifications").insert(
    actors.map((a) => ({
      user_id: a.id,
      type: "stage_ready",
      body: `${title} is ready for your review.`,
      link: "/pipeline",
      read: false,
    }))
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Saves one indicator's value on the live plan. Called on blur, not per keystroke. */
export async function saveIndicatorValue(
  submissionId: string,
  indicatorId: string,
  unit: string,
  value: number | null
): Promise<{ ok?: true; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, submitter_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission || submission.submitter_id !== profile.submitter?.id) {
    return { error: "Not authorized." };
  }

  if (value === null) {
    const { error } = await supabase
      .from("submission_values")
      .delete()
      .eq("submission_id", submissionId)
      .eq("indicator_id", indicatorId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("submission_values")
      .upsert(
        { submission_id: submissionId, indicator_id: indicatorId, value, unit },
        { onConflict: "submission_id,indicator_id" }
      );
    if (error) return { error: error.message };
  }

  await supabase.from("submissions").update({ updated_at: new Date().toISOString() }).eq("id", submissionId);

  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath("/submissions/new");
  return { ok: true };
}

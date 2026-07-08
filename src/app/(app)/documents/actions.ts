"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Records a supporting document. Metadata only — this environment has no
 * Supabase Storage bucket configured yet, so the real file's name, size, and
 * type are captured honestly, but its bytes are not persisted anywhere.
 * `storage_path` stays null until real storage is wired up.
 */
export async function uploadDocument(
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "other");
  const submissionId = String(formData.get("submissionId") ?? "");

  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };

  const profile = await requireProfile();
  const submitterId = profile.submitter?.id;
  if (!submitterId) return { error: "No county is linked to this account." };

  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert({
    submitter_id: submitterId,
    submission_id: submissionId || null,
    file_name: file.name,
    storage_path: null,
    kind,
    uploaded_by: profile.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/documents");
  return { ok: true };
}

export async function deleteDocument(id: string): Promise<{ ok?: true; error?: string }> {
  const profile = await requireProfile();
  const submitterId = profile.submitter?.id;
  if (!submitterId) return { error: "No county is linked to this account." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("submitter_id", submitterId);
  if (error) return { error: error.message };

  revalidatePath("/documents");
  return { ok: true };
}

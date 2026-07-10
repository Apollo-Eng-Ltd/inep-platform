"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markAllRead() {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("user_id", profile.id).eq("read", false);
  revalidatePath("/notifications");
}

export async function markRead(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", profile.id);
  revalidatePath("/notifications");
}

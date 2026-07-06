// Server-side auth helpers. Load the current user's profile (role + submitter)
// once and reuse across a request. Screens branch on `profile.role`.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "county_officer" | "national_planner" | "admin" | "committee_member";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  submitter_id: string | null;
  avatar_url: string | null;
  submitter?: { id: string; name: string; type: string; code: string | null } | null;
}

/** Returns the current profile, or null if not signed in. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select(
      "id, full_name, email, role, submitter_id, avatar_url, submitter:submitters(id, name, type, code)"
    )
    .eq("id", user.id)
    .single();

  if (!data) return null;
  // Supabase returns the embedded relation as an array-or-object depending on
  // the relationship; normalise to a single object.
  const submitter = Array.isArray(data.submitter) ? data.submitter[0] : data.submitter;
  return { ...data, submitter: submitter ?? null } as Profile;
}

/** Like getProfile but redirects to /login when there is no session. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export const isNational = (role: Role) =>
  role === "national_planner" || role === "admin" || role === "committee_member";

// Service-role Supabase client — bypasses RLS entirely. Server-only, never
// imported by client code, and only for operations that legitimately need to
// write on behalf of someone other than the acting user (e.g. inserting a
// notification for the *next* reviewer, not the person taking the current
// action — the `notifications` RLS policy only allows a user to write their
// own rows, by design, so this is the one deliberate, narrow exception).
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

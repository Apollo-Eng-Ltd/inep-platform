// Server-side Supabase client for Server Components, Server Actions, and Route
// Handlers. In Next.js 16 `cookies()` is async, so this factory is async too.
// It runs under the caller's session, so Postgres RLS applies automatically —
// a county officer only ever reads their own county's rows.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In a Server Component, setting cookies throws — the proxy handles
          // session refresh instead, so we can safely ignore that case.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* called from a Server Component — ignore */
          }
        },
      },
    }
  );
}

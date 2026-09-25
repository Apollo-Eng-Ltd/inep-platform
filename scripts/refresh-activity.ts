/**
 * Re-stamps a batch of real, already-seeded agent_actions and
 * validation_results rows with recent timestamps, spread across the last
 * ~50 minutes. Doesn't invent any data — every row it touches is a real,
 * already-logged agent check; this just makes "activity in the last hour"
 * true again after the seed data has aged past that window, so the header's
 * live counter, the agent-pipeline ticker/sparklines, and the "Updated Xm
 * ago" dashboard timestamp all have something real to show for a demo.
 *
 *   npm run refresh-activity
 *
 * Safe to re-run any time you want the app to look freshly active again.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\n  Missing env. Add these to inep-platform/.env.local:\n" +
      "    NEXT_PUBLIC_SUPABASE_URL=...\n" +
      "    SUPABASE_SERVICE_ROLE_KEY=...\n"
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const WINDOW_MS = 50 * 60 * 1000; // spread across the last 50 minutes

async function restamp(table: string, limit: number) {
  const { data: rows, error } = await db
    .from(table)
    .select("id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!rows?.length) {
    console.log(`  ${table}: no rows found, skipping`);
    return;
  }

  // Newest-looking row gets the smallest offset, so the list still reads
  // newest-first once restamped — matches how the UI sorts it.
  const updates = rows.map((r, i) => ({
    id: r.id,
    created_at: new Date(Date.now() - Math.round((i / rows.length) * WINDOW_MS)).toISOString(),
  }));

  for (const u of updates) {
    const { error: updErr } = await db.from(table).update({ created_at: u.created_at }).eq("id", u.id);
    if (updErr) throw updErr;
  }
  console.log(`  ${table}: restamped ${updates.length} rows into the last ${WINDOW_MS / 60000} minutes`);
}

async function main() {
  console.log("Refreshing AI activity timestamps for a live-looking demo…");
  await restamp("agent_actions", 60);
  await restamp("validation_results", 40);
  console.log("Done. Reload the app — the header's live counter and the agent-pipeline ticker should show fresh activity.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

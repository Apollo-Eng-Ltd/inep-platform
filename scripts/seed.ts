/**
 * INEP seed script.
 *
 *   npm run seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Uses the service-role key, so it bypasses RLS. Safe to re-run: it wipes the
 * app tables and demo auth users first, then rebuilds everything.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import {
  COUNTIES,
  PROVIDERS,
  PRIVATE_ORGS,
  SECTORS,
  INDICATORS,
  STAGES,
  SAMPLE_WARDS,
  DEMO_USERS,
  DEMO_PASSWORD,
  type IndicatorSeed,
} from "./data";

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

const ZERO = "00000000-0000-0000-0000-000000000000";
const CYCLE_YEARS = [2022, 2023, 2024];
const PLAN_YEAR = 2025;

// ---- deterministic pseudo-random so re-seeding gives stable numbers ---------
function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}
function rng(seed: string): () => number {
  let a = hashStr(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Plausible value for an indicator given a county size factor and a year.
function valueFor(ind: IndicatorSeed, factor: number, year: number, key: string): number {
  const r = rng(`${key}:${ind.slug}:${year}`);
  const noise = 0.85 + r() * 0.3;
  const yi = year - CYCLE_YEARS[0]; // 0,1,2 (plan year extrapolates)
  if (ind.kind === "percent") {
    let v: number;
    if (ind.slug === "firewood_dependency_pct") {
      v = ind.base * (1.25 - factor * 0.14) * (1 - yi * 0.03) * noise; // falls over time
    } else if (ind.slug === "avg_tariff_kwh") {
      v = ind.base * (0.95 + r() * 0.15) * (1 + yi * 0.02);
    } else {
      v = ind.base * (0.6 + factor * 0.14) * (1 + yi * 0.04) * noise; // access rises
    }
    return Math.round(Math.min(ind.expected_max, Math.max(ind.expected_min, v)) * 10) / 10;
  }
  const v = ind.base * factor * (1 + yi * 0.08) * noise;
  return Math.round(Math.min(ind.expected_max, Math.max(ind.expected_min, v)));
}

async function wipe(table: string) {
  const { error } = await db.from(table).delete().neq("id", ZERO);
  if (error) throw new Error(`wipe ${table}: ${error.message}`);
}
async function insert<T = unknown>(table: string, rows: Record<string, unknown>[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await db.from(table).insert(chunk).select();
    if (error) throw new Error(`insert ${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

async function main() {
  console.log("→ Wiping existing data…");
  for (const t of [
    "notifications", "audit_log", "agent_actions", "validation_results",
    "cross_cutting_scores", "submission_stage_history", "submission_values",
    "public_comments", "documents", "national_summaries", "submissions",
    "wards", "users", "templates", "planning_cycles", "indicators",
    "sectors", "workflow_stages", "submitters",
  ]) {
    await wipe(t);
  }

  // ---- reference data -------------------------------------------------------
  console.log("→ Seeding sectors, indicators, stages, templates, cycle…");
  const sectorRows = await insert<{ id: string; slug: string }>("sectors", SECTORS);
  const sectorId = new Map(sectorRows.map((s) => [s.slug, s.id]));

  const indicatorRows = await insert<{ id: string; slug: string }>(
    "indicators",
    INDICATORS.map((i) => ({
      sector_id: sectorId.get(i.sector),
      slug: i.slug, name: i.name, unit: i.unit,
      expected_min: i.expected_min, expected_max: i.expected_max,
      description: i.description, sort_order: i.sort_order,
    }))
  );
  const indicatorId = new Map(indicatorRows.map((i) => [i.slug, i.id]));

  const stageRows = await insert<{ id: string; submitter_type: string; stage_key: string; sort_order: number }>(
    "workflow_stages", STAGES
  );
  const stageId = (type: string, key: string) =>
    stageRows.find((s) => s.submitter_type === type && s.stage_key === key)!.id;
  const stagesOf = (type: string) =>
    stageRows.filter((s) => s.submitter_type === type).sort((a, b) => a.sort_order - b.sort_order);

  await insert("templates", [
    { name: "County Energy Plan", submission_type: "full_plan", review_cycle_years: 3 },
    { name: "County Progress Report", submission_type: "progress_report", review_cycle_years: 3 },
    { name: "Provider Annual Report", submission_type: "annual_report", review_cycle_years: 5 },
    { name: "Private Sector / PBO Report", submission_type: "annual_report", review_cycle_years: 1 },
  ]);

  const [cycle] = await insert<{ id: string }>("planning_cycles", [
    {
      name: "2025 Integrated National Energy Plan Cycle",
      triggered_by: "Cabinet Secretary, Ministry of Energy",
      triggered_at: "2025-01-15",
      plan_due_date: "2025-06-30",
      report_due_dates: JSON.stringify(["2025-01-31", "2025-07-31"]),
      status: "active",
    },
  ]);

  // ---- submitters -----------------------------------------------------------
  console.log("→ Seeding submitters (47 counties, providers, private orgs)…");
  const submitterRows = await insert<{ id: string; code: string; type: string }>("submitters", [
    ...COUNTIES.map((c) => ({
      type: "county", name: c.name, code: c.code, region: c.region,
      headquarters: c.name, review_cycle_years: 3, profile: {},
    })),
    ...PROVIDERS.map((p) => ({
      type: "national_provider", name: p.name, code: p.code, region: p.region,
      review_cycle_years: 5, profile: {},
    })),
    ...PRIVATE_ORGS.map((o) => ({
      type: "private_sector", name: o.name, code: o.code, region: o.region,
      profile: o.profile, review_cycle_years: 1,
    })),
  ]);
  const submitterByCode = new Map(submitterRows.map((s) => [s.code, s]));

  // wards for a couple of counties
  const wardRows: Record<string, unknown>[] = [];
  for (const [countyName, wards] of Object.entries(SAMPLE_WARDS)) {
    const c = COUNTIES.find((x) => x.name === countyName)!;
    const sid = submitterByCode.get(c.code)!.id;
    for (const w of wards) wardRows.push({ submitter_id: sid, sub_county: w.sub_county, name: w.name });
  }
  const insertedWards = await insert<{ id: string; submitter_id: string }>("wards", wardRows);

  // ---- auth users + profiles ------------------------------------------------
  console.log("→ Creating demo login accounts…");
  const { data: existing } = await db.auth.admin.listUsers();
  for (const u of existing?.users ?? []) {
    if (DEMO_USERS.some((d) => d.email === u.email)) await db.auth.admin.deleteUser(u.id);
  }
  const userRows: Record<string, unknown>[] = [];
  for (const d of DEMO_USERS) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: d.email, password: DEMO_PASSWORD, email_confirm: true,
    });
    if (error) throw new Error(`auth ${d.email}: ${error.message}`);
    userRows.push({
      id: created.user.id, full_name: d.full_name, email: d.email, role: d.role,
      submitter_id: d.submitter_code ? submitterByCode.get(d.submitter_code)!.id : null,
    });
  }
  await insert("users", userRows);
  const officerId = userRows.find((u) => u.role === "county_officer")!.id as string;
  const plannerId = userRows.find((u) => u.role === "national_planner")!.id as string;

  // ---- submissions ----------------------------------------------------------
  console.log("→ Generating submissions, values, history…");
  type SubSeed = {
    title: string; submitter_id: string; submission_type: string; period_year: number;
    period_half: number | null; status: string; current_stage_id: string | null;
    stageIdxTarget: number; type: string; factor: number; key: string; indicators: IndicatorSeed[];
    cidp_reference: string | null; returned: boolean;
  };
  const subSeeds: SubSeed[] = [];

  const pushCounty = (code: string, name: string, factor: number, idx: number) => {
    const sid = submitterByCode.get(code)!.id;
    // historical published annual reports
    for (const year of CYCLE_YEARS) {
      subSeeds.push({
        title: `${name} Annual Energy Report ${year}`, submitter_id: sid,
        submission_type: "annual_report", period_year: year, period_half: null,
        status: "published", current_stage_id: stageId("county", "published"),
        stageIdxTarget: 4, type: "county", factor, key: code, indicators: INDICATORS,
        cidp_reference: `CIDP ${name} 2023-2027`, returned: false,
      });
    }
    // live full plan somewhere on the board
    const lane = idx % 6; // 0..5
    const targetKey = ["draft", "committee_review", "executive_approval", "assembly_approval", "published", "committee_review"][lane];
    const targetIdx = stagesOf("county").findIndex((s) => s.stage_key === targetKey);
    const returned = lane === 5;
    const status = targetKey === "published" ? "published" : targetKey === "draft" ? "draft" : returned ? "returned" : "in_review";
    subSeeds.push({
      title: `${name} Energy Plan ${PLAN_YEAR}`, submitter_id: sid,
      submission_type: "full_plan", period_year: PLAN_YEAR, period_half: null,
      status, current_stage_id: stageId("county", targetKey),
      stageIdxTarget: targetIdx, type: "county", factor, key: code + "P", indicators: INDICATORS,
      cidp_reference: `CIDP ${name} 2023-2027`, returned,
    });
  };
  COUNTIES.forEach((c, i) => pushCounty(c.code, c.name, c.factor, i));

  // providers: annual reports (electricity-heavy) + one live plan
  const providerIndicators = INDICATORS.filter((i) => ["electricity", "efficiency", "resource_dev"].includes(i.sector));
  PROVIDERS.forEach((p, i) => {
    const sid = submitterByCode.get(p.code)!.id;
    for (const year of [2023, 2024]) {
      subSeeds.push({
        title: `${p.name} Annual Report ${year}`, submitter_id: sid,
        submission_type: "annual_report", period_year: year, period_half: null,
        status: "published", current_stage_id: stageId("national_provider", "published"),
        stageIdxTarget: 4, type: "national_provider", factor: 3.5, key: p.code, indicators: providerIndicators,
        cidp_reference: null, returned: false,
      });
    }
    const targetKey = ["technical_review", "committee_review", "approved"][i % 3];
    const targetIdx = stagesOf("national_provider").findIndex((s) => s.stage_key === targetKey);
    subSeeds.push({
      title: `${p.name} Energy Plan ${PLAN_YEAR}`, submitter_id: sid,
      submission_type: "full_plan", period_year: PLAN_YEAR, period_half: null, status: "in_review",
      current_stage_id: stageId("national_provider", targetKey), stageIdxTarget: targetIdx,
      type: "national_provider", factor: 3.5, key: p.code + "P", indicators: providerIndicators,
      cidp_reference: null, returned: false,
    });
  });

  // private sector: annual report + one live report
  const privateIndicators = INDICATORS.filter((i) => ["energy_access", "bioenergy"].includes(i.sector));
  PRIVATE_ORGS.forEach((o, i) => {
    const sid = submitterByCode.get(o.code)!.id;
    subSeeds.push({
      title: `${o.name} Project Report 2024`, submitter_id: sid,
      submission_type: "annual_report", period_year: 2024, period_half: null,
      status: "published", current_stage_id: stageId("private_sector", "published"),
      stageIdxTarget: 3, type: "private_sector", factor: 1.4, key: o.code, indicators: privateIndicators,
      cidp_reference: null, returned: false,
    });
    const targetKey = ["draft", "validation_review", "approved"][i % 3];
    const targetIdx = stagesOf("private_sector").findIndex((s) => s.stage_key === targetKey);
    subSeeds.push({
      title: `${o.name} Project Report ${PLAN_YEAR}`, submitter_id: sid,
      submission_type: "annual_report", period_year: PLAN_YEAR, period_half: null,
      status: targetKey === "draft" ? "draft" : "in_review",
      current_stage_id: stageId("private_sector", targetKey), stageIdxTarget: targetIdx,
      type: "private_sector", factor: 1.4, key: o.code + "P", indicators: privateIndicators,
      cidp_reference: null, returned: false,
    });
  });

  const insertedSubs = await insert<{ id: string; title: string }>(
    "submissions",
    subSeeds.map((s) => ({
      submitter_id: s.submitter_id, planning_cycle_id: cycle.id, submission_type: s.submission_type,
      title: s.title, period_year: s.period_year, period_half: s.period_half, status: s.status,
      current_stage_id: s.current_stage_id, cidp_reference: s.cidp_reference,
      submitted_by: officerId, submitted_at: s.status === "draft" ? null : new Date().toISOString(),
    }))
  );
  const subIdByTitle = new Map(insertedSubs.map((s) => [s.title, s.id]));

  // values
  const valueRows: Record<string, unknown>[] = [];
  for (const s of subSeeds) {
    const subId = subIdByTitle.get(s.title)!;
    for (const ind of s.indicators) {
      valueRows.push({
        submission_id: subId, indicator_id: indicatorId.get(ind.slug),
        value: valueFor(ind, s.factor, s.period_year, s.key), unit: ind.unit,
      });
    }
  }
  await insert("submission_values", valueRows);

  // stage history for anything past draft
  const historyRows: Record<string, unknown>[] = [];
  for (const s of subSeeds) {
    if (s.stageIdxTarget <= 0 && !s.returned) continue;
    const subId = subIdByTitle.get(s.title)!;
    const chain = stagesOf(s.type);
    historyRows.push({ submission_id: subId, stage_id: chain[0].id, action: "submitted", actor_id: officerId, comment: "Submitted for review" });
    for (let k = 1; k <= s.stageIdxTarget; k++) {
      historyRows.push({ submission_id: subId, stage_id: chain[k].id, action: "approved", actor_id: plannerId, comment: null });
    }
    if (s.returned) {
      historyRows.push({ submission_id: subId, stage_id: chain[Math.max(0, s.stageIdxTarget)].id, action: "sent_back", actor_id: plannerId, comment: "Please reconcile the electricity access figure with last year's report." });
    }
  }
  await insert("submission_stage_history", historyRows);

  // ---- a few deliberate anomalies + cross-cutting scores --------------------
  console.log("→ Seeding validation flags and cross-cutting scores…");
  const flagRows: Record<string, unknown>[] = [];
  const ccRows: Record<string, unknown>[] = [];
  const livePlans = subSeeds.filter((s) => s.submission_type === "full_plan" && s.type === "county");
  livePlans.slice(0, 6).forEach((s, i) => {
    const subId = subIdByTitle.get(s.title)!;
    if (i % 2 === 0) {
      flagRows.push({
        submission_id: subId, agent: "anomaly", indicator_id: indicatorId.get("electricity_access_pct"),
        severity: "warning", rule_code: "YOY_JUMP",
        message: "Electricity access rose more than 25% year-on-year — unusually fast versus this county's history.",
        details: JSON.stringify({ previous: 61.2, current: 78.9, threshold_pct: 25 }),
      });
    } else {
      flagRows.push({
        submission_id: subId, agent: "validation", indicator_id: indicatorId.get("installed_capacity_mw"),
        severity: "error", rule_code: "MISSING_VALUE",
        message: "Installed capacity is blank but grid connections were reported — value expected.",
        details: JSON.stringify({}),
      });
    }
    for (const dim of ["gender", "disaster_risk", "environment"] as const) {
      ccRows.push({
        submission_id: subId, dimension: dim,
        score: 45 + Math.round(rng(`${s.key}:${dim}`)() * 50),
        rationale: `Coverage of ${dim.replace("_", " ")} references assessed from plan narrative and indicators.`,
      });
    }
  });
  await insert("validation_results", flagRows);
  await insert("cross_cutting_scores", ccRows);

  // ---- national summaries (approved/published data only) --------------------
  console.log("→ Rolling up national summaries…");
  const summaryRows: Record<string, unknown>[] = [];
  for (const year of CYCLE_YEARS) {
    for (const ind of INDICATORS) {
      const vals: number[] = [];
      for (const c of COUNTIES) {
        vals.push(valueFor(ind, c.factor, year, c.code));
      }
      const agg = ind.kind === "percent"
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : Math.round(vals.reduce((a, b) => a + b, 0));
      summaryRows.push({
        planning_cycle_id: cycle.id, sector_id: sectorId.get(ind.sector), indicator_id: indicatorId.get(ind.slug),
        period_year: year, aggregated_value: agg, submitter_count: COUNTIES.length, source: "county_submission",
      });
    }
  }
  // a couple of EPRA-sourced national figures, tagged distinctly
  summaryRows.push(
    { planning_cycle_id: cycle.id, sector_id: sectorId.get("electricity"), indicator_id: indicatorId.get("avg_tariff_kwh"), period_year: 2024, aggregated_value: 23.9, submitter_count: 0, source: "epra_national" },
    { planning_cycle_id: cycle.id, sector_id: sectorId.get("electricity"), indicator_id: indicatorId.get("installed_capacity_mw"), period_year: 2024, aggregated_value: 3321, submitter_count: 0, source: "epra_national" }
  );
  await insert("national_summaries", summaryRows);

  // ---- public comments (ward-aware) -----------------------------------------
  console.log("→ Seeding public comments, agent log, notifications…");
  const makueniPlan = subSeeds.find((s) => s.title.startsWith("Makueni Energy Plan"));
  const commentRows: Record<string, unknown>[] = [];
  if (makueniPlan) {
    const subId = subIdByTitle.get(makueniPlan.title)!;
    const mkWards = insertedWards.filter((w) => w.submitter_id === submitterByCode.get("017")!.id);
    commentRows.push(
      { submission_id: subId, submitter_id: submitterByCode.get("017")!.id, ward_id: mkWards[0]?.id, section_referenced: "Energy Access", author_name: "Wote Energy Champion", body: "Please prioritise mini-grid connections for the market centre.", moderation_status: "approved" },
      { submission_id: subId, submitter_id: submitterByCode.get("017")!.id, ward_id: mkWards[1]?.id, section_referenced: "Clean Cooking", author_name: "Makindu Resident", body: "Are subsidised cookstoves part of this plan?", moderation_status: "pending", agent_draft_reply: "Thank you for your comment. The 2025 plan includes a target for improved cookstove distribution; details are in the Bio-energy section." }
    );
  }
  await insert("public_comments", commentRows);

  // ---- agent action log + notifications ------------------------------------
  const agentRows: Record<string, unknown>[] = livePlans.slice(0, 4).map((s) => ({
    agent: "insight", submission_id: subIdByTitle.get(s.title)!, action_type: "summary_drafted",
    input_summary: `Aggregated indicators for ${s.key}`,
    proposed_output: JSON.stringify({ text: "Draft insight generated from approved indicators." }),
    status: "proposed",
  }));
  await insert("agent_actions", agentRows);

  await insert("notifications", [
    { user_id: plannerId, type: "approval", body: "3 county plans are awaiting committee review.", link: "/pipeline", read: false },
    { user_id: officerId, type: "returned", body: "Your 2025 plan was sent back with a comment.", link: "/submissions", read: false },
  ]);

  console.log("\n✅ Seed complete.");
  console.log(`   Submitters: ${submitterRows.length}  |  Submissions: ${insertedSubs.length}  |  Values: ${valueRows.length}`);
  console.log(`   Login with any of these (password: ${DEMO_PASSWORD}):`);
  DEMO_USERS.forEach((u) => console.log(`     ${u.email}  (${u.role})`));
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e.message);
  process.exit(1);
});

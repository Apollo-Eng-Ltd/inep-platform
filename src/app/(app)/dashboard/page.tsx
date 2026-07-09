import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient, type ValueRow } from "./dashboard-client";

export default async function DashboardPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: sectors }, { data: indicators }, { data: counties }] = await Promise.all([
    supabase.from("sectors").select("id, name, slug, sort_order").order("sort_order"),
    supabase
      .from("indicators")
      .select("id, name, slug, unit, sector_id, sort_order, expected_min, expected_max")
      .order("sort_order"),
    supabase.from("submitters").select("id, name").eq("type", "county").order("name"),
  ]);

  const countyIds = (counties ?? []).map((c) => c.id);

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, submitter_id, period_year, submission_type, status, created_at")
    .in("submitter_id", countyIds)
    .in("submission_type", ["annual_report", "full_plan"])
    .order("created_at", { ascending: false });

  // one submission per (county, year): a real submitted/approved/published record
  // always wins over a stray draft (e.g. leftover test data), newest breaks ties.
  const DRAFT_STATUSES = new Set(["draft"]);
  const submissionByCountyYear = new Map<
    string,
    { id: string; submitter_id: string; period_year: number; status: string }
  >();
  (submissions ?? []).forEach((s) => {
    const key = `${s.submitter_id}-${s.period_year}`;
    const existing = submissionByCountyYear.get(key);
    if (!existing) {
      submissionByCountyYear.set(key, s);
    } else if (DRAFT_STATUSES.has(existing.status) && !DRAFT_STATUSES.has(s.status)) {
      submissionByCountyYear.set(key, s);
    }
  });
  const usedSubmissionIds = [...submissionByCountyYear.values()].map((s) => s.id);
  const submissionMeta = new Map(
    [...submissionByCountyYear.values()].map((s) => [s.id, { submitterId: s.submitter_id, year: s.period_year }])
  );

  // PostgREST caps a single select at 1000 rows — 47 counties x ~4 periods x 18
  // indicators can exceed that, so page through until a page comes back short.
  type ValueQueryRow = { submission_id: string; indicator_id: string; value: number | null };
  const values: ValueQueryRow[] = [];
  if (usedSubmissionIds.length) {
    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
      const { data: page } = await supabase
        .from("submission_values")
        .select("submission_id, indicator_id, value")
        .in("submission_id", usedSubmissionIds)
        .range(offset, offset + PAGE - 1);
      values.push(...(page ?? []));
      if (!page || page.length < PAGE) break;
    }
  }

  const countyNameById = new Map((counties ?? []).map((c) => [c.id, c.name]));
  const indicatorById = new Map((indicators ?? []).map((i) => [i.id, i]));

  // Drop values clearly outside an indicator's expected range (e.g. stray bad
  // test data) rather than letting one bad number distort national aggregates.
  const inRange = (indicatorId: string, value: number): boolean => {
    const ind = indicatorById.get(indicatorId);
    if (!ind) return true;
    if (ind.expected_min != null && value < ind.expected_min) return false;
    if (ind.expected_max != null && value > ind.expected_max) return false;
    return true;
  };

  const valueRows: ValueRow[] = values
    .filter((v) => v.value != null && inRange(v.indicator_id, v.value))
    .map((v) => {
      const meta = submissionMeta.get(v.submission_id)!;
      return {
        countyId: meta.submitterId,
        countyName: countyNameById.get(meta.submitterId) ?? "—",
        indicatorId: v.indicator_id,
        year: meta.year,
        value: v.value as number,
      };
    });

  return (
    <DashboardClient
      sectors={(sectors ?? []).map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
      indicators={(indicators ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        slug: i.slug,
        unit: i.unit,
        sectorId: i.sector_id,
      }))}
      counties={(counties ?? []).map((c) => ({ id: c.id, name: c.name }))}
      valueRows={valueRows}
    />
  );
}

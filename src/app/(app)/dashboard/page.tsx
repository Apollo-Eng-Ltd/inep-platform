import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient, type ValueRow, type EpraRow } from "./dashboard-client";
import { EPRA_SLUGS } from "./epra-config";
import type { MapPoint } from "./point-map";

export default async function DashboardPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: sectors }, { data: indicators }, { data: counties }] = await Promise.all([
    supabase.from("sectors").select("id, name, slug, sort_order").order("sort_order"),
    supabase
      .from("indicators")
      .select("id, name, slug, unit, sector_id, sort_order, expected_min, expected_max")
      .order("sort_order"),
    supabase.from("submitters").select("id, name, region").eq("type", "county").order("name"),
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

  // EPRA "Year at a Glance" hero-row series — real national context figures,
  // never derived from county submissions (see scripts/data.ts EPRA_INDICATORS).
  const epraIndicatorIds = (indicators ?? []).filter((i) => EPRA_SLUGS.includes(i.slug)).map((i) => i.id);
  const { data: epraSummaries } = epraIndicatorIds.length
    ? await supabase
        .from("national_summaries")
        .select("indicator_id, period_year, aggregated_value")
        .eq("source", "epra_national")
        .in("indicator_id", epraIndicatorIds)
        .order("period_year")
    : { data: [] as { indicator_id: string; period_year: number; aggregated_value: number }[] };
  const epraRows: EpraRow[] = (epraSummaries ?? []).map((e) => ({
    indicatorId: e.indicator_id,
    year: e.period_year,
    value: e.aggregated_value,
  }));

  // Latest real submission per county — for the choropleth's click-through.
  const submissionIdByCounty = new Map<string, string>();
  submissionByCountyYear.forEach((s) => {
    const cur = submissionIdByCounty.get(s.submitter_id);
    const curYear = cur ? submissionMeta.get(cur)?.year ?? 0 : -1;
    if (s.period_year >= curYear) submissionIdByCounty.set(s.submitter_id, s.id);
  });

  // Provider + private-sector points for the point map — only ones with real
  // GPS coordinates captured in submitters.profile are ever placed.
  const { data: mapSubmitters } = await supabase
    .from("submitters")
    .select("id, name, type, profile")
    .in("type", ["national_provider", "private_sector"]);

  const { data: mapSubmissions } = mapSubmitters?.length
    ? await supabase
        .from("submissions")
        .select("id, submitter_id, created_at")
        .in(
          "submitter_id",
          mapSubmitters.map((m) => m.id)
        )
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; submitter_id: string; created_at: string }[] };
  const latestSubmissionBySubmitter = new Map<string, string>();
  (mapSubmissions ?? []).forEach((s) => {
    if (!latestSubmissionBySubmitter.has(s.submitter_id)) latestSubmissionBySubmitter.set(s.submitter_id, s.id);
  });

  let missingLocationCount = 0;
  const mapPoints: MapPoint[] = [];
  (mapSubmitters ?? []).forEach((s) => {
    const profile = (s.profile ?? {}) as { gps_lat?: number; gps_lng?: number };
    if (profile.gps_lat == null || profile.gps_lng == null) {
      missingLocationCount += 1;
      return;
    }
    mapPoints.push({
      id: s.id,
      name: s.name,
      type: s.type as "national_provider" | "private_sector",
      lat: profile.gps_lat,
      lng: profile.gps_lng,
      href: latestSubmissionBySubmitter.get(s.id) ? `/submissions/${latestSubmissionBySubmitter.get(s.id)}` : null,
    });
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
      counties={(counties ?? []).map((c) => ({ id: c.id, name: c.name, region: c.region }))}
      valueRows={valueRows}
      epraRows={epraRows}
      countySubmissionIds={Object.fromEntries(submissionIdByCounty)}
      mapPoints={mapPoints}
      missingLocationCount={missingLocationCount}
    />
  );
}

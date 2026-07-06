// Glue between the database and the agent service layer for one submission.
// Pulls the values, history, and peers an agent needs, then runs the rule-based
// agents. Kept server-only and separate from UI so the swap to a real model is
// isolated to the agent layer.
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import {
  runValidation,
  runAnomaly,
  runDrafting,
  runCrossCutting,
  type AnomalyInput,
} from "@/lib/agents";
import type { Indicator, Sector, SubmissionValue } from "@/lib/types";

export async function analyzeSubmission(submissionId: string) {
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "id, title, submitter_id, submission_type, period_year, status, narrative, cidp_reference, submitted_at, submitter:submitters(id, name, type, code, profile), current_stage:workflow_stages(id, name, sort_order, submitter_type)"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) return null;

  const submitter = one<{ id: string; name: string; type: string; code: string; profile: Record<string, unknown> }>(submission.submitter);

  const [{ data: sectors }, { data: indicators }, { data: values }] = await Promise.all([
    supabase.from("sectors").select("id, slug, name").order("sort_order"),
    supabase
      .from("indicators")
      .select("id, sector_id, slug, name, unit, expected_min, expected_max, description")
      .order("sort_order"),
    supabase
      .from("submission_values")
      .select("indicator_id, value, unit, indicator:indicators(slug)")
      .eq("submission_id", submissionId),
  ]);

  const indList = (indicators ?? []) as Indicator[];
  const secList = (sectors ?? []) as Sector[];
  const valList = (values ?? []).map((v) => ({
    indicator_id: v.indicator_id,
    value: v.value,
    unit: v.unit,
  })) as SubmissionValue[];

  // Only run checks against the indicators relevant to this submission type.
  const reportedIds = new Set(valList.map((v) => v.indicator_id));
  const relevantIndicators = indList.filter((i) => reportedIds.has(i.id));

  // --- validation (live) ---
  const validation = runValidation(valList, relevantIndicators);

  // --- anomaly (live): needs prior-year history + same-period peers ---
  const { data: prior } = await supabase
    .from("submissions")
    .select("id")
    .eq("submitter_id", submission.submitter_id)
    .eq("submission_type", submission.submission_type)
    .lt("period_year", submission.period_year)
    .order("period_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  const historyByIndicator = new Map<string, number>();
  if (prior) {
    const { data: pv } = await supabase
      .from("submission_values")
      .select("indicator_id, value")
      .eq("submission_id", prior.id);
    for (const row of pv ?? []) if (row.value !== null) historyByIndicator.set(row.indicator_id, row.value);
  }

  // peers: same type + period, other submitters (RLS may limit officers to none)
  const { data: peerSubs } = await supabase
    .from("submissions")
    .select("id")
    .eq("submission_type", submission.submission_type)
    .eq("period_year", submission.period_year)
    .neq("submitter_id", submission.submitter_id)
    .limit(60);
  const peerIds = (peerSubs ?? []).map((s) => s.id);
  const peersByIndicator = new Map<string, number[]>();
  if (peerIds.length) {
    const { data: peerVals } = await supabase
      .from("submission_values")
      .select("indicator_id, value")
      .in("submission_id", peerIds);
    for (const row of peerVals ?? []) {
      if (row.value === null) continue;
      const arr = peersByIndicator.get(row.indicator_id) ?? [];
      arr.push(row.value);
      peersByIndicator.set(row.indicator_id, arr);
    }
  }

  const anomalyInputs: AnomalyInput[] = valList
    .filter((v) => v.value !== null)
    .map((v) => {
      const indicator = indList.find((i) => i.id === v.indicator_id)!;
      const hist = historyByIndicator.get(v.indicator_id);
      return {
        indicator,
        current: v.value as number,
        history: hist !== undefined ? [{ year: submission.period_year - 1, value: hist }] : [],
        peers: peersByIndicator.get(v.indicator_id) ?? [],
      };
    });
  const anomaly = runAnomaly(anomalyInputs);

  // --- drafting + cross-cutting (live previews) ---
  const drafting = runDrafting({
    submitterName: submitter?.name ?? "This submitter",
    submitterType: (submitter?.type ?? "county") as "county" | "national_provider" | "private_sector",
    periodYear: submission.period_year,
    sectors: secList,
    indicators: relevantIndicators,
    values: valList,
  });

  const reportedSlugs = (values ?? [])
    .map((v) => one<{ slug: string }>(v.indicator)?.slug)
    .filter(Boolean) as string[];
  const crossCutting = runCrossCutting({
    narrative: submission.narrative ?? drafting.data.paragraphs.map((p) => p.text).join(" "),
    reportedSlugs,
  });

  return {
    submission,
    submitter,
    currentStage: one<{ id: string; name: string; sort_order: number; submitter_type: string }>(submission.current_stage),
    sectors: secList,
    indicators: indList,
    values: valList,
    validation: validation.data,
    anomaly: anomaly.data,
    drafting: drafting.data,
    crossCutting: crossCutting.data,
  };
}

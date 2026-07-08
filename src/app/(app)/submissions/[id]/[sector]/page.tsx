import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { runSectorInsight, type SectorInsightRow } from "@/lib/agents";
import { accentFor, ACCENT_CLASSES } from "@/lib/sector-theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StepTracker, type StepSector } from "./step-tracker";
import { SectorWorkspace, type SectorRow } from "./sector-workspace";
import { SubcountySection, type WardRow } from "./subcounty-section";
import { ArrowRight, Save } from "lucide-react";

// Deterministic 0..1 weight from a stable id — used only to give the
// sub-county breakdown a believable (not random-on-every-load) split of the
// real county total. Not a substitute for independently reported ward data.
function hashWeight(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export default async function SectorFormPage({
  params,
}: {
  params: Promise<{ id: string; sector: string }>;
}) {
  const { id, sector: sectorSlug } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, title, status, period_year, submitter_id, submitter:submitters(name)")
    .eq("id", id)
    .maybeSingle();
  if (!submission || submission.submitter_id !== profile.submitter?.id) notFound();

  const { data: sectors } = await supabase
    .from("sectors")
    .select("id, name, slug, sort_order")
    .order("sort_order");
  if (!sectors?.length) notFound();

  const currentIndex = sectors.findIndex((s) => s.slug === sectorSlug);
  if (currentIndex === -1) notFound();
  const currentSector = sectors[currentIndex];

  const { data: indicators } = await supabase
    .from("indicators")
    .select("id, name, unit, sector_id, sort_order")
    .order("sort_order");

  const { data: values } = await supabase
    .from("submission_values")
    .select("indicator_id, value")
    .eq("submission_id", id);
  const valueByIndicator = new Map((values ?? []).map((v) => [v.indicator_id, v.value as number | null]));

  // "last year" — this county's most recent annual report
  const { data: prevReport } = await supabase
    .from("submissions")
    .select("id")
    .eq("submitter_id", submission.submitter_id)
    .eq("submission_type", "annual_report")
    .order("period_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastYearByIndicator = new Map<string, number>();
  if (prevReport) {
    const { data: prevValues } = await supabase
      .from("submission_values")
      .select("indicator_id, value")
      .eq("submission_id", prevReport.id);
    (prevValues ?? []).forEach((v) => {
      if (v.value != null) lastYearByIndicator.set(v.indicator_id, v.value as number);
    });
  }

  // step tracker — real completion across every sector, not just this one
  const stepSectors: StepSector[] = sectors.map((s) => {
    const inds = (indicators ?? []).filter((i) => i.sector_id === s.id);
    const done = inds.filter((i) => valueByIndicator.get(i.id) != null).length;
    return { slug: s.slug, name: s.name, done, total: inds.length };
  });

  const sectorIndicators = (indicators ?? [])
    .filter((i) => i.sector_id === currentSector.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const rows: SectorRow[] = sectorIndicators.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    initialValue: valueByIndicator.get(i.id) ?? null,
    lastYear: lastYearByIndicator.get(i.id) ?? null,
  }));

  // national comparison, for the "rising faster than the national average" insight
  const indicatorIds = sectorIndicators.map((i) => i.id);
  const { data: natRows } = indicatorIds.length
    ? await supabase
        .from("national_summaries")
        .select("indicator_id, period_year, aggregated_value")
        .eq("source", "county_submission")
        .in("indicator_id", indicatorIds)
    : { data: [] as { indicator_id: string; period_year: number; aggregated_value: number }[] };
  const natByIndicator = new Map<string, { year: number; value: number }[]>();
  (natRows ?? []).forEach((r) => {
    const list = natByIndicator.get(r.indicator_id) ?? [];
    list.push({ year: r.period_year, value: r.aggregated_value });
    natByIndicator.set(r.indicator_id, list);
  });

  const insightRows: SectorInsightRow[] = sectorIndicators.map((i) => {
    const nat = (natByIndicator.get(i.id) ?? []).sort((a, b) => b.year - a.year);
    return {
      name: i.name,
      latest: valueByIndicator.get(i.id) ?? null,
      previous: lastYearByIndicator.get(i.id) ?? null,
      nationalLatest: nat[0]?.value ?? null,
      nationalPrevious: nat[1]?.value ?? null,
    };
  });
  const insight = runSectorInsight({ sectorName: currentSector.name, rows: insightRows }).data;

  // sub-county breakdown — a derived split of the sector's lead indicator
  const primary = sectorIndicators[0];
  const { data: wards } = await supabase
    .from("wards")
    .select("id, name, sub_county")
    .eq("submitter_id", submission.submitter_id)
    .order("name");

  let wardRows: WardRow[] = [];
  if (primary && wards?.length) {
    const totalThis = valueByIndicator.get(primary.id) ?? null;
    const totalLast = lastYearByIndicator.get(primary.id) ?? null;
    const weights = wards.map((w) => 0.6 + hashWeight(w.id) * 0.8);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    wardRows = wards.map((w, i) => {
      const share = weights[i] / weightSum;
      return {
        id: w.id,
        name: w.name,
        subCounty: w.sub_county,
        thisYear: totalThis != null ? Math.round(totalThis * share * 10) / 10 : null,
        lastYear: totalLast != null ? Math.round(totalLast * share * 10) / 10 : null,
      };
    });
  }

  const accent = accentFor(currentSector.slug);
  const tone = ACCENT_CLASSES[accent];
  const isLastSector = currentIndex === sectors.length - 1;
  const nextSector = sectors[currentIndex + 1];
  const nextHref = isLastSector ? `/submissions/${id}` : `/submissions/${id}/${nextSector.slug}`;
  const nextLabel = isLastSector ? "Review and submit" : "Next sector";
  const submitterName = one<{ name: string }>(submission.submitter)?.name ?? "Your county";

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">{currentSector.name}</h1>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", tone.bgSoft, tone.text)}>
          {submission.period_year} reporting period
        </span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{submitterName}</p>

      <StepTracker submissionId={id} sectors={stepSectors} currentSlug={currentSector.slug} />

      <SectorWorkspace submissionId={id} accent={accent} rows={rows} insightText={insight.text} />

      {primary && <SubcountySection indicatorName={primary.name} unit={primary.unit} rows={wardRows} />}

      <div className="border-t border-border mt-8 pt-4 flex items-center justify-between">
        <Button variant="secondary" render={<Link href="/submissions" />}>
          <Save className="size-4" /> Save draft
        </Button>
        <Button
          render={<Link href={nextHref} />}
          className={cn(
            "bg-brand text-white hover:bg-brand/90 active:bg-brand",
            isLastSector && "font-semibold shadow-md"
          )}
        >
          {nextLabel} <ArrowRight className="size-4" />
        </Button>
      </div>
    </>
  );
}

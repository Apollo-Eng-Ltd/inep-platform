import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analyzeSubmission } from "@/lib/submission-analysis";
import { PageHeader, EmptyState } from "@/components/page";
import { halfYearLabel } from "@/lib/format";
import { HistoryTable, type HistoryRow } from "./history-table";
import { History as HistoryIcon } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  full_plan: "Energy Plan",
  progress_report: "Progress Report",
  annual_report: "Annual Report",
};

export default async function HistoryPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const submitterId = profile.submitter?.id;

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, title, submission_type, status, submitted_at")
    .eq("submitter_id", submitterId ?? "")
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false });

  const { data: sectors } = await supabase
    .from("sectors")
    .select("id, slug, name, sort_order")
    .order("sort_order");

  // Which sector(s) had a validation/anomaly flag on each past submission —
  // computed live the same way the submission detail page does (this app
  // never treats the sparse validation_results table as the full historical
  // record; findings are recomputed from the data on file each time).
  const analyses = await Promise.all((submissions ?? []).map((s) => analyzeSubmission(s.id)));
  const flaggedSectorsBySubmission = new Map<string, Set<string>>();
  analyses.forEach((result) => {
    if (!result) return;
    const sectorSlugByIndicatorId = new Map(
      result.indicators.map((i) => [i.slug, result.sectors.find((sec) => sec.id === i.sector_id)?.slug] as const)
    );
    const set = new Set<string>();
    [...result.validation, ...result.anomaly].forEach((f) => {
      const slug = f.indicatorSlug && sectorSlugByIndicatorId.get(f.indicatorSlug);
      if (slug) set.add(slug);
    });
    flaggedSectorsBySubmission.set(result.submission.id, set);
  });

  const rows: HistoryRow[] = (submissions ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    typeLabel: TYPE_LABEL[s.submission_type] ?? s.submission_type,
    periodLabel: halfYearLabel(s.submitted_at as string),
    submittedAt: s.submitted_at as string,
    status: s.status,
    flaggedSectors: [...(flaggedSectorsBySubmission.get(s.id) ?? [])],
  }));

  return (
    <>
      <PageHeader
        title="History"
        description="Every plan and report your county has submitted, with what was flagged at the time."
      />

      {rows.length ? (
        <HistoryTable rows={rows} sectors={(sectors ?? []).map((s) => ({ slug: s.slug, name: s.name }))} />
      ) : (
        <EmptyState
          icon={<HistoryIcon className="size-8" />}
          title="No submissions yet"
          description="Once you submit a plan or report, it will show up here as a permanent record."
        />
      )}
    </>
  );
}

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { halfYearLabel } from "@/lib/format";
import { PageHeader } from "@/components/page";
import { UploadZone, type SubmissionOption } from "./upload-zone";
import { DocumentsTable, type DocumentRow } from "./documents-table";

export default async function DocumentsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const submitterId = profile.submitter?.id;

  const [{ data: documents }, { data: submissions }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, file_name, kind, created_at, submission:submissions(period_year, period_half, submitted_at, title), uploader:users(full_name)"
      )
      .eq("submitter_id", submitterId ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("submissions")
      .select("id, title, period_year, period_half, submitted_at")
      .eq("submitter_id", submitterId ?? "")
      .order("period_year", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const periodLabelFor = (s: { period_half: number | null; submitted_at: string | null; period_year: number } | undefined) => {
    if (!s) return null;
    if (s.submitted_at) return halfYearLabel(s.submitted_at);
    return String(s.period_year);
  };

  const rows: DocumentRow[] = (documents ?? []).map((d) => {
    const sub = one<{ period_year: number; period_half: number | null; submitted_at: string | null; title: string }>(
      d.submission
    );
    const uploader = one<{ full_name: string }>(d.uploader);
    return {
      id: d.id,
      fileName: d.file_name,
      kind: d.kind ?? "other",
      createdAt: d.created_at,
      uploaderName: uploader?.full_name ?? "—",
      periodLabel: periodLabelFor(sub),
    };
  });

  const submissionOptions: SubmissionOption[] = (submissions ?? []).map((s) => ({
    id: s.id,
    label: `${s.title} · ${periodLabelFor(s)}`,
  }));

  return (
    <>
      <PageHeader
        title="Documents"
        description="Supporting studies, maps, and annexes for your county's submissions."
      />

      <UploadZone submissions={submissionOptions} />

      <div className="mt-6">
        <DocumentsTable rows={rows} />
      </div>
    </>
  );
}

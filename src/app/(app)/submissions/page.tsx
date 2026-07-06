import Link from "next/link";
import { requireProfile, isNational } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, SubmitterTypeBadge } from "@/components/badges";
import { one } from "@/lib/rel";
import { relativeTime } from "@/lib/format";
import { FilePlus2, FileText } from "lucide-react";

export default async function SubmissionsPage() {
  const profile = await requireProfile();
  const national = isNational(profile.role);
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("submissions")
    .select(
      "id, title, submission_type, period_year, status, updated_at, submitter:submitters(name, type), current_stage:workflow_stages(name)"
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader
        title="Submissions"
        description={
          national
            ? "Every plan and report across counties, providers, and private-sector reporters."
            : "Your county's plans and progress reports."
        }
      >
        {!national && (
          <Button render={<Link href="/submissions/new" />}>
            <FilePlus2 className="size-4" /> New submission
          </Button>
        )}
      </PageHeader>

      <Card className="p-0 overflow-hidden">
        {rows?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-4 py-3">
                    Title
                  </th>
                  {national && (
                    <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-4 py-3">
                      Submitter
                    </th>
                  )}
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-4 py-3">
                    Period
                  </th>
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-4 py-3">
                    Stage
                  </th>
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-4 py-3">
                    Status
                  </th>
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-4 py-3">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const submitter = one<{ name: string; type: string }>(r.submitter);
                  const stage = one<{ name: string }>(r.current_stage);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/submissions/${r.id}`} className="font-medium hover:text-brand">
                          {r.title}
                        </Link>
                      </td>
                      {national && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <SubmitterTypeBadge type={submitter?.type ?? "county"} />
                            <span className="text-muted-foreground">{submitter?.name}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{r.period_year}</td>
                      <td className="px-4 py-3 text-muted-foreground">{stage?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {relativeTime(r.updated_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<FileText className="size-8" />}
            title="No submissions yet"
            description="When plans and reports are submitted, they appear here."
          />
        )}
      </Card>
    </>
  );
}

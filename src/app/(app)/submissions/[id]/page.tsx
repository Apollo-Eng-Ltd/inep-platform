import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile, isNational } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analyzeSubmission } from "@/lib/submission-analysis";
import { one } from "@/lib/rel";
import { fmtValue, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, SubmitterTypeBadge, SeverityBadge, AgentTag } from "@/components/badges";
import {
  CheckCircle2, AlertTriangle, KanbanSquare, MapPin, FileCheck2, ArrowRight,
} from "lucide-react";

export default async function SubmissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const result = await analyzeSubmission(id);
  if (!result) notFound();

  const { submission, submitter, currentStage, sectors, indicators, values, validation, anomaly, drafting, crossCutting } = result;
  const findings = [...validation, ...anomaly];
  const flaggedSlugs = new Set(findings.map((f) => f.indicatorSlug).filter(Boolean));

  // Only the owning county officer can jump into the editable form; national
  // reviewers land here read-only, so their finding rows stay plain text.
  const canEdit = !isNational(profile.role) && profile.submitter?.id === submission.submitter_id;
  const sectorSlugById = new Map(sectors.map((s) => [s.id, s.slug]));
  const indicatorBySlug = new Map(indicators.map((i) => [i.slug, i]));
  const findingHref = (slug: string | undefined) => {
    if (!canEdit || !slug) return null;
    const indicator = indicatorBySlug.get(slug);
    if (!indicator) return null;
    const sectorSlug = sectorSlugById.get(indicator.sector_id);
    if (!sectorSlug) return null;
    return `/submissions/${id}/${sectorSlug}#ind-${indicator.id}`;
  };

  // approval history
  const supabase = await createClient();
  const { data: history } = await supabase
    .from("submission_stage_history")
    .select("id, action, comment, acted_at, stage:workflow_stages(name), actor:users(full_name)")
    .eq("submission_id", id)
    .order("acted_at", { ascending: true });

  const valueByIndicatorId = new Map(values.map((v) => [v.indicator_id, v]));
  const profileData = submitter?.profile as Record<string, unknown> | undefined;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/submissions" className="hover:text-foreground">Submissions</Link>
            <span>/</span>
            <span>{submission.period_year}</span>
          </div>
          <h1 className="text-2xl font-medium tracking-tight">{submission.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <SubmitterTypeBadge type={submitter?.type ?? "county"} />
            <span className="text-sm text-muted-foreground">{submitter?.name}</span>
            <StatusBadge status={submission.status} />
            {currentStage && (
              <span className="text-xs text-muted-foreground">· {currentStage.name}</span>
            )}
          </div>
        </div>
        {isNational(profile.role) && (
          <Button variant="outline" render={<Link href="/pipeline" />}>
            <KanbanSquare className="size-4" /> Open pipeline board
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Data checks */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Data checks <AgentTag>validation + anomaly agents</AgentTag>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {findings.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-success bg-success-soft rounded-lg px-3 py-2.5">
                  <CheckCircle2 className="size-4" /> All automated checks passed. No issues found.
                </div>
              ) : (
                findings.map((f, i) => {
                  const href = findingHref(f.indicatorSlug);
                  const row = (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-lg border border-border px-3 py-2.5",
                        href && "transition-colors hover:border-brand hover:bg-muted/50"
                      )}
                    >
                      <AlertTriangle
                        className={
                          f.severity === "error" ? "size-4 text-danger mt-0.5" : "size-4 text-warning mt-0.5"
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{f.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <SeverityBadge severity={f.severity} />
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                            {f.agent} · {f.ruleCode}
                          </span>
                        </div>
                      </div>
                      {href && (
                        <span className="text-xs text-brand inline-flex items-center gap-1 shrink-0 mt-0.5">
                          Fix it <ArrowRight className="size-3.5" />
                        </span>
                      )}
                    </div>
                  );
                  return href ? (
                    <Link key={i} href={href} className="block">
                      {row}
                    </Link>
                  ) : (
                    <div key={i}>{row}</div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Indicators by sector */}
          {sectors.map((sector) => {
            const inds = indicators.filter(
              (i) => i.sector_id === sector.id && valueByIndicatorId.has(i.id)
            );
            if (inds.length === 0) return null;
            return (
              <Card key={sector.id}>
                <CardHeader>
                  <CardTitle className="text-base">{sector.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {inds.map((ind) => {
                        const v = valueByIndicatorId.get(ind.id);
                        const flagged = flaggedSlugs.has(ind.slug);
                        return (
                          <tr key={ind.id} className="border-b border-border last:border-0">
                            <td className="px-5 py-3">
                              <span>{ind.name}</span>
                              {flagged && (
                                <AlertTriangle className="inline size-3.5 text-warning ml-2 -mt-0.5" />
                              )}
                            </td>
                            <td className="px-5 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                              {fmtValue(v?.value ?? null, ind.unit)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}

          {/* Draft narrative */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Plan narrative <AgentTag>drafting agent · draft</AgentTag>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {drafting.paragraphs.map((p, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-sm font-medium">{p.heading}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.text}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Generated from the reported numbers. A human reviews and edits before this becomes final.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {profileData && Object.keys(profileData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck2 className="size-4" /> Project details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {profileData.project_name != null && (
                  <Row label="Project">{String(profileData.project_name)}</Row>
                )}
                {profileData.project_cost_kes_m != null && (
                  <Row label="Cost">KES {String(profileData.project_cost_kes_m)}M</Row>
                )}
                {Array.isArray(profileData.partners) && (
                  <Row label="Partners">{(profileData.partners as string[]).join(", ")}</Row>
                )}
                {profileData.gps_lat != null && (
                  <Row label="GPS">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {String(profileData.gps_lat)}, {String(profileData.gps_lng)}
                    </span>
                  </Row>
                )}
              </CardContent>
            </Card>
          )}

          {submission.cidp_reference && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CIDP alignment</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {submission.cidp_reference}
              </CardContent>
            </Card>
          )}

          {/* Cross-cutting scorecard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Cross-cutting <AgentTag>agent</AgentTag>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {crossCutting.map((c) => (
                <div key={c.dimension} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{c.dimension.replace("_", " ")}</span>
                    <span className="font-medium tabular-nums">{c.score}</span>
                  </div>
                  <Progress value={c.score} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Approval history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval history</CardTitle>
            </CardHeader>
            <CardContent>
              {history?.length ? (
                <ol className="space-y-4">
                  {history.map((h) => {
                    const stage = one<{ name: string }>(h.stage);
                    const actor = one<{ full_name: string }>(h.actor);
                    return (
                      <li key={h.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={
                              "size-2.5 rounded-full mt-1 " +
                              (h.action === "sent_back" ? "bg-danger" : "bg-brand")
                            }
                          />
                          <span className="flex-1 w-px bg-border mt-1" />
                        </div>
                        <div className="pb-1">
                          <p className="text-sm">
                            <span className="font-medium capitalize">{h.action.replace("_", " ")}</span>{" "}
                            at {stage?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {actor?.full_name ?? "System"} · {fmtDate(h.acted_at)}
                          </p>
                          {h.comment && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              &ldquo;{h.comment}&rdquo;
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Not yet submitted for review.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

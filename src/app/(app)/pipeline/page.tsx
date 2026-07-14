import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page";
import { PipelineBoard, type PipelineCardData, type StageInfo } from "./pipeline-board";
import { DelegateDialogTrigger } from "./delegate-dialog";
import { STAGE_ROLE, resolveActingIdentities, canActOnStageAs } from "@/lib/pipeline-rbac";
import { listActiveDelegationsReceivedBy, listDelegationsGivenBy, listEligibleDelegates } from "@/lib/delegations";
import { one } from "@/lib/rel";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "county", label: "Counties" },
  { key: "national_provider", label: "Providers" },
  { key: "private_sector", label: "Private / PBO" },
] as const;

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; open?: string }>;
}) {
  const profile = await requireProfile();
  const { type: typeParam, open } = await searchParams;
  const type = TYPES.some((t) => t.key === typeParam) ? typeParam! : "county";

  const supabase = await createClient();

  const [receivedDelegations, myDelegations] = await Promise.all([
    listActiveDelegationsReceivedBy(profile.id),
    listDelegationsGivenBy(profile.id),
  ]);
  const identities = resolveActingIdentities({ role: profile.role, submitterId: profile.submitter_id }, receivedDelegations);
  const eligibleDelegates = await listEligibleDelegates(profile.role, profile.submitter_id, profile.id);

  const [{ data: stages }, { data: subRows }, { data: reviewers }] = await Promise.all([
    supabase
      .from("workflow_stages")
      .select("id, name, stage_key, sort_order, is_terminal")
      .eq("submitter_type", type)
      .order("sort_order"),
    supabase
      .from("submissions")
      .select("id, title, submitter_id, current_stage_id, period_year, created_at, submitter:submitters!inner(name, type)")
      .eq("submitter.type", type)
      .order("period_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("users")
      .select("id, full_name, role, submitter_id")
      .in("role", ["county_officer", "committee_member", "admin"]),
  ]);

  const stageList = stages ?? [];

  // one live submission per submitter — the highest period_year on file wins
  const seen = new Set<string>();
  const subs = (subRows ?? []).filter((s) => {
    if (seen.has(s.submitter_id)) return false;
    seen.add(s.submitter_id);
    return true;
  });
  const submissionIds = subs.map((s) => s.id);

  const [{ data: flagRows }, { data: historyRows }] = await Promise.all([
    submissionIds.length
      ? supabase.from("validation_results").select("submission_id").eq("status", "open").in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as { submission_id: string }[] }),
    submissionIds.length
      ? supabase
          .from("submission_stage_history")
          .select("id, submission_id, action, comment, acted_at, stage:workflow_stages(name), actor:users(full_name)")
          .in("submission_id", submissionIds)
          .order("acted_at", { ascending: true })
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const flagCount = new Map<string, number>();
  (flagRows ?? []).forEach((f) => flagCount.set(f.submission_id, (flagCount.get(f.submission_id) ?? 0) + 1));

  type HistoryRow = {
    id: string;
    submission_id: string;
    action: string;
    comment: string | null;
    acted_at: string;
    stage: unknown;
    actor: unknown;
  };
  const historyBySubmission = new Map<string, PipelineCardData["history"]>();
  ((historyRows ?? []) as HistoryRow[]).forEach((h) => {
    const list = historyBySubmission.get(h.submission_id) ?? [];
    list.push({
      id: h.id,
      action: h.action,
      comment: h.comment,
      actedAt: h.acted_at,
      stageName: one<{ name: string }>(h.stage)?.name ?? "—",
      actorName: one<{ full_name: string }>(h.actor)?.full_name ?? "—",
    });
    historyBySubmission.set(h.submission_id, list);
  });

  const stageOrderById = new Map(stageList.map((s) => [s.id, s.sort_order]));
  const stageById = new Map(stageList.map((s) => [s.id, s]));
  const maxOrder = Math.max(...stageList.map((s) => s.sort_order), 0);

  const cards: PipelineCardData[] = subs.map((s) => {
    const submitter = one<{ name: string; type: string }>(s.submitter);
    const stage = s.current_stage_id ? stageById.get(s.current_stage_id) : stageList[0];
    const stageKey = stage?.stage_key ?? "draft";
    const order = stage ? stageOrderById.get(stage.id) ?? 0 : 0;
    const history = (historyBySubmission.get(s.id) ?? []).sort(
      (a, b) => new Date(a.actedAt).getTime() - new Date(b.actedAt).getTime()
    );
    const enteredStageAt = history.length ? history[history.length - 1].actedAt : s.created_at;

    // Who's authorized to act on this stage for this org — prefer someone
    // scoped to this exact submitter over an unscoped, platform-wide reviewer.
    const requiredRole = STAGE_ROLE[stageKey];
    const candidates = (reviewers ?? []).filter((r) => r.role === requiredRole);
    const waitingOn =
      candidates.find((r) => r.submitter_id === s.submitter_id) ??
      candidates.find((r) => r.submitter_id === null) ??
      null;

    const actingAs = canActOnStageAs(identities, stageKey, s.submitter_id);

    return {
      id: s.id,
      title: s.title,
      submitterId: s.submitter_id,
      submitterName: submitter?.name ?? "—",
      submitterType: submitter?.type ?? type,
      stageId: stage?.id ?? stageList[0]?.id ?? "",
      stageKey,
      flags: flagCount.get(s.id) ?? 0,
      enteredStageAt,
      waitingOnName: waitingOn?.full_name ?? null,
      waitingOnInitials: waitingOn ? initials(waitingOn.full_name) : "—",
      canAdvance: order < maxOrder && !!actingAs,
      canReturn: order > 0 && !!actingAs,
      actingOnBehalfOf: actingAs?.onBehalfOf?.name ?? null,
      history,
    };
  });

  const stageInfos: StageInfo[] = stageList.map((s) => ({
    id: s.id,
    name: s.name,
    isTerminal: s.is_terminal,
  }));

  return (
    <>
      <PageHeader
        title="Plan pipeline board"
        description="Every plan as a card moving through its real approval stages. Nothing moves without a visible action attached to it."
      />

      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="inline-flex rounded-xl bg-muted p-1">
          {TYPES.map((t) => (
            <Link
              key={t.key}
              href={`/pipeline?type=${t.key}`}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-sm transition-all duration-150",
                type === t.key
                  ? "bg-card text-foreground font-medium shadow-sm ring-1 ring-foreground/6"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <DelegateDialogTrigger
          eligibleDelegates={eligibleDelegates}
          myDelegations={myDelegations}
          scopeLabel={profile.submitter?.name ?? "National level"}
        />
      </div>

      <PipelineBoard stages={stageInfos} cards={cards} initialOpenId={open ?? null} />
    </>
  );
}

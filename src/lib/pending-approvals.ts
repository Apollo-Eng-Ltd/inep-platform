// "Your pending approvals" — every live plan currently sitting in a stage
// this viewer (or someone who has delegated to them) is authorized to act
// on, oldest-waiting-first. Reads the exact same stage-and-approval records
// as the pipeline board and its side panel, so this list, the board, and the
// notifications it fires all agree at every step.
import { createClient } from "@/lib/supabase/server";
import { STAGE_ROLE, resolveActingIdentities, canActOnStageAs } from "@/lib/pipeline-rbac";
import { listActiveDelegationsReceivedBy } from "@/lib/delegations";
import { one } from "@/lib/rel";
import type { Profile } from "@/lib/auth";

export interface PendingApproval {
  submissionId: string;
  title: string;
  submitterName: string;
  submitterType: string;
  stageName: string;
  enteredStageAt: string;
  onBehalfOf: string | null;
}

export async function getPendingApprovalsFor(profile: Profile): Promise<PendingApproval[]> {
  const received = await listActiveDelegationsReceivedBy(profile.id);
  const identities = resolveActingIdentities({ role: profile.role, submitterId: profile.submitter_id }, received);

  // Skip the queries entirely if none of the viewer's identities own any stage.
  const relevantRoles = new Set(identities.map((i) => i.role));
  const relevantStageKeys = Object.entries(STAGE_ROLE)
    .filter(([, role]) => role && relevantRoles.has(role))
    .map(([key]) => key);
  if (!relevantStageKeys.length) return [];

  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("workflow_stages")
    .select("id, stage_key, name")
    .in("stage_key", relevantStageKeys);
  const stageIds = (stages ?? []).map((s) => s.id);
  if (!stageIds.length) return [];
  const stageById = new Map((stages ?? []).map((s) => [s.id, s]));

  const { data: subRows } = await supabase
    .from("submissions")
    .select("id, title, submitter_id, current_stage_id, period_year, created_at, submitter:submitters(name, type)")
    .in("current_stage_id", stageIds)
    .order("period_year", { ascending: false })
    .order("created_at", { ascending: false });

  // one live submission per submitter — the highest period_year on file wins,
  // matching the exact same dedup the pipeline board itself uses.
  const seen = new Set<string>();
  const subs = (subRows ?? []).filter((s) => {
    if (seen.has(s.submitter_id)) return false;
    seen.add(s.submitter_id);
    return true;
  });
  const submissionIds = subs.map((s) => s.id);

  const { data: historyRows } = submissionIds.length
    ? await supabase
        .from("submission_stage_history")
        .select("submission_id, acted_at")
        .in("submission_id", submissionIds)
        .order("acted_at", { ascending: false })
    : { data: [] as { submission_id: string; acted_at: string }[] };
  const latestEnteredAt = new Map<string, string>();
  (historyRows ?? []).forEach((h) => {
    if (!latestEnteredAt.has(h.submission_id)) latestEnteredAt.set(h.submission_id, h.acted_at);
  });

  const out: PendingApproval[] = [];
  subs.forEach((s) => {
    const stage = s.current_stage_id ? stageById.get(s.current_stage_id) : null;
    if (!stage) return;
    const actingAs = canActOnStageAs(identities, stage.stage_key, s.submitter_id);
    if (!actingAs) return;
    const submitter = one<{ name: string; type: string }>(s.submitter);
    out.push({
      submissionId: s.id,
      title: s.title,
      submitterName: submitter?.name ?? "—",
      submitterType: submitter?.type ?? "county",
      stageName: stage.name,
      enteredStageAt: latestEnteredAt.get(s.id) ?? s.created_at,
      onBehalfOf: actingAs.onBehalfOf?.name ?? null,
    });
  });

  return out.sort((a, b) => new Date(a.enteredStageAt).getTime() - new Date(b.enteredStageAt).getTime());
}

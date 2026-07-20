// Server-only data layer for the agent pipeline view — built entirely from
// real, logged rows in `agent_actions` and `validation_results`. Nothing
// here is invented: every count, sparkline point, ticker line, and
// pending-decision card is a real row scoped to the viewer.
//
// Types/constants shared with client components live in
// agent-pipeline-shared.ts (a plain module, no "next/headers") — importing
// THIS file from a client component would drag the server-only Supabase
// client into the browser bundle, so client code must import from there.
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth";
import { one } from "@/lib/rel";
import {
  AGENT_DEFS, AGENT_DEF_BY_ID, AGENT_EDGES,
  type AgentName, type AgentNode, type AgentGraph, type PendingItem, type NodeStatus, type TickerEvent,
} from "./agent-pipeline-shared";

export * from "./agent-pipeline-shared";

// Which agents sit at the center of the web for each role — everyone else
// still appears, just smaller and dimmer in the background.
function centralAgentsFor(profile: Profile): Set<AgentName> {
  if (profile.role === "county_officer") return new Set(["intake", "validation", "anomaly", "drafting"]);
  if (profile.role === "committee_member") return new Set(["validation", "anomaly", "cross_cutting", "compliance"]);
  return new Set(AGENT_DEFS.map((a) => a.id)); // national_planner / admin: the full web
}

const DAY_MS = 86400000;
const VERB: Record<AgentName, string> = {
  intake: "received", validation: "checked", anomaly: "flagged", aggregation: "rolled up",
  drafting: "drafted a narrative for", cross_cutting: "scored coverage for", compliance: "checked the deadline for",
  public_engagement: "drafted a reply for", query: "answered a question for", insight: "refreshed the summary for",
};

export async function getAgentGraphFor(profile: Profile): Promise<AgentGraph> {
  const supabase = await createClient();
  const scopedSubmitterId = profile.submitter_id; // null = national, unscoped

  const [{ data: actionRows }, { data: flagRows }] = await Promise.all([
    supabase
      .from("agent_actions")
      .select("id, agent, status, action_type, input_summary, proposed_output, created_at, submission:submissions(submitter_id, title, submitter:submitters(name))")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("validation_results")
      .select("id, agent, severity, rule_code, message, status, created_at, submission:submissions(submitter_id, title, submitter:submitters(name))")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  type ActionRow = {
    id: string; agent: AgentName; status: string; action_type: string; input_summary: string | null;
    proposed_output: { summary?: string } | null; created_at: string; submission: unknown;
  };
  type FlagRow = {
    id: string; agent: AgentName; severity: "error" | "warning" | "info"; rule_code: string; message: string;
    status: string; created_at: string; submission: unknown;
  };

  const submitterNameOf = (submission: unknown) => one<{ submitter_id: string; title: string; submitter: unknown }>(submission);

  const actions = ((actionRows ?? []) as ActionRow[])
    .map((a) => {
      const sub = submitterNameOf(a.submission);
      return { ...a, submitterId: sub?.submitter_id ?? null, title: sub?.title ?? "—", submitterName: one<{ name: string }>(sub?.submitter)?.name ?? "—" };
    })
    .filter((a) => !scopedSubmitterId || a.submitterId === scopedSubmitterId);

  const flags = ((flagRows ?? []) as FlagRow[])
    .map((f) => {
      const sub = submitterNameOf(f.submission);
      return { ...f, submitterId: sub?.submitter_id ?? null, title: sub?.title ?? "—", submitterName: one<{ name: string }>(sub?.submitter)?.name ?? "—" };
    })
    .filter((f) => !scopedSubmitterId || f.submitterId === scopedSubmitterId);

  const central = centralAgentsFor(profile);

  const nodes: AgentNode[] = AGENT_DEFS.map((def) => {
    const myActions = actions.filter((a) => a.agent === def.id);
    const myFlags = flags.filter((f) => f.agent === def.id);
    const count = myActions.length + myFlags.length;

    const sparkline = Array.from({ length: 7 }, (_, i) => {
      const dayStart = Date.now() - (6 - i) * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const inDay = (iso: string) => new Date(iso).getTime() >= dayStart && new Date(iso).getTime() < dayEnd;
      return myActions.filter((a) => inDay(a.created_at)).length + myFlags.filter((f) => inDay(f.created_at)).length;
    });

    const pendingActions: PendingItem[] = myActions
      .filter((a) => a.status === "proposed")
      .map((a) => ({
        id: a.id, kind: "agent_action" as const, agent: def.id,
        title: `${def.label} needs a decision`,
        message: a.proposed_output?.summary ?? a.input_summary ?? a.action_type,
        submitterName: a.submitterName, createdAt: a.created_at,
      }));
    const pendingFlags: PendingItem[] = myFlags
      .filter((f) => f.status === "open" && f.severity !== "info")
      .map((f) => ({
        id: f.id, kind: "validation_result" as const, agent: def.id,
        title: `${def.label} flags ${f.submitterName}`,
        message: f.message, submitterName: f.submitterName, createdAt: f.created_at, severity: f.severity,
      }));
    const pending = [...pendingActions, ...pendingFlags].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const recentActivity = sparkline[sparkline.length - 1] > 0 || sparkline[sparkline.length - 2] > 0;
    const status: NodeStatus = pending.length > 0 ? "needs_you" : recentActivity ? "active" : "idle";

    return { def, central: central.has(def.id), count, sparkline, status, pending };
  });

  const tickerFromActions: TickerEvent[] = actions.slice(0, 30).map((a) => ({
    id: `a-${a.id}`, agent: a.agent,
    text: `${AGENT_DEF_BY_ID.get(a.agent)?.label} ${VERB[a.agent]} ${a.submitterName}'s ${a.title}.`,
    createdAt: a.created_at,
  }));
  const tickerFromFlags: TickerEvent[] = flags.slice(0, 30).map((f) => ({
    id: `f-${f.id}`, agent: f.agent, text: f.message, createdAt: f.created_at,
  }));
  const ticker = [...tickerFromActions, ...tickerFromFlags]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 25);

  return { nodes, edges: AGENT_EDGES, ticker };
}

// Plain (no "next/headers", no "use client") module — the agent-pipeline
// types and constants that both the server data layer (agent-pipeline.ts)
// and client components (agent-pipeline-canvas.tsx, activity-ticker.tsx)
// need. Split out so importing these from a client component never drags
// the server-only Supabase client into the browser bundle.
export type AgentName =
  | "intake" | "validation" | "anomaly" | "aggregation" | "drafting"
  | "cross_cutting" | "compliance" | "public_engagement" | "query" | "insight";

export interface AgentDef {
  id: AgentName;
  label: string;
  icon: string; // lucide icon name, resolved via src/components/icon.tsx
  /** Existing design token only — no new colors. */
  color: "brand" | "provider" | "warning" | "agent" | "success" | "danger" | "private" | "muted";
  /** Rotates in the node's one-line "real job" description. */
  blurbs: string[];
}

// Ten hues aren't available in the token set (see globals.css), so a few
// agents intentionally share a color family and are told apart by icon and
// position instead — reusing tokens beats inventing new ones.
export const AGENT_DEFS: AgentDef[] = [
  {
    id: "intake", label: "Intake", icon: "Inbox", color: "provider",
    blurbs: ["Accepts submissions from counties, providers, and private-sector reporters.", "Logs the origin and format of every incoming submission."],
  },
  {
    id: "validation", label: "Validation", icon: "ListChecks", color: "brand",
    blurbs: [
      "Checking for missing required fields.",
      "Checking units against the expected standard.",
      "Checking for duplicate entries on one indicator.",
      "Checking reported values against their expected range.",
    ],
  },
  {
    id: "anomaly", label: "Anomaly", icon: "TriangleAlert", color: "warning",
    blurbs: [
      "Comparing values against a submitter's own reporting history.",
      "Comparing values against peer counties for the same period.",
      "Watching for statistical outliers versus history and peers.",
      "Watching for conflicting planning assumptions between counties.",
    ],
  },
  {
    id: "aggregation", label: "Aggregation", icon: "Layers", color: "success",
    blurbs: ["Rolls only approved data into national totals.", "Never touches a value before it's been approved."],
  },
  {
    id: "drafting", label: "Drafting", icon: "PenLine", color: "agent",
    blurbs: ["Writes a first-draft plan narrative from reported numbers.", "Always produces a draft — never a final plan."],
  },
  {
    id: "cross_cutting", label: "Cross-cutting", icon: "Scale", color: "agent",
    blurbs: ["Scoring gender coverage in the plan narrative.", "Scoring disaster-risk coverage in the plan narrative.", "Scoring environment coverage in the plan narrative."],
  },
  {
    id: "compliance", label: "Compliance", icon: "CalendarClock", color: "danger",
    blurbs: ["Tracking each submitter's configured review cycle.", "Escalating past-due reports — never penalizing."],
  },
  {
    id: "public_engagement", label: "Public engagement", icon: "MessagesSquare", color: "private",
    blurbs: ["Drafting replies to citizen comments for committee approval.", "Never publishes a reply without sign-off."],
  },
  {
    id: "query", label: "Query", icon: "Sparkles", color: "provider",
    blurbs: ["Turning a plain-English question into a chart.", "Answering ad-hoc questions about the national dataset."],
  },
  {
    id: "insight", label: "Insight", icon: "Activity", color: "agent",
    blurbs: ["Writing the plain-English summary atop the national dashboard.", "Summarizing only from data that's already been approved."],
  },
];
export const AGENT_DEF_BY_ID = new Map(AGENT_DEFS.map((a) => [a.id, a]));

/** Real data-flow edges between agents, labeled with what actually passes between them. */
export const AGENT_EDGES: { from: AgentName; to: AgentName; label: string }[] = [
  { from: "intake", to: "validation", label: "raw submissions" },
  { from: "intake", to: "anomaly", label: "raw submissions" },
  { from: "validation", to: "drafting", label: "validated records" },
  { from: "validation", to: "cross_cutting", label: "validated records" },
  { from: "anomaly", to: "compliance", label: "flagged anomalies" },
  { from: "drafting", to: "cross_cutting", label: "draft narrative" },
  { from: "cross_cutting", to: "aggregation", label: "scored narrative" },
  { from: "aggregation", to: "insight", label: "approved totals" },
  { from: "insight", to: "query", label: "national summary" },
  { from: "intake", to: "public_engagement", label: "citizen comments" },
];

export type NodeStatus = "active" | "idle" | "needs_you";

export interface PendingItem {
  id: string;
  kind: "agent_action" | "validation_result";
  agent: AgentName;
  title: string;
  message: string;
  submitterName: string;
  createdAt: string;
  severity?: "error" | "warning" | "info";
}

export interface AgentNode {
  def: AgentDef;
  central: boolean;
  count: number;
  sparkline: number[]; // last 7 days, oldest first
  status: NodeStatus;
  pending: PendingItem[];
}

export interface TickerEvent {
  id: string;
  agent: AgentName;
  text: string;
  createdAt: string;
}

export interface AgentGraph {
  nodes: AgentNode[];
  edges: { from: AgentName; to: AgentName; label: string }[];
  ticker: TickerEvent[];
}

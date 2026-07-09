// Agent service layer — public entry point.
//
// The entire "AI" surface of INEP lives behind this barrel. Today every export
// is deterministic, rule-based logic. To move to real models later, reimplement
// the individual modules (keeping the AgentResponse<T> envelope) — no UI change.
//
// Nothing here calls an external API. Nothing here writes to the database or
// makes a decision final: agents PROPOSE, humans DECIDE.

export * from "./types";
export { runValidation } from "./validation";
export { runAnomaly, type AnomalyInput } from "./anomaly";
export { runAggregation, type AggInputRow, type AggResult } from "./aggregation";
export { runInsight, type InsightInput, type IndicatorTrend, type InsightOutput } from "./insight";
export { runCountyInsight, type CountyInsightInput, type CountyInsightOutput } from "./insight";
export { runSectorInsight, type SectorInsightInput, type SectorInsightRow, type SectorInsightOutput } from "./insight";
export { runNationalInsight, type NationalOverviewInput, type NationalOverviewChip, type NationalOverviewOutput } from "./insight";
export { runDrafting, type DraftingInput, type DraftingOutput } from "./drafting";
export { runCrossCutting, type CrossCuttingInput, type Dimension, type DimensionScore } from "./crossCutting";
export { runCompliance, nextReviewDate, type ComplianceInput, type ComplianceItem } from "./compliance";
export { runQuery, type QueryDataset, type QueryOutput, type ChartSpec } from "./query";
export { runPublicEngagement, type CommentInput, type ReplyOutput } from "./publicEngagement";

import { runValidation } from "./validation";
import { runAnomaly } from "./anomaly";
import { runAggregation } from "./aggregation";
import { runInsight, runCountyInsight, runSectorInsight, runNationalInsight } from "./insight";
import { runDrafting } from "./drafting";
import { runCrossCutting } from "./crossCutting";
import { runCompliance } from "./compliance";
import { runQuery } from "./query";
import { runPublicEngagement } from "./publicEngagement";

/** Registry describing each agent — used by the "how this works" UI popups. */
export const AGENT_REGISTRY = [
  { name: "intake", label: "Intake", blurb: "Accepts submissions (form or Excel) from all three submitter types and logs their origin." },
  { name: "validation", label: "Validation", blurb: "Checks units, missing fields, duplicates, and expected ranges the moment data arrives." },
  { name: "anomaly", label: "Anomaly", blurb: "Flags numbers that look off versus a submitter's own history and its peers." },
  { name: "aggregation", label: "Aggregation", blurb: "Rolls approved data into national totals — never touches unapproved data." },
  { name: "drafting", label: "Drafting", blurb: "Writes a first-draft plan narrative from the numbers, always as a draft." },
  { name: "cross_cutting", label: "Cross-cutting", blurb: "Scores gender, disaster-risk, and environment coverage." },
  { name: "compliance", label: "Compliance", blurb: "Tracks legal deadlines and the configurable review cycle; escalates, never penalises." },
  { name: "public_engagement", label: "Public engagement", blurb: "Drafts replies to citizen comments for committee approval." },
  { name: "query", label: "Query", blurb: "Turns a plain-English question into an answer and a chart." },
  { name: "insight", label: "Insight", blurb: "Writes the plain-English summary atop the national dashboard from approved data." },
] as const;

export const agents = {
  runValidation,
  runAnomaly,
  runAggregation,
  runInsight,
  runCountyInsight,
  runSectorInsight,
  runNationalInsight,
  runDrafting,
  runCrossCutting,
  runCompliance,
  runQuery,
  runPublicEngagement,
};

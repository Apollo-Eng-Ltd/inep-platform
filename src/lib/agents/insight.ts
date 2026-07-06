// Insight agent — rule-based text generation.
// Writes the plain-English summary at the top of the national dashboard, using
// only already-aggregated, approved data. Template + data → prose that reads
// like a model wrote it. Swap the body for a real model later; keep the shape.

import { respond, type AgentResponse } from "./types";

export interface IndicatorTrend {
  slug: string;
  name: string;
  unit: string;
  latest: number;
  previous: number | null;
  isPercent: boolean;
}

export interface InsightInput {
  periodYear: number;
  countyCount: number;
  trends: IndicatorTrend[];
}

export interface InsightOutput {
  headline: string;
  body: string;
  highlights: string[];
}

function fmt(n: number, isPercent: boolean): string {
  if (isPercent) return `${n}%`;
  return n.toLocaleString("en-KE");
}

function deltaPhrase(t: IndicatorTrend): string | null {
  if (t.previous === null || t.previous === 0) return null;
  const change = (t.latest - t.previous) / t.previous;
  if (Math.abs(change) < 0.01) return `${t.name.toLowerCase()} held roughly steady`;
  const dir = change > 0 ? "up" : "down";
  const pct = Math.round(Math.abs(change) * 100);
  return `${t.name.toLowerCase()} ${dir} ${pct}%`;
}

export function runInsight(input: InsightInput): AgentResponse<InsightOutput> {
  const { periodYear, countyCount, trends } = input;

  const access = trends.find((t) => t.slug === "electricity_access_pct");
  const connections = trends.find((t) => t.slug === "grid_connections");
  const cooking = trends.find((t) => t.slug === "clean_cooking_pct");

  const headline = access
    ? `National electricity access at ${fmt(access.latest, true)} across ${countyCount} counties`
    : `National energy summary for ${periodYear}`;

  const sentences: string[] = [];
  if (access) {
    const d = deltaPhrase(access);
    sentences.push(
      `Across the ${countyCount} counties reporting in ${periodYear}, average electricity access stands at ${fmt(
        access.latest,
        true
      )}${d ? `, with ${d} on the previous cycle` : ""}.`
    );
  }
  if (connections) {
    sentences.push(
      `Counties together report ${fmt(connections.latest, false)} households connected to the grid.`
    );
  }
  if (cooking) {
    sentences.push(
      `Clean cooking access remains the widest gap at ${fmt(cooking.latest, true)}, and is the clearest priority for the coming cycle.`
    );
  }
  sentences.push(
    "These figures cover approved county submissions only; national petroleum and emissions data shown elsewhere are sourced separately from EPRA."
  );

  // Top movers as highlights
  const highlights = trends
    .map((t) => ({ t, d: t.previous ? (t.latest - t.previous) / t.previous : 0 }))
    .filter((x) => Math.abs(x.d) >= 0.05)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 3)
    .map(
      ({ t, d }) =>
        `${t.name} ${d > 0 ? "▲" : "▼"} ${Math.round(Math.abs(d) * 100)}% — now ${fmt(
          t.latest,
          t.isPercent
        )} ${t.isPercent ? "" : t.unit}`.trim()
    );

  return respond(
    "insight",
    { headline, body: sentences.join(" "), highlights },
    0.88
  );
}

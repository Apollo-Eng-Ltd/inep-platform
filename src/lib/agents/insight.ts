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

// ---------------------------------------------------------------------------
// County-level insight — one plain-English sentence for the officer's home
// screen, built from that county's own indicator trends. Same rule-based
// engine, smaller scope: no aggregation, no cross-county comparison.

export interface CountyInsightInput {
  trends: IndicatorTrend[];
  openFlags: number;
}

export interface CountyInsightOutput {
  text: string;
}

export function runCountyInsight(input: CountyInsightInput): AgentResponse<CountyInsightOutput> {
  const { trends, openFlags } = input;

  const withDelta = trends
    .filter((t) => t.previous !== null && t.previous !== 0)
    .map((t) => ({ t, d: (t.latest - (t.previous as number)) / (t.previous as number) }));

  let text: string;
  if (withDelta.length === 0) {
    text =
      openFlags > 0
        ? `${openFlags} open data ${openFlags === 1 ? "flag needs" : "flags need"} a look before this submission moves forward.`
        : "No prior-year data to compare yet — trends will show once last year's report is on file.";
  } else {
    const top = withDelta.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a));
    const dir = top.d >= 0 ? "higher" : "lower";
    const mag = Math.abs(top.d);
    const magPhrase = mag >= 1 ? `${Math.round(mag + 1)}x` : `${Math.round(mag * 100)}%`;
    const verb = mag >= 1 ? "are" : "is";
    text = `Your ${top.t.name.toLowerCase()} ${verb} ${magPhrase} ${dir} than last year.`;
    if (mag >= 0.4) {
      text += " Worth double-checking before you submit.";
    } else if (openFlags > 0) {
      text += ` There ${openFlags === 1 ? "is" : "are"} also ${openFlags} open data ${openFlags === 1 ? "flag" : "flags"} to review.`;
    } else {
      text += " That's in line with a steady reporting trend.";
    }
  }

  return respond("insight", { text }, 0.82);
}

// ---------------------------------------------------------------------------
// Sector-level insight — one sentence for the sector form screen, comparing
// this county's year-on-year movement against the national average for the
// same indicator where that comparison is available (national_summaries).

export interface SectorInsightRow {
  name: string;
  latest: number | null;
  previous: number | null;
  nationalLatest: number | null;
  nationalPrevious: number | null;
}

export interface SectorInsightInput {
  sectorName: string;
  rows: SectorInsightRow[];
}

export interface SectorInsightOutput {
  text: string;
}

export function runSectorInsight(input: SectorInsightInput): AgentResponse<SectorInsightOutput> {
  const { sectorName, rows } = input;

  const comparable = rows.filter(
    (r) =>
      r.latest != null &&
      r.previous != null &&
      r.previous !== 0 &&
      r.nationalLatest != null &&
      r.nationalPrevious != null &&
      r.nationalPrevious !== 0
  );

  let text: string;
  if (comparable.length > 0) {
    const scored = comparable.map((r) => {
      const countyChange = (r.latest! - r.previous!) / r.previous!;
      const nationalChange = (r.nationalLatest! - r.nationalPrevious!) / r.nationalPrevious!;
      return { r, countyChange, nationalChange, gap: countyChange - nationalChange };
    });
    const top = scored.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
    const countyPct = Math.round(top.countyChange * 100);
    const nationalPct = Math.round(top.nationalChange * 100);

    if (Math.abs(top.gap) < 0.03) {
      text = `${top.r.name} is moving in line with the national trend — up ${countyPct}% here and ${nationalPct}% nationally.`;
    } else if (top.gap > 0) {
      text = `${top.r.name} is rising faster here than the national average — ${countyPct}% versus ${nationalPct}% nationally.`;
    } else {
      text = `${top.r.name} is behind the national pace — ${countyPct}% here versus ${nationalPct}% nationally.`;
    }
  } else {
    const withTrend = rows.filter((r) => r.latest != null && r.previous != null && r.previous !== 0);
    if (withTrend.length > 0) {
      const top = withTrend.reduce((a, b) =>
        Math.abs((b.latest! - b.previous!) / b.previous!) > Math.abs((a.latest! - a.previous!) / a.previous!)
          ? b
          : a
      );
      const pct = Math.round(((top.latest! - top.previous!) / top.previous!) * 100);
      text = `${top.name} is ${pct >= 0 ? "up" : "down"} ${Math.abs(pct)}% versus last year.`;
    } else {
      text = `Fill in this year's numbers to see how ${sectorName.toLowerCase()} is trending.`;
    }
  }

  return respond("insight", { text }, 0.8);
}

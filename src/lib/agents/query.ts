// Query agent — rule-based natural-language question answering.
// Parses a plain-English question by intent (which indicator, which submitter,
// ranking, trend) and returns an answer plus a chart spec the UI can render.
// A real NL model can replace parseIntent + compose without changing the shape.

import { respond, type AgentResponse } from "./types";

export interface QueryDataset {
  // one flat table the agent can answer over
  rows: {
    submitter: string;
    submitterType: "county" | "national_provider" | "private_sector";
    indicatorSlug: string;
    indicatorName: string;
    unit: string;
    year: number;
    value: number;
  }[];
  indicators: { slug: string; name: string; unit: string }[];
}

export interface ChartSpec {
  type: "bar" | "line";
  title: string;
  unit: string;
  data: { label: string; value: number }[];
}

export interface QueryOutput {
  answer: string;
  chart: ChartSpec | null;
  matchedIndicator?: string;
}

type Intent = "rank_top" | "rank_bottom" | "trend" | "value" | "unknown";

function parseIntent(q: string): Intent {
  const s = q.toLowerCase();
  if (/\b(top|highest|most|best|leading)\b/.test(s)) return "rank_top";
  if (/\b(bottom|lowest|least|worst|fewest)\b/.test(s)) return "rank_bottom";
  if (/\b(trend|over time|change|growth|history|year)\b/.test(s)) return "trend";
  if (/\b(how many|how much|what is|value of)\b/.test(s)) return "value";
  return "unknown";
}

function matchIndicator(q: string, indicators: QueryDataset["indicators"]) {
  const s = q.toLowerCase();
  // score by how many words of the indicator name appear in the question
  let best: { slug: string; name: string; unit: string; score: number } | null = null;
  for (const ind of indicators) {
    const words = ind.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const score = words.filter((w) => s.includes(w)).length + (s.includes(ind.slug) ? 2 : 0);
    if (score > 0 && (!best || score > best.score)) best = { ...ind, score };
  }
  return best;
}

export function runQuery(question: string, ds: QueryDataset): AgentResponse<QueryOutput> {
  const intent = parseIntent(question);
  const ind = matchIndicator(question, ds.indicators);

  if (!ind) {
    return respond<QueryOutput>(
      "query",
      {
        answer:
          "I couldn't match that to a tracked indicator. Try naming one, e.g. \"electricity access\", \"solar home systems\", or \"clean cooking\".",
        chart: null,
      },
      0.4
    );
  }

  const latestYear = Math.max(...ds.rows.map((r) => r.year));

  if (intent === "trend") {
    // trend across years, averaged across submitters
    const byYear = new Map<number, number[]>();
    for (const r of ds.rows.filter((r) => r.indicatorSlug === ind.slug)) {
      const arr = byYear.get(r.year) ?? [];
      arr.push(r.value);
      byYear.set(r.year, arr);
    }
    const data = [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, vals]) => ({
        label: String(year),
        value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
      }));
    return respond<QueryOutput>(
      "query",
      {
        answer: `${ind.name} across the reporting period: ${data
          .map((d) => `${d.label} — ${d.value} ${ind.unit}`)
          .join(", ")}.`,
        chart: { type: "line", title: `${ind.name} over time`, unit: ind.unit, data },
        matchedIndicator: ind.slug,
      },
      0.85
    );
  }

  // ranking (default to top when unclear)
  const rows = ds.rows.filter((r) => r.indicatorSlug === ind.slug && r.year === latestYear);
  rows.sort((a, b) => b.value - a.value);
  const bottom = intent === "rank_bottom";
  const picked = (bottom ? [...rows].reverse() : rows).slice(0, 8);
  const answer =
    picked.length === 0
      ? `No ${latestYear} data found for ${ind.name}.`
      : `${bottom ? "Lowest" : "Highest"} ${ind.name} (${latestYear}): ${picked
          .slice(0, 3)
          .map((r) => `${r.submitter} (${r.value} ${ind.unit})`)
          .join(", ")}.`;

  return respond<QueryOutput>(
    "query",
    {
      answer,
      chart: {
        type: "bar",
        title: `${bottom ? "Lowest" : "Highest"} ${ind.name} — ${latestYear}`,
        unit: ind.unit,
        data: picked.map((r) => ({ label: r.submitter, value: r.value })),
      },
      matchedIndicator: ind.slug,
    },
    0.85
  );
}

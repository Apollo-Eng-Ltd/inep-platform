// Aggregation agent — rule-based roll-up.
// Rolls APPROVED submission values into national totals per indicator per year.
// Percent indicators are averaged; absolute indicators are summed. It refuses to
// aggregate anything not marked approved/published (enforced by the caller
// passing only approved rows).

import { respond, type AgentResponse } from "./types";

export interface AggInputRow {
  indicatorSlug: string;
  indicatorName: string;
  unit: string;
  isPercent: boolean;
  year: number;
  value: number;
}

export interface AggResult {
  indicatorSlug: string;
  indicatorName: string;
  unit: string;
  year: number;
  aggregated: number;
  submitterCount: number;
}

export function runAggregation(rows: AggInputRow[]): AgentResponse<AggResult[]> {
  const groups = new Map<string, AggInputRow[]>();
  for (const r of rows) {
    const key = `${r.indicatorSlug}::${r.year}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const results: AggResult[] = [];
  for (const arr of groups.values()) {
    const first = arr[0];
    const values = arr.map((r) => r.value);
    const aggregated = first.isPercent
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : Math.round(values.reduce((a, b) => a + b, 0));
    results.push({
      indicatorSlug: first.indicatorSlug,
      indicatorName: first.indicatorName,
      unit: first.unit,
      year: first.year,
      aggregated,
      submitterCount: arr.length,
    });
  }

  results.sort((a, b) => a.indicatorName.localeCompare(b.indicatorName) || a.year - b.year);
  return respond("aggregation", results, 0.97);
}

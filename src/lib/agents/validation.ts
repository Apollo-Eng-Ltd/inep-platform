// Validation agent — rule-based.
// Checks completeness, units, duplicates, and expected ranges for a submission.
// Mirrors what a model would flag, but deterministic and explainable.

import type { Indicator, SubmissionValue } from "@/lib/types";
import { respond, type AgentResponse, type Finding } from "./types";

export function runValidation(
  values: SubmissionValue[],
  indicators: Indicator[]
): AgentResponse<Finding[]> {
  const findings: Finding[] = [];
  const byIndicator = new Map<string, SubmissionValue[]>();
  for (const v of values) {
    const arr = byIndicator.get(v.indicator_id) ?? [];
    arr.push(v);
    byIndicator.set(v.indicator_id, arr);
  }

  for (const ind of indicators) {
    const rows = byIndicator.get(ind.id) ?? [];

    // Missing value
    if (rows.length === 0 || rows[0].value === null || rows[0].value === undefined) {
      findings.push({
        agent: "validation",
        indicatorSlug: ind.slug,
        severity: "error",
        ruleCode: "MISSING_VALUE",
        message: `${ind.name} is required but was not reported.`,
      });
      continue;
    }

    // Duplicate entries for one indicator
    if (rows.length > 1) {
      findings.push({
        agent: "validation",
        indicatorSlug: ind.slug,
        severity: "warning",
        ruleCode: "DUPLICATE",
        message: `${ind.name} was reported ${rows.length} times — expected once.`,
        details: { count: rows.length },
      });
    }

    const row = rows[0];

    // Unit mismatch
    if (row.unit && row.unit !== ind.unit) {
      findings.push({
        agent: "validation",
        indicatorSlug: ind.slug,
        severity: "warning",
        ruleCode: "UNIT_MISMATCH",
        message: `${ind.name} reported in "${row.unit}" but the expected unit is "${ind.unit}".`,
        details: { reported: row.unit, expected: ind.unit },
      });
    }

    // Out of expected range
    const val = row.value as number;
    if (ind.expected_min !== null && val < ind.expected_min) {
      findings.push({
        agent: "validation",
        indicatorSlug: ind.slug,
        severity: "warning",
        ruleCode: "BELOW_RANGE",
        message: `${ind.name} (${val} ${ind.unit}) is below the expected minimum of ${ind.expected_min}.`,
        details: { value: val, min: ind.expected_min },
      });
    }
    if (ind.expected_max !== null && val > ind.expected_max) {
      findings.push({
        agent: "validation",
        indicatorSlug: ind.slug,
        severity: "error",
        ruleCode: "ABOVE_RANGE",
        message: `${ind.name} (${val} ${ind.unit}) exceeds the expected maximum of ${ind.expected_max}.`,
        details: { value: val, max: ind.expected_max },
      });
    }
  }

  // Confidence dips a little when there are many findings — feels model-like.
  const confidence = Math.max(0.6, 0.95 - findings.length * 0.03);
  return respond("validation", findings, confidence);
}

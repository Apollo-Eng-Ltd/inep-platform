// Cross-cutting agent — rule-based scoring.
// Scores a submission on gender, disaster risk, and environment coverage by
// scanning the narrative for relevant terms and checking whether supporting
// indicators were reported. Produces a 0..100 score + a rationale per dimension.

import { respond, type AgentResponse } from "./types";

export type Dimension = "gender" | "disaster_risk" | "environment";

const KEYWORDS: Record<Dimension, string[]> = {
  gender: ["gender", "women", "girls", "inclusion", "youth", "vulnerable", "equity"],
  disaster_risk: ["disaster", "risk", "climate", "drought", "flood", "resilience", "hazard"],
  environment: ["environment", "emission", "conservation", "biodiversity", "renewable", "clean", "sustainab"],
};

export interface CrossCuttingInput {
  narrative: string;
  /** slugs of indicators that were actually reported, used as supporting evidence */
  reportedSlugs: string[];
}

export interface DimensionScore {
  dimension: Dimension;
  score: number;
  rationale: string;
}

const SUPPORTING: Record<Dimension, string[]> = {
  gender: ["clean_cooking_pct", "improved_cookstoves"],
  disaster_risk: ["mini_grids", "solar_home_systems"],
  environment: ["firewood_dependency_pct", "efficiency_savings_gwh", "biogas_digesters"],
};

export function runCrossCutting(input: CrossCuttingInput): AgentResponse<DimensionScore[]> {
  const text = (input.narrative || "").toLowerCase();
  const scores: DimensionScore[] = (Object.keys(KEYWORDS) as Dimension[]).map((dim) => {
    const hits = KEYWORDS[dim].filter((k) => text.includes(k)).length;
    const support = SUPPORTING[dim].filter((s) => input.reportedSlugs.includes(s)).length;

    // keyword coverage (up to 60) + indicator support (up to 40)
    const kwScore = Math.min(60, hits * 15);
    const supScore = Math.min(40, support * 20);
    const score = Math.max(10, Math.min(100, kwScore + supScore));

    const label = dim.replace("_", " ");
    const rationale =
      hits === 0 && support === 0
        ? `No explicit ${label} references or supporting indicators found — consider strengthening this area.`
        : `${hits} narrative reference${hits === 1 ? "" : "s"} to ${label} and ${support} supporting indicator${
            support === 1 ? "" : "s"
          } reported.`;

    return { dimension: dim, score, rationale };
  });

  return respond("cross_cutting", scores, 0.8);
}

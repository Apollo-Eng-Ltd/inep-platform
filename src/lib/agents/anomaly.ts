// Anomaly agent — rule-based.
// Compares each indicator against (a) the submitter's own history and (b) its
// peers (other counties in the same period), flagging values that look off.
// This is the "AI-assisted checks for outliers and conflicting assumptions"
// requirement, done with transparent statistics instead of a model.

import type { Indicator, SeriesPoint } from "@/lib/types";
import { respond, type AgentResponse, type Finding } from "./types";

const YOY_JUMP_THRESHOLD = 0.25; // 25% year-on-year change is notable
const PEER_Z_THRESHOLD = 2.2; // std-devs from the peer mean

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}
function stdev(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export interface AnomalyInput {
  indicator: Indicator;
  current: number;
  /** Prior years for this same submitter, most-recent last. */
  history: SeriesPoint[];
  /** Same-period values from peer submitters. */
  peers: number[];
}

export function runAnomaly(inputs: AnomalyInput[]): AgentResponse<Finding[]> {
  const findings: Finding[] = [];

  for (const { indicator, current, history, peers } of inputs) {
    // (a) Year-on-year jump vs the submitter's own last reported value
    const prev = history.length ? history[history.length - 1].value : null;
    if (prev !== null && prev > 0) {
      const change = (current - prev) / prev;
      if (Math.abs(change) >= YOY_JUMP_THRESHOLD) {
        findings.push({
          agent: "anomaly",
          indicatorSlug: indicator.slug,
          severity: Math.abs(change) >= 0.5 ? "error" : "warning",
          ruleCode: "YOY_JUMP",
          message: `${indicator.name} ${change > 0 ? "rose" : "fell"} ${Math.round(
            Math.abs(change) * 100
          )}% versus last year — unusually large for this submitter.`,
          details: { previous: prev, current, changePct: Math.round(change * 100) },
        });
      }
    }

    // (b) Peer outlier: how far from the peer group's mean
    if (peers.length >= 3) {
      const m = mean(peers);
      const sd = stdev(peers, m);
      if (sd > 0) {
        const z = (current - m) / sd;
        if (Math.abs(z) >= PEER_Z_THRESHOLD) {
          findings.push({
            agent: "anomaly",
            indicatorSlug: indicator.slug,
            severity: "warning",
            ruleCode: "PEER_OUTLIER",
            message: `${indicator.name} is well ${
              z > 0 ? "above" : "below"
            } comparable submitters (${current} vs a peer average of ${Math.round(m)}).`,
            details: { value: current, peerMean: Math.round(m), z: Math.round(z * 10) / 10 },
          });
        }
      }
    }
  }

  const confidence = Math.max(0.6, 0.92 - findings.length * 0.03);
  return respond("anomaly", findings, confidence);
}

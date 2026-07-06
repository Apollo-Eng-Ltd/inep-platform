// Common shapes for the agent service layer.
//
// Every agent returns an `AgentResponse<T>`: a thin envelope that looks like an
// LLM response (an engine label, a timestamp, an optional confidence) wrapping a
// typed payload. UI code reads `AgentResponse` and never cares whether the body
// was produced by rules or by a real model. To swap in a live model later,
// replace the function internals and keep this envelope identical.

export type AgentName =
  | "intake"
  | "validation"
  | "anomaly"
  | "aggregation"
  | "drafting"
  | "cross_cutting"
  | "compliance"
  | "public_engagement"
  | "query"
  | "insight";

export type Severity = "error" | "warning" | "info";

/** A single issue raised by the validation or anomaly agents. */
export interface Finding {
  agent: Extract<AgentName, "validation" | "anomaly">;
  indicatorSlug?: string;
  severity: Severity;
  ruleCode: string;
  message: string;
  details?: Record<string, unknown>;
}

/** The uniform envelope returned by every agent call. */
export interface AgentResponse<T> {
  agent: AgentName;
  /** Which engine produced this. Rules today; a model id tomorrow. */
  engine: string;
  generatedAt: string;
  /** 0..1 — synthetic for the rule engine, real for a model. */
  confidence: number;
  data: T;
}

export const RULE_ENGINE = "rule-based-v1";

export function respond<T>(
  agent: AgentName,
  data: T,
  confidence = 0.9
): AgentResponse<T> {
  return {
    agent,
    engine: RULE_ENGINE,
    generatedAt: new Date().toISOString(),
    confidence,
    data,
  };
}

// Public engagement agent — rule-based reply drafting.
// Reads a citizen comment and drafts a courteous reply for a human to approve.
// It NEVER sends: the output is always a proposed draft.

import { respond, type AgentResponse } from "./types";

export interface CommentInput {
  authorName?: string | null;
  sectionReferenced?: string | null;
  ward?: string | null;
  body: string;
}

export interface ReplyOutput {
  draft: string;
  suggestedStatus: "approve" | "review";
  topic: string;
}

const TOPIC_HINTS: { match: RegExp; topic: string; line: string }[] = [
  { match: /cook|stove|charcoal|firewood/i, topic: "clean cooking", line: "The plan includes targets for improved cookstove distribution and clean cooking access, detailed in the Bio-energy section." },
  { match: /solar|off.?grid|mini.?grid|connect|electric/i, topic: "electricity access", line: "Expanding connections and off-grid solar is a priority in the Energy Access section of the plan." },
  { match: /cost|price|tariff|afford/i, topic: "affordability", line: "Tariff and affordability considerations are noted, and the county will engage the relevant providers on pricing concerns." },
  { match: /job|employ|train|youth/i, topic: "livelihoods", line: "The plan links energy investment to local jobs and skills, including staff and community training." },
];

export function runPublicEngagement(input: CommentInput): AgentResponse<ReplyOutput> {
  const hint = TOPIC_HINTS.find((h) => h.match.test(input.body));
  const name = input.authorName?.split(/\s+/)[0] || "there";
  const wardBit = input.ward ? ` from ${input.ward} ward` : "";

  const draft = [
    `Dear ${name}, thank you for your input${wardBit}.`,
    hint ? hint.line : "Your comment has been recorded and shared with the planning committee for consideration.",
    "Public participation directly shapes the priorities in this plan, and we encourage you to stay engaged as it progresses.",
  ].join(" ");

  return respond(
    "public_engagement",
    {
      draft,
      suggestedStatus: hint ? "approve" : "review",
      topic: hint?.topic ?? "general",
    },
    hint ? 0.8 : 0.55
  );
}

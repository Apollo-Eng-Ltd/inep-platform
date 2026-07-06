// Drafting agent — rule-based narrative generation.
// Produces a first-draft plan narrative from a submission's numbers, grouped by
// sector. Always a DRAFT: the UI must show it as agent-proposed, never final.

import type { Indicator, Sector, SubmissionValue } from "@/lib/types";
import { respond, type AgentResponse } from "./types";

export interface DraftingInput {
  submitterName: string;
  submitterType: "county" | "national_provider" | "private_sector";
  periodYear: number;
  sectors: Sector[];
  indicators: Indicator[];
  values: SubmissionValue[];
}

export interface DraftingOutput {
  title: string;
  paragraphs: { heading: string; text: string }[];
  wordCount: number;
}

function fmtVal(v: number, unit: string): string {
  const isPct = unit === "%";
  return isPct ? `${v}%` : `${v.toLocaleString("en-KE")} ${unit}`;
}

export function runDrafting(input: DraftingInput): AgentResponse<DraftingOutput> {
  const { submitterName, periodYear, sectors, indicators, values } = input;
  const valueBy = new Map(values.map((v) => [v.indicator_id, v]));

  const paragraphs: { heading: string; text: string }[] = [];

  paragraphs.push({
    heading: "Introduction",
    text: `This energy plan sets out ${submitterName}'s position and priorities for the ${periodYear} planning cycle. It is prepared in line with the Integrated National Energy Plan framework and aligns with the entity's development priorities. The figures below are drawn directly from the reported indicators and should be reviewed by the planning committee before adoption.`,
  });

  for (const sector of sectors) {
    const sectorInds = indicators.filter((i) => i.sector_id === sector.id);
    const reported = sectorInds
      .map((i) => ({ i, v: valueBy.get(i.id) }))
      .filter((x) => x.v && x.v.value !== null) as { i: Indicator; v: SubmissionValue }[];
    if (reported.length === 0) continue;

    const clauses = reported
      .map(({ i, v }) => `${i.name.toLowerCase()} at ${fmtVal(v.value as number, i.unit)}`)
      .join(", ");
    paragraphs.push({
      heading: sector.name,
      text: `In the ${sector.name.toLowerCase()} area, ${submitterName} reports ${clauses}. These figures form the baseline against which progress will be measured over the plan period, and inform the interventions prioritised for the coming year.`,
    });
  }

  paragraphs.push({
    heading: "Cross-cutting considerations",
    text: `The plan takes into account gender inclusion, disaster and climate risk, and environmental safeguards across all interventions. Public participation at ward level has informed the priorities set out above, consistent with statutory requirements.`,
  });

  const wordCount = paragraphs.reduce((n, p) => n + p.text.split(/\s+/).length, 0);
  return respond(
    "drafting",
    { title: `${submitterName} Energy Plan ${periodYear} (Draft)`, paragraphs, wordCount },
    0.82
  );
}

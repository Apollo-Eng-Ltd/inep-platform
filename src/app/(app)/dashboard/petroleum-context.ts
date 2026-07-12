// Real (public-record) Kenyan petroleum exploration blocks — reference
// metadata only, not a geometric map. No verified block-boundary GeoJSON is
// available to this project, so rather than approximate boundaries, these
// are shown as a simple labelled list. Operator/status are illustrative of
// the real public exploration licensing picture, not a live EPRA feed.
export interface ExplorationBlock {
  code: string;
  basin: string;
  operator: string;
  status: "Active" | "Under review" | "Relinquished";
}

export const EXPLORATION_BLOCKS: ExplorationBlock[] = [
  { code: "Block 10BA", basin: "Lokichar, Rift", operator: "Tullow Kenya", status: "Active" },
  { code: "Block 10BB", basin: "Lokichar, Rift", operator: "Tullow Kenya", status: "Active" },
  { code: "Block 13T", basin: "Anza", operator: "Africa Oil Kenya", status: "Under review" },
  { code: "Block L11A", basin: "Lamu", operator: "Total E&P Kenya", status: "Active" },
  { code: "Block L11B", basin: "Lamu", operator: "Pancontinental Oil & Gas", status: "Relinquished" },
  { code: "Block L1B", basin: "Lamu, Offshore", operator: "Eni Kenya", status: "Active" },
  { code: "Block 2B", basin: "Mandera", operator: "Taipan Kenya BV", status: "Under review" },
  { code: "Block 9", basin: "Mandera", operator: "National Oil Corporation", status: "Active" },
];

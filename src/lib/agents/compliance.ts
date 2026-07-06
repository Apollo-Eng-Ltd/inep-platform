// Compliance agent — rule-based deadline tracking.
// Reads the active planning cycle plus each submitter's configurable review
// cycle, and reports what is due, overdue, or upcoming. It never penalises —
// it only surfaces status for a human to act on.

import { respond, type AgentResponse } from "./types";

export interface ComplianceItem {
  label: string;
  dueDate: string; // ISO date
  status: "overdue" | "due_soon" | "on_track" | "done";
  daysRemaining: number;
  submitter?: string;
}

export interface ComplianceInput {
  today: string; // ISO date
  deadlines: {
    label: string;
    dueDate: string;
    submitter?: string;
    completed?: boolean;
  }[];
}

const DUE_SOON_DAYS = 30;

export function runCompliance(input: ComplianceInput): AgentResponse<ComplianceItem[]> {
  const today = new Date(input.today).getTime();

  const items: ComplianceItem[] = input.deadlines.map((d) => {
    const due = new Date(d.dueDate).getTime();
    const daysRemaining = Math.round((due - today) / (1000 * 60 * 60 * 24));
    let status: ComplianceItem["status"];
    if (d.completed) status = "done";
    else if (daysRemaining < 0) status = "overdue";
    else if (daysRemaining <= DUE_SOON_DAYS) status = "due_soon";
    else status = "on_track";
    return { label: d.label, dueDate: d.dueDate, status, daysRemaining, submitter: d.submitter };
  });

  // Sort worst-first so the UI can lead with what needs attention.
  const order = { overdue: 0, due_soon: 1, on_track: 2, done: 3 };
  items.sort((a, b) => order[a.status] - order[b.status] || a.daysRemaining - b.daysRemaining);

  return respond("compliance", items, 0.95);
}

/** Helper: derive the next review date from a configurable cycle length. */
export function nextReviewDate(lastReviewISO: string, cycleYears: number): string {
  const d = new Date(lastReviewISO);
  d.setFullYear(d.getFullYear() + cycleYears);
  return d.toISOString().slice(0, 10);
}

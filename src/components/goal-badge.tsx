// Small, consistent "capability tags" — quiet pills naming which official
// 2026 NGDA Challenge Team Goal a screen or section answers. Purely
// presentational, no data or logic implications. Kept deliberately quiet
// (muted background, small text) so they read as system chrome, not as
// marketing — meant to sit in a card corner and still be noticed on a scan.
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const CHALLENGE_GOALS = {
  1: "Core data fields, indicators & assumptions",
  2: "Standardized template & database structure",
  3: "Automated validation checks",
  4: "Aggregation → national summaries",
  5: "Dashboards & visual comparison",
  6: "Submission & storage of plans",
} as const;

// Short form for the quiet on-screen pill; the full sentence above still
// shows on hover via the title attribute.
const SHORT_LABEL = {
  1: "Structured data fields",
  2: "Standardized template",
  3: "Automated validation",
  4: "Aggregation",
  5: "Comparison dashboard",
  6: "Plan storage",
} as const;

export type GoalNumber = keyof typeof CHALLENGE_GOALS;

export function GoalBadge({ goal, className }: { goal: GoalNumber; className?: string }) {
  return (
    <span
      title={`Challenge Team Goal #${goal}: ${CHALLENGE_GOALS[goal]}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted/70 text-muted-foreground px-2 py-0.5 text-[10.5px] font-medium tracking-tight",
        className
      )}
    >
      <Target className="size-3 opacity-70" />
      {SHORT_LABEL[goal]}
    </span>
  );
}

export function GoalBadgeRow({ goals, className }: { goals: GoalNumber[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {goals.map((g) => (
        <GoalBadge key={g} goal={g} />
      ))}
    </div>
  );
}

import { Landmark } from "lucide-react";

/**
 * Marks a chart as sourced from EPRA's own national records rather than
 * rolled up from county submissions — this platform displays that figure as
 * context, it didn't generate it. Keep this next to any chart driven by
 * `epraRows` / `national_summaries.source = "epra_national"`.
 */
export function NationalContextBadge({ label = "National context" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Landmark className="size-2.5" />
      {label}
    </span>
  );
}

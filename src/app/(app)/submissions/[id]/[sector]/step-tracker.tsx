import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_CLASSES, accentFor, type SectorAccent } from "@/lib/sector-theme";

export interface StepSector {
  slug: string;
  name: string;
  done: number;
  total: number;
}

export function StepTracker({
  submissionId,
  sectors,
  currentSlug,
}: {
  submissionId: string;
  sectors: StepSector[];
  currentSlug: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mt-4 mb-6">
      {sectors.map((s, i) => {
        const isCurrent = s.slug === currentSlug;
        const isComplete = s.total > 0 && s.done === s.total;
        const accent: SectorAccent = accentFor(s.slug);
        const tone = ACCENT_CLASSES[accent];

        return (
          <div key={s.slug} className="flex items-center gap-1.5 flex-1">
            <Link
              href={`/submissions/${submissionId}/${s.slug}`}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-w-0",
                isCurrent
                  ? cn(tone.bgSoft, tone.text, "font-semibold ring-1 ring-inset", tone.ringStatic)
                  : isComplete
                    ? "bg-success-soft text-success"
                    : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {isComplete && !isCurrent && <Check className="size-3 shrink-0" />}
              <span className="truncate">{s.name}</span>
            </Link>
            {i < sectors.length - 1 && <span className="h-px flex-1 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

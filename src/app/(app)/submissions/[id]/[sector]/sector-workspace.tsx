"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { RingProgress } from "@/components/charts";
import { saveIndicatorValue } from "./actions";
import { ACCENT_CLASSES, type SectorAccent } from "@/lib/sector-theme";
import { fmtNum } from "@/lib/format";
import { ArrowUpRight, ArrowDownRight, AlertTriangle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// Matches the anomaly agent's YOY_JUMP_THRESHOLD (src/lib/agents/anomaly.ts) —
// the same 25% cutoff, so a cell flags here exactly when the rule-based
// validation would flag it once submitted.
const JUMP_THRESHOLD = 0.25;

export interface SectorRow {
  id: string;
  name: string;
  unit: string;
  initialValue: number | null;
  lastYear: number | null;
}

export function SectorWorkspace({
  submissionId,
  accent,
  rows,
  insightText,
}: {
  submissionId: string;
  accent: SectorAccent;
  rows: SectorRow[];
  insightText: string;
}) {
  const tone = ACCENT_CLASSES[accent];
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.initialValue]))
  );
  const persisted = useRef<Record<string, number | null>>(
    Object.fromEntries(rows.map((r) => [r.id, r.initialValue]))
  );
  const [, startTransition] = useTransition();

  const doneCount = rows.filter((r) => values[r.id] != null).length;
  const completionPct = rows.length ? (doneCount / rows.length) * 100 : 0;

  const flagged = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const r of rows) {
      const cur = values[r.id];
      const prev = r.lastYear;
      if (cur == null || prev == null || prev === 0) {
        map[r.id] = null;
        continue;
      }
      const change = (cur - prev) / prev;
      if (Math.abs(change) >= JUMP_THRESHOLD) {
        const dir = change > 0 ? "rose" : "fell";
        map[r.id] = `${r.name} ${dir} ${Math.round(Math.abs(change) * 100)}% versus last year — unusually large for this county. Worth double-checking before you continue.`;
      } else {
        map[r.id] = null;
      }
    }
    return map;
  }, [rows, values]);

  const warningsCount = Object.values(flagged).filter(Boolean).length;

  // Deep-linked from a flagged finding elsewhere (e.g. the review page): jump
  // to that row, flash it, and put the cursor in its input.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const match = window.location.hash.match(/^#ind-(.+)$/);
    const targetId = match?.[1];
    if (!targetId || !rows.some((r) => r.id === targetId)) return;
    const el = document.getElementById(`ind-${targetId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.querySelector("input")?.focus();
    const showTimer = setTimeout(() => setHighlightId(targetId), 0);
    const hideTimer = setTimeout(() => setHighlightId(null), 2500);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (indicatorId: string, unit: string, value: number | null) => {
    if (persisted.current[indicatorId] === value) return;
    persisted.current[indicatorId] = value;
    startTransition(async () => {
      const res = await saveIndicatorValue(submissionId, indicatorId, unit, value);
      if (res.error) toast.error(res.error);
    });
  };

  return (
    <TooltipProvider>
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-6 mb-4 px-1">
        <div className="flex items-center gap-2.5">
          <RingProgress pct={completionPct} toneVar={tone.cssVar} />
          <div className="leading-tight">
            <p className="text-sm font-medium tabular-nums">{doneCount}/{rows.length} fields</p>
            <p className="text-xs text-muted-foreground">complete</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "size-10 rounded-full grid place-items-center shrink-0",
              warningsCount > 0 ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"
            )}
          >
            <AlertTriangle className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium tabular-nums">{warningsCount}</p>
            <p className="text-xs text-muted-foreground">{warningsCount === 1 ? "warning" : "warnings"}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 flex-1 min-w-[16rem]">
          <div className={cn("size-6 rounded-md grid place-items-center shrink-0 mt-0.5", tone.bgSoft, tone.text)}>
            <Activity className="size-3.5" />
          </div>
          <p className="text-sm text-muted-foreground leading-snug">{insightText}</p>
        </div>
      </div>

      {/* Data grid */}
      <Card className="p-0 overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">
                  Technology / fuel type
                </th>
                <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3 text-right">
                  This year
                </th>
                <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3 text-right">
                  Last year
                </th>
                <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3 text-right">
                  Trend
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const cur = values[r.id];
                const prev = r.lastYear;
                const change = cur != null && prev != null && prev !== 0 ? (cur - prev) / prev : null;
                const flag = flagged[r.id];
                return (
                  <tr
                    key={r.id}
                    id={`ind-${r.id}`}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors duration-500",
                      i % 2 === 1 && "bg-muted/25",
                      highlightId === r.id && tone.bgSoft
                    )}
                  >
                    <td className="px-5 py-2.5 font-medium">{r.name}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={cur ?? ""}
                          placeholder={r.unit}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setValues((v) => ({ ...v, [r.id]: raw === "" ? null : Number(raw) }));
                          }}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            commit(r.id, r.unit, raw === "" ? null : Number(raw));
                          }}
                          className={cn(
                            "h-8 w-28 rounded-lg border border-input bg-transparent px-2.5 text-right text-sm tabular-nums outline-none transition-colors",
                            "focus-visible:ring-3",
                            tone.ring
                          )}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                      {prev != null ? fmtNum(prev, prev % 1 === 0 ? 0 : 1) : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {change != null ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-medium",
                            change >= 0 ? "text-success" : "text-danger"
                          )}
                        >
                          {change >= 0 ? (
                            <ArrowUpRight className="size-3.5" />
                          ) : (
                            <ArrowDownRight className="size-3.5" />
                          )}
                          {Math.abs(Math.round(change * 100))}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {flag && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button type="button" className="grid place-items-center size-6 text-warning">
                                <AlertTriangle className="size-4" />
                              </button>
                            }
                          />
                          <TooltipContent side="left" className="max-w-64">
                            {flag}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { fmtNum } from "@/lib/format";
import { ChevronDown, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const JUMP_THRESHOLD = 0.25;

export interface WardRow {
  id: string;
  name: string;
  subCounty: string;
  thisYear: number | null;
  lastYear: number | null;
}

export function SubcountySection({
  indicatorName,
  unit,
  rows,
}: {
  indicatorName: string;
  unit: string;
  rows: WardRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-brand transition-colors"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          Break down by sub-county
        </button>

        {open && (
          <Card className="p-0 overflow-hidden mt-3">
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground px-5 py-6">
                  Sub-county detail isn&apos;t available for this county yet.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground px-5 pt-3">
                    {`Estimated split of ${indicatorName.toLowerCase()} across this county's wards.`}
                  </p>
                  <table className="w-full text-sm mt-1">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-2.5">
                          Ward
                        </th>
                        <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-2.5 text-right">
                          This year
                        </th>
                        <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-2.5 text-right">
                          Last year
                        </th>
                        <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-2.5 text-right">
                          Trend
                        </th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const change =
                          r.thisYear != null && r.lastYear != null && r.lastYear !== 0
                            ? (r.thisYear - r.lastYear) / r.lastYear
                            : null;
                        const flagged = change != null && Math.abs(change) >= JUMP_THRESHOLD;
                        return (
                          <tr
                            key={r.id}
                            className={cn("border-b border-border last:border-0", i % 2 === 1 && "bg-muted/25")}
                          >
                            <td className="px-5 py-2.5">
                              <span className="font-medium">{r.name}</span>{" "}
                              <span className="text-xs text-muted-foreground">{r.subCounty}</span>
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums">
                              {r.thisYear != null ? (
                                <>
                                  {fmtNum(r.thisYear, 1)} <span className="text-xs text-muted-foreground">{unit}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                              {r.lastYear != null ? fmtNum(r.lastYear, 1) : "—"}
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
                              {flagged && (
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <button type="button" className="grid place-items-center size-6 text-warning">
                                        <AlertTriangle className="size-4" />
                                      </button>
                                    }
                                  />
                                  <TooltipContent side="left" className="max-w-64">
                                    {r.name} moved {Math.abs(Math.round((change ?? 0) * 100))}% versus last year —
                                    unusually large for one ward.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkline } from "@/components/charts";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export interface CountyRow {
  id: string;
  name: string;
  region: string;
  status: string;
  overdue: boolean;
  /** Days before (positive) or after (negative) the shared deadline this
   *  county actually submitted — null if they haven't submitted yet. */
  earlyLateDays: number | null;
  flaggedCount: number;
  /** Real per-county trend (electricity access rate across annual reports on file). */
  trend: number[];
  viewHref: string | null;
}

const COMPLETE = new Set(["approved", "published"]);

const STATUS_META = {
  not_started: { label: "Not started", pill: "bg-muted text-muted-foreground" },
  in_progress: { label: "In progress", pill: "bg-provider-soft text-provider" },
  complete: { label: "Complete", pill: "bg-success-soft text-success" },
} as const;

function statusKeyFor(r: CountyRow): keyof typeof STATUS_META {
  if (COMPLETE.has(r.status)) return "complete";
  if (!r.viewHref) return "not_started";
  return "in_progress";
}

// Overdue first, then flagged, then everyone else.
function priority(r: CountyRow): number {
  if (r.overdue) return 0;
  if (r.flaggedCount > 0) return 1;
  return 2;
}

const SORT_OPTIONS = [
  { value: "priority", label: "Status (overdue first)" },
  { value: "name", label: "County name (A–Z)" },
  { value: "timing", label: "Submission timing (latest first)" },
];

export function CountyStatusTable({ rows }: { rows: CountyRow[] }) {
  const [sort, setSort] = useState("priority");

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "timing")
      copy.sort((a, b) => (a.earlyLateDays ?? Infinity) - (b.earlyLateDays ?? Infinity));
    else copy.sort((a, b) => priority(a) - priority(b) || a.name.localeCompare(b.name));
    return copy;
  }, [rows, sort]);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="font-medium">All counties</h2>
        <Select value={sort} onValueChange={(v) => setSort(String(v))} items={SORT_OPTIONS}>
          <SelectTrigger size="sm" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-linear-to-r from-brand-soft/70 via-brand-soft/20 to-transparent shadow-[inset_0_-1px_0_var(--border)]">
            <tr className="text-left">
              <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">County</th>
              <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">Status</th>
              <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">Submitted</th>
              <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">Trend</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const complete = COMPLETE.has(r.status);
              const statusKey = statusKeyFor(r);
              const meta = STATUS_META[statusKey];
              return (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-2.5 font-medium">{r.name}</td>
                  <td className="px-5 py-2.5">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", meta.pill)}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    {r.earlyLateDays == null ? (
                      <span className="text-muted-foreground">Not yet submitted</span>
                    ) : r.earlyLateDays > 0 ? (
                      <span className="text-success font-medium tabular-nums">
                        {r.earlyLateDays}d early
                      </span>
                    ) : r.earlyLateDays < 0 ? (
                      <span className="text-danger font-medium tabular-nums">
                        {Math.abs(r.earlyLateDays)}d late
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-medium">On time</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <Sparkline data={r.trend} tone={complete ? "success" : r.overdue ? "danger" : "brand"} />
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {r.viewHref ? (
                      <Button size="sm" variant="outline" render={<Link href={r.viewHref} />}>
                        View <ArrowRight className="size-3.5" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        View
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

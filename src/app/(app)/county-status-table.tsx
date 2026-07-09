"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/badges";
import { Sparkline } from "@/components/charts";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export interface CountyRow {
  id: string;
  name: string;
  region: string;
  status: string;
  overdue: boolean;
  daysLeft: number | null;
  flaggedCount: number;
  /** Real per-county trend (electricity access rate across annual reports on file). */
  trend: number[];
  viewHref: string | null;
}

const COMPLETE = new Set(["approved", "published"]);

function priority(r: CountyRow): number {
  if (r.status === "returned") return 0;
  if (r.overdue) return 1;
  if (r.flaggedCount > 0) return 2;
  if (r.status === "in_review" || r.status === "submitted") return 3;
  if (r.status === "draft") return 4;
  return 5;
}

const SORT_OPTIONS = [
  { value: "priority", label: "Status (overdue first)" },
  { value: "name", label: "County name (A–Z)" },
  { value: "days", label: "Days left" },
];

export function CountyStatusTable({ rows }: { rows: CountyRow[] }) {
  const [sort, setSort] = useState("priority");

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "days") copy.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
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
          <thead>
            <tr className="border-b border-border text-left bg-linear-to-r from-brand-soft/40 via-transparent to-transparent">
              <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">County</th>
              <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">Status</th>
              <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">Days left</th>
              <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">Trend</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const complete = COMPLETE.has(r.status);
              return (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-2.5 font-medium">{r.name}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-2.5">
                    {complete ? (
                      <span className="text-success font-medium">Submitted</span>
                    ) : r.overdue ? (
                      <span className="text-danger font-medium">Overdue</span>
                    ) : r.daysLeft != null ? (
                      <span className={cn("font-medium tabular-nums", r.daysLeft < 7 ? "text-warning" : "text-muted-foreground")}>
                        {r.daysLeft}d left
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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

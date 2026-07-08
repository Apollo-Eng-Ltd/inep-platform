"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export interface HistoryRow {
  id: string;
  title: string;
  typeLabel: string;
  periodLabel: string;
  submittedAt: string;
  status: string;
  flaggedSectors: string[];
}

type StatusBucket = "approved" | "pending" | "returned";

const STATUS_META: Record<string, { bucket: StatusBucket; label: string; pill: string }> = {
  submitted: { bucket: "pending", label: "Pending review", pill: "bg-warning-soft text-warning" },
  in_review: { bucket: "pending", label: "Pending review", pill: "bg-warning-soft text-warning" },
  returned: { bucket: "returned", label: "Sent back for changes", pill: "bg-danger-soft text-danger" },
  approved: { bucket: "approved", label: "Approved", pill: "bg-success-soft text-success" },
  published: { bucket: "approved", label: "Published", pill: "bg-success-soft text-success" },
};

const STATUS_OPTIONS: { value: StatusBucket; label: string }[] = [
  { value: "approved", label: "Approved / published" },
  { value: "pending", label: "Pending review" },
  { value: "returned", label: "Sent back" },
];

export function HistoryTable({
  rows,
  sectors,
}: {
  rows: HistoryRow[];
  sectors: { slug: string; name: string }[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");

  const statusItems = useMemo(
    () => [{ label: "All statuses", value: "all" }, ...STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))],
    []
  );
  const sectorItems = useMemo(
    () => [
      { label: "Flagged in any sector", value: "all" },
      ...sectors.map((s) => ({ label: `Flagged in ${s.name}`, value: s.slug })),
    ],
    [sectors]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const meta = STATUS_META[r.status];
      if (statusFilter !== "all" && meta?.bucket !== statusFilter) return false;
      if (sectorFilter !== "all" && !r.flaggedSectors.includes(sectorFilter)) return false;
      return true;
    });
  }, [rows, statusFilter, sectorFilter]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(String(v))} items={statusItems}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sectorFilter} onValueChange={(v) => setSectorFilter(String(v))} items={sectorItems}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All sectors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Flagged in any sector</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>
                Flagged in {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || sectorFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setSectorFilter("all");
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <Card className="p-0 overflow-hidden">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground px-5 py-10 text-center">
              No submissions match these filters.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">
                    Reporting period
                  </th>
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">
                    Date submitted
                  </th>
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">
                    Status
                  </th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status] ?? {
                    label: r.status,
                    pill: "bg-muted text-muted-foreground",
                  };
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{r.periodLabel}</p>
                        <p className="text-xs text-muted-foreground">{r.typeLabel}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                        {fmtDate(r.submittedAt)}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", meta.pill)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="outline" render={<Link href={`/submissions/${r.id}`} />}>
                          View <ArrowRight className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type { TemplateRow } from "@/lib/submission-template";

/** A plausible example value so the preview doesn't look empty — never real data. */
function exampleValue(row: TemplateRow): string {
  const base = row.lastYear != null ? row.lastYear * 1.05 : row.unit === "%" ? 68 : 480;
  const rounded = Math.round(base * 10) / 10;
  return rounded.toLocaleString("en-KE", { maximumFractionDigits: 1 });
}

export function TemplatePreviewDialog({ rows }: { rows: TemplateRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Eye className="size-3.5" /> Preview template
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>What the template looks like</DialogTitle>
          <DialogDescription>
            Same columns as the downloadable file. Example values are shown here so you can see the
            shape of it — the real file arrives blank for you to fill in.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Sector
                </th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Technology / fuel type
                </th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide text-right">
                  This year&apos;s value
                </th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide text-right">
                  Last year&apos;s value
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.sector}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.indicator}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-brand">
                    {exampleValue(r)} <span className="text-muted-foreground">{r.unit}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.lastYear != null ? r.lastYear.toLocaleString("en-KE") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

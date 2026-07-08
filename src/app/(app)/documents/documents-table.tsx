"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteDocument } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { fmtDate } from "@/lib/format";
import {
  Search, Download, Trash2, FileText, FileSpreadsheet, Image as ImageIcon, File as FileGeneric,
} from "lucide-react";

export interface DocumentRow {
  id: string;
  fileName: string;
  kind: string;
  createdAt: string;
  uploaderName: string;
  periodLabel: string | null;
}

const CATEGORY_META: Record<string, string> = {
  study: "Study",
  map: "Map",
  annex: "Annex",
  other: "Other",
};

function fileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return ImageIcon;
  if (["pdf", "doc", "docx"].includes(ext)) return FileText;
  return FileGeneric;
}

export function DocumentsTable({ rows }: { rows: DocumentRow[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const router = useRouter();

  const categoryItems = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...Object.entries(CATEGORY_META).map(([value, label]) => ({ value, label })),
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "all" && r.kind !== category) return false;
      if (q && !r.fileName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, category]);

  const handleDownload = (r: DocumentRow) => {
    toast.info(`"${r.fileName}" isn't stored yet — file storage isn't connected in this environment.`);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteDocument(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Document removed.");
        router.refresh();
      }
      setConfirmId(null);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file name"
            className="pl-8"
          />
        </div>

        <Select value={category} onValueChange={(v) => setCategory(String(v))} items={categoryItems}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground px-5 py-10 text-center">
              {rows.length === 0 ? "No documents yet." : "No documents match these filters."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">
                    File
                  </th>
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">
                    Category
                  </th>
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">
                    Date added
                  </th>
                  <th className="font-medium text-muted-foreground text-xs uppercase tracking-wide px-5 py-3">
                    Added by
                  </th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const Icon = fileIcon(r.fileName);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="size-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{r.fileName}</p>
                            {r.periodLabel && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground mt-0.5">
                                {r.periodLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-full bg-provider-soft px-2.5 py-1 text-xs font-medium text-provider">
                          {CATEGORY_META[r.kind] ?? "Other"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.uploaderName}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Download"
                            onClick={() => handleDownload(r)}
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete"
                            className="hover:text-danger"
                            onClick={() => setConfirmId(r.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes it from your county&apos;s document list. This can&apos;t be undone.
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => confirmId && handleDelete(confirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

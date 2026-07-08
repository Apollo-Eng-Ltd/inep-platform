"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadDocument } from "./actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, FileIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg";

const CATEGORY_OPTIONS = [
  { value: "study", label: "Study" },
  { value: "map", label: "Map" },
  { value: "annex", label: "Annex" },
  { value: "other", label: "Other" },
];

export interface SubmissionOption {
  id: string;
  label: string;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ submissions }: { submissions: SubmissionOption[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [kind, setKind] = useState("other");
  const [submissionId, setSubmissionId] = useState("none");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const pick = (f: File | undefined | null) => {
    if (f) setFile(f);
  };

  const reset = () => {
    setFile(null);
    setKind("other");
    setSubmissionId("none");
  };

  const submit = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    fd.set("submissionId", submissionId === "none" ? "" : submissionId);
    startTransition(async () => {
      const res = await uploadDocument(fd);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Added ${file.name}.`);
        reset();
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "rounded-xl border border-dashed px-4 py-8 text-center cursor-pointer transition-colors",
          dragOver ? "border-brand bg-brand-soft/40" : "border-border hover:bg-muted/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <UploadCloud className="size-5 mx-auto text-muted-foreground mb-2" />
        {file ? (
          <p className="text-sm font-medium flex items-center justify-center gap-1.5">
            <FileIcon className="size-3.5" /> {file.name}{" "}
            <span className="text-muted-foreground font-normal">({fmtBytes(file.size)})</span>
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">Drag a supporting file here</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              or click to browse — PDF, Word, Excel, or image
            </p>
          </>
        )}
      </div>

      {file && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={(v) => setKind(String(v))} items={CATEGORY_OPTIONS}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={submissionId}
            onValueChange={(v) => setSubmissionId(String(v))}
            items={[{ value: "none", label: "Not linked to a submission" }, ...submissions.map((s) => ({ value: s.id, label: s.label }))]}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Link to a submission" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not linked to a submission</SelectItem>
              {submissions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={reset} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {pending ? "Adding…" : "Add document"}
          </Button>
        </div>
      )}
    </div>
  );
}

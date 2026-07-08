"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadTemplate } from "./actions";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function UploadZone() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const pick = (f: File | undefined | null) => {
    if (f) setFile(f);
  };

  const submit = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadTemplate(fd);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          res.count ? `Loaded ${res.count} field${res.count === 1 ? "" : "s"} from the file.` : "File received — no matching fields were found."
        );
        setFile(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-2">
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
          "rounded-xl border border-dashed px-4 py-6 text-center cursor-pointer transition-colors",
          dragOver ? "border-brand bg-brand-soft/40" : "border-border hover:bg-muted/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <UploadCloud className="size-5 mx-auto text-muted-foreground mb-2" />
        {file ? (
          <p className="text-sm font-medium flex items-center justify-center gap-1.5">
            <FileText className="size-3.5" /> {file.name}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">Drag your filled-in file here</p>
            <p className="text-xs text-muted-foreground mt-0.5">or click to browse — the .csv from the template</p>
          </>
        )}
      </div>
      {file && (
        <Button type="button" size="sm" className="w-full" onClick={submit} disabled={pending}>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {pending ? "Uploading…" : "Upload file"}
        </Button>
      )}
    </div>
  );
}

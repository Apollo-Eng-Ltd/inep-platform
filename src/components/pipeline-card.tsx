"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { advanceStage, returnStage } from "@/app/(app)/pipeline/actions";
import { SubmitterTypeBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { ChevronRight, Undo2, AlertTriangle } from "lucide-react";

export interface PipelineCardData {
  id: string;
  title: string;
  submitterName: string;
  submitterType: string;
  flags: number;
  canAdvance: boolean;
  canReturn: boolean;
}

export function PipelineCard({ card, canManage }: { card: PipelineCardData; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const doAdvance = () =>
    startTransition(async () => {
      const res = await advanceStage(card.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Plan advanced to the next stage.");
        router.refresh();
      }
    });

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-2.5">
      <Link href={`/submissions/${card.id}`} className="block space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <SubmitterTypeBadge type={card.submitterType} />
          {card.flags > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-warning">
              <AlertTriangle className="size-3" /> {card.flags}
            </span>
          )}
        </div>
        <p className="text-sm font-medium leading-snug">{card.submitterName}</p>
        <p className="text-xs text-muted-foreground truncate">{card.title}</p>
      </Link>

      {canManage && (card.canAdvance || card.canReturn) && (
        <div className="flex items-center gap-1.5 pt-1">
          {card.canAdvance && (
            <Button size="xs" onClick={doAdvance} disabled={pending} className="flex-1">
              Advance <ChevronRight className="size-3" />
            </Button>
          )}
          {card.canReturn && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button size="xs" variant="outline" disabled={pending} aria-label="Send back">
                    <Undo2 className="size-3" />
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send back for changes</DialogTitle>
                </DialogHeader>
                <form
                  action={async (fd) => {
                    const res = await returnStage(fd);
                    if (res?.error) toast.error(res.error);
                    else {
                      toast.success("Sent back with a comment.");
                      setOpen(false);
                      router.refresh();
                    }
                  }}
                  className="space-y-4"
                >
                  <input type="hidden" name="submissionId" value={card.id} />
                  <Textarea
                    name="comment"
                    required
                    placeholder="Explain what needs to change before this can proceed…"
                    rows={4}
                  />
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
                    <Button type="submit">Send back</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}

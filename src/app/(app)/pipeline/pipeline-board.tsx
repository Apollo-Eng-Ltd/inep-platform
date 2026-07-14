"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { advanceStage, returnStage } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { daysSince, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search, AlertTriangle, Undo2, Check, UserCog } from "lucide-react";

export interface StageInfo {
  id: string;
  name: string;
  isTerminal: boolean;
}

export interface PipelineCardData {
  id: string;
  title: string;
  submitterId: string;
  submitterName: string;
  submitterType: string;
  stageId: string;
  stageKey: string;
  flags: number;
  enteredStageAt: string;
  waitingOnName: string | null;
  waitingOnInitials: string;
  canAdvance: boolean;
  canReturn: boolean;
  /** Set when the viewer can act on this card only via a delegation — the name of the person they're standing in for. */
  actingOnBehalfOf: string | null;
  history: { id: string; action: string; comment: string | null; actedAt: string; stageName: string; actorName: string }[];
}

const TYPE_TAG: Record<string, { label: string; cls: string }> = {
  county: { label: "County", cls: "bg-county-soft text-county" },
  national_provider: { label: "Provider", cls: "bg-provider-soft text-provider" },
  private_sector: { label: "Private / PBO", cls: "bg-private-soft text-private" },
};

const LINGER_THRESHOLD_DAYS = 3;

export function PipelineBoard({
  stages,
  cards,
  initialOpenId = null,
}: {
  stages: StageInfo[];
  cards: PipelineCardData[];
  initialOpenId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialOpenId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => c.submitterName.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
  }, [cards, query]);

  const cardsByStage = useMemo(() => {
    const m = new Map<string, PipelineCardData[]>();
    filtered.forEach((c) => {
      const arr = m.get(c.stageId) ?? [];
      arr.push(c);
      m.set(c.stageId, arr);
    });
    return m;
  }, [filtered]);

  const maxCount = Math.max(1, ...stages.map((s) => (cardsByStage.get(s.id) ?? []).length));
  const selected = cards.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <div className="relative w-72 mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by county or organization"
          className="pl-8"
        />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const list = cardsByStage.get(stage.id) ?? [];
          const pct = (list.length / maxCount) * 100;
          return (
            <div key={stage.id} className="w-72 shrink-0">
              <div className="mb-3 px-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("size-1.5 rounded-full", stage.isTerminal ? "bg-success" : "bg-muted-foreground/40")}
                    />
                    <h3 className="text-sm font-medium">{stage.name}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted mt-2 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", stage.isTerminal ? "bg-success" : "bg-brand")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                {list.map((c) => (
                  <PipelineCard key={c.id} card={c} onOpen={() => setSelectedId(c.id)} />
                ))}
                {list.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PipelineDetailSheet card={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}

function PipelineCard({ card, onOpen }: { card: PipelineCardData; onOpen: () => void }) {
  const days = daysSince(card.enteredStageAt) ?? 0;
  const lingering = days >= LINGER_THRESHOLD_DAYS;
  const tag = TYPE_TAG[card.submitterType] ?? { label: card.submitterType, cls: "bg-muted text-muted-foreground" };

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl border border-border bg-card p-3 shadow-sm hover:shadow-md hover:border-brand/30 transition-all space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", tag.cls)}>
          {tag.label}
        </span>
        {card.flags > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-warning">
            <AlertTriangle className="size-3" /> {card.flags}
          </span>
        )}
      </div>
      <p className="text-sm font-medium leading-snug">{card.submitterName}</p>
      <p className="text-xs text-muted-foreground truncate">{card.title}</p>
      <div className="flex items-center justify-between pt-1">
        <span className={cn("text-[11px] font-medium", lingering ? "text-warning" : "text-muted-foreground")}>
          {days <= 0 ? "Entered today" : `${days} day${days === 1 ? "" : "s"} in this stage`}
        </span>
        <Avatar size="sm" title={card.waitingOnName ?? undefined}>
          <AvatarFallback className="bg-muted text-[10px] font-medium">{card.waitingOnInitials}</AvatarFallback>
        </Avatar>
      </div>
    </button>
  );
}

function PipelineDetailSheet({ card, onClose }: { card: PipelineCardData | null; onClose: () => void }) {
  return (
    <Sheet open={!!card} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {/* Keyed by card id so the comment box resets when a different card
            opens, instead of an effect reaching back to clear state. */}
        {card && <PipelineDetailContent key={card.id} card={card} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function PipelineDetailContent({ card, onDone }: { card: PipelineCardData; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  const submit = (dir: "advance" | "return") => {
    if (!comment.trim()) {
      toast.error("Add a short comment before confirming.");
      return;
    }
    const fd = new FormData();
    fd.set("submissionId", card.id);
    fd.set("comment", comment.trim());
    startTransition(async () => {
      const res = dir === "advance" ? await advanceStage(fd) : await returnStage(fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(dir === "advance" ? "Approved and moved forward." : "Sent back with a comment.");
        onDone();
        router.refresh();
      }
    });
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-8">{card.title}</SheetTitle>
        <SheetDescription>{card.submitterName}</SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">History</h4>
          {card.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions recorded yet — still in Draft.</p>
          ) : (
            <div>
              {card.history.map((h, i) => (
                <div key={h.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "size-2 rounded-full mt-1.5 shrink-0",
                        h.action === "sent_back" ? "bg-danger" : "bg-success"
                      )}
                    />
                    {i < card.history.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{h.actorName}</span>{" "}
                      {h.action === "sent_back" ? "sent back from" : "approved"} {h.stageName}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(h.actedAt)}</p>
                    {h.comment && (
                      <p className="text-xs text-foreground bg-muted rounded-lg px-2.5 py-1.5 mt-1.5">{h.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {(card.canAdvance || card.canReturn) && (
          <div className="border-t border-border pt-4 space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Take action</h4>
            {card.actingOnBehalfOf && (
              <p className="flex items-center gap-1.5 text-xs text-agent bg-agent-soft rounded-lg px-2.5 py-1.5">
                <UserCog className="size-3.5 shrink-0" /> Acting on behalf of {card.actingOnBehalfOf}
              </p>
            )}
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="A short comment explaining your decision…"
              rows={3}
            />
            {!comment.trim() && (
              <p className="text-xs text-muted-foreground">A comment is required before you can approve or send this back.</p>
            )}
          </div>
        )}
      </SheetBody>

      {(card.canAdvance || card.canReturn) && (
        <SheetFooter className="justify-end">
          {card.canReturn && (
            <Button variant="outline" disabled={pending || !comment.trim()} onClick={() => submit("return")}>
              <Undo2 className="size-3.5" /> Send back a stage
            </Button>
          )}
          {card.canAdvance && (
            <Button disabled={pending || !comment.trim()} onClick={() => submit("advance")}>
              <Check className="size-3.5" /> Approve and move forward
            </Button>
          )}
        </SheetFooter>
      )}
    </>
  );
}

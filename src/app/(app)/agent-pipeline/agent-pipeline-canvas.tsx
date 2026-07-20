"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkline } from "@/components/charts";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { decideAgentAction, decideValidationResult } from "./actions";
import { ActivityTicker } from "./activity-ticker";
import { layoutNodes, curvedPath, curvePointAt, VIEW_W, VIEW_H, type PositionedNode } from "./layout-geometry";
import type { AgentGraph, AgentDef, AgentName, PendingItem } from "@/lib/agent-pipeline-shared";
import { X, Check, Pencil, ThumbsDown, UserCog } from "lucide-react";

const COLOR_VAR: Record<AgentDef["color"], string> = {
  brand: "var(--brand)", provider: "var(--provider)", warning: "var(--warning)",
  agent: "var(--agent)", success: "var(--success)", danger: "var(--danger)",
  private: "var(--private)", muted: "var(--muted-foreground)",
};

function pct(v: number, total: number): string {
  return `${(v / total) * 100}%`;
}

export function AgentPipelineCanvas({ graph }: { graph: AgentGraph }) {
  const router = useRouter();
  const positioned = useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);
  const byId = useMemo(() => new Map(positioned.map((n) => [n.def.id, n])), [positioned]);
  const [selectedAgent, setSelectedAgent] = useState<AgentName | null>(null);
  const [blurbTick, setBlurbTick] = useState(0);

  // Real re-fetch of the server's live data, not a fake incrementing timer —
  // counts/sparklines/ticker only ever change because the underlying rows did.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 25000);
    return () => clearInterval(id);
  }, [router]);

  // Rotates each node's one-line description through its real checks.
  useEffect(() => {
    const id = setInterval(() => setBlurbTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const selected = selectedAgent ? byId.get(selectedAgent) : null;
  const nextPending: PendingItem | undefined = selected?.pending[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="relative rounded-2xl border border-border bg-card overflow-hidden" style={{ aspectRatio: `${VIEW_W}/${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 w-full h-full">
          {graph.edges.map((e) => {
            const from = byId.get(e.from);
            const to = byId.get(e.to);
            if (!from || !to) return null;
            const id = `edge-${e.from}-${e.to}`;
            const d = curvedPath(from, to);
            const dim = !from.central && !to.central;
            const color = COLOR_VAR[from.def.color];
            return (
              <g key={id} opacity={dim ? 0.45 : 0.9}>
                {/* base line — always visible, marks every real connection */}
                <path d={d} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={2} />
                {/* flowing dashes on top — continuous motion in the direction data moves */}
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.25}
                  strokeLinecap="round"
                  strokeDasharray="1 13"
                  style={{ animation: "edge-flow 1.1s linear infinite" }}
                />
              </g>
            );
          })}
        </svg>

        {/* Edge labels — what actually passes between agents, placed directly on the curve */}
        {graph.edges.map((e) => {
          const from = byId.get(e.from);
          const to = byId.get(e.to);
          if (!from || !to || (!from.central && !to.central)) return null;
          const p = curvePointAt(from, to, 0.5);
          return (
            <span
              key={`${e.from}-${e.to}-label`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-popover px-2 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap shadow-sm"
              style={{ left: pct(p.x, VIEW_W), top: pct(p.y, VIEW_H) }}
            >
              {e.label}
            </span>
          );
        })}

        {positioned.map((node, i) => (
          <AgentNodeCard
            key={node.def.id}
            node={node}
            blurbTick={blurbTick}
            selected={selectedAgent === node.def.id}
            onClick={() => setSelectedAgent((cur) => (cur === node.def.id ? null : node.def.id))}
            style={{ left: pct(node.x, VIEW_W), top: pct(node.y, VIEW_H), animationDelay: `${i * 0.18}s` }}
          />
        ))}

        {selected && nextPending && (
          <ApprovalCard
            node={selected}
            item={nextPending}
            style={{
              left: pct(Math.min(VIEW_W - 20, selected.x + selected.size / 2 + 14), VIEW_W),
              top: pct(Math.max(20, selected.y - 40), VIEW_H),
            }}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </div>

      <ActivityTicker events={graph.ticker} />
    </div>
  );
}

function AgentNodeCard({
  node, blurbTick, selected, onClick, style,
}: {
  node: PositionedNode;
  blurbTick: number;
  selected: boolean;
  onClick: () => void;
  style: React.CSSProperties;
}) {
  const color = COLOR_VAR[node.def.color];
  const blurb = node.def.blurbs[blurbTick % node.def.blurbs.length];
  const displayCount = useCountUp(node.count);
  const statusColor = node.status === "needs_you" ? "var(--warning)" : node.status === "active" ? "var(--success)" : "var(--muted-foreground)";

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -translate-x-1/2 -translate-y-1/2 text-left transition-transform hover:scale-[1.03]"
      style={style}
    >
      <div
        className="absolute inset-0 rounded-2xl -z-10"
        style={{
          boxShadow: `0 0 24px 6px ${color}`,
          animation: "agent-glow-pulse 3.2s ease-in-out infinite",
          animationDelay: style.animationDelay,
        }}
      />
      <div
        className={cn(
          "rounded-2xl border bg-card/95 backdrop-blur-sm shadow-lg px-3 py-2.5 flex flex-col gap-1.5",
          node.central ? "w-48" : "w-40 opacity-80",
          selected && "ring-2 ring-offset-2 ring-offset-card"
        )}
        style={{ borderColor: color, ...(selected ? ({ "--tw-ring-color": color } as React.CSSProperties) : {}) }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="size-6 rounded-lg grid place-items-center shrink-0" style={{ backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`, color }}>
              <Icon name={node.def.icon} className="size-3.5" />
            </span>
            <p className={cn("font-medium truncate", node.central ? "text-sm" : "text-xs")}>{node.def.label}</p>
          </div>
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: statusColor, boxShadow: node.status !== "idle" ? `0 0 6px ${statusColor}` : undefined }}
          />
        </div>

        {node.central && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{blurb}</p>}

        <div className="flex items-end justify-between gap-2 pt-0.5">
          <span className="text-lg font-semibold tabular-nums leading-none">{displayCount}</span>
          <Sparkline data={node.sparkline.length ? node.sparkline : [0, 0]} tone={node.def.color} width={node.central ? 56 : 40} height={20} />
        </div>

        {node.status === "needs_you" && (
          <p className="text-[10px] font-medium text-warning">{node.pending.length} need{node.pending.length === 1 ? "s" : ""} you</p>
        )}
      </div>
    </button>
  );
}

function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target]);
  return value;
}

function ApprovalCard({
  node, item, style, onClose,
}: {
  node: PositionedNode;
  item: PendingItem;
  style: React.CSSProperties;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState(item.message);

  const submit = (decision: "approved" | "rejected") => {
    if (!comment.trim()) {
      toast.error("Add a short comment before confirming.");
      return;
    }
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("decision", decision);
    fd.set("comment", comment.trim());
    if (editing && decision === "approved") fd.set("editedSummary", editedSummary.trim());

    startTransition(async () => {
      const res = item.kind === "agent_action" ? await decideAgentAction(fd) : await decideValidationResult(fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(decision === "approved" ? "Approved." : "Rejected.");
        setComment("");
        setEditing(false);
        router.refresh();
      }
    });
  };

  return (
    <div
      className="absolute z-10 w-72 rounded-2xl border-2 bg-popover shadow-2xl p-3.5 space-y-2.5"
      style={{ ...style, borderColor: "var(--warning)", boxShadow: "0 0 0 3px color-mix(in oklch, var(--warning) 20%, transparent), 0 12px 32px -8px rgb(0 0 0 / 0.3)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-warning text-xs font-medium">
          <UserCog className="size-3.5" /> Needs your decision
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>

      <p className="text-sm leading-snug">
        <span className="font-medium">{node.def.label} agent</span> flags <span className="font-medium">{item.submitterName}</span>: {item.message}
      </p>
      <p className="text-[11px] text-muted-foreground">{fmtDateTime(item.createdAt)}</p>

      {editing && (
        <Textarea value={editedSummary} onChange={(e) => setEditedSummary(e.target.value)} rows={2} className="text-xs" />
      )}

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="A short comment explaining your decision…"
        rows={2}
        className="text-xs"
      />
      {!comment.trim() && <p className="text-[11px] text-muted-foreground">A comment is required to approve, edit, or reject.</p>}

      <div className="flex flex-wrap gap-1.5 justify-end pt-0.5">
        <Button size="sm" variant="outline" disabled={pending || !comment.trim()} onClick={() => submit("rejected")}>
          <ThumbsDown className="size-3.5" /> Reject
        </Button>
        {item.kind === "agent_action" && !editing && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
        <Button size="sm" disabled={pending || !comment.trim() || (editing && !editedSummary.trim())} onClick={() => submit("approved")}>
          <Check className="size-3.5" /> {editing ? "Save & approve" : "Approve"}
        </Button>
      </div>
    </div>
  );
}

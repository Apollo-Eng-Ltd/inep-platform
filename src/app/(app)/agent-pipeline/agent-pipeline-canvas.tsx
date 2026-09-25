"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { decideAgentAction, decideValidationResult } from "./actions";
import { ActivityTicker } from "./activity-ticker";
import {
  layoutNodes, curvedPath, curvePointAt, outPoint, inPoint,
  VIEW_W, VIEW_H, MARGIN_X, MARGIN_Y, type PositionedNode,
} from "./layout-geometry";
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

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function AgentPipelineCanvas({ graph }: { graph: AgentGraph }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Layout metadata (size/height/central/def per agent) is computed once and
  // never changes mid-session — only the position a user has dragged a node
  // to is real interactive state. Live data (counts/status/pending) flows
  // straight from `graph` on every render via the memo below, so a
  // background refresh updates numbers without ever touching arranged
  // positions or needing an effect to reconcile the two.
  const [layoutMeta] = useState<PositionedNode[]>(() => layoutNodes(graph.nodes));
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(layoutMeta.map((n) => [n.def.id, { x: n.x, y: n.y }]))
  );

  const liveById = useMemo(() => new Map(graph.nodes.map((n) => [n.def.id, n])), [graph.nodes]);
  const nodes: PositionedNode[] = useMemo(
    () =>
      layoutMeta.map((m) => {
        const live = liveById.get(m.def.id) ?? m;
        const pos = positions[m.def.id] ?? { x: m.x, y: m.y };
        return { ...m, ...live, x: pos.x, y: pos.y };
      }),
    [layoutMeta, liveById, positions]
  );
  const byId = useMemo(() => new Map(nodes.map((n) => [n.def.id, n])), [nodes]);
  const [selectedAgent, setSelectedAgent] = useState<AgentName | null>(null);

  // Real re-fetch of the server's live data, not a fake incrementing timer —
  // counts/sparklines/ticker only ever change because the underlying rows did.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 25000);
    return () => clearInterval(id);
  }, [router]);

  const moveNode = (id: AgentName, dxPx: number, dyPx: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dxV = (dxPx / rect.width) * VIEW_W;
    const dyV = (dyPx / rect.height) * VIEW_H;
    setPositions((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return {
        ...prev,
        [id]: {
          x: clamp(cur.x + dxV, MARGIN_X - 20, VIEW_W - MARGIN_X + 20),
          y: clamp(cur.y + dyV, MARGIN_Y - 20, VIEW_H - MARGIN_Y + 20),
        },
      };
    });
  };

  const selected = selectedAgent ? byId.get(selectedAgent) : null;
  const nextPending: PendingItem | undefined = selected?.pending[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div
        ref={containerRef}
        className="relative rounded-2xl border border-border bg-card overflow-hidden h-[1100px] w-full"
      >
        {/* preserveAspectRatio="none" so the SVG always fills the container
            exactly, matching the percentage-positioned HTML nodes below —
            this decouples the rendered canvas size from the internal
            viewBox ratio, so the canvas can be sized freely (big and long)
            without edges drifting off their nodes. */}
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {graph.edges.map((e) => {
            const from = byId.get(e.from);
            const to = byId.get(e.to);
            if (!from || !to) return null;
            const id = `edge-${e.from}-${e.to}`;
            const a = outPoint(from);
            const b = inPoint(to);
            const d = curvedPath(a, b);
            const dim = !from.central && !to.central;
            const color = COLOR_VAR[from.def.color];
            return (
              <g key={id} opacity={dim ? 0.5 : 1}>
                {/* base line — always visible, marks every real connection */}
                <path d={d} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={2} />
                {/* a real "task" traveling from source to target — two staggered so the flow reads as continuous */}
                {[0, 0.9].map((delay) => (
                  <path
                    key={delay}
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray="3 500"
                    style={{ animation: "edge-flow 1.8s linear infinite", animationDelay: `${delay}s` }}
                  />
                ))}
                {/* junction dots right at the node edge, like a wired connector */}
                <circle cx={a.x} cy={a.y} r={3.5} fill={color} />
                <circle cx={b.x} cy={b.y} r={3.5} fill={color} />
              </g>
            );
          })}
        </svg>

        {/* Edge labels — what actually passes between agents, placed directly on the curve */}
        {graph.edges.map((e) => {
          const from = byId.get(e.from);
          const to = byId.get(e.to);
          if (!from || !to || (!from.central && !to.central)) return null;
          const p = curvePointAt(outPoint(from), inPoint(to), 0.5);
          return (
            <span
              key={`${e.from}-${e.to}-label`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-card px-1 text-[10px] font-medium whitespace-nowrap pointer-events-none"
              style={{ left: pct(p.x, VIEW_W), top: pct(p.y, VIEW_H), color: COLOR_VAR[from.def.color] }}
            >
              {e.label}
            </span>
          );
        })}

        {nodes.map((node) => (
          <AgentNodeCard
            key={node.def.id}
            node={node}
            selected={selectedAgent === node.def.id}
            onOpen={() => setSelectedAgent((cur) => (cur === node.def.id ? null : node.def.id))}
            onDrag={(dx, dy) => moveNode(node.def.id, dx, dy)}
            style={{ left: pct(node.x, VIEW_W), top: pct(node.y, VIEW_H) }}
          />
        ))}

        {selected && nextPending && (
          <ApprovalCard
            node={selected}
            item={nextPending}
            style={{
              left: pct(Math.min(VIEW_W - 20, selected.x + selected.iconSize / 2 + 24), VIEW_W),
              top: pct(Math.max(20, selected.y - 40), VIEW_H),
            }}
            onClose={() => setSelectedAgent(null)}
          />
        )}

        <p className="absolute bottom-2 left-3 text-[10px] text-muted-foreground/70 pointer-events-none">
          Drag any node to rearrange — click to review a pending decision.
        </p>
      </div>

      <ActivityTicker events={graph.ticker} />
    </div>
  );
}

function AgentNodeCard({
  node, selected, onOpen, onDrag, style,
}: {
  node: PositionedNode;
  selected: boolean;
  onOpen: () => void;
  onDrag: (dxPx: number, dyPx: number) => void;
  style: React.CSSProperties;
}) {
  const color = COLOR_VAR[node.def.color];
  const displayCount = useCountUp(node.count);
  const needsYou = node.status === "needs_you";
  const subtitle = needsYou
    ? `${node.pending.length} need${node.pending.length === 1 ? "s" : ""} you`
    : `${displayCount} processed`;

  const dragging = useRef(false);
  const moved = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    moved.current = false;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      moved.current = true;
      onDrag(dx, dy);
      last.current = { x: e.clientX, y: e.clientY };
    }
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const handleClick = () => {
    if (moved.current) {
      moved.current = false;
      return; // that was a drag, not a click — don't open the approval card
    }
    onOpen();
  };

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      title={node.def.blurbs[0]}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 group cursor-grab active:cursor-grabbing touch-none select-none"
      style={style}
    >
      <span className="relative shrink-0" style={{ width: node.iconSize, height: node.iconSize }}>
        <span
          className="absolute inset-0 rounded-2xl"
          style={{
            boxShadow: `0 0 18px 4px ${color}`,
            animation: "agent-glow-pulse 3.2s ease-in-out infinite",
            opacity: node.central ? 1 : 0.6,
          }}
        />
        <span
          className={cn(
            "relative size-full rounded-2xl border-2 bg-card grid place-items-center shadow-md transition-transform group-hover:scale-105",
            selected && "ring-2 ring-offset-2 ring-offset-card"
          )}
          style={{
            borderColor: color,
            color,
            backgroundColor: `color-mix(in oklch, ${color} 10%, var(--card))`,
            ...(selected ? ({ "--tw-ring-color": color } as React.CSSProperties) : {}),
          }}
        >
          <Icon name={node.def.icon} className={node.central ? "size-6" : "size-5"} />
        </span>
        {/* status badge — a different shape from the node itself, so the one human-decision point never reads as "just another agent" */}
        <span
          className={cn(
            "absolute -bottom-1 -right-1 size-4.5 rounded-full grid place-items-center ring-2 ring-card",
            needsYou ? "bg-warning" : "bg-success"
          )}
        >
          {needsYou ? <span className="size-1.5 rounded-full bg-white" /> : <Check className="size-2.5 text-white" strokeWidth={3} />}
        </span>
      </span>

      <span className="flex flex-col items-center gap-0.5 w-32">
        <span className={cn("font-medium leading-tight text-center", node.central ? "text-[13px]" : "text-xs text-muted-foreground")}>
          {node.def.label}
        </span>
        <span className={cn("text-[11px] leading-tight text-center", needsYou ? "text-warning font-medium" : "text-muted-foreground")}>
          {subtitle}
        </span>
      </span>
    </button>
  );
}

function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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

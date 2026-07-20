"use client";

import { Icon } from "@/components/icon";
import { relativeTime } from "@/lib/format";
import { AGENT_DEF_BY_ID, type TickerEvent } from "@/lib/agent-pipeline-shared";

const COLOR_VAR: Record<string, string> = {
  brand: "var(--brand)", provider: "var(--provider)", warning: "var(--warning)",
  agent: "var(--agent)", success: "var(--success)", danger: "var(--danger)",
  private: "var(--private)", muted: "var(--muted-foreground)",
};

function Row({ e, fadeIn }: { e: TickerEvent; fadeIn: boolean }) {
  const def = AGENT_DEF_BY_ID.get(e.agent);
  const color = COLOR_VAR[def?.color ?? "muted"];
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-2 py-1.5"
      style={fadeIn ? { animation: "ticker-row-in 400ms ease-out" } : undefined}
    >
      <span className="size-5 rounded-md grid place-items-center shrink-0 mt-0.5" style={{ backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`, color }}>
        {def && <Icon name={def.icon} className="size-3" />}
      </span>
      <div className="min-w-0">
        <p className="text-xs leading-snug">{e.text}</p>
        <p className="text-[10px] text-muted-foreground">{relativeTime(e.createdAt)}</p>
      </div>
    </div>
  );
}

export function ActivityTicker({ events }: { events: TickerEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-3.5 flex flex-col h-full">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-2 shrink-0">Live activity</p>
        <p className="text-sm text-muted-foreground px-1 py-4">No agent activity in your scope yet.</p>
      </div>
    );
  }

  // Genuinely continuous motion: the real event list is rendered twice back
  // to back and the whole strip is animated up by exactly one copy's height
  // (translateY(-50%) of the doubled content), so the loop point is
  // invisible — newest stays pinned visually at the top of each pass, older
  // rows keep sliding up and off, the way a real live feed reads. Duration
  // scales with the row count so a longer, denser feed doesn't fly by.
  const duration = Math.max(18, events.length * 3.4);

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 flex flex-col h-full overflow-hidden">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-2 shrink-0">Live activity</p>
      <div className="relative flex-1 min-h-0 [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]">
        <div
          className="absolute inset-x-0 top-0 space-y-1 hover:[animation-play-state:paused]"
          style={{ animation: `ticker-scroll ${duration}s linear infinite` }}
        >
          {events.map((e) => (
            <Row key={`a-${e.id}`} e={e} fadeIn />
          ))}
          {events.map((e) => (
            <Row key={`b-${e.id}`} e={e} fadeIn={false} />
          ))}
        </div>
      </div>
    </div>
  );
}

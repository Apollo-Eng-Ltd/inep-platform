"use client";

import { useMemo } from "react";
import { HeroStatCard } from "@/components/hero-stat-card";
import { NationalContextBadge } from "@/components/national-context-badge";
import { epraSeriesFor, epraLatestAndDelta, type Indicator, type EpraRow } from "./dashboard-types";
import { FileCheck, ShieldCheck, MessageSquareCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CARD_CONFIG: { slug: string; icon: LucideIcon; tone: "brand" | "success" | "agent" }[] = [
  { slug: "licensing_volume", icon: FileCheck, tone: "brand" },
  { slug: "compliance_rate_pct", icon: ShieldCheck, tone: "success" },
  { slug: "complaints_resolved_pct", icon: MessageSquareCheck, tone: "agent" },
];

export function ConsumerProtectionTab({ epraRows, indicators }: { epraRows: EpraRow[]; indicators: Indicator[] }) {
  const indicatorBySlug = useMemo(() => new Map(indicators.map((i) => [i.slug, i])), [indicators]);

  const cards = useMemo(
    () =>
      CARD_CONFIG.map((cfg) => {
        const ind = indicatorBySlug.get(cfg.slug);
        if (!ind) return null;
        const rows = epraSeriesFor(epraRows, indicatorBySlug, cfg.slug);
        const { latest, delta } = epraLatestAndDelta(rows);
        return { indicator: ind, icon: cfg.icon, tone: cfg.tone, latest, delta, series: rows.map((r) => r.value), labels: rows.map((r) => String(r.year)) };
      }).filter((c): c is NonNullable<typeof c> => c != null),
    [epraRows, indicatorBySlug]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Licensing, compliance &amp; complaints</h2>
        <NationalContextBadge />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <HeroStatCard
            key={c.indicator.id}
            icon={c.icon}
            tone={c.tone}
            latest={c.latest}
            unit={c.indicator.unit}
            name={c.indicator.name}
            delta={c.delta}
            series={c.series}
            labels={c.labels}
          />
        ))}
      </div>
    </div>
  );
}

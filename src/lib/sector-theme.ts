// Quiet per-sector accent, built entirely from existing design tokens — no new
// colors. Used sparingly: a pill, a ring, a small icon. Never a background fill.
export type SectorAccent = "provider" | "private" | "success" | "agent" | "brand";

const SECTOR_ACCENT: Record<string, SectorAccent> = {
  electricity: "provider",
  energy_access: "private",
  bioenergy: "success",
  efficiency: "agent",
  resource_dev: "brand",
};

export function accentFor(slug: string): SectorAccent {
  return SECTOR_ACCENT[slug] ?? "brand";
}

export const ACCENT_CLASSES: Record<
  SectorAccent,
  { text: string; bgSoft: string; dot: string; ring: string; ringStatic: string; cssVar: string }
> = {
  provider: {
    text: "text-provider",
    bgSoft: "bg-provider-soft",
    dot: "bg-provider",
    ring: "focus-visible:border-provider focus-visible:ring-provider/35",
    ringStatic: "ring-provider/50",
    cssVar: "var(--provider)",
  },
  private: {
    text: "text-private",
    bgSoft: "bg-private-soft",
    dot: "bg-private",
    ring: "focus-visible:border-private focus-visible:ring-private/35",
    ringStatic: "ring-private/50",
    cssVar: "var(--private)",
  },
  success: {
    text: "text-success",
    bgSoft: "bg-success-soft",
    dot: "bg-success",
    ring: "focus-visible:border-success focus-visible:ring-success/35",
    ringStatic: "ring-success/50",
    cssVar: "var(--success)",
  },
  agent: {
    text: "text-agent",
    bgSoft: "bg-agent-soft",
    dot: "bg-agent",
    ring: "focus-visible:border-agent focus-visible:ring-agent/35",
    ringStatic: "ring-agent/50",
    cssVar: "var(--agent)",
  },
  brand: {
    text: "text-brand",
    bgSoft: "bg-brand-soft",
    dot: "bg-brand",
    ring: "focus-visible:border-brand focus-visible:ring-brand/35",
    ringStatic: "ring-brand/50",
    cssVar: "var(--brand)",
  },
};

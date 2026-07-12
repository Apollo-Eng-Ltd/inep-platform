// Shared, plain (non-"use client") types + pure helpers for the national
// dashboard's tabs — kept out of dashboard-client.tsx so every tab component
// can import them without creating a client-to-client circular import back
// through the file that renders them.

export interface Sector {
  id: string;
  name: string;
  slug: string;
}
export interface Indicator {
  id: string;
  name: string;
  slug: string;
  unit: string;
  sectorId: string;
}
export interface County {
  id: string;
  name: string;
  region: string;
}
export interface ValueRow {
  countyId: string;
  countyName: string;
  indicatorId: string;
  year: number;
  value: number;
}
export interface EpraRow {
  indicatorId: string;
  year: number;
  value: number;
}

/** All epraRows for one indicator slug, sorted by year (or repurposed month/hour order). */
export function epraSeriesFor(
  epraRows: EpraRow[],
  indicatorBySlug: Map<string, Indicator>,
  slug: string
): { year: number; value: number }[] {
  const ind = indicatorBySlug.get(slug);
  if (!ind) return [];
  return epraRows.filter((e) => e.indicatorId === ind.id).sort((a, b) => a.year - b.year);
}

/** Latest value + YoY-style delta (last two points) for a slug's series. */
export function epraLatestAndDelta(rows: { year: number; value: number }[]): { latest: number | null; delta: number | null } {
  const latest = rows.length ? rows[rows.length - 1].value : null;
  const prev = rows.length > 1 ? rows[rows.length - 2].value : null;
  const delta = latest != null && prev != null && prev !== 0 ? Math.round(((latest - prev) / prev) * 1000) / 10 : null;
  return { latest, delta };
}

/** The single latest-year value for a slug (snapshot indicators). */
export function epraSnapshot(epraRows: EpraRow[], indicatorBySlug: Map<string, Indicator>, slug: string): number | null {
  const rows = epraSeriesFor(epraRows, indicatorBySlug, slug);
  return rows.length ? rows[rows.length - 1].value : null;
}

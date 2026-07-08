// Number & date formatting helpers, shared across screens.
export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-KE", { maximumFractionDigits: digits });
}

export function fmtValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "—";
  if (unit === "%") return `${fmtNum(value, 1)}%`;
  return fmtNum(value);
}

export function pctChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function pctElapsed(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (end <= start) return null;
  return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
}

/** Whole days from `fromIso` to `toIso`. Pure — no wall-clock read. */
export function daysBetween(fromIso: string | null | undefined, toIso: string | null | undefined): number | null {
  if (!fromIso || !toIso) return null;
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000);
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

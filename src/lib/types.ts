// Domain types shared across the app and the agent service layer.
// These mirror the database rows but are hand-written so the agent layer has no
// dependency on Supabase — it works on plain data and can be unit-tested alone.

export type SubmitterType = "county" | "national_provider" | "private_sector";

export interface Indicator {
  id: string;
  sector_id: string;
  slug: string;
  name: string;
  unit: string;
  expected_min: number | null;
  expected_max: number | null;
  description?: string | null;
}

export interface Sector {
  id: string;
  slug: string;
  name: string;
}

export interface SubmissionValue {
  indicator_id: string;
  value: number | null;
  unit: string | null;
}

/** A historical or peer data point for anomaly comparison. */
export interface SeriesPoint {
  year: number;
  value: number;
}

// Minimal, dependency-free geometry for rendering Kenya's real county
// boundaries as SVG — no mapping library, no API key, no tile server. Kenya
// straddles the equator, so a plain equirectangular projection (linear
// lon/lat -> x/y, with a cos(latitude) width correction) is geometrically
// accurate enough for a static, non-panning choropleth/point map; nothing
// here approximates or invents coordinates, it only projects real ones.

export interface Projected {
  project(lon: number, lat: number): [number, number];
  width: number;
  height: number;
}

// Real bounding box of the seeded Kenya counties GeoJSON (src/data/kenya-counties.json).
const BOUNDS = { minLon: 33.9, maxLon: 41.95, minLat: -4.72, maxLat: 5.48 };

export function makeProjection(width: number, height: number, padding = 12): Projected {
  const lonSpan = BOUNDS.maxLon - BOUNDS.minLon;
  const latSpan = BOUNDS.maxLat - BOUNDS.minLat;
  const midLat = (BOUNDS.minLat + BOUNDS.maxLat) / 2;
  const latCorrection = Math.cos((midLat * Math.PI) / 180);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const scaleX = innerW / (lonSpan * latCorrection);
  const scaleY = innerH / latSpan;
  const scale = Math.min(scaleX, scaleY);

  const projectedW = lonSpan * latCorrection * scale;
  const projectedH = latSpan * scale;
  const offsetX = padding + (innerW - projectedW) / 2;
  const offsetY = padding + (innerH - projectedH) / 2;

  return {
    width,
    height,
    project(lon: number, lat: number): [number, number] {
      const x = (lon - BOUNDS.minLon) * latCorrection * scale + offsetX;
      const y = (BOUNDS.maxLat - lat) * scale + offsetY; // flip: north is up
      return [x, y];
    },
  };
}

type Ring = [number, number][];
type GeoGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

/** Converts a GeoJSON Polygon/MultiPolygon into an SVG path `d` string. */
export function geometryToPath(geometry: GeoGeometry, proj: Projected): string {
  const ringPath = (ring: Ring) =>
    ring
      .map(([lon, lat], i) => {
        const [x, y] = proj.project(lon, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringPath).join(" ");
  }
  return geometry.coordinates.map((poly) => poly.map(ringPath).join(" ")).join(" ");
}

/** Centroid in projected screen space — good enough for label/dot placement. */
export function geometryCentroid(geometry: GeoGeometry, proj: Projected): [number, number] {
  const rings: Ring[] = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  const outer = rings[0] ?? [];
  let x = 0;
  let y = 0;
  outer.forEach(([lon, lat]) => {
    const [px, py] = proj.project(lon, lat);
    x += px;
    y += py;
  });
  const n = outer.length || 1;
  return [x / n, y / n];
}

// The one real name mismatch between this GeoJSON source (geoBoundaries) and
// our own submitters — everything else matches exactly.
export const COUNTY_NAME_ALIASES: Record<string, string> = {
  Tharaka: "Tharaka-Nithi",
};

/** Rescales a raw score into the observed [min,max] range onto a clean 0-100 scale. */
export function rescale(value: number, range: { min: number; max: number }): number {
  if (range.max === range.min) return 50;
  return ((value - range.min) / (range.max - range.min)) * 100;
}

/**
 * Deep teal (strong) fading through amber to soft red (weak) — existing
 * tokens only. Mixed `in oklab` (rectangular) rather than `oklch` (polar):
 * oklch always rotates hue the "short way", which between teal (~158deg) and
 * amber (~72deg) crosses straight through a muddy yellow-green. oklab blends
 * the two colors on a straight line instead, so it reads as a clean fade.
 */
export function heatColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 50) {
    const t = (s - 50) / 50; // 0 (amber) -> 1 (teal)
    return `color-mix(in oklab, var(--brand) ${Math.round(t * 100)}%, var(--warning) ${Math.round((1 - t) * 100)}%)`;
  }
  const t = s / 50; // 0 (red) -> 1 (amber)
  return `color-mix(in oklab, var(--warning) ${Math.round(t * 100)}%, var(--danger) ${Math.round((1 - t) * 100)}%)`;
}

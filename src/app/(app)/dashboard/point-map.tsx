"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import kenyaCounties from "@/data/kenya-counties.json";
import { makeProjection, geometryToPath } from "@/lib/kenya-map";

interface GeoFeature {
  type: "Feature";
  properties: { shapeName: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

export interface MapPoint {
  id: string;
  name: string;
  type: "national_provider" | "private_sector";
  lat: number;
  lng: number;
  href: string | null;
}

const WIDTH = 460;
const HEIGHT = 520;

export function PointMap({ points, missingCount }: { points: MapPoint[]; missingCount: number }) {
  const router = useRouter();
  const proj = useMemo(() => makeProjection(WIDTH, HEIGHT), []);
  const [hover, setHover] = useState<{ point: MapPoint; x: number; y: number } | null>(null);

  const shapes = useMemo(
    () =>
      (kenyaCounties.features as GeoFeature[]).map((f) => ({
        name: f.properties.shapeName,
        path: geometryToPath(f.geometry as never, proj),
      })),
    [proj]
  );

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto max-h-[560px]">
        {shapes.map((s) => (
          <path key={s.name} d={s.path} fill="var(--muted)" fillOpacity={0.4} stroke="var(--border)" strokeWidth={0.75} />
        ))}
        {points.map((p) => {
          const [x, y] = proj.project(p.lng, p.lat);
          const color = p.type === "national_provider" ? "var(--provider)" : "var(--private)";
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={6}
              fill={color}
              stroke="var(--card)"
              strokeWidth={1.5}
              className={cnCursor(p.href)}
              onMouseEnter={(e) => setHover({ point: p, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setHover({ point: p, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              onClick={() => p.href && router.push(p.href)}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <p className="font-medium">{hover.point.name}</p>
          <p className="text-muted-foreground">{hover.point.type === "national_provider" ? "National provider" : "Private / PBO"}</p>
        </div>
      )}

      {missingCount > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {missingCount} {missingCount === 1 ? "site" : "sites"} not shown, missing location.
        </p>
      )}
    </div>
  );
}

function cnCursor(href: string | null): string {
  return href ? "cursor-pointer" : "";
}

export function PointMapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full shrink-0" style={{ background: "var(--provider)" }} />
        <span>National provider</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full shrink-0" style={{ background: "var(--private)" }} />
        <span>Private sector / PBO</span>
      </div>
    </div>
  );
}

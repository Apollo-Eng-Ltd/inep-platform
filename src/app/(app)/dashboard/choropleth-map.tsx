"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import kenyaCounties from "@/data/kenya-counties.json";
import { makeProjection, geometryToPath, COUNTY_NAME_ALIASES, heatColor, rescale } from "@/lib/kenya-map";
import { fmtNum } from "@/lib/format";

interface GeoFeature {
  type: "Feature";
  properties: { shapeName: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

export interface ChoroplethCounty {
  name: string;
  score: number | null;
  rawValue: number | null;
  submissionId: string | null;
}

const WIDTH = 460;
const HEIGHT = 520;

export function ChoroplethMap({
  data,
  unit,
}: {
  data: ChoroplethCounty[];
  unit?: string;
}) {
  const router = useRouter();
  const proj = useMemo(() => makeProjection(WIDTH, HEIGHT), []);
  const [hover, setHover] = useState<{ county: ChoroplethCounty; x: number; y: number } | null>(null);

  const dataByName = useMemo(() => new Map(data.map((d) => [d.name, d])), [data]);
  const scoreRange = useMemo(() => {
    const vals = data.map((d) => d.score).filter((s): s is number => s != null);
    return vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : { min: 0, max: 100 };
  }, [data]);

  const shapes = useMemo(() => {
    return (kenyaCounties.features as GeoFeature[]).map((f) => {
      const rawName = f.properties.shapeName;
      const name = COUNTY_NAME_ALIASES[rawName] ?? rawName;
      return { name, path: geometryToPath(f.geometry as never, proj) };
    });
  }, [proj]);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto max-h-[560px]">
        <defs>
          <pattern id="choropleth-nodata" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--muted)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="2" />
          </pattern>
        </defs>
        {shapes.map((s) => {
          const county = dataByName.get(s.name);
          const score = county?.score ?? null;
          const fill = score != null ? heatColor(rescale(score, scoreRange)) : "url(#choropleth-nodata)";
          return (
            <path
              key={s.name}
              d={s.path}
              fill={fill}
              stroke="var(--card)"
              strokeWidth={1}
              className="cursor-pointer transition-opacity hover:opacity-85"
              onMouseEnter={(e) => county && setHover({ county, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => county && setHover({ county, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              onClick={() => county?.submissionId && router.push(`/submissions/${county.submissionId}`)}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <p className="font-medium">{hover.county.name}</p>
          <p className="text-muted-foreground">
            {hover.county.rawValue != null ? `${fmtNum(hover.county.rawValue, 1)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}` : "No data"}
          </p>
        </div>
      )}
    </div>
  );
}

export function ChoroplethLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-24 rounded-full bg-linear-to-r from-danger via-warning to-brand" />
        <span>Behind → Leading</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="size-3 rounded-sm shrink-0"
          style={{
            backgroundColor: "var(--muted)",
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--border) 0, var(--border) 1px, transparent 1px, transparent 4px)",
          }}
        />
        <span>No data</span>
      </div>
    </div>
  );
}

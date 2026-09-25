// Flowchart-style geometry for the agent web — compact icon nodes in real
// data-flow order, left to right, generously spaced, not dense info-cards
// packed into a web. Each agent is assigned a fixed column (its longest-path
// depth from the agents with no inputs, computed from the same real edges
// rendered on the canvas), and nodes stack vertically inside their column
// with fixed gaps. This prevents overlap by construction — no relaxation
// needed — and reads as a pipeline moving in one direction, matching how
// the agents actually feed each other.
import { AGENT_EDGES, type AgentName, type AgentNode } from "@/lib/agent-pipeline-shared";

export const VIEW_W = 1680;
export const VIEW_H = 980;
export const MARGIN_X = 90;
export const MARGIN_Y = 70;
const ROW_GAP = 56;

// Icon tile size — the small square node itself, not the label underneath.
export const CENTRAL_ICON = 68;
export const SECONDARY_ICON = 52;
// Footprint used for column-width/row-stacking math: the label block below
// the icon is usually wider than the icon, so spacing must account for it.
export const CENTRAL_SIZE = 148;
export const SECONDARY_SIZE = 124;
const CENTRAL_HEIGHT = CENTRAL_ICON + 62; // icon + gap + two-line label
const SECONDARY_HEIGHT = SECONDARY_ICON + 54;

export interface PositionedNode extends AgentNode {
  x: number;
  y: number; // icon center — connectors attach here, the label renders below
  size: number;
  height: number;
  iconSize: number;
}

// Longest-path rank from AGENT_EDGES — column 0 is whatever has no real
// incoming edge (intake), each subsequent column is one hop downstream.
function computeRanks(): Record<AgentName, number> {
  const rank: Partial<Record<AgentName, number>> = {};
  const allIds = new Set<AgentName>();
  AGENT_EDGES.forEach((e) => {
    allIds.add(e.from);
    allIds.add(e.to);
  });
  allIds.forEach((id) => (rank[id] = 0));
  for (let pass = 0; pass < allIds.size; pass++) {
    let changed = false;
    for (const e of AGENT_EDGES) {
      const proposed = (rank[e.from] ?? 0) + 1;
      if (proposed > (rank[e.to] ?? 0)) {
        rank[e.to] = proposed;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return rank as Record<AgentName, number>;
}
const RANK = computeRanks();

export function layoutNodes(nodes: AgentNode[]): PositionedNode[] {
  const byRank = new Map<number, AgentNode[]>();
  nodes.forEach((n) => {
    const r = RANK[n.def.id] ?? 0;
    const list = byRank.get(r) ?? [];
    list.push(n);
    byRank.set(r, list);
  });

  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  const maxRank = Math.max(1, ...ranks);
  const colSpacing = ranks.length > 1 ? (VIEW_W - MARGIN_X * 2) / maxRank : 0;

  const positioned: PositionedNode[] = [];
  ranks.forEach((r) => {
    const colNodes = [...(byRank.get(r) ?? [])].sort((a, b) => (b.central ? 1 : 0) - (a.central ? 1 : 0));
    const heights = colNodes.map((n) => (n.central ? CENTRAL_HEIGHT : SECONDARY_HEIGHT));
    const totalHeight = heights.reduce((a, b) => a + b, 0) + ROW_GAP * (colNodes.length - 1);
    const x = MARGIN_X + r * colSpacing;
    let y = VIEW_H / 2 - totalHeight / 2 + heights[0] / 2;
    colNodes.forEach((n, i) => {
      positioned.push({
        ...n,
        x,
        y: Math.max(MARGIN_Y, Math.min(VIEW_H - MARGIN_Y, y)),
        size: n.central ? CENTRAL_SIZE : SECONDARY_SIZE,
        height: heights[i],
        iconSize: n.central ? CENTRAL_ICON : SECONDARY_ICON,
      });
      y += heights[i] / 2 + ROW_GAP + (heights[i + 1] ?? heights[i]) / 2;
    });
  });

  return positioned;
}

interface Point {
  x: number;
  y: number;
}

/** Right edge of a node's icon — where an outgoing connector should start. */
export function outPoint(n: { x: number; y: number; iconSize: number }): Point {
  return { x: n.x + n.iconSize / 2, y: n.y };
}
/** Left edge of a node's icon — where an incoming connector should end. */
export function inPoint(n: { x: number; y: number; iconSize: number }): Point {
  return { x: n.x - n.iconSize / 2, y: n.y };
}

/** A gentle S-curve between two points — horizontal tangent at both ends, so left-to-right connectors read as a clean flowchart bend, not a straight ruler line. */
function controlPoints(a: Point, b: Point): [Point, Point] {
  const dx = (b.x - a.x) * 0.5;
  return [
    { x: a.x + dx, y: a.y },
    { x: b.x - dx, y: b.y },
  ];
}

export function curvedPath(a: Point, b: Point): string {
  const [c1, c2] = controlPoints(a, b);
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

/** The actual point at t on the same cubic curve `curvedPath` draws — for label placement, so labels sit on the visible line instead of the straight-line chord. */
export function curvePointAt(a: Point, b: Point, t: number): Point {
  const [c1, c2] = controlPoints(a, b);
  const mt = 1 - t;
  const x = mt ** 3 * a.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * b.x;
  const y = mt ** 3 * a.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * b.y;
  return { x, y };
}

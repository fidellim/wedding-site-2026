import { defaultSideCounts, rectangularChairs } from "../domain/tableLayout";
import type { PublicationValidation, SeatingSnapshot, SeatingTable } from "../domain/types";
import { defaultParameters, ledLayout, normalizeParameters, stageLayout, venueLayout, type VenueParameters } from "./venueModel";

export interface Point { x: number; y: number }
export interface TablePlacement extends Point {
  rotation: number;
  width: number;
  depth: number;
  dimensionsVerified: boolean;
}
export interface VenueLayout {
  parameters: VenueParameters;
  led: "center" | "side";
  tables: Record<string, TablePlacement>;
  landmarks: Record<"stage" | "danceFloor" | "entrance", Point>;
}
export function defaultVenueLayout(): VenueLayout {
  const parameters = { ...defaultParameters }, s = stageLayout(parameters), v = venueLayout(parameters);
  return { parameters, led: "center", tables: {}, landmarks: {
    stage: { x: s.centerX, y: s.centerY }, danceFloor: { x: s.danceX, y: s.danceY }, entrance: { x: v.plazaX, y: v.entranceY + 4 },
  } };
}
export function estimatedPlacement(table: SeatingTable): TablePlacement {
  return { x: 5, y: 0, rotation: 0, width: table.shape === "round" ? 1.8 : 2.4,
    depth: table.shape === "round" ? 1.8 : 1.2, dimensionsVerified: false };
}
export function isVenueLayout(value: unknown): value is VenueLayout {
  if (!value || typeof value !== "object") return false;
  const l = value as VenueLayout;
  if (Array.isArray(value) || Array.isArray(l.parameters) || Array.isArray(l.tables) || Array.isArray(l.landmarks)) return false;
  if (!l.parameters || !l.tables || !l.landmarks || !["center", "side"].includes(l.led)) return false;
  const normalized = normalizeParameters(l.parameters);
  if (Object.keys(normalized).some(k => normalized[k as keyof VenueParameters] !== l.parameters[k as keyof VenueParameters])) return false;
  const point = (p: Point) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 200 && Math.abs(p.y) <= 200;
  return ["stage", "danceFloor", "entrance"].every(k => point(l.landmarks[k as keyof VenueLayout["landmarks"]]))
    && Object.values(l.tables).every(t => t && point(t) && Number.isFinite(t.rotation) && t.rotation >= 0 && t.rotation < 360
      && Number.isFinite(t.width) && t.width >= .5 && t.width <= 10 && Number.isFinite(t.depth) && t.depth >= .5 && t.depth <= 10
      && typeof t.dimensionsVerified === "boolean");
}
/** Chair centers in physical units, with stable numbering independent of table heading. */
export function physicalChairs(table: SeatingTable, p: TablePlacement) {
  if (table.shape === "round") return Array.from({ length: table.capacity }, (_, i) => {
    const angle = (table.seatOneAngle + i * 360 / table.capacity) * Math.PI / 180;
    return { number: i + 1, x: (p.width / 2 + .45) * Math.sin(angle), y: -(p.width / 2 + .45) * Math.cos(angle) };
  });
  const counts = table.sideCounts ?? defaultSideCounts(table.capacity);
  return rectangularChairs(counts).map(({ side, index }, position) => {
    const f = (index + .5) / counts[side];
    return { number: (position - (table.seatOnePosition ?? 0) + table.capacity) % table.capacity + 1,
      x: side === "top" ? (f - .5) * p.width : side === "bottom" ? (.5 - f) * p.width : (side === "right" ? 1 : -1) * (p.width / 2 + .45),
      y: side === "right" ? (f - .5) * p.depth : side === "left" ? (.5 - f) * p.depth : (side === "top" ? -1 : 1) * (p.depth / 2 + .45) };
  });
}
/** Conservative footprint includes 0.7 m chair space on every side. */
export function footprint(table: SeatingTable, p: TablePlacement) {
  if (table.shape === "round") return { x: p.x, y: p.y, halfWidth: p.width / 2 + .7, halfDepth: p.width / 2 + .7 };
  const angle = p.rotation * Math.PI / 180, c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  return { x: p.x, y: p.y, halfWidth: (p.width / 2 + .7) * c + (p.depth / 2 + .7) * s,
    halfDepth: (p.width / 2 + .7) * s + (p.depth / 2 + .7) * c };
}
export function layoutValidation(snapshot: SeatingSnapshot): PublicationValidation {
  const errors: PublicationValidation["errors"] = [], warnings: PublicationValidation["warnings"] = [];
  const layout = snapshot.venueLayout ?? defaultVenueLayout();
  const assignedTables = new Set(snapshot.assignments.map(a => snapshot.seats.find(s => s.id === a.seatId)?.tableId));
  const placed = snapshot.tables.flatMap(table => {
    const p = layout.tables[table.id];
    if (!p) {
      if (assignedTables.has(table.id)) errors.push({ code: "table_unplaced", message: `${table.name} has assigned guests but has not been placed.`, relatedIds: [table.id] });
      return [];
    }
    const f = footprint(table, p);
    if (assignedTables.has(table.id) && (Math.abs(p.x) + f.halfWidth > layout.parameters.lawnWidth / 2 + 1e-6
      || Math.abs(p.y) + f.halfDepth > layout.parameters.lawnLength / 2 + 1e-6)) errors.push({ code: "table_outside_venue", message: `${table.name} and its chair space extend outside the reception lawn.`, relatedIds: [table.id] });
    return [{ table, f }];
  });
  const obstacles = [
    { label: "stage", ...layout.landmarks.stage, halfWidth: ledLayout(layout.parameters, layout.led).width / 2, halfDepth: layout.parameters.stageDepth / 2 },
    { label: "dance floor", ...layout.landmarks.danceFloor, halfWidth: layout.parameters.danceFloorSize / 2, halfDepth: layout.parameters.danceFloorSize / 2 },
  ];
  const near = (a: ReturnType<typeof footprint>, b: ReturnType<typeof footprint>) => Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + .5 && Math.abs(a.y - b.y) < a.halfDepth + b.halfDepth + .5;
  placed.forEach(({ table, f }, i) => {
    placed.slice(i + 1).forEach(other => { if (near(f, other.f)) warnings.push({ code: "layout_clearance", message: `${table.name} and ${other.table.name} may overlap or have less than 0.5 m clearance.`, relatedIds: [table.id, other.table.id] }); });
    obstacles.forEach(o => { if (near(f, o)) warnings.push({ code: "layout_clearance", message: `${table.name} may overlap or be too close to the ${o.label}.`, relatedIds: [table.id] }); });
  });
  return { canPublish: !errors.length, errors, warnings };
}

/** PostgreSQL jsonb reorders object keys; compare content, not wire key order. */
export function layoutSignature(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
    return item;
  };
  return JSON.stringify(canonical(value));
}

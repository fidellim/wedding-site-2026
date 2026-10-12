import { physicalChairs, type VenueLayout } from "../venue/layout";
import type { SeatingSnapshot } from "../domain/types";
import type { FurnitureTarget } from "../venue/VenueInspection";
import { cameraView, normalizeParameters } from "../venue/venueModel";
export type SeatCameraView = "aerial" | "close-up";

/** A queued animation frame may predate a journey started by a React effect. */
export function flightProgress(now: number, start: number) {
  return Math.max(0, Math.min(1, (now - start) / 10000));
}

export function seatDestination(snapshot: SeatingSnapshot, layout: VenueLayout, target: FurnitureTarget, aspect = 1.5, view: SeatCameraView = "close-up") {
  const table = snapshot.tables.find(t => t.id === target.tableId), p = layout.tables[target.tableId];
  if (!table || !p) return null;
  const chair = target.seatNumber === undefined ? null : physicalChairs(table, p).find(c => c.number === target.seatNumber);
  const angle = p.rotation * Math.PI / 180;
  const x = p.x + (chair && view === "close-up" ? chair.x * Math.cos(angle) - chair.y * Math.sin(angle) : 0);
  const y = p.y + (chair && view === "close-up" ? chair.x * Math.sin(angle) + chair.y * Math.cos(angle) : 0);
  const aerial = view === "aerial";
  const distance = Math.max(aerial ? 11 : 9, Math.max(p.width, p.depth) * (aerial ? 3.5 : 2.5)) * Math.max(1, .9 / Math.max(.35, aspect));
  return { position: [x + distance * .3, -y - distance * (aerial ? .4 : .6), distance] as [number, number, number], target: [x, -y, .4] as [number, number, number] };
}

export function flightViews(snapshot: SeatingSnapshot, layout: VenueLayout, target: FurnitureTarget, aspect: number, view: SeatCameraView = "aerial") {
  const end = seatDestination(snapshot, layout, target, aspect, view);
  if (!end) return null;
  const parameters = normalizeParameters(layout.parameters);
  return [cameraView(parameters, "entrance", aspect, layout.led), cameraView(parameters, "ceremony", aspect, layout.led),
    { position: [0, 12, Math.max(28, parameters.lawnWidth * .9)], target: [0, 0, 0] }, end];
}

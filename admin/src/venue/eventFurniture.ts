import type { TablePlacement, VenueLayout } from "./layout";
import { ledLayout } from "./venueModel";

export const eventFurnitureKinds = ["couple", "cake"] as const;
export type EventFurnitureKind = typeof eventFurnitureKinds[number];
export type EventFurnitureLayout = Partial<Record<EventFurnitureKind, TablePlacement>>;
export const eventFurnitureNames = { couple: "Couple’s table", cake: "Cake table" };

/** Chairs sit together behind the couple's table, facing local -Y. No guest seat IDs. */
export function coupleChairs(p: TablePlacement) {
  return [-1, 1].map(side => ({ x: side * Math.min(.45, p.width / 4), y: p.depth / 2 + .45 }));
}

export function eventFurnitureEstimates(layout: VenueLayout): Required<EventFurnitureLayout> {
  // Facing the LED from the lawn, left is +plan X. Turn inward toward the dance floor.
  const couple: TablePlacement = layout.eventFurniture?.couple ?? { x: layout.landmarks.stage.x + ledLayout(layout.parameters, layout.led).width / 2 + 3,
    y: layout.landmarks.stage.y - .5, rotation: 330, width: 1.8, depth: .75, dimensionsVerified: false };
  const angle = couple.rotation * Math.PI / 180;
  return { couple, cake: { x: Math.round((couple.x - .9 * Math.cos(angle) + 2.4 * Math.sin(angle)) * 10) / 10,
    y: Math.round((couple.y - .9 * Math.sin(angle) - 2.4 * Math.cos(angle)) * 10) / 10,
    rotation: 0, width: .9, depth: .9, dimensionsVerified: false } };
}

export function eventFurnitureLandmarks(layout?: VenueLayout) {
  return eventFurnitureKinds.flatMap(kind => {
    const p = layout?.eventFurniture?.[kind];
    return p ? [{ id: `event-${kind}`, label: eventFurnitureNames[kind], position: [p.x, p.y, kind === "cake" ? 1.5 : .9] }] : [];
  });
}

/** Conservative rotated bounds include the two chairs behind the couple, with no chairs at the cake. */
export function eventFurnitureFootprint(kind: EventFurnitureKind, p: TablePlacement) {
  if (kind === "cake") return { x: p.x, y: p.y, halfWidth: p.width / 2, halfDepth: p.width / 2 };
  const angle = p.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const rear = p.depth / 2 + .75, front = -p.depth / 2;
  const offset = (rear + front) / 2, halfDepth = (rear - front) / 2;
  const halfWidth = Math.max(p.width / 2, Math.min(.45, p.width / 4) + .23);
  return { x: p.x - offset * s, y: p.y + offset * c,
    halfWidth: halfWidth * Math.abs(c) + halfDepth * Math.abs(s),
    halfDepth: halfWidth * Math.abs(s) + halfDepth * Math.abs(c) };
}

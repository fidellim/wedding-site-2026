import type { SeatingSnapshot } from "../domain/types";
import { ceremonyStructure, venueLayout, type VenueParameters } from "./venueModel";

/** RSVP totals include attendees whose named roster has not been completed yet. */
export function ceremonyChairCount(snapshot: SeatingSnapshot) {
  return snapshot.invitationParties.reduce((total, party) => {
    if (party.rsvpStatus !== "accepted") return total;
    const noSeat = snapshot.invitees.filter(guest => guest.invitationPartyId === party.id
      && guest.attendanceStatus === "confirmed" && !guest.requiresSeat).length;
    return total + Math.max(0, party.attendingCount - noSeat);
  }, 0);
}

// Physical dimensions include the skirt pleats, not just the seat cushion.
const chairDimensions = { seatWidth: .5, skirtWidth: .54, pleatDepth: .016 } as const;
const chair = { ...chairDimensions, footprintWidth: chairDimensions.skirtWidth + chairDimensions.pleatDepth * 2 };

/** Approximate event footprint; chairs have positions but no guest or seat identities. */
export function ceremonyLayout(p: VenueParameters, chairCount: number) {
  const l = venueLayout(p), aisleWidth = 2.2;
  const platformSize = 4.6, platformHalf = platformSize / 2;
  const platformX = l.plazaX, structure = ceremonyStructure(p);
  // Distance from the fountain center to the nearest square edge/corner.
  const structureClearance = structure.radius + .8;
  const horizontalGap = Math.max(0, Math.abs(structure.x - platformX) - platformHalf);
  const verticalGap = horizontalGap < structureClearance
    ? platformHalf + Math.sqrt(structureClearance ** 2 - horizontalGap ** 2) : 0;
  const platformY = Math.min(l.terraceFront - platformHalf - 1.2, structure.y - verticalGap);
  const floor = p.terraceHeight + .075, platformHeight = .18;
  const aisleStart = l.terraceFront - p.plazaLength + .3;
  const aisleEnd = platformY - platformHalf + .1;
  // A circumscribed footprint keeps adjacent curved rows clear at every heading.
  const chairRadius = Math.SQRT2 * chair.footprintWidth / 2;
  const rowSpacing = 1, chairSpacing = chairRadius * 2 + .06;
  const maxColumns = Math.max(1, Math.floor((l.plazaWidth / 2 - chairRadius - aisleWidth / 2 - .85) / chairSpacing) + 1);
  const innerX = aisleWidth / 2 + .85;
  const rowRadius = (columns: number) => Math.hypot(innerX + (columns - 1) * chairSpacing, platformHalf + 1.15);
  const maxRadius = Math.hypot(Math.max(0, platformY - aisleStart - chairRadius), innerX);
  const capacity = (columns: number) => Math.max(0, Math.floor((maxRadius - rowRadius(columns)) / rowSpacing) + 1) * columns * 2;
  let columns = Math.min(4, maxColumns);
  while (columns < maxColumns && chairCount > capacity(columns)) columns++;
  const firstRadius = rowRadius(columns);
  const chairs = Array.from({ length: chairCount }, (_, index) => {
    const row = Math.floor(index / (columns * 2)), side = index % 2 ? 1 : -1;
    const column = Math.floor(index / 2) % columns;
    const offsetX = side * (innerX + column * chairSpacing), radius = firstRadius + row * rowSpacing;
    const offsetY = -Math.sqrt(radius ** 2 - offsetX ** 2);
    return { x: platformX + offsetX, y: platformY + offsetY,
      rotation: Math.atan2(offsetX, -offsetY) };
  });
  const flowers = [-1, 1].flatMap(side => [0, .45, .9].map(fraction => ({
    x: platformX + side * (aisleWidth / 2 + .32),
    y: aisleStart + .7 + fraction * Math.max(0, aisleEnd - aisleStart - 1.4),
  })));
  const fits = chairs.every(point => {
    const extent = (Math.abs(Math.cos(point.rotation)) + Math.abs(Math.sin(point.rotation))) * chair.footprintWidth / 2;
    return Math.abs(point.x - platformX) + extent <= l.plazaWidth / 2
      && Math.abs(point.x - platformX) - extent >= aisleWidth / 2
      && point.y - extent >= aisleStart
      && point.y + extent <= platformY - platformHalf;
  });
  // Ground-grown floral surround; the front opening stays wider than the aisle.
  const platformFlowers = [-1, 1].flatMap(side => [
    { x: platformX + side * 1.92, y: platformY - platformHalf - .12, spread: .48, height: side < 0 ? .72 : .9 },
    ...[-1.25, -.15, 1.05, 2.05].map((offset, index) => ({
      x: platformX + side * (platformHalf + .14), y: platformY + offset,
      spread: index % 2 ? .38 : .46, height: [.7, .55, .9, side < 0 ? .95 : 1.25][index],
    })),
  ]);
  for (const offset of [-1.65, -.8, 0, .8, 1.65]) platformFlowers.push({
    x: platformX + offset, y: platformY + platformHalf + .12,
    spread: .38, height: Math.abs(offset) < 1 ? .42 : .7,
  });
  return { platformX, platformY, platformSize, platformHeight, floor, aisleWidth, aisleStart, aisleEnd, chair,
    chairs, flowers, platformFlowers, fits };
}

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

/** Approximate event footprint; chairs have positions but no guest or seat identities. */
export function ceremonyLayout(p: VenueParameters, chairCount: number) {
  const l = venueLayout(p), aisleWidth = 2.2;
  const platformRadius = Math.min(2.3, l.plazaWidth * .18);
  const platformX = l.plazaX, structure = ceremonyStructure(p);
  const structureClearance = platformRadius + structure.radius + .8;
  const horizontalGap = structure.x - platformX;
  const verticalGap = Math.sqrt(Math.max(0, structureClearance ** 2 - horizontalGap ** 2));
  const platformY = Math.min(l.terraceFront - platformRadius - 1.2, structure.y - verticalGap);
  const floor = p.terraceHeight + .075, platformHeight = .18;
  const aisleStart = l.terraceFront - p.plazaLength + .3;
  const aisleEnd = platformY - platformRadius + .1;
  const rowSpacing = .9, chairSpacing = .65;
  const maxColumns = Math.max(1, Math.floor((l.plazaWidth / 2 - 1.2 - aisleWidth / 2 - .85) / chairSpacing) + 1);
  const innerX = aisleWidth / 2 + .85;
  const rowRadius = (columns: number) => Math.hypot(innerX + (columns - 1) * chairSpacing, platformRadius + 1.15);
  const maxRadius = Math.hypot(Math.max(0, platformY - aisleStart - .5), innerX);
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
  return { platformX, platformY, platformRadius, platformHeight, floor, aisleWidth, aisleStart, aisleEnd,
    archY: platformY + .55, archRadius: 1.55, chairs, flowers, fits: chairCount <= capacity(columns) };
}

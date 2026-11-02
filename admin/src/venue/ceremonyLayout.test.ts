import { expect, it } from "vitest";
import { createDemoWorkspace } from "../data/memoryRepository";
import { ceremonyChairCount, ceremonyLayout } from "./ceremonyLayout";
import { ceremonyStructure, defaultParameters, venueLayout } from "./venueModel";

it("includes unnamed accepted attendees and excludes only attending guests needing no chair", () => {
  const snapshot = createDemoWorkspace().draft;
  snapshot.invitationParties[0].attendingCount = 7;
  snapshot.invitees[0].requiresSeat = false;
  snapshot.invitees.find(guest => guest.attendanceStatus === "not_attending")!.requiresSeat = false;
  expect(ceremonyChairCount(snapshot)).toBe(8);
  snapshot.assignments = [];
  expect(ceremonyChairCount(snapshot)).toBe(8);
  snapshot.invitationParties[1].rsvpStatus = "pending";
  expect(ceremonyChairCount(snapshot)).toBe(6);
});

it.each([0, 1, 5, 48, 125, 240])("places exactly %s anonymous chairs outside the straight aisle", count => {
  const layout = ceremonyLayout(defaultParameters, count), plaza = venueLayout(defaultParameters);
  expect(layout.chairs).toHaveLength(count);
  if (count <= 125) expect(layout.fits).toBe(true);
  for (const chair of layout.chairs) {
    expect(Object.keys(chair).sort()).toEqual(["rotation", "x", "y"]);
    const extent = (Math.abs(Math.cos(chair.rotation)) + Math.abs(Math.sin(chair.rotation))) * layout.chair.footprintWidth / 2;
    expect(Math.abs(chair.x - layout.platformX) - extent).toBeGreaterThan(layout.aisleWidth / 2);
    expect(chair.y + extent).toBeLessThan(layout.platformY - layout.platformSize / 2);
    expect(chair.x - extent).toBeGreaterThan(plaza.plazaX - plaza.plazaWidth / 2);
    expect(chair.x + extent).toBeLessThan(plaza.plazaX + plaza.plazaWidth / 2);
    if (layout.fits) expect(chair.y - extent).toBeGreaterThan(layout.aisleStart);
  }
  expect(new Set(layout.chairs.map(chair => `${chair.x},${chair.y}`)).size).toBe(count);
});

it("curves each row around the platform and turns chairs toward it", () => {
  const layout = ceremonyLayout(defaultParameters, 48);
  const row = layout.chairs.slice(0, 8);
  const radius = Math.hypot(row[0].x - layout.platformX, row[0].y - layout.platformY);
  for (const chair of row) {
    const dx = layout.platformX - chair.x, dy = layout.platformY - chair.y;
    expect(Math.hypot(dx, dy)).toBeCloseTo(radius);
    expect(-Math.sin(chair.rotation)).toBeCloseTo(dx / radius);
    expect(Math.cos(chair.rotation)).toBeCloseTo(dy / radius);
  }
  expect(row[6].y).toBeGreaterThan(row[0].y);
});

it("reports overflow without dropping guests from the chair count", () => {
  const layout = ceremonyLayout(defaultParameters, 500);
  expect(layout.fits).toBe(false);
  expect(layout.chairs).toHaveLength(500);
});


it.each([12, 18, 24, 26])("keeps the 4.6 m square clear of the fountain in a %s m plaza", plazaWidth => {
  const p = { ...defaultParameters, plazaWidth }, layout = ceremonyLayout(p, 92), fountain = ceremonyStructure(p);
  expect(layout.platformSize).toBe(4.6);
  const dx = Math.max(0, Math.abs(fountain.x - layout.platformX) - layout.platformSize / 2);
  const dy = Math.max(0, Math.abs(fountain.y - layout.platformY) - layout.platformSize / 2);
  expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(fountain.radius + .8 - 1e-10);
  expect(layout.aisleEnd).toBeGreaterThan(layout.platformY - layout.platformSize / 2);
});

it.each([12, 18, 24, 26])("accounts for full rotated footprints and overflow in a %s m plaza", plazaWidth => {
  const p = { ...defaultParameters, plazaWidth };
  for (const count of [48, 92, 125, 240, 500]) {
    const layout = ceremonyLayout(p, count), half = layout.chair.footprintWidth / 2;
    const corners = layout.chairs.flatMap(chair => [-half, half].flatMap(x => [-half, half].map(y => ({
      x: chair.x + x * Math.cos(chair.rotation) - y * Math.sin(chair.rotation),
      y: chair.y + x * Math.sin(chair.rotation) + y * Math.cos(chair.rotation),
    }))));
    expect(layout.fits).toBe(corners.every(point => Math.abs(point.x - layout.platformX) <= plazaWidth / 2
      && Math.abs(point.x - layout.platformX) >= layout.aisleWidth / 2
      && point.y >= layout.aisleStart && point.y <= layout.platformY - layout.platformSize / 2));
    // Circumscribed footprints prove separation even where adjacent chairs turn differently.
    for (let i = 0; i < layout.chairs.length; i++) for (let j = i + 1; j < layout.chairs.length; j++) {
      const a = layout.chairs[i], b = layout.chairs[j];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(layout.chair.footprintWidth * Math.SQRT2);
    }
  }
});


it("keeps the floral garden outside the couple's standing area and the aisle entrance", () => {
  const layout = ceremonyLayout(defaultParameters, 92);
  expect(layout.platformFlowers.length).toBeGreaterThan(10);
  for (const flowers of layout.platformFlowers) {
    // Include the bloom beyond each stem cluster's spread.
    const radius = flowers.spread + .15;
    expect(Math.abs(flowers.x - layout.platformX) - radius > 1.1
      || Math.abs(flowers.y - layout.platformY) - radius > 1.2).toBe(true);
    if (flowers.y - radius < layout.platformY - layout.platformSize / 2) {
      expect(Math.abs(flowers.x - layout.platformX) - radius).toBeGreaterThan(layout.aisleWidth / 2);
    }
  }
  const back = layout.platformFlowers.filter(flowers => Math.abs(flowers.x - layout.platformX) < 1);
  expect(back.every(flowers => flowers.height < .5)).toBe(true);
});

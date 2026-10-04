import { expect, it } from "vitest";
import { createDemoWorkspace } from "../data/memoryRepository";
import { ceremonyChairCount, ceremonyLayout } from "./ceremonyLayout";
import { defaultParameters, venueLayout } from "./venueModel";

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
  for (const chair of layout.chairs) {
    expect(Object.keys(chair).sort()).toEqual(["rotation", "x", "y"]);
    expect(Math.abs(chair.x - layout.platformX) - .22).toBeGreaterThan(layout.aisleWidth / 2);
    expect(chair.y + .22).toBeLessThan(layout.platformY - layout.platformRadius);
    expect(chair.x - .22).toBeGreaterThan(plaza.plazaX - plaza.plazaWidth / 2);
    expect(chair.x + .22).toBeLessThan(plaza.plazaX + plaza.plazaWidth / 2);
    if (layout.fits) expect(chair.y - .22).toBeGreaterThan(layout.aisleStart);
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

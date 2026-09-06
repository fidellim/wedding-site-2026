import { describe, expect, it } from "vitest";
import { defaultSideCounts, tableLayout, validSideCounts } from "./tableLayout";
import type { SeatingTable } from "./types";

const table: SeatingTable = { id: "t", name: "Lily", number: 1, shape: "round", capacity: 4, seatOneAngle: 0 };

describe("physical table layout", () => {
  it("starts at the top and runs clockwise; angles rotate chairs around a fixed round surface", () => {
    const initial = tableLayout(table);
    expect(initial.seats[0].x).toBeCloseTo(initial.width / 2);
    expect(initial.seats[0].y).toBeLessThan(initial.height / 2);
    expect(initial.seats[1].x).toBeGreaterThan(initial.width / 2);
    const rotated = tableLayout({ ...table, seatOneAngle: 90 });
    expect(rotated.seats[0].x).toBeCloseTo(initial.seats[1].x);
    expect(rotated.seats[0].y).toBeCloseTo(initial.seats[1].y);
    expect(rotated.surface).toEqual(initial.surface);
  });

  it("places legacy odd rectangular capacity on the long sides, with the extra on top", () => {
    const layout = tableLayout({ ...table, shape: "rectangular", capacity: 5 });
    expect(layout.seats.filter((seat) => seat.y < layout.surface.top)).toHaveLength(3);
    expect(layout.seats.filter((seat) => seat.y > layout.surface.top + layout.surface.height)).toHaveLength(2);
    expect(layout.seats[3].x).toBeGreaterThan(layout.seats[4].x);
  });

  it("renumbers fixed rectangular chair positions from the selected chair", () => {
    const rectangular = { ...table, shape: "rectangular" as const, sideCounts: { top: 1, right: 1, bottom: 1, left: 1 } };
    const before = tableLayout(rectangular);
    const after = tableLayout({ ...rectangular, seatOnePosition: 2 });
    expect(after.seats.map((seat) => seat.number)).toEqual([3, 4, 1, 2]);
    expect(after.seats.map(({ x, y }) => [x, y])).toEqual(before.seats.map(({ x, y }) => [x, y]));
  });

  it("rejects fractional, negative, and mismatched chair counts", () => {
    expect(validSideCounts(defaultSideCounts(5), 5)).toBe(true);
    expect(validSideCounts({ top: 1.5, right: 0, bottom: 2.5, left: 0 }, 4)).toBe(false);
    expect(validSideCounts({ top: -1, right: 0, bottom: 5, left: 0 }, 4)).toBe(false);
    expect(validSideCounts(defaultSideCounts(5), 4)).toBe(false);
  });

  it("keeps name cards within the canvas and nonoverlapping for all supported capacities", () => {
    for (let capacity = 1; capacity <= 30; capacity++) {
      for (const shape of ["round", "rectangular"] as const) {
        for (const expanded of [false, true]) {
          const layout = tableLayout({ ...table, capacity, shape, seatOneAngle: 37 }, expanded);
          for (const [index, seat] of layout.seats.entries()) {
            expect(seat.x - layout.seatWidth / 2).toBeGreaterThanOrEqual(0);
            expect(seat.y - layout.seatHeight / 2).toBeGreaterThanOrEqual(0);
            expect(seat.x + layout.seatWidth / 2).toBeLessThanOrEqual(layout.width);
            expect(seat.y + layout.seatHeight / 2).toBeLessThanOrEqual(layout.height);
            for (const other of layout.seats.slice(index + 1)) {
              expect(Math.abs(seat.x - other.x) >= layout.seatWidth || Math.abs(seat.y - other.y) >= layout.seatHeight).toBe(true);
            }
          }
        }
      }
    }
  });
});

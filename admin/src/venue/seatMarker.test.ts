import { expect, it } from "vitest";
import { placeSeatMarker } from "./seatMarker";

const size = { width: 140, height: 36 };

it("keeps the pointer anchored to the visible seat while avoiding the guide panel", () => {
  const panel = { left: 12, top: 440, width: 366, height: 320 };
  const marker = placeSeatMarker({ x: 210, y: 420, visible: true }, size, 390, 800, [panel])!;
  expect(marker.edge).toBe(false);
  expect(marker).toMatchObject({ x: 210, y: 420 });
  expect(marker.top + marker.height).toBeLessThan(panel.top);
});

it.each([-600, 1200])("keeps an off-screen seat at x=%s discoverable with a directional edge arrow", x => {
  const marker = placeSeatMarker({ x, y: 300, visible: false }, size, 390, 800, [])!;
  expect(marker.edge).toBe(true);
  expect(Math.sign(Math.cos(marker.angle))).toBe(x < 0 ? -1 : 1);
  expect(marker.left).toBeGreaterThanOrEqual(16);
  expect(marker.left + marker.width).toBeLessThanOrEqual(374);
});

it("moves an edge marker clear of mobile panels even when its chair is under the panel", () => {
  const panels = [{ left: 0, top: 470, width: 390, height: 330 }, { left: 0, top: 0, width: 390, height: 100 }];
  const marker = placeSeatMarker({ x: 195, y: 600, visible: true }, size, 390, 800, panels)!;
  expect(marker.edge).toBe(true);
  expect(marker.top).toBeGreaterThan(110);
  expect(marker.top + marker.height).toBeLessThan(460);
  expect(Math.sin(marker.angle)).toBeGreaterThan(0);
});

it("does not draw a clipped marker when the viewport cannot fit it", () => {
  expect(placeSeatMarker({ x: -50, y: 30, visible: false }, size, 100, 100, [])).toBeNull();
});

import { expect, it } from "vitest";
import { placeLandmarkLabels } from "./landmarkLabels";

it("keeps clustered venue callouts separated and inside a phone viewport", () => {
  const result = placeLandmarkLabels(["water", "plaza", "lawn", "stage", "pavilion", "entrance", "sand"].map(id => ({ id, x: 170, y: 240, width: 130, height: 30 })), 358, 440);
  expect(result.some(tag => tag.id === "lawn")).toBe(true);
  expect(result.some(tag => tag.id === "stage")).toBe(true);
  for (const tag of result) {
    expect(tag.left).toBeGreaterThanOrEqual(12);
    expect(tag.top).toBeGreaterThanOrEqual(12);
    expect(tag.left + tag.width).toBeLessThanOrEqual(346);
    expect(tag.top + tag.height).toBeLessThanOrEqual(428);
    expect(tag.x >= tag.left - 8 && tag.x <= tag.left + tag.width + 8 && tag.y >= tag.top - 8 && tag.y <= tag.top + tag.height + 8).toBe(false);
  }
  result.forEach((a, i) => result.slice(i + 1).forEach(b => {
    expect(a.left < b.left + b.width + 10 && a.left + a.width + 10 > b.left && a.top < b.top + b.height + 10 && a.top + a.height + 10 > b.top).toBe(false);
  }));
});

it("preserves leader anchors at edges and omits callouts that cannot fit", () => {
  const edge = placeLandmarkLabels([{ id: "stage", x: 340, y: 400, width: 100, height: 30 }], 358, 440)[0];
  expect(edge).toMatchObject({ x: 340, y: 400 });
  expect(edge.lineX).toBeGreaterThanOrEqual(edge.left);
  expect(edge.lineX).toBeLessThanOrEqual(edge.left + edge.width);
  expect(placeLandmarkLabels([{ id: "stage", x: 20, y: 20, width: 400, height: 30 }], 358, 440)).toEqual([]);
});

it("keeps callouts clear of seating information and view controls", () => {
  const overlays = [{ left: 12, top: 290, width: 320, height: 140 }, { left: 12, top: 12, width: 300, height: 80 }];
  const result = placeLandmarkLabels([{ id: "lawn", x: 180, y: 270, width: 130, height: 30 },
    { id: "stage", x: 170, y: 280, width: 100, height: 30 }], 358, 440, overlays);
  expect(result.length).toBeGreaterThan(0);
  for (const tag of result) for (const panel of overlays) {
    expect(tag.left < panel.left + panel.width + 10 && tag.left + tag.width + 10 > panel.left
      && tag.top < panel.top + panel.height + 10 && tag.top + tag.height + 10 > panel.top).toBe(false);
  }
});

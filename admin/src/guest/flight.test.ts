import { expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { flightViews, seatDestination } from "./flight";
import { previewFixture } from "./previewFixtures";
import { LED_HEIGHT, LED_WIDTH } from "../venue/venueModel";

it.each([.45, 1.5])("keeps the selected seat and either LED arrangement visible at aspect %s", aspect => {
  const { snapshot } = previewFixture("split"), layout = snapshot.venueLayout!;
  const target = { tableId: "sample-long", seatNumber: 6 };
  const place = new Vector3(...seatDestination(snapshot, layout, target, aspect, "close-up")!.target);
  for (const screen of [[-12, 30, 3], [18, -4, 2]] satisfies [number, number, number][]) {
    const end = seatDestination(snapshot, layout, target, aspect, "aerial", screen)!;
    const camera = new PerspectiveCamera(40, aspect, .2, 600);
    camera.up.set(0, 0, 1); camera.position.fromArray(end.position);
    camera.lookAt(new Vector3(...end.target)); camera.updateMatrixWorld(true);
    const towardScreen = new Vector3(screen[0] - place.x, screen[1] - place.y, 0).normalize();
    const behindSeat = camera.position.clone().sub(place); behindSeat.z = 0;
    expect(behindSeat.normalize().dot(towardScreen)).toBeCloseTo(-1);
    expect(camera.position.z).toBeGreaterThan(place.z);
    const points = [place];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      points.push(new Vector3(screen[0] + x * LED_WIDTH / 2, screen[1] + y * LED_WIDTH / 2, screen[2] + z * LED_HEIGHT / 2));
    }
    for (const point of points) {
      const projected = point.clone().project(camera);
      expect(Math.abs(projected.x)).toBeLessThanOrEqual(.65);
      expect(Math.abs(projected.y)).toBeLessThanOrEqual(.65);
      expect(projected.z).toBeGreaterThan(-1);
      expect(projected.z).toBeLessThan(1);
    }
    expect(flightViews(snapshot, layout, target, aspect, "aerial", screen)?.at(-1)).toEqual(end);
  }
});

it("keeps the destination finite if the screen is directly above the selected place", () => {
  const { snapshot } = previewFixture("single"), layout = snapshot.venueLayout!;
  const target = { tableId: "sample-round", seatNumber: 3 };
  const place = seatDestination(snapshot, layout, target, 1.5, "close-up")!.target;
  const end = seatDestination(snapshot, layout, target, 1.5, "aerial", [place[0], place[1], 3])!;
  expect([...end.position, ...end.target].every(Number.isFinite)).toBe(true);
});

it("preserves a tighter close-up of the chair while orienting it toward the screen", () => {
  const { snapshot } = previewFixture("single"), layout = snapshot.venueLayout!;
  const target = { tableId: "sample-round", seatNumber: 3 };
  const screen: [number, number, number] = [8, 30, 3];
  const original = seatDestination(snapshot, layout, target, 1.5, "close-up")!;
  const close = seatDestination(snapshot, layout, target, 1.5, "close-up", screen)!;
  const aerial = seatDestination(snapshot, layout, target, 1.5, "aerial", screen)!;
  expect(close.target).toEqual(original.target);
  expect(close.position[2]).toBeLessThan(aerial.position[2]);
  const forward = new Vector3(...close.target).sub(new Vector3(...close.position)); forward.z = 0;
  const towardScreen = new Vector3(...screen).sub(new Vector3(...close.target)); towardScreen.z = 0;
  expect(forward.normalize().dot(towardScreen.normalize())).toBeCloseTo(1);
});

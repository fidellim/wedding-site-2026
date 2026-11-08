import { physicalChairs, type VenueLayout } from "../venue/layout";
import type { SeatingSnapshot } from "../domain/types";
import type { FurnitureTarget } from "../venue/VenueInspection";
import { cameraView, LED_HEIGHT, LED_WIDTH, normalizeParameters } from "../venue/venueModel";
import { PerspectiveCamera, Vector3 } from "three";
export type SeatCameraView = "aerial" | "close-up";

/** A queued animation frame may predate a journey started by a React effect. */
export function flightProgress(now: number, start: number) {
  return Math.max(0, Math.min(1, (now - start) / 10000));
}

type ScenePoint = readonly [number, number, number];

/** Keep the selected place in the foreground and the actual screen ahead. */
function ledFacingDestination(place: Vector3, screenPosition: ScenePoint, distance: number, aspect: number, aerial: boolean) {
  const screen = new Vector3(...screenPosition);
  const direction = new Vector3(screen.x - place.x, screen.y - place.y, 0);
  const separation = direction.length();
  if (separation < .01) direction.set(0, 1, 0);
  direction.normalize();
  if (!aerial) {
    const position = place.clone().addScaledVector(direction, -distance * .67); position.z = distance;
    return { position: position.toArray(), target: place.toArray() };
  }
  const camera = new PerspectiveCamera(40, Math.max(.1, aspect), .2, 600);
  camera.up.set(0, 0, 1);
  const frame = [place];
  // A conservative box covers the 5×3m screen in either LED arrangement.
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    frame.push(screen.clone().add(new Vector3(x * LED_WIDTH / 2, y * LED_WIDTH / 2, z * LED_HEIGHT / 2)));
  }
  let back = Math.max(distance * .8, separation * .45);
  let height = Math.max(distance, screen.z + 4, separation * .35);
  let aim = new Vector3();
  for (let attempt = 0; attempt < 16; attempt++) {
    camera.position.copy(place).addScaledVector(direction, -back); camera.position.z = height;
    const forward = place.clone().sub(camera.position).normalize().add(screen.clone().sub(camera.position).normalize()).normalize();
    const focusHeight = (place.z + screen.z) / 2;
    aim = camera.position.clone().addScaledVector(forward, (height - focusHeight) / -forward.z);
    camera.lookAt(aim); camera.updateMatrixWorld(true);
    // Leave room for the guest panel and the mobile camera lift.
    if (frame.every(point => {
      const projected = point.clone().project(camera);
      return Math.abs(projected.x) <= .65 && Math.abs(projected.y) <= .65 && Math.abs(projected.z) <= 1;
    })) break;
    back *= 1.2; height *= 1.2;
  }
  return { position: camera.position.toArray(), target: aim.toArray() };
}

export function seatDestination(snapshot: SeatingSnapshot, layout: VenueLayout, target: FurnitureTarget, aspect = 1.5, view: SeatCameraView = "close-up", screenPosition?: ScenePoint) {
  const table = snapshot.tables.find(t => t.id === target.tableId), p = layout.tables[target.tableId];
  if (!table || !p) return null;
  const chair = target.seatNumber === undefined ? null : physicalChairs(table, p).find(c => c.number === target.seatNumber);
  const angle = p.rotation * Math.PI / 180;
  const x = p.x + (chair && (view === "close-up" || screenPosition) ? chair.x * Math.cos(angle) - chair.y * Math.sin(angle) : 0);
  const y = p.y + (chair && (view === "close-up" || screenPosition) ? chair.x * Math.sin(angle) + chair.y * Math.cos(angle) : 0);
  const aerial = view === "aerial";
  const distance = Math.max(aerial ? 11 : 9, Math.max(p.width, p.depth) * (aerial ? 3.5 : 2.5)) * Math.max(1, .9 / Math.max(.35, aspect));
  if (screenPosition) return ledFacingDestination(new Vector3(x, -y, .4), screenPosition, distance, aspect, aerial);
  return { position: [x + distance * .3, -y - distance * (aerial ? .4 : .6), distance] as [number, number, number], target: [x, -y, .4] as [number, number, number] };
}

export function flightViews(snapshot: SeatingSnapshot, layout: VenueLayout, target: FurnitureTarget, aspect: number, view: SeatCameraView = "aerial", screenPosition?: ScenePoint) {
  const end = seatDestination(snapshot, layout, target, aspect, view, screenPosition);
  if (!end) return null;
  const parameters = normalizeParameters(layout.parameters);
  return [cameraView(parameters, "entrance", aspect, layout.led), cameraView(parameters, "ceremony", aspect, layout.led),
    { position: [0, 12, Math.max(28, parameters.lawnWidth * .9)], target: [0, 0, 0] }, end];
}

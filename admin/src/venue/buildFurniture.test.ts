import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoWorkspace } from "../data/memoryRepository";
import { defaultVenueLayout, estimatedPlacement } from "./layout";
import { buildFurniture } from "./buildFurniture";
import { cameraView } from "./venueModel";
import { toScenePosition } from "./venueCoordinates";
import { seatDestination } from "../guest/flight";

it("places planner Seat 1 on the LED side and Seat 3 on the right when looking toward the LED", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const snapshot = createDemoWorkspace().draft;
  const table = snapshot.tables[0];
  table.capacity = 8; table.seatOneAngle = 0;
  const placement = { ...estimatedPlacement(table), x: 5, y: -2 };
  const layout = { ...defaultVenueLayout(), tables: { [table.id]: placement } };
  const furniture = buildFurniture(snapshot, layout);
  try {
    furniture.root.updateMatrixWorld(true);
    const group = furniture.root.getObjectByName(`TABLE_${table.id}`)!;
    const position = (number: number) => group.children.find(child => child.userData.furnitureTarget?.seatNumber === number)!.getWorldPosition(new THREE.Vector3());
    const center = group.getWorldPosition(new THREE.Vector3());
    const stage = new THREE.Vector3(...toScenePosition([layout.landmarks.stage.x, layout.landmarks.stage.y, 0]));
    expect(position(1).distanceTo(stage)).toBeLessThan(position(5).distanceTo(stage));
    const view = cameraView(layout.parameters, "stage", 1.5, layout.led);
    const camera = new THREE.PerspectiveCamera(45, 1.5, .1, 1000);
    camera.up.set(0, 0, 1); camera.position.fromArray(view.position); camera.lookAt(new THREE.Vector3(...view.target));
    camera.updateMatrixWorld(true);
    expect(position(3).project(camera).x).toBeGreaterThan(center.clone().project(camera).x);
    expect(position(7).project(camera).x).toBeLessThan(center.clone().project(camera).x);
    const destination = seatDestination(snapshot, layout, { tableId: table.id, seatNumber: 1 })!;
    expect(destination.target[0]).toBeCloseTo(position(1).x);
    expect(destination.target[1]).toBeCloseTo(position(1).y);
  } finally { furniture.dispose(); }
});

afterEach(() => vi.restoreAllMocks());

it.each([0, 90, 227])("keeps table-name textures readable above a table rotated %s degrees", rotation => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: vi.fn(), fillText: vi.fn(), measureText: () => ({ width: 200 }),
  } as unknown as CanvasRenderingContext2D);
  const snapshot = createDemoWorkspace().draft;
  const table = snapshot.tables[0];
  const layout = { ...defaultVenueLayout(), tables: {
    [table.id]: { ...estimatedPlacement(table), rotation },
  } };
  const furniture = buildFurniture(snapshot, layout);
  try {
    furniture.root.updateMatrixWorld(true);
    const group = furniture.root.getObjectByName(`TABLE_${table.id}`)!;
    const marker = group.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry)!;
    const origin = marker.localToWorld(new THREE.Vector3());
    const right = marker.localToWorld(new THREE.Vector3(1, 0, 0)).sub(origin);
    const up = marker.localToWorld(new THREE.Vector3(0, 1, 0)).sub(origin);
    expect(right.x).toBeCloseTo(1);
    expect(up.y).toBeCloseTo(1);
    expect(right.clone().cross(up).z).toBeGreaterThan(0);
  } finally { furniture.dispose(); }
});

it("identifies seats and table tops when raycast from above after rotation and scene reflection", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const snapshot = createDemoWorkspace().draft;
  const table = snapshot.tables[0];
  const layout = { ...defaultVenueLayout(), tables: { [table.id]: { ...estimatedPlacement(table), rotation: 90 } } };
  const furniture = buildFurniture(snapshot, layout);
  try {
    furniture.root.updateMatrixWorld(true);
    const group = furniture.root.getObjectByName(`TABLE_${table.id}`)!;
    const chair = group.children.find(child => child.userData.furnitureTarget?.seatNumber === 1)!;
    const chairPosition = chair.getWorldPosition(new THREE.Vector3());
    const raycaster = new THREE.Raycaster(new THREE.Vector3(chairPosition.x, chairPosition.y, 10), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(furniture.root, true)[0].object.userData.furnitureTarget).toEqual({ tableId: table.id, seatNumber: 1 });
    const tablePosition = group.getWorldPosition(new THREE.Vector3());
    raycaster.set(new THREE.Vector3(tablePosition.x, tablePosition.y, 10), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(furniture.root, true)[0].object.parent?.userData.furnitureTarget).toEqual({ tableId: table.id });
  } finally { furniture.dispose(); }
});

it.each(["round", "rectangular"] as const)("faces %s chairs toward their table after rotation and scene reflection", shape => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const snapshot = createDemoWorkspace().draft;
  const table = snapshot.tables.find(table => table.shape === shape)!;
  table.capacity = 12;
  const placement = { ...estimatedPlacement(table), rotation: 227 };
  const furniture = buildFurniture(snapshot, { ...defaultVenueLayout(), tables: { [table.id]: placement } });
  try {
    furniture.root.updateMatrixWorld(true);
    const group = furniture.root.getObjectByName(`TABLE_${table.id}`)!;
    for (const chair of group.children.filter(child => child.userData.furnitureTarget?.seatNumber)) {
      const target = shape === "round" ? new THREE.Vector3()
        : Math.abs(chair.position.x) > placement.width / 2
          ? new THREE.Vector3(0, chair.position.y, 0) : new THREE.Vector3(chair.position.x, 0, 0);
      const inward = group.localToWorld(target).sub(chair.getWorldPosition(new THREE.Vector3())).normalize();
      const front = chair.localToWorld(new THREE.Vector3(0, 1, 0)).sub(chair.getWorldPosition(new THREE.Vector3())).normalize();
      expect(front.dot(inward)).toBeCloseTo(1);
    }
  } finally { furniture.dispose(); }
});

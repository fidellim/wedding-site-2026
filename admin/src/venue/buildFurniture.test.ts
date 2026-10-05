import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoWorkspace } from "../data/memoryRepository";
import { defaultVenueLayout, estimatedPlacement } from "./layout";
import { buildFurniture } from "./buildFurniture";

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

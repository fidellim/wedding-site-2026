import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoWorkspace } from "../data/memoryRepository";
import { buildFurniture } from "./buildFurniture";
import { defaultVenueLayout, estimatedPlacement } from "./layout";

afterEach(() => vi.restoreAllMocks());
function canvasContext() {
  const ctx = { fillRect: vi.fn(), fillText: vi.fn(), measureText: (text: string) => ({ width: text.length * 30 }) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return ctx;
}

it.each([0, 90, 227])("keeps attached number cards readable and selectable on round and rectangular chairs at %s°", rotation => {
  canvasContext();
  const snapshot = createDemoWorkspace().draft;
  const layout = { ...defaultVenueLayout(), tables: Object.fromEntries(snapshot.tables.map((table, index) =>
    [table.id, { ...estimatedPlacement(table), rotation, x: index * 10 }])) };
  const furniture = buildFurniture(snapshot, layout);
  try {
    furniture.root.updateMatrixWorld(true);
    for (const table of snapshot.tables) {
      const group = furniture.root.getObjectByName(`TABLE_${table.id}`)!;
      const chairs = group.children.filter(child => child.userData.furnitureTarget?.seatNumber);
      expect(chairs).toHaveLength(table.capacity);
      for (const chair of chairs) {
        const forward = chair.localToWorld(new THREE.Vector3(0, 1, 0)).sub(chair.getWorldPosition(new THREE.Vector3())).normalize();
        const card = chair.getObjectByName("CHAIR_NUMBERS") as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        expect(card.parent).toBe(chair);
        const positions = card.geometry.getAttribute("position"), normals = card.geometry.getAttribute("normal");
        // Each card face retains its own UV orientation in the shared geometry.
        for (const [face, start] of [0, 4, 8].entries()) {
          const point = (index: number) => card.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, start + index));
          const right = point(1).sub(point(0)), up = point(0).sub(point(2));
          const normal = new THREE.Vector3().fromBufferAttribute(normals, start).transformDirection(card.matrixWorld);
          expect(right.clone().cross(up).dot(normal)).toBeGreaterThan(0);
          if (face === 2) expect(normal.z).toBeCloseTo(1);
          else {
            expect(up.clone().normalize().z).toBeCloseTo(1);
            expect(normal.dot(forward)).toBeCloseTo(face === 1 ? 1 : -1);
          }
          const origin = point(0).add(point(3)).multiplyScalar(.5);
          const ray = new THREE.Raycaster(origin.clone().addScaledVector(normal, .4), normal.clone().negate());
          expect(ray.intersectObject(card)[0]?.object.userData.furnitureTarget).toEqual(chair.userData.furnitureTarget);
          expect(card.material.toneMapped).toBe(false);
        }
      }
    }
  } finally { furniture.dispose(); }
});

it("prints only the seat number, shares it across tables, and disposes shared card resources once", () => {
  const ctx = canvasContext(), snapshot = createDemoWorkspace().draft, table = snapshot.tables[0];
  table.number = 3; table.capacity = 30;
  const other = snapshot.tables[1];
  const layout = { ...defaultVenueLayout(), tables: { [table.id]: estimatedPlacement(table), [other.id]: estimatedPlacement(other) } };
  const furniture = buildFurniture(snapshot, layout, { textureAnisotropy: 8 });
  expect(ctx.fillText.mock.calls.some(([text]) => String(text).startsWith("TABLE"))).toBe(false);
  expect(ctx.fillText).toHaveBeenCalledWith("30", expect.any(Number), expect.any(Number));
  const group = furniture.root.getObjectByName(`TABLE_${table.id}`)!;
  const chair = group.children.find(child => child.userData.furnitureTarget?.seatNumber === 1)!;
  const cards = chair.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  expect(cards).toHaveLength(1);
  expect(cards[0].geometry.getIndex()!.count).toBe(18);
  const otherChair = furniture.root.getObjectByName(`TABLE_${other.id}`)!.children.find(child => child.userData.furnitureTarget?.seatNumber === 1)!;
  expect((otherChair.getObjectByName("CHAIR_NUMBERS") as THREE.Mesh).material).toBe(cards[0].material);
  expect(cards[0].material.map!.image).toMatchObject({ width: 256, height: 256 });
  expect(cards[0].material.map!.anisotropy).toBe(8);
  const geometryDispose = vi.spyOn(cards[0].geometry, "dispose");
  const textureDispose = vi.spyOn(cards[0].material.map!, "dispose");
  const materialDispose = vi.spyOn(cards[0].material, "dispose");
  furniture.dispose();
  expect(geometryDispose).toHaveBeenCalledOnce();
  expect(textureDispose).toHaveBeenCalledOnce();
  expect(materialDispose).toHaveBeenCalledOnce();
});

it("omits attached numbers when chair positions are unapproved without moving chairs", () => {
  canvasContext();
  const snapshot = createDemoWorkspace().draft, table = snapshot.tables[0];
  const layout = { ...defaultVenueLayout(), tables: { [table.id]: estimatedPlacement(table) } };
  const approved = buildFurniture(snapshot, layout), unapproved = buildFurniture(snapshot, layout, { chairNumbers: false });
  try {
    expect(approved.root.getObjectByName("CHAIR_NUMBERS")).toBeDefined();
    expect(unapproved.root.getObjectByName("CHAIR_NUMBERS")).toBeUndefined();
    const chairs = (root: THREE.Group) => root.getObjectByName(`TABLE_${table.id}`)!.children.filter(child => child.userData.furnitureTarget?.seatNumber);
    expect(chairs(unapproved.root).map(chair => chair.position.toArray())).toEqual(chairs(approved.root).map(chair => chair.position.toArray()));
  } finally { approved.dispose(); unapproved.dispose(); }
});

import * as THREE from "three";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoWorkspace } from "../data/memoryRepository";
import { defaultVenueLayout, estimatedPlacement, isVenueLayout, layoutValidation, type VenueLayout } from "./layout";
import { eventFurnitureEstimates, eventFurnitureFootprint } from "./eventFurniture";
import { buildFurniture } from "./buildFurniture";
import { TableFurniture } from "./TableFurniture";
import { LayoutEditor } from "./LayoutEditor";
import { cameraView } from "./venueModel";
import { toScenePosition } from "./venueCoordinates";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("starts left of the LED from the guests' viewpoint, facing inward with cake in front toward the stage", () => {
  const layout = defaultVenueLayout();
  const { couple, cake } = eventFurnitureEstimates(layout);
  expect(couple).toMatchObject({ width: 1.8, depth: .75, rotation: 330, dimensionsVerified: false });
  expect(cake).toMatchObject({ width: .9, depth: .9, dimensionsVerified: false });
  const view = cameraView(layout.parameters, "stage", 1.5, layout.led);
  const camera = new THREE.PerspectiveCamera(40, 1.5, .2, 600);
  camera.up.set(0, 0, 1); camera.position.fromArray(view.position); camera.lookAt(new THREE.Vector3(...view.target)); camera.updateMatrixWorld();
  const project = (x: number, y: number) => new THREE.Vector3(...toScenePosition([x, y, 0])).project(camera);
  expect(project(couple.x, couple.y).x).toBeLessThan(project(layout.landmarks.stage.x, layout.landmarks.stage.y).x);
  expect(cake.x).toBeLessThan(couple.x); expect(cake.y).toBeLessThan(couple.y);
  const snapshot = { ...createDemoWorkspace().draft, assignments: [], venueLayout: { ...layout, eventFurniture: { couple, cake } } };
  expect(layoutValidation(snapshot)).toMatchObject({ errors: [], warnings: [] });
});

it("accepts legacy layouts and rejects malformed event furniture", () => {
  const layout = defaultVenueLayout(), furniture = eventFurnitureEstimates(layout);
  expect(isVenueLayout(layout)).toBe(true);
  expect(isVenueLayout({ ...layout, eventFurniture: furniture })).toBe(true);
  for (const eventFurniture of [null, [], { buffet: furniture.cake }, { cake: null }, { couple: { ...furniture.couple, x: NaN } },
    { cake: { ...furniture.cake, depth: 1.2 } }, { couple: { ...furniture.couple, rotation: 360 } }]) {
    expect(isVenueLayout({ ...layout, eventFurniture })).toBe(false);
  }
});

it("checks event furniture against lawn edges, guest chairs, and event landmarks", () => {
  const snapshot = createDemoWorkspace().draft;
  const layout = { ...defaultVenueLayout(), tables: { [snapshot.tables[0].id]: estimatedPlacement(snapshot.tables[0]) }, eventFurniture: eventFurnitureEstimates(defaultVenueLayout()) };
  layout.eventFurniture.cake = { ...layout.eventFurniture.cake, x: 5, y: 0 };
  expect(layoutValidation({ ...snapshot, venueLayout: layout }).warnings.some(w => w.relatedIds.includes("cake") && w.relatedIds.includes(snapshot.tables[0].id))).toBe(true);
  layout.eventFurniture.cake = { ...layout.eventFurniture.cake, ...layout.landmarks.danceFloor };
  expect(layoutValidation({ ...snapshot, venueLayout: layout }).warnings.some(w => w.relatedIds.includes("cake") && w.message.includes("dance floor"))).toBe(true);
  layout.eventFurniture.couple.x = 100;
  expect(layoutValidation({ ...snapshot, venueLayout: layout }).errors.some(e => e.relatedIds.includes("couple"))).toBe(true);
});

it("renders two couple chairs and a cake in matching 2D and 3D positions without guest seat targets", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const snapshot = createDemoWorkspace().draft;
  const layout = { ...defaultVenueLayout(), eventFurniture: eventFurnitureEstimates(defaultVenueLayout()) };
  const { container } = render(<svg><TableFurniture snapshot={snapshot} layout={layout} /></svg>);
  expect(container.querySelectorAll("[data-couple-chair]")).toHaveLength(2);
  expect(container.querySelector('[data-event-furniture="cake"]')).toHaveAttribute("transform", `translate(${layout.eventFurniture.cake.x},${layout.eventFurniture.cake.y}) rotate(0)`);
  const furniture = buildFurniture(snapshot, layout);
  try {
    furniture.root.updateMatrixWorld(true);
    const couple = furniture.root.getObjectByName("EVENT_COUPLE")!;
    expect(couple.getWorldPosition(new THREE.Vector3()).toArray()).toEqual(toScenePosition([layout.eventFurniture.couple.x, layout.eventFurniture.couple.y, 0]));
    const chairs = couple.children.filter(child => child.name.endsWith("_CHAIR"));
    expect(chairs).toHaveLength(2);
    for (const chair of chairs) {
      expect(chair.userData.furnitureTarget).toBeUndefined();
      const front = chair.localToWorld(new THREE.Vector3(0, 1, 0)).sub(chair.getWorldPosition(new THREE.Vector3()));
      expect(front.x).toBeLessThan(0); expect(front.y).toBeGreaterThan(0);
    }
    const cake = furniture.root.getObjectByName("EVENT_CAKE")!;
    expect(cake.children.filter(child => child.name.startsWith("CAKE_TIER_"))).toHaveLength(3);
    expect(cake.children.some(child => child.userData.furnitureTarget)).toBe(false);
  } finally { furniture.dispose(); }
});

it("adds, resizes, rotates, and unplaces event furniture without changing guest table placements or assignments", async () => {
  const snapshot = createDemoWorkspace().draft;
  const before = structuredClone(snapshot);
  const layout = { ...defaultVenueLayout(), tables: { [snapshot.tables[0].id]: estimatedPlacement(snapshot.tables[0]) } };
  const save = vi.fn(async (_layout: VenueLayout) => true);
  const props = { snapshot, layout, disabled: false, save, undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false };
  const { rerender } = render(<LayoutEditor {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Add couple & cake tables" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const added = save.mock.calls[0][0];
  expect(added.tables).toEqual(layout.tables); expect(added.eventFurniture?.couple?.depth).toBe(.75);
  rerender(<LayoutEditor {...props} layout={added} />);
  expect(screen.getByLabelText("Depth (m)")).toBeValid();
  fireEvent.change(screen.getByLabelText("Rotation (°)"), { target: { value: "315" } });
  fireEvent.change(screen.getByLabelText("Width (m)"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Save table adjustments" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  const changed = save.mock.calls[1][0];
  expect(changed.eventFurniture?.couple).toMatchObject({ rotation: 315, width: 2, depth: .75 });
  expect(changed.eventFurniture?.cake).toEqual(added.eventFurniture?.cake);
  rerender(<LayoutEditor {...props} layout={changed} />);
  fireEvent.change(screen.getByLabelText("Selected furniture"), { target: { value: "event:cake" } });
  fireEvent.click(screen.getByRole("button", { name: "Move to unplaced tray" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
  expect(save.mock.calls[2][0].eventFurniture?.cake).toBeUndefined();
  expect(snapshot).toEqual(before);
});

it.each([.5, 1.8])("includes both chairs in clearance bounds when the couple’s table is %s m wide", width => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const layout = defaultVenueLayout(), snapshot = createDemoWorkspace().draft;
  const couple = { ...eventFurnitureEstimates(layout).couple, width };
  const furniture = buildFurniture(snapshot, { ...layout, eventFurniture: { couple } });
  try {
    furniture.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(furniture.root.getObjectByName("EVENT_COUPLE")!);
    const f = eventFurnitureFootprint("couple", couple);
    expect(box.min.x).toBeGreaterThanOrEqual(f.x - f.halfWidth - 1e-6);
    expect(box.max.x).toBeLessThanOrEqual(f.x + f.halfWidth + 1e-6);
    expect(box.min.y).toBeGreaterThanOrEqual(-f.y - f.halfDepth - 1e-6);
    expect(box.max.y).toBeLessThanOrEqual(-f.y + f.halfDepth + 1e-6);
  } finally { furniture.dispose(); }
});

import { describe, expect, it } from "vitest";
import { createDemoWorkspace, createMemorySeatingRepository } from "../data/memoryRepository";
import { previewVenueLayout, defaultVenueLayout, estimatedPlacement, footprint, isVenueLayout, layoutValidation, physicalChairs } from "./layout";

const placed = () => {
  const w = createDemoWorkspace();
  w.draft.venueLayout = { ...defaultVenueLayout(), tables: Object.fromEntries(w.draft.tables.map((t, i) => [t.id, { ...estimatedPlacement(t), x: 2 + i * 8 }])) };
  return w;
};
describe("physical venue layout", () => {
  it("preserves rectangular Seat 1 and clockwise numbering independently of whole-table rotation", () => {
    const t = { ...createDemoWorkspace().draft.tables[1], sideCounts: { top: 1, right: 1, bottom: 1, left: 1 }, seatOnePosition: 2 };
    const p = estimatedPlacement(t);
    const chairs = physicalChairs(t, p);
    expect(chairs.map(c => c.number)).toEqual([3, 4, 1, 2]);
    expect(chairs[2]).toMatchObject({ number: 1, y: p.depth / 2 + .45 });
    expect(physicalChairs(t, { ...p, rotation: 90 })).toEqual(chairs);
    const round = { ...t, shape: "round" as const, seatOneAngle: 90 };
    expect(physicalChairs(round, p)[0].x).toBeCloseTo(p.width / 2 + .45);
  });
  it("blocks missing assigned tables, but allows empty unplaced tables", () => {
    const w = placed(); delete w.draft.venueLayout!.tables["table-2"];
    expect(layoutValidation(w.draft).errors.map(e => e.code)).toEqual(["table_unplaced"]);
    w.draft.assignments = w.draft.assignments.filter(a => a.inviteeId !== "elena");
    expect(layoutValidation(w.draft).canPublish).toBe(true);
    delete w.draft.venueLayout;
    expect(layoutValidation(w.draft).errors[0].code).toBe("table_unplaced");
  });
  it("checks rotated chair footprints at boundaries and does not rescale positions when room dimensions change", () => {
    const w = placed(), l = w.draft.venueLayout!, t = w.draft.tables[1];
    l.tables[t.id] = { ...l.tables[t.id], width: 6, depth: 1, y: 5, rotation: 0 };
    expect(layoutValidation(w.draft).canPublish).toBe(true);
    l.tables[t.id].rotation = 90;
    expect(layoutValidation(w.draft).errors[0].code).toBe("table_outside_venue");
    l.parameters.lawnLength = 20;
    expect(layoutValidation(w.draft).canPublish).toBe(true);
    expect(l.tables[t.id].y).toBe(5);
    const f = footprint(t, l.tables[t.id]); expect(f.halfDepth).toBeCloseTo(3.7);
  });
  it("checks the inland-facing stage width across X and depth across Y", () => {
    const w = placed(), l = w.draft.venueLayout!, t = w.draft.tables[0];
    w.draft.assignments = [];
    l.tables = { [t.id]: { ...estimatedPlacement(t), x: l.landmarks.stage.x + 3, y: l.landmarks.stage.y } };
    l.landmarks.danceFloor = { x: -15, y: 0 };
    expect(layoutValidation(w.draft).warnings.some(issue => issue.message.includes("stage"))).toBe(true);
    l.tables[t.id] = { ...l.tables[t.id], x: l.landmarks.stage.x, y: l.landmarks.stage.y - 4 };
    expect(layoutValidation(w.draft).warnings).toEqual([]);
  });
  it("requires explicit warning acknowledgement, publishes an immutable layout, and restores it without losing assignments", async () => {
    const w = placed();
    w.draft.invitees.forEach(i => { if (i.id === "charlie" || i.id === "franco") i.requiresSeat = false; });
    w.draft.venueLayout!.tables["table-2"].x = 2;
    const repo = createMemorySeatingRepository(w);
    await expect(repo.execute({ type: "publish", expectedVersion: w.draft.version })).rejects.toThrow("publishing");
    let next = await repo.execute({ type: "publish", expectedVersion: w.draft.version, acknowledgeLayoutWarnings: true });
    const published = structuredClone(next.published!);
    const moved = structuredClone(next.draft.venueLayout!); moved.tables["table-2"].x = 12;
    next = await repo.execute({ type: "save_venue_layout", expectedVersion: next.draft.version, layout: moved });
    expect(next.draft.assignments).toEqual(w.draft.assignments); expect(next.draft.seats).toEqual(w.draft.seats);
    expect(next.published).toEqual(published);
    next = await repo.execute({ type: "restore_revision", expectedVersion: next.draft.version, revisionId: published.id });
    expect(next.draft.venueLayout).toEqual(published.venueLayout);
    expect(next.draft.assignments).toEqual(w.draft.assignments);
  });
  it("rejects non-finite and malformed geometry before saving", () => {
    const l = defaultVenueLayout(); l.tables.bad = { ...estimatedPlacement(createDemoWorkspace().draft.tables[0]), x: NaN };
    expect(isVenueLayout(l)).toBe(false);
    expect(isVenueLayout({ ...l, tables: { bad: null } })).toBe(false);
    expect(isVenueLayout({ ...defaultVenueLayout(), tables: [] })).toBe(false);
  });
});


it("upgrades old venue proportions locally without changing saved table or landmark data", () => {
  const original = defaultVenueLayout();
  original.parameters.plazaWidth = 18; original.parameters.plazaLength = 20;
  const parameters = Object.fromEntries(Object.entries(original.parameters).filter(([key]) =>
    !["approachLength", "pavilionPlazaGap", "bridgeHeight", "bridgeStepCount", "bridgeTread"].includes(key)));
  const legacy = { ...original, parameters };
  expect(isVenueLayout(legacy)).toBe(true);
  if (!isVenueLayout(legacy)) throw new Error("Legacy layout should remain valid");
  const updated = previewVenueLayout(legacy);
  expect(updated.parameters).toMatchObject({ plazaWidth: 24, plazaLength: 26, approachLength: 36, pavilionPlazaGap: 6 });
  expect(legacy.parameters).toEqual(parameters);
  expect(updated.tables).toBe(legacy.tables); expect(updated.landmarks).toBe(legacy.landmarks);
  expect(isVenueLayout({ ...updated, parameters: { ...updated.parameters, bridgeHeight: 999 } })).toBe(false);
  const customized = { ...updated, parameters: { ...updated.parameters, plazaWidth: 16 } };
  expect(previewVenueLayout(customized).parameters.plazaWidth).toBe(16);
});

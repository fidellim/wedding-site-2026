import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { createDemoWorkspace } from "../data/memoryRepository";
import { defaultVenueLayout } from "./layout";
import { useVenueLayout } from "./useVenueLayout";
import type { RepositoryCommand } from "../data/seatingRepository";

it("retains at most 50 session actions and saves undo/redo as draft changes", async () => {
  let workspace = createDemoWorkspace(); workspace.draft.venueLayout = defaultVenueLayout();
  const writes: RepositoryCommand[] = [];
  const execute = async (c: RepositoryCommand) => {
    if (c.type !== "save_venue_layout") return false;
    writes.push(c); workspace = { ...workspace, draft: { ...workspace.draft, version: workspace.draft.version + 1, venueLayout: { tables: structuredClone(c.layout.tables), landmarks: structuredClone(c.layout.landmarks), led: c.layout.led, parameters: structuredClone(c.layout.parameters) } } };
    return true;
  };
  const { result, rerender } = renderHook(() => useVenueLayout(workspace, execute));
  for (let i = 1; i <= 51; i++) {
    await act(async () => { await result.current.save({ ...defaultVenueLayout(), landmarks: { ...defaultVenueLayout().landmarks, entrance: { x: i, y: 0 } } }); }); rerender();
  }
  for (let i = 0; i < 50; i++) { await act(async () => { await result.current.undo(); }); rerender(); }
  expect(result.current.canUndo).toBe(false); expect(result.current.canRedo).toBe(true);
  expect(workspace.draft.venueLayout!.landmarks.entrance.x).toBe(1);
  await act(async () => { await result.current.redo(); }); rerender();
  expect(workspace.draft.venueLayout!.landmarks.entrance.x).toBe(2);
  expect(writes.at(-1)).toMatchObject({ type: "save_venue_layout", expectedVersion: workspace.draft.version - 1 });
});
it("adds no phantom undo action after a failed save and clears history on external layout changes", async () => {
  let workspace = createDemoWorkspace(); workspace.draft.venueLayout = defaultVenueLayout();
  let succeeds = false;
  const execute = async (c: RepositoryCommand) => {
    if (!succeeds || c.type !== "save_venue_layout") return false;
    workspace = { ...workspace, draft: { ...workspace.draft, version: workspace.draft.version + 1, venueLayout: c.layout } }; return true;
  };
  const { result, rerender } = renderHook(() => useVenueLayout(workspace, execute));
  const next = { ...defaultVenueLayout(), led: "side" as const };
  await act(async () => { expect(await result.current.save(next)).toBe(false); });
  expect(result.current.canUndo).toBe(false);
  succeeds = true; await act(async () => { await result.current.save(next); }); rerender();
  expect(result.current.canUndo).toBe(true);
  workspace = { ...workspace, draft: { ...workspace.draft, venueLayout: defaultVenueLayout() } }; rerender();
  expect(result.current.canUndo).toBe(false);
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoWorkspace } from "../data/memoryRepository";
import { defaultVenueLayout, estimatedPlacement, type VenueLayout } from "./layout";
import { LayoutEditor } from "./LayoutEditor";

afterEach(cleanup);

it("saves position and heading together without changing chair assignments", async () => {
  const snapshot = createDemoWorkspace().draft;
  const layout = { ...defaultVenueLayout(), tables: { "table-1": estimatedPlacement(snapshot.tables[0]) } };
  const save = vi.fn(async (_layout: VenueLayout) => true);
  render(<LayoutEditor snapshot={snapshot} layout={layout} disabled={false} save={save} undo={vi.fn()} redo={vi.fn()} canUndo={false} canRedo={false} />);
  expect(screen.getByRole("group", { name: "Venue overhead plan" })).toHaveTextContent("White Lily · Seat 1 · Alice Santos");
  fireEvent.change(screen.getByLabelText("Rotation (°)"), { target: { value: "90" } });
  fireEvent.change(screen.getByLabelText("X position (m)"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Save table adjustments" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).toMatchObject({ tables: { "table-1": { x: 10, rotation: 90 } } });
  expect(snapshot.assignments[0]).toEqual({ inviteeId: "alice", seatId: "table-1-seat-1" });
});
it("keeps editing disabled while allowing an existing layout to be viewed", () => {
  const snapshot = createDemoWorkspace().draft;
  const layout = { ...defaultVenueLayout(), tables: { "table-1": estimatedPlacement(snapshot.tables[0]) } };
  render(<LayoutEditor snapshot={snapshot} layout={layout} disabled save={vi.fn()} undo={vi.fn()} redo={vi.fn()} canUndo canRedo />);
  expect(screen.getByRole("button", { name: "Save table adjustments" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Place 2 · Garden Rose" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Undo layout" })).toBeDisabled();
  expect(screen.getByRole("group", { name: "Venue overhead plan" })).toHaveTextContent("White Lily · Seat 1 · Alice Santos");
});

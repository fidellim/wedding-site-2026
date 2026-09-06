import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySeatingRepository } from "../data/memoryRepository";
import { App } from "../App";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openPlanner(mobile = false) {
  if (mobile) vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
  const repository = createMemorySeatingRepository();
  render(<App repository={repository} adminName="Test" demo />);
  fireEvent.click(await screen.findByRole("button", { name: "Open seat planner" }));
  return repository;
}

describe("physical seating planner", () => {
  it("assigns through Visual and List and retains the unassigned search", async () => {
    const repository = await openPlanner();
    expect(screen.getByRole("button", { name: "Visual" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Charlie" } });
    expect(screen.queryByRole("button", { name: "Franco Reyes" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Charlie Santos" }));
    fireEvent.click(screen.getByRole("button", { name: "Assign selected attendee to table 1 seat 3" }));
    await waitFor(async () => expect((await repository.load()).draft.assignments).toContainEqual({ inviteeId: "charlie", seatId: "table-1-seat-3" }));
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    fireEvent.click(screen.getByRole("button", { name: "Charlie Santos" }));
    fireEvent.click(screen.getByRole("button", { name: "Assign selected attendee to table 2 seat 2" }));
    await waitFor(async () => expect((await repository.load()).draft.assignments).toContainEqual({ inviteeId: "charlie", seatId: "table-2-seat-2" }));
  });

  it("allows mobile expansion and view switching but no assignment", async () => {
    const repository = await openPlanner(true);
    const before = await repository.load();
    expect(screen.getByRole("button", { name: "Charlie Santos" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Expand table 1" }));
    expect(screen.getByRole("button", { name: "Back to all tables" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: "Assign selected attendee to table 1 seat 3" })).toBeDisabled();
    expect(await repository.load()).toEqual(before);
  });
});


it("edits rectangular side counts and selects Seat 1 without moving assignments", async () => {
  const repository = await openPlanner();
  const before = await repository.load();
  fireEvent.click(screen.getByRole("button", { name: /Tables$/ }));
  fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
  fireEvent.change(screen.getByLabelText("Top"), { target: { value: "1" } });
  expect(screen.getByRole("button", { name: "Save table" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Right"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Bottom"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Left"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Make current seat 3 Seat 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Save table" }));
  await waitFor(async () => expect((await repository.load()).draft.tables[1]).toMatchObject({
    sideCounts: { top: 1, right: 1, bottom: 1, left: 1 }, seatOnePosition: 2,
  }));
  expect((await repository.load()).draft.assignments).toEqual(before.draft.assignments);
});

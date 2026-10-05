import { createDemoWorkspace } from "../data/memoryRepository";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import VenuePreview from "./VenuePreview";
import { defaultVenueLayout, estimatedPlacement } from "./layout";

afterEach(cleanup);

vi.mock("three", async importOriginal => {
  const actual = await importOriginal<typeof import("three")>();
  return { ...actual, WebGLRenderer: class { constructor() { throw new Error("WebGL unavailable"); } } };
});

it("retains a readable overhead venue plan when WebGL cannot start", async () => {
  render(<VenuePreview workspace={createDemoWorkspace()} disabled={false} history={{ save: vi.fn(), undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }} />);
  expect(await screen.findByRole("group", { name: "Venue overhead plan" })).toBeVisible();
  expect(screen.getByText(/3D is unavailable on this device/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Entrance" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "2D plan" })).toBeEnabled();
});

it("updates anonymous ceremony chairs from RSVP totals without relying on reception assignments", async () => {
  const workspace = createDemoWorkspace();
  const history = { save: vi.fn(), undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false };
  const { container, rerender } = render(<VenuePreview workspace={workspace} disabled={false} history={history} />);
  await screen.findByRole("group", { name: "Venue overhead plan" });
  expect(screen.getByText(/Ceremony: 5 chairs/)).toBeVisible();
  expect(container.querySelectorAll("[data-ceremony-chair]")).toHaveLength(5);
  const updated = { ...workspace, draft: { ...workspace.draft, assignments: [], invitationParties: workspace.draft.invitationParties.map((party, index) => index === 0 ? { ...party, attendingCount: 6 } : party) } };
  rerender(<VenuePreview workspace={updated} disabled={false} history={history} />);
  expect(screen.getByText(/Ceremony: 8 chairs/)).toBeVisible();
  expect(container.querySelectorAll("[data-ceremony-chair]")).toHaveLength(8);
  expect(history.save).not.toHaveBeenCalled();
});


it("realigns an existing shared draft at the beach without moving its tables", async () => {
  const { defaultVenueLayout } = await import("./layout");
  const workspace = createDemoWorkspace(), saved = defaultVenueLayout();
  saved.landmarks.stage = { x: -20, y: 0 };
  saved.landmarks.danceFloor = { x: -13.9, y: 0 };
  saved.tables = { "table-1": { x: -5, y: 0, width: 1.8, depth: 1.8, rotation: 0, dimensionsVerified: false } };
  workspace.draft.venueLayout = saved;
  const save = vi.fn().mockResolvedValue(true);
  render(<VenuePreview workspace={workspace} disabled={false} history={{ save, undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }} />);
  fireEvent.click(screen.getByRole("button", { name: "Adjust dimensions" }));
  fireEvent.click(screen.getByRole("button", { name: "Center stage at beach edge" }));
  fireEvent.click(screen.getByRole("button", { name: "Save venue setup" }));
  expect(save).toHaveBeenCalledWith({ ...saved, landmarks: { ...saved.landmarks, stage: { x: 0, y: 6 }, danceFloor: { x: 0, y: expect.closeTo(-.1) } } });
});


it("previews both 5 × 3 m LED options immediately and saves the selected option", () => {
  const save = vi.fn().mockResolvedValue(true);
  render(<VenuePreview workspace={createDemoWorkspace()} disabled={false} history={{ save, undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }} />);
  expect(screen.getByText("5 × 3 m LED screen")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Side LED" }));
  expect(screen.getByRole("button", { name: "Side LED" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText(/Pavilion side · angled 30°/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Center LED" }));
  expect(screen.getByRole("button", { name: "Center LED" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText(/Floral surround:/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Side LED" }));
  fireEvent.click(screen.getByRole("button", { name: "Adjust dimensions" }));
  fireEvent.click(screen.getByRole("button", { name: "Save venue setup" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ led: "side" }));
});

it("toggles schematic cocktail fixtures without saving or changing permanent architecture", async () => {
  const save = vi.fn();
  const { container } = render(<VenuePreview workspace={createDemoWorkspace()} disabled={false} history={{ save, undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }} />);
  await screen.findByRole("group", { name: "Venue overhead plan" });
  const terrace = container.querySelector("[data-venue-terrace]")?.getAttribute("points");
  expect(container.querySelectorAll("[data-cocktail-fixture]")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Show cocktail fixtures" }));
  expect(container.querySelectorAll("[data-cocktail-fixture]")).toHaveLength(4);
  expect(container.querySelector("[data-venue-terrace]")?.getAttribute("points")).toBe(terrace);
  fireEvent.click(screen.getByRole("button", { name: "Hide cocktail fixtures" }));
  expect(container.querySelectorAll("[data-cocktail-fixture]")).toHaveLength(0);
  expect(save).not.toHaveBeenCalled();
});

it("previews a narrower estimated shoreline without overwriting the shared draft", async () => {
  const { defaultVenueLayout } = await import("./layout");
  const workspace = createDemoWorkspace();
  workspace.draft.venueLayout = defaultVenueLayout();
  workspace.draft.venueLayout.parameters.waterSetback = 10;
  const save = vi.fn();
  const { container } = render(<VenuePreview workspace={workspace} disabled={false} history={{ save, undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }} />);
  await screen.findByRole("group", { name: "Venue overhead plan" });
  const before = container.querySelector("[data-venue-terrace]")?.getAttribute("points");
  fireEvent.click(screen.getByRole("button", { name: "Adjust dimensions" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview narrower sand strip · 3 m estimate from video" }));
  expect(screen.getByRole("slider", { name: "Estimated sand strip to water" })).toHaveValue("3");
  expect(workspace.draft.venueLayout.parameters.waterSetback).toBe(10);
  expect(container.querySelector("[data-venue-terrace]")?.getAttribute("points")).toBe(before);
  expect(save).not.toHaveBeenCalled();
});

it("renders the corrected proportions for an old shared draft without automatically saving", async () => {
  const { defaultVenueLayout, isVenueLayout } = await import("./layout");
  const { reconstructionParameterKeys } = await import("./venueModel");
  const workspace = createDemoWorkspace(), original = defaultVenueLayout();
  const parameters = Object.fromEntries(Object.entries(original.parameters)
    .filter(([key]) => !reconstructionParameterKeys.some(optional => optional === key)));
  const legacy = { ...original, parameters: { ...parameters, plazaWidth: 18, plazaLength: 20 } };
  if (!isVenueLayout(legacy)) throw new Error("Legacy layout must remain readable");
  workspace.draft.venueLayout = legacy;
  const before = structuredClone(workspace), save = vi.fn();
  render(<VenuePreview workspace={workspace} disabled={false} history={{ save, undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }} />);
  expect(await screen.findByText(/Updated venue proportions are previewed/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Adjust dimensions" }));
  expect(screen.getByRole("slider", { name: "Plaza width" })).toHaveValue("24");
  expect(screen.getByRole("slider", { name: "Plaza depth" })).toHaveValue("26");
  expect(screen.getByRole("slider", { name: "Approach walkway length" })).toHaveValue("36");
  expect(screen.getByRole("slider", { name: "Approach stair risers" })).toHaveValue("13");
  expect(save).not.toHaveBeenCalled();
  expect(workspace).toEqual(before);
});

it("shows a seat peek on hover and keyboard focus, pins it on click, and closes on Escape", async () => {
  const workspace = createDemoWorkspace();
  const { seatGuest } = await import("./VenueInspection");
  const table = workspace.draft.tables[0], seat = workspace.draft.seats.find(s => s.tableId === table.id)!;
  table.name = "2021";
  workspace.draft.venueLayout = { ...defaultVenueLayout(), tables: { [table.id]: estimatedPlacement(table) } };
  const name = seatGuest(workspace.draft, table.id, seat.number);
  render(<VenuePreview workspace={workspace} disabled={false} history={{ save: vi.fn(), undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }} />);
  const chair = await screen.findByRole("button", { name: `Table ${table.name} · Seat ${seat.number} · ${name}` });
  fireEvent.mouseEnter(chair, { clientX: 100, clientY: 100 });
  expect(screen.getByRole("tooltip")).toHaveTextContent(name);
  fireEvent.click(chair);
  expect(screen.getByRole("region", { name: "Seating details" })).toHaveTextContent(`Table ${table.name} · Seat ${seat.number}`);
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(chair).toHaveAttribute("aria-pressed", "true");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("region", { name: "Seating details" })).toBeNull();
  fireEvent.focus(chair);
  expect(screen.getByRole("tooltip")).toHaveTextContent(name);
  fireEvent.keyDown(chair, { key: "Enter" });
  expect(screen.getByRole("region", { name: "Seating details" })).toHaveTextContent(name);
  fireEvent.click(screen.getByRole("button", { name: "Close seating details" }));
  expect(screen.queryByRole("region", { name: "Seating details" })).toBeNull();
  expect(table.name).toBe("2021");
  expect(screen.getByRole("button", { name: "Opposite view" })).toBeDisabled();
});

it("opens table guest lists, selects an unassigned seat, and dismisses on the background", async () => {
  const workspace = createDemoWorkspace();
  workspace.draft.assignments = [];
  const table = workspace.draft.tables[0];
  workspace.draft.venueLayout = { ...defaultVenueLayout(), tables: { [table.id]: estimatedPlacement(table) } };
  const { container } = render(<VenuePreview workspace={workspace} disabled={false} history={{ save: vi.fn(), undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }} />);
  fireEvent.click(await screen.findByRole("button", { name: `Table ${table.name} · View guests` }));
  const details = screen.getByRole("region", { name: "Seating details" });
  expect(details.querySelectorAll("li")).toHaveLength(workspace.draft.seats.filter(s => s.tableId === table.id).length);
  fireEvent.click(details.querySelector("li button")!);
  expect(screen.getByRole("region", { name: "Seating details" })).toHaveTextContent("Unassigned");
  fireEvent.click(screen.getByRole("button", { name: "View all seats at this table" }));
  expect(screen.getByRole("heading", { name: "Guests at this table" })).toBeVisible();
  fireEvent.click(container.querySelector(".venue-plan > rect")!);
  expect(screen.queryByRole("region", { name: "Seating details" })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Inspect table" }), { target: { value: table.id } });
  expect(screen.getByRole("heading", { name: "Guests at this table" })).toBeVisible();
});

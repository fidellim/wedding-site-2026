import { createDemoWorkspace } from "../data/memoryRepository";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import VenuePreview from "./VenuePreview";

afterEach(cleanup);

vi.mock("three", async importOriginal => {
  const actual = await importOriginal<typeof import("three")>();
  return { ...actual, WebGLRenderer: class { constructor() { throw new Error("WebGL unavailable"); } } };
});

it("retains a readable overhead venue plan when WebGL cannot start", async () => {
  render(<VenuePreview workspace={createDemoWorkspace()} disabled={false} history={{ save: vi.fn(), undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }} />);
  expect(await screen.findByRole("img", { name: "Venue overhead plan" })).toBeVisible();
  expect(screen.getByText(/3D is unavailable on this device/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Entrance" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "2D plan" })).toBeEnabled();
});

it("updates anonymous ceremony chairs from RSVP totals without relying on reception assignments", async () => {
  const workspace = createDemoWorkspace();
  const history = { save: vi.fn(), undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false };
  const { container, rerender } = render(<VenuePreview workspace={workspace} disabled={false} history={history} />);
  await screen.findByRole("img", { name: "Venue overhead plan" });
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

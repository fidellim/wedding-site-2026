import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import GuidePreview from "./GuidePreview";
import type { SeatingWorkspace } from "../domain/types";
import { SeatingGuide } from "./SeatingGuide";
import { previewFixture } from "./previewFixtures";
import { partyGuide, parseGuide } from "./guideData";
import { seatDestination } from "./flight";

vi.mock("three", async importOriginal => {
  const actual = await importOriginal<typeof import("three")>();
  return { ...actual, WebGLRenderer: class { constructor() { throw new Error("WebGL unavailable"); } } };
});
afterEach(cleanup);

it("shows assignments immediately, switches between split tables, and preserves an overhead fallback", async () => {
  const data = previewFixture("split", false);
  const { container } = render(<SeatingGuide data={data} />);
  expect(screen.getByRole("button", { name: /Alex\s*Table 1 · Seat 3/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /Jamie\s*Table 2 · Seat 6/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "Show my seat" })).toBeDisabled();
  await screen.findByRole("img", { name: "Venue overhead plan" });
  fireEvent.click(screen.getByRole("button", { name: /Jamie\s*Table 2 · Seat 6/ }));
  expect(screen.getByRole("button", { name: /Jamie\s*Table 2 · Seat 6/ })).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector("[data-guide-highlight]")?.parentElement).toHaveAttribute("transform", "translate(5,-4) rotate(90)");
  expect(container.querySelector("[data-guide-highlight]")).toHaveAttribute("cx", "0");
  expect(screen.getByRole("button", { name: "3D venue" })).toBeDisabled();
});

it("automatically selects a single person, and only outlines a chair after explicit approval", async () => {
  const data = previewFixture("single", false);
  const { container, rerender } = render(<SeatingGuide data={data} />);
  expect(screen.getByRole("button", { name: /Alex\s*Table 1 · Seat 3/ })).toHaveAttribute("aria-pressed", "true");
  await screen.findByRole("img", { name: "Venue overhead plan" });
  expect(Number(container.querySelector("[data-guide-highlight]")?.getAttribute("r"))).toBeCloseTo(1.7);
  rerender(<SeatingGuide data={{ ...data, chairsApproved: true }} />);
  expect(container.querySelector("[data-guide-highlight]")).toHaveAttribute("r", "0.4");
  expect(Number(container.querySelector("[data-guide-highlight]")?.getAttribute("cx"))).toBeCloseTo(-1.35);
});

it("removes other parties, non-attendees, notes, and preferences while preserving table names in previews", () => {
  const data = previewFixture("split");
  const snapshot = structuredClone(data.snapshot);
  const foreign = { ...snapshot.invitees[0], id: "other", invitationPartyId: "other-party", fullName: "Secret other name" };
  snapshot.invitees.push(foreign, { ...snapshot.invitees[0], id: "declined", attendanceStatus: "not_attending", fullName: "Secret declined" });
  snapshot.assignments.push({ inviteeId: foreign.id, seatId: "sample-round-8" });
  snapshot.invitees[0].privateNotes = "Secret notes";
  snapshot.tables[0].name = "2021";
  const guide = partyGuide(snapshot, data.party.id)!;
  expect(guide.snapshot.invitees).toHaveLength(2);
  expect(guide.snapshot.assignments).toHaveLength(2);
  expect(guide.snapshot.tables[0].name).toBe("2021");
  expect(JSON.stringify(guide.snapshot)).not.toContain("Secret");
  expect(guide.directory).toContainEqual({ tableId: "sample-round", fullName: "Secret other name" });
  expect(JSON.stringify(guide.directory)).not.toContain("Secret notes");
  expect(JSON.stringify(guide.directory)).not.toContain("Secret declined");
  expect(parseGuide(null)).toBeNull();
  expect(() => parseGuide({ party: data.party })).toThrow("Invalid seating response");
});

it("reflects plan Y once and rotates chair offsets when focusing a numbered chair", () => {
  const { snapshot } = previewFixture("split");
  const layout = snapshot.venueLayout!;
  const table = seatDestination(snapshot, layout, { tableId: "sample-long" }, 1.5)!;
  const chair = seatDestination(snapshot, layout, { tableId: "sample-long", seatNumber: 6 }, 1.5)!;
  expect(table.target).toEqual([5, 4, .4]);
  expect(chair.target).not.toEqual(table.target);
  expect(chair.target[0]).toBeCloseTo(6.05);
  expect(chair.target[1]).toBeCloseTo(4.375);
});

it("requires review of the current published revision and resets review when chair approval changes", () => {
  const snapshot = previewFixture("single").snapshot;
  const revision = { ...snapshot, id: "reviewed", revisionNumber: 1, publishedAt: "2026-10-09T00:00:00Z", publishedBy: "admin" };
  const workspace: SeatingWorkspace = { draft: { ...snapshot, id: "draft", version: 1, baseRevisionNumber: 1 },
    published: revision, revisions: [revision], auditLog: [], guestLookupEnabled: true, guideRelease: { revisionId: null, chairsApproved: false } };
  render(<GuidePreview workspace={workspace} disabled={false} execute={vi.fn()} />);
  const release = screen.getByRole("button", { name: "Release guide" });
  expect(release).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "published" } });
  expect(release).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I reviewed this published layout/));
  expect(release).toBeEnabled();
  fireEvent.click(screen.getByLabelText(/I approve the physical chair arrangement/));
  expect(release).toBeDisabled();
});

it("collapses the party list while keeping the selected seat and primary action available", async () => {
  render(<SeatingGuide data={previewFixture("single")} />);
  const toggle = screen.getByRole("button", { name: "Your seats" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: /Alex\s*Table 1 · Seat 3/ })).toBeNull();
  expect(screen.getByRole("button", { name: "Show my seat" })).toBeVisible();
  fireEvent.click(toggle);
  expect(screen.getByRole("button", { name: /Alex\s*Table 1 · Seat 3/ })).toBeVisible();
});

it("shows saved table names in seating details and the overhead fallback", async () => {
  const data = previewFixture("single");
  data.snapshot.tables[0].name = "2021";
  const { container } = render(<SeatingGuide data={data} />);
  expect(screen.getByRole("button", { name: /Alex\s*Table 2021 · Seat 3/ })).toBeVisible();
  expect(container.querySelector(".guide-destination")).toHaveTextContent("Table 2021 · Seat 3");
  await screen.findByRole("img", { name: "Venue overhead plan" });
  const tableLabels = Array.from(screen.getByRole("img", { name: "Venue overhead plan" }).querySelectorAll("text"));
  expect(tableLabels.some(label => label.textContent === "2021")).toBe(true);
  expect(tableLabels.some(label => label.textContent === "Table 2021")).toBe(false);
});


it("lets guests peek at a chair, dismiss with Escape, and tap through a table's guests", async () => {
  const data = previewFixture("single");
  data.directory.push({ tableId: "sample-round", seatNumber: 5, fullName: "Morgan" });
  render(<SeatingGuide data={data} />);
  await screen.findByRole("img", { name: "Venue overhead plan" });
  const chair = screen.getByRole("button", { name: "Table 1 · Seat 5 · Morgan" });
  fireEvent.mouseEnter(chair, { clientX: 120, clientY: 120 });
  expect(screen.getByRole("tooltip")).toHaveTextContent("Morgan");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.click(chair);
  expect(screen.getByRole("region", { name: "Seating details" })).toHaveTextContent("Morgan");
  expect(screen.getByRole("region", { name: "Seating details" })).toHaveTextContent("Table 1 · Seat 5");
  fireEvent.click(screen.getByRole("button", { name: "View all seats at this table" }));
  expect(screen.getByRole("region", { name: "Seating details" })).toHaveTextContent("Alex");
  expect(screen.getByRole("region", { name: "Seating details" })).toHaveTextContent("Morgan");
  fireEvent.click(screen.getByRole("button", { name: "Close seating details" }));
  expect(screen.queryByRole("region", { name: "Seating details" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show my seat" })).toBeVisible();
  expect(document.querySelector(".guide-destination")).toHaveTextContent("Alex");
});

it("offers table exploration without chair positions before approval", async () => {
  const data = previewFixture("single", false);
  data.directory.push({ tableId: "sample-round", fullName: "Morgan" });
  render(<SeatingGuide data={data} />);
  await screen.findByRole("img", { name: "Venue overhead plan" });
  expect(screen.queryByRole("button", { name: /Seat 5/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Explore tables" }), { target: { value: "sample-round" } });
  const details = screen.getByRole("region", { name: "Seating details" });
  expect(details).toHaveTextContent("Morgan");
  expect(details).not.toHaveTextContent("Seat");
});

it("parses a minimal shared directory without adding other guests to the party panel", () => {
  const data = previewFixture("single");
  const payload = { ...data.snapshot, party: data.party, chairsApproved: true,
    directory: [{ tableId: "sample-round", fullName: "Morgan", seatNumber: 5, privateNotes: "Hidden" }] };
  const guide = parseGuide(payload)!;
  expect(guide.directory).toEqual([{ tableId: "sample-round", fullName: "Morgan", seatNumber: 5 }]);
  expect(guide.snapshot.invitees.map(person => person.fullName)).toEqual(["Alex"]);
  expect(parseGuide({ ...payload, chairsApproved: false })!.directory).toEqual([{ tableId: "sample-round", fullName: "Morgan" }]);
  expect(() => parseGuide({ ...payload, directory: [{ tableId: "missing", fullName: "Morgan", seatNumber: 5 }] })).toThrow("Invalid seating directory");
});

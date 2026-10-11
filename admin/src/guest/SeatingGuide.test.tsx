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
  const data = previewFixture("split");
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
  const data = previewFixture("single");
  const { container, rerender } = render(<SeatingGuide data={data} />);
  expect(screen.getByRole("button", { name: /Alex\s*Table 1 · Seat 3/ })).toHaveAttribute("aria-pressed", "true");
  await screen.findByRole("img", { name: "Venue overhead plan" });
  expect(Number(container.querySelector("[data-guide-highlight]")?.getAttribute("r"))).toBeCloseTo(1.7);
  rerender(<SeatingGuide data={{ ...data, chairsApproved: true }} />);
  expect(container.querySelector("[data-guide-highlight]")).toHaveAttribute("r", "0.4");
  expect(Number(container.querySelector("[data-guide-highlight]")?.getAttribute("cx"))).toBeCloseTo(1.35);
});

it("removes other parties, non-attendees, notes, preferences, and identifying table names from previews", () => {
  const data = previewFixture("split");
  const snapshot = structuredClone(data.snapshot);
  const foreign = { ...snapshot.invitees[0], id: "other", invitationPartyId: "other-party", fullName: "Secret other name" };
  snapshot.invitees.push(foreign, { ...snapshot.invitees[0], id: "declined", attendanceStatus: "not_attending", fullName: "Secret declined" });
  snapshot.assignments.push({ inviteeId: foreign.id, seatId: "sample-round-8" });
  snapshot.invitees[0].privateNotes = "Secret notes";
  snapshot.tables[0].name = "Secret identifying name";
  const guide = partyGuide(snapshot, data.party.id)!;
  expect(guide.snapshot.invitees).toHaveLength(2);
  expect(guide.snapshot.assignments).toHaveLength(2);
  expect(JSON.stringify(guide)).not.toContain("Secret");
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
  expect(chair.target[0]).toBeCloseTo(3.95);
  expect(chair.target[1]).toBeCloseTo(3.625);
});

it("requires review of the current published revision and resets review when chair approval changes", () => {
  const snapshot = previewFixture("single").snapshot;
  const revision = { ...snapshot, id: "reviewed", revisionNumber: 1, publishedAt: "2026-10-09T00:00:00Z", publishedBy: "admin" };
  const workspace: SeatingWorkspace = { draft: { ...snapshot, id: "draft", version: 1, baseRevisionNumber: 1 },
    published: revision, revisions: [revision], auditLog: [], guestLookupEnabled: true, guideRelease: { revisionId: null, chairsApproved: false } };
  render(<GuidePreview workspace={workspace} disabled={false} execute={vi.fn()} />);
  const release = screen.getByRole("button", { name: "Release reviewed guide" });
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

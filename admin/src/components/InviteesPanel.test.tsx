import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Invitee, InvitationParty, SeatingWorkspace } from "../domain/types";
import { InviteesPanel } from "./InviteesPanel";

const parties: InvitationParty[] = [
  { id: "accepted-missing", label: "Missing Family", rsvpStatus: "accepted", attendingCount: 2 },
  { id: "accepted-complete", label: "Complete Family", rsvpStatus: "accepted", attendingCount: 2 },
  { id: "accepted-roster", label: "Roster Family", rsvpStatus: "accepted", attendingCount: 2 },
  { id: "pending-empty", label: "Pending Family", rsvpStatus: "pending", attendingCount: 0 },
  { id: "declined-named", label: "Declined Family", rsvpStatus: "declined", attendingCount: 0 },
];

const makeInvitee = (
  id: string,
  invitationPartyId: string,
  fullName: string,
  attendanceStatus: Invitee["attendanceStatus"],
): Invitee => ({
  id,
  invitationPartyId,
  fullName,
  attendanceStatus,
  requiresSeat: true,
  tags: [],
  keepTogetherGroupId: null,
  privateNotes: "",
});

const workspace: SeatingWorkspace = {
  draft: {
    id: "draft",
    version: 1,
    baseRevisionNumber: null,
    invitationParties: parties,
    invitees: [
      makeInvitee("missing-one", "accepted-missing", "Maria Missing", "not_attending"),
      makeInvitee("complete-one", "accepted-complete", "Alice Complete", "confirmed"),
      makeInvitee("complete-two", "accepted-complete", "Bob Complete", "confirmed"),
      makeInvitee("roster-one", "accepted-roster", "Elena Roster", "confirmed"),
      makeInvitee("roster-two", "accepted-roster", "Franco Roster", "not_attending"),
      makeInvitee("declined-one", "declined-named", "Grace Declined", "not_attending"),
    ],
    tables: [],
    seats: [],
    assignments: [],
  },
  published: null,
  revisions: [],
  auditLog: [],
  guestLookupEnabled: true,
};

const renderPanel = () => render(
  <InviteesPanel workspace={workspace} disabled={false} execute={vi.fn().mockResolvedValue(true)} />,
);

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
});

describe("InviteesPanel filters", () => {
  it("defaults to accepted parties that need names or roster confirmation", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Missing Family" })).toBeInTheDocument();
    expect(screen.getByText("1 more name needed.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roster Family" })).toBeInTheDocument();
    expect(screen.getByText("Confirm the attending roster (1/2 selected).")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Complete Family" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pending Family" })).not.toBeInTheDocument();
  });

  it("combines status and attention filters with AND logic", () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText("RSVP status"), { target: { value: "all" } });
    expect(screen.getByRole("heading", { name: "Pending Family" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Attention"), { target: { value: "complete" } });
    expect(screen.getByRole("heading", { name: "Complete Family" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Declined Family" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Missing Family" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("RSVP status"), { target: { value: "accepted" } });
    expect(screen.getByRole("heading", { name: "Complete Family" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Declined Family" })).not.toBeInTheDocument();
  });

  it("searches invitee names while showing their complete party card", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    fireEvent.change(screen.getByLabelText("Search parties or names"), { target: { value: "ALICE" } });

    expect(screen.getByRole("heading", { name: "Complete Family" })).toBeInTheDocument();
    expect(screen.getByText("Alice Complete")).toBeInTheDocument();
    expect(screen.getByText("Bob Complete")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Roster Family" })).not.toBeInTheDocument();
  });

  it("persists structured filters but not the search phrase", async () => {
    const first = renderPanel();
    fireEvent.change(screen.getByLabelText("RSVP status"), { target: { value: "pending" } });
    fireEvent.change(screen.getByLabelText("Attention"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Search parties or names"), { target: { value: "Pending" } });

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("seating-studio.invitee-filters.v1") ?? "{}"))
        .toEqual({ status: "pending", attention: "all" });
    });

    first.unmount();
    renderPanel();

    expect(screen.getByLabelText("RSVP status")).toHaveValue("pending");
    expect(screen.getByLabelText("Attention")).toHaveValue("all");
    expect(screen.getByLabelText("Search parties or names")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Pending Family" })).toBeInTheDocument();
  });

  it("resets every filter and persists the reset state", async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Search parties or names"), { target: { value: "Missing" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

    expect(screen.getByLabelText("RSVP status")).toHaveValue("all");
    expect(screen.getByLabelText("Attention")).toHaveValue("all");
    expect(screen.getByLabelText("Search parties or names")).toHaveValue("");
    parties.forEach((party) => {
      expect(screen.getByRole("heading", { name: party.label })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("seating-studio.invitee-filters.v1") ?? "{}"))
        .toEqual({ status: "all", attention: "all" });
    });
  });
});

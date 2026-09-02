import { describe, expect, it } from "vitest";
import {
  applyCommand,
  inspectWorkspace,
  publishDraft,
  restoreRevision,
  validatePublication,
} from "./seating";
import type { SeatingWorkspace } from "./types";

const context = (auditId: string, actorId = "fidel") => ({
  actorId,
  auditId,
  at: "2026-09-02T12:00:00.000Z",
});

function workspace(): SeatingWorkspace {
  return {
    draft: {
      id: "draft",
      version: 1,
      baseRevisionNumber: null,
      invitationParties: [
        { id: "party-a", label: "Santos Family", rsvpStatus: "accepted", attendingCount: 2 },
        { id: "party-b", label: "Reyes Family", rsvpStatus: "accepted", attendingCount: 1 },
      ],
      invitees: [
        {
          id: "alice",
          invitationPartyId: "party-a",
          fullName: "Alice Santos",
          attendanceStatus: "confirmed",
          requiresSeat: true,
          tags: [],
          keepTogetherGroupId: "friends",
          privateNotes: "",
        },
        {
          id: "bob",
          invitationPartyId: "party-a",
          fullName: "Bob Santos",
          attendanceStatus: "confirmed",
          requiresSeat: true,
          tags: [],
          keepTogetherGroupId: null,
          privateNotes: "",
        },
        {
          id: "carla",
          invitationPartyId: "party-b",
          fullName: "Carla Reyes",
          attendanceStatus: "confirmed",
          requiresSeat: true,
          tags: [],
          keepTogetherGroupId: "friends",
          privateNotes: "",
        },
      ],
      tables: [
        { id: "table-1", name: "Garden One", number: 1, shape: "round", capacity: 2, seatOneAngle: 0 },
        { id: "table-2", name: "Garden Two", number: 2, shape: "rectangular", capacity: 2, seatOneAngle: 0 },
      ],
      seats: [
        { id: "t1-s1", tableId: "table-1", number: 1 },
        { id: "t1-s2", tableId: "table-1", number: 2 },
        { id: "t2-s1", tableId: "table-2", number: 1 },
        { id: "t2-s2", tableId: "table-2", number: 2 },
      ],
      assignments: [],
    },
    published: null,
    revisions: [],
    auditLog: [],
    guestLookupEnabled: true,
  };
}

describe("seating domain interface", () => {
  it("blocks publication when named attendees do not match an RSVP count", () => {
    const value = workspace();
    value.draft.invitees[1].attendanceStatus = "not_attending";

    const validation = validatePublication(value.draft);

    expect(validation.errors.map((issue) => issue.code)).toContain("attendance_count_mismatch");
    expect(validation.canPublish).toBe(false);
  });

  it("does not require a seat for a confirmed attendee marked no-seat-required", () => {
    const value = workspace();
    value.draft.invitees[2].requiresSeat = false;
    value.draft.assignments = [
      { inviteeId: "alice", seatId: "t1-s1" },
      { inviteeId: "bob", seatId: "t1-s2" },
    ];

    expect(validatePublication(value.draft).errors).toEqual([]);
  });

  it("reports split parties and keep-together groups as warnings only", () => {
    const value = workspace();
    value.draft.assignments = [
      { inviteeId: "alice", seatId: "t1-s1" },
      { inviteeId: "bob", seatId: "t2-s1" },
      { inviteeId: "carla", seatId: "t2-s2" },
    ];

    const validation = validatePublication(value.draft);

    expect(validation.canPublish).toBe(true);
    expect(validation.warnings.map((issue) => issue.code).sort()).toEqual([
      "keep_together_split",
      "split_invitation_party",
    ]);
  });

  it("uses optimistic versions and lets the first seat move win", () => {
    const value = workspace();
    const first = applyCommand(
      value,
      { type: "move_invitee", expectedVersion: 1, inviteeId: "alice", toSeatId: "t1-s1" },
      context("audit-1"),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const stale = applyCommand(
      first.value,
      { type: "move_invitee", expectedVersion: 1, inviteeId: "bob", toSeatId: "t1-s1" },
      context("audit-2", "hannah"),
    );
    expect(stale).toMatchObject({ ok: false, error: { code: "stale_version" } });

    const occupied = applyCommand(
      first.value,
      { type: "move_invitee", expectedVersion: 2, inviteeId: "bob", toSeatId: "t1-s1" },
      context("audit-3", "hannah"),
    );
    expect(occupied).toMatchObject({ ok: false, error: { code: "seat_occupied" } });
  });

  it("refuses undo when another move changed the attendee afterward", () => {
    const value = workspace();
    const first = applyCommand(
      value,
      { type: "move_invitee", expectedVersion: 1, inviteeId: "alice", toSeatId: "t1-s1" },
      context("audit-1"),
    );
    if (!first.ok) throw new Error("first move failed");
    const second = applyCommand(
      first.value,
      { type: "move_invitee", expectedVersion: 2, inviteeId: "alice", toSeatId: "t2-s1" },
      context("audit-2", "hannah"),
    );
    if (!second.ok) throw new Error("second move failed");

    const undone = applyCommand(
      second.value,
      { type: "undo_move", expectedVersion: 3, auditId: "audit-1" },
      context("audit-3"),
    );

    expect(undone).toMatchObject({ ok: false, error: { code: "undo_conflict" } });
  });

  it("publishes an immutable snapshot and keeps later draft edits private", () => {
    const value = workspace();
    value.draft.assignments = [
      { inviteeId: "alice", seatId: "t1-s1" },
      { inviteeId: "bob", seatId: "t1-s2" },
      { inviteeId: "carla", seatId: "t2-s1" },
    ];

    const published = publishDraft(value, context("publish-1"), "revision-1");
    expect(published.ok).toBe(true);
    if (!published.ok) return;

    const moved = applyCommand(
      published.value,
      {
        type: "move_invitee",
        expectedVersion: published.value.draft.version,
        inviteeId: "carla",
        toSeatId: "t2-s2",
      },
      context("audit-2"),
    );
    if (!moved.ok) throw new Error("move failed");

    expect(moved.value.published?.assignments).toContainEqual({
      inviteeId: "carla",
      seatId: "t2-s1",
    });
    expect(inspectWorkspace(moved.value).assignmentsByInviteeId.get("carla")?.id).toBe("t2-s2");
  });

  it("restores a published revision into a new draft without changing publication", () => {
    const value = workspace();
    value.draft.assignments = [
      { inviteeId: "alice", seatId: "t1-s1" },
      { inviteeId: "bob", seatId: "t1-s2" },
      { inviteeId: "carla", seatId: "t2-s1" },
    ];
    const published = publishDraft(value, context("publish-1"), "revision-1");
    if (!published.ok) throw new Error("publish failed");
    published.value.draft.assignments = [];

    const restored = restoreRevision(
      published.value,
      "revision-1",
      context("restore-1", "hannah"),
    );

    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.draft.assignments).toHaveLength(3);
    expect(restored.value.published?.id).toBe("revision-1");
    expect(restored.value.draft).not.toBe(restored.value.published);
  });
});

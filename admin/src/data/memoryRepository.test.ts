import { describe, expect, it } from "vitest";
import { createMemorySeatingRepository } from "./memoryRepository";

describe("in-memory seating repository", () => {
  it("records a decline amendment and releases the party's draft seats", async () => {
    const repository = createMemorySeatingRepository();
    const before = await repository.load();

    const after = await repository.execute({
      type: "amend_rsvp",
      expectedVersion: before.draft.version,
      invitationPartyId: "demo-santos",
      nextStatus: "declined",
      nextAttendingCount: 0,
      reason: "The family contacted us.",
    });

    expect(after.draft.invitationParties.find((party) => party.id === "demo-santos")).toMatchObject({
      rsvpStatus: "declined",
      attendingCount: 0,
    });
    expect(after.draft.invitees.filter((invitee) =>
      invitee.invitationPartyId === "demo-santos" && invitee.attendanceStatus === "confirmed"
    )).toHaveLength(0);
    expect(after.draft.assignments.map((assignment) => assignment.inviteeId)).not.toContain("alice");
    expect(after.auditLog.at(-1)?.kind).toBe("rsvp_amended");
  });

  it("creates a fresh high-entropy guest seating token", async () => {
    const repository = createMemorySeatingRepository();

    const first = await repository.provisionGuestAccess("demo-santos");
    const second = await repository.provisionGuestAccess("demo-santos");

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toMatch(/^[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
  });
});

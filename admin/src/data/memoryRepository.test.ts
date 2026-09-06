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

describe("table geometry persistence", () => {
  it("retains stable seats and assignments when redistributing and renumbering chairs", async () => {
    const repository = createMemorySeatingRepository();
    const before = await repository.load();
    const table = before.draft.tables[1];
    const after = await repository.execute({
      type: "upsert_table", expectedVersion: before.draft.version,
      table: { ...table, sideCounts: { top: 1, right: 1, bottom: 1, left: 1 }, seatOnePosition: 2 },
    });
    expect(after.draft.seats).toEqual(before.draft.seats);
    expect(after.draft.assignments).toEqual(before.draft.assignments);
    expect((await repository.load()).draft.tables[1]).toMatchObject({ sideCounts: { top: 1, right: 1, bottom: 1, left: 1 }, seatOnePosition: 2 });
  });

  it("rejects shrinking past an occupied seat atomically", async () => {
    const repository = createMemorySeatingRepository();
    const before = await repository.load();
    await expect(repository.execute({ type: "upsert_table", expectedVersion: before.draft.version,
      table: { ...before.draft.tables[0], capacity: 1 },
    })).rejects.toThrow("occupied seat");
    expect(await repository.load()).toEqual(before);
  });

  it("rejects invalid rectangular counts and first chair", async () => {
    const repository = createMemorySeatingRepository();
    const before = await repository.load();
    for (const patch of [{ sideCounts: { top: 3, right: 0, bottom: 3, left: 0 } }, { seatOnePosition: 4 }]) {
      await expect(repository.execute({ type: "upsert_table", expectedVersion: before.draft.version,
        table: { ...before.draft.tables[1], ...patch },
      })).rejects.toThrow("Invalid table layout");
    }
    expect(await repository.load()).toEqual(before);
  });

  it("publishes geometry immutably and restores it with its original assignments", async () => {
    const repository = createMemorySeatingRepository();
    let workspace = await repository.load();
    for (const [inviteeId, toSeatId] of [["charlie", "table-1-seat-3"], ["franco", "table-2-seat-2"]]) {
      workspace = await repository.execute({ type: "move_invitee", expectedVersion: workspace.draft.version, inviteeId, toSeatId });
    }
    workspace = await repository.execute({ type: "upsert_table", expectedVersion: workspace.draft.version,
      table: { ...workspace.draft.tables[1], sideCounts: { top: 1, right: 1, bottom: 1, left: 1 }, seatOnePosition: 2 },
    });
    workspace = await repository.execute({ type: "publish", expectedVersion: workspace.draft.version });
    const published = workspace.published!;
    workspace = await repository.execute({ type: "upsert_table", expectedVersion: workspace.draft.version,
      table: { ...workspace.draft.tables[1], sideCounts: { top: 2, right: 0, bottom: 2, left: 0 }, seatOnePosition: 0 },
    });
    expect(workspace.published).toEqual(published);
    workspace = await repository.execute({ type: "restore_revision", expectedVersion: workspace.draft.version, revisionId: published.id });
    expect(workspace.draft.tables).toEqual(published.tables);
    expect(workspace.draft.assignments).toEqual(published.assignments);
  });
});

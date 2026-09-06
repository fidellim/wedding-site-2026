import { defaultSideCounts, validSideCounts } from "../domain/tableLayout";
import {
  applyCommand,
  publishDraft,
  restoreRevision,
} from "../domain/seating";
import type {
  AuditEntry,
  Invitee,
  SeatingTable,
  SeatingWorkspace,
} from "../domain/types";
import {
  SeatingRepositoryError,
  type RepositoryCommand,
  type SeatingRepository,
} from "./seatingRepository";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const secureToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export function createDemoWorkspace(): SeatingWorkspace {
  return {
    draft: {
      id: "draft",
      version: 1,
      baseRevisionNumber: null,
      invitationParties: [
        { id: "demo-santos", label: "Santos Family", rsvpStatus: "accepted", attendingCount: 3 },
        { id: "demo-reyes", label: "Reyes Family", rsvpStatus: "accepted", attendingCount: 2 },
        { id: "demo-cruz", label: "Cruz Family", rsvpStatus: "declined", attendingCount: 0 },
      ],
      invitees: [
        ["alice", "demo-santos", "Alice Santos", "confirmed"],
        ["bob", "demo-santos", "Bob Santos", "confirmed"],
        ["charlie", "demo-santos", "Charlie Santos", "confirmed"],
        ["diana", "demo-santos", "Diana Santos", "not_attending"],
        ["elena", "demo-reyes", "Elena Reyes", "confirmed"],
        ["franco", "demo-reyes", "Franco Reyes", "confirmed"],
        ["grace", "demo-cruz", "Grace Cruz", "not_attending"],
      ].map(([inviteeId, partyId, fullName, attendanceStatus]) => ({
        id: inviteeId,
        invitationPartyId: partyId,
        fullName,
        attendanceStatus,
        requiresSeat: true,
        tags: [],
        keepTogetherGroupId: null,
        privateNotes: "",
      })) as Invitee[],
      tables: [
        { id: "table-1", name: "White Lily", number: 1, shape: "round", capacity: 4, seatOneAngle: 0 },
        { id: "table-2", name: "Garden Rose", number: 2, shape: "rectangular", capacity: 4, seatOneAngle: 0 },
      ],
      seats: [1, 2, 3, 4].flatMap((seatNumber) => [
        { id: `table-1-seat-${seatNumber}`, tableId: "table-1", number: seatNumber },
        { id: `table-2-seat-${seatNumber}`, tableId: "table-2", number: seatNumber },
      ]),
      assignments: [
        { inviteeId: "alice", seatId: "table-1-seat-1" },
        { inviteeId: "bob", seatId: "table-1-seat-2" },
        { inviteeId: "elena", seatId: "table-2-seat-1" },
      ],
    },
    published: null,
    revisions: [],
    auditLog: [],
    guestLookupEnabled: true,
  };
}

function appendAudit(workspace: SeatingWorkspace, entry: AuditEntry): SeatingWorkspace {
  return { ...workspace, auditLog: [...workspace.auditLog, entry] };
}

export function createMemorySeatingRepository(
  initial: SeatingWorkspace = createDemoWorkspace(),
): SeatingRepository {
  let workspace = structuredClone(initial);
  const listeners = new Set<() => void>();
  const actorId = "demo-fidel";

  const notify = () => listeners.forEach((listener) => listener());
  const ensureVersion = (expectedVersion: number) => {
    if (workspace.draft.version !== expectedVersion) {
      throw new SeatingRepositoryError("The plan changed. Refresh and try again.", "stale_version");
    }
  };
  const update = (next: SeatingWorkspace) => {
    workspace = next;
    notify();
    return structuredClone(workspace);
  };

  return {
    async load() {
      return structuredClone(workspace);
    },

    async execute(command: RepositoryCommand) {
      if (command.type === "move_invitee" || command.type === "undo_move") {
        const result = applyCommand(workspace, command, {
          actorId,
          at: now(),
          auditId: id(),
        });
        if (!result.ok) throw new SeatingRepositoryError(result.error.message, result.error.code);
        return update(result.value);
      }

      if (command.type === "publish") {
        ensureVersion(command.expectedVersion);
        const result = publishDraft(workspace, { actorId, at: now(), auditId: id() }, id());
        if (!result.ok) throw new SeatingRepositoryError(result.error.message, result.error.code);
        return update(result.value);
      }

      if (command.type === "restore_revision") {
        ensureVersion(command.expectedVersion);
        const result = restoreRevision(workspace, command.revisionId, {
          actorId,
          at: now(),
          auditId: id(),
        });
        if (!result.ok) throw new SeatingRepositoryError(result.error.message, result.error.code);
        return update(result.value);
      }

      if (command.type === "upsert_invitee") {
        ensureVersion(command.expectedVersion);
        const existingIndex = workspace.draft.invitees.findIndex(
          (invitee) => invitee.id === command.invitee.id,
        );
        const existing = existingIndex >= 0 ? workspace.draft.invitees[existingIndex] : null;
        const invitee: Invitee = {
          id: command.invitee.id ?? id(),
          invitationPartyId: command.invitee.invitationPartyId,
          fullName: command.invitee.fullName.trim(),
          attendanceStatus: command.invitee.attendanceStatus ?? existing?.attendanceStatus ?? "not_attending",
          requiresSeat: command.invitee.requiresSeat ?? existing?.requiresSeat ?? true,
          tags: command.invitee.tags ?? existing?.tags ?? [],
          keepTogetherGroupId: command.invitee.keepTogetherGroupId ?? existing?.keepTogetherGroupId ?? null,
          privateNotes: command.invitee.privateNotes ?? existing?.privateNotes ?? "",
        };
        const invitees = [...workspace.draft.invitees];
        if (existingIndex >= 0) invitees[existingIndex] = invitee;
        else invitees.push(invitee);
        const assignments = invitee.attendanceStatus === "confirmed" && invitee.requiresSeat
          ? workspace.draft.assignments
          : workspace.draft.assignments.filter((assignment) => assignment.inviteeId !== invitee.id);
        workspace = {
          ...workspace,
          draft: { ...workspace.draft, version: workspace.draft.version + 1, invitees, assignments },
        };
        return update(workspace);
      }

      if (command.type === "resolve_roster") {
        ensureVersion(command.expectedVersion);
        const party = workspace.draft.invitationParties.find(
          (candidate) => candidate.id === command.invitationPartyId,
        );
        if (!party || command.confirmedInviteeIds.length !== party.attendingCount) {
          throw new SeatingRepositoryError("Named attendees must match the RSVP count.");
        }
        const confirmed = new Set(command.confirmedInviteeIds);
        const invitees = workspace.draft.invitees.map((invitee) =>
          invitee.invitationPartyId === command.invitationPartyId
            ? { ...invitee, attendanceStatus: confirmed.has(invitee.id) ? "confirmed" as const : "not_attending" as const }
            : invitee,
        );
        const assignments = workspace.draft.assignments.filter((assignment) => {
          const invitee = invitees.find((item) => item.id === assignment.inviteeId);
          return invitee?.attendanceStatus === "confirmed" && invitee.requiresSeat;
        });
        workspace = {
          ...workspace,
          draft: {
            ...workspace.draft,
            version: workspace.draft.version + 1,
            invitees,
            assignments,
          },
        };
        return update(workspace);
      }

      if (command.type === "amend_rsvp") {
        ensureVersion(command.expectedVersion);
        if (!command.reason.trim()) {
          throw new SeatingRepositoryError("An RSVP amendment reason is required.");
        }
        const invitationParties = workspace.draft.invitationParties.map((party) =>
          party.id === command.invitationPartyId
            ? {
                ...party,
                rsvpStatus: command.nextStatus,
                attendingCount: command.nextStatus === "declined" ? 0 : command.nextAttendingCount,
              }
            : party,
        );
        let invitees = workspace.draft.invitees;
        let assignments = workspace.draft.assignments;
        if (command.nextStatus === "declined") {
          const partyInviteeIds = new Set(
            invitees
              .filter((invitee) => invitee.invitationPartyId === command.invitationPartyId)
              .map((invitee) => invitee.id),
          );
          invitees = invitees.map((invitee) => partyInviteeIds.has(invitee.id)
            ? { ...invitee, attendanceStatus: "not_attending" as const }
            : invitee);
          assignments = assignments.filter((assignment) => !partyInviteeIds.has(assignment.inviteeId));
        }
        workspace = appendAudit({
          ...workspace,
          draft: {
            ...workspace.draft,
            version: workspace.draft.version + 1,
            invitationParties,
            invitees,
            assignments,
          },
        }, {
          id: id(),
          kind: "rsvp_amended",
          actorId,
          occurredAt: now(),
          inviteeId: null,
          fromSeatId: null,
          toSeatId: null,
          revisionNumber: null,
          reversesAuditId: null,
        });
        return update(workspace);
      }

      if (command.type === "upsert_table") {
        ensureVersion(command.expectedVersion);
        const tableId = command.table.id ?? id();
        const seatingTable = {
          id: tableId,
          name: command.table.name.trim(),
          number: command.table.number,
          shape: command.table.shape,
          capacity: command.table.capacity,
          seatOneAngle: command.table.seatOneAngle ?? 0,
          sideCounts: command.table.sideCounts ?? defaultSideCounts(command.table.capacity),
          seatOnePosition: command.table.seatOnePosition ?? 0,
        } satisfies SeatingTable;
        if (!Number.isInteger(seatingTable.capacity) || seatingTable.capacity < 1 || seatingTable.capacity > 30
          || !validSideCounts(seatingTable.sideCounts, seatingTable.capacity)
          || !Number.isInteger(seatingTable.seatOnePosition) || seatingTable.seatOnePosition < 0
          || seatingTable.seatOnePosition >= seatingTable.capacity
          || !Number.isInteger(seatingTable.seatOneAngle) || seatingTable.seatOneAngle < 0 || seatingTable.seatOneAngle > 359) {
          throw new SeatingRepositoryError("Invalid table layout.");
        }
        const removedSeatIds = new Set(workspace.draft.seats.filter(
          (seat) => seat.tableId === tableId && seat.number > seatingTable.capacity,
        ).map((seat) => seat.id));
        if (workspace.draft.assignments.some((assignment) => removedSeatIds.has(assignment.seatId))) {
          throw new SeatingRepositoryError("Capacity cannot remove an occupied seat.");
        }
        const existingIndex = workspace.draft.tables.findIndex((table) => table.id === tableId);
        const tables = [...workspace.draft.tables];
        if (existingIndex >= 0) tables[existingIndex] = seatingTable;
        else tables.push(seatingTable);
        const retainedSeats = workspace.draft.seats.filter(
          (seat) => seat.tableId !== tableId || seat.number <= seatingTable.capacity,
        );
        const existingNumbers = new Set(
          retainedSeats.filter((seat) => seat.tableId === tableId).map((seat) => seat.number),
        );
        for (let seatNumber = 1; seatNumber <= seatingTable.capacity; seatNumber += 1) {
          if (!existingNumbers.has(seatNumber)) {
            retainedSeats.push({ id: `${tableId}-seat-${seatNumber}`, tableId, number: seatNumber });
          }
        }
        workspace = {
          ...workspace,
          draft: {
            ...workspace.draft,
            version: workspace.draft.version + 1,
            tables,
            seats: retainedSeats,
          },
        };
        return update(workspace);
      }

      workspace = appendAudit({ ...workspace, guestLookupEnabled: command.enabled }, {
        id: id(),
        kind: "guest_lookup_changed",
        actorId,
        occurredAt: now(),
        inviteeId: null,
        fromSeatId: null,
        toSeatId: null,
        revisionNumber: null,
        reversesAuditId: null,
      });
      return update(workspace);
    },

    async provisionGuestAccess() {
      return secureToken();
    },

    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}

import { layoutValidation } from "../venue/layout";
import type {
  AuditEntry,
  CommandContext,
  DomainResult,
  DraftSeatingPlan,
  Id,
  Invitee,
  PlannerView,
  PublicationIssue,
  PublicationValidation,
  PublishedRevision,
  Seat,
  SeatAssignment,
  SeatingCommand,
  SeatingDomainErrorCode,
  SeatingSnapshot,
  SeatingWarningCode,
  SeatingWorkspace,
} from "./types";

const fail = <T>(code: SeatingDomainErrorCode, message: string): DomainResult<T> => ({
  ok: false,
  error: { code, message },
});

const cloneSnapshot = <T extends SeatingSnapshot>(snapshot: T): T =>
  structuredClone(snapshot);

function tableIdForSeat(seatsById: Map<Id, Seat>, seatId: Id): Id | null {
  return seatsById.get(seatId)?.tableId ?? null;
}

function addGroupedWarning(
  warnings: PublicationIssue<SeatingWarningCode>[],
  code: SeatingWarningCode,
  label: string,
  invitees: Invitee[],
  assignedSeatByInvitee: Map<Id, Seat>,
) {
  const tableIds = new Set(
    invitees
      .map((invitee) => assignedSeatByInvitee.get(invitee.id)?.tableId)
      .filter((tableId): tableId is string => Boolean(tableId)),
  );

  if (tableIds.size > 1) {
    warnings.push({
      code,
      message: `${label} is split across ${tableIds.size} tables.`,
      relatedIds: invitees.map((invitee) => invitee.id),
    });
  }
}

export function validatePublication(snapshot: SeatingSnapshot): PublicationValidation {
  const errors: PublicationValidation["errors"] = [];
  const warnings: PublicationValidation["warnings"] = [];
  const inviteesById = new Map(snapshot.invitees.map((invitee) => [invitee.id, invitee]));
  const seatsById = new Map(snapshot.seats.map((seat) => [seat.id, seat]));
  const tablesById = new Map(snapshot.tables.map((table) => [table.id, table]));
  const assignmentCountByInvitee = new Map<Id, number>();
  const assignmentCountBySeat = new Map<Id, number>();
  const assignmentCountByTable = new Map<Id, number>();
  const assignedSeatByInvitee = new Map<Id, Seat>();

  for (const party of snapshot.invitationParties) {
    const confirmedCount = snapshot.invitees.filter(
      (invitee) =>
        invitee.invitationPartyId === party.id && invitee.attendanceStatus === "confirmed",
    ).length;
    const expectedCount = party.rsvpStatus === "accepted" ? party.attendingCount : 0;

    if (confirmedCount !== expectedCount) {
      errors.push({
        code: "attendance_count_mismatch",
        message: `${party.label} has ${confirmedCount} named attendees but its RSVP count is ${expectedCount}.`,
        relatedIds: [party.id],
      });
    }
  }

  for (const assignment of snapshot.assignments) {
    assignmentCountByInvitee.set(
      assignment.inviteeId,
      (assignmentCountByInvitee.get(assignment.inviteeId) ?? 0) + 1,
    );
    assignmentCountBySeat.set(
      assignment.seatId,
      (assignmentCountBySeat.get(assignment.seatId) ?? 0) + 1,
    );

    const invitee = inviteesById.get(assignment.inviteeId);
    const seat = seatsById.get(assignment.seatId);
    if (!invitee || invitee.attendanceStatus !== "confirmed" || !invitee.requiresSeat || !seat) {
      errors.push({
        code: "ineligible_assignment",
        message: "A seat is assigned to an ineligible or missing attendee.",
        relatedIds: [assignment.inviteeId, assignment.seatId],
      });
      continue;
    }

    assignedSeatByInvitee.set(invitee.id, seat);
    assignmentCountByTable.set(
      seat.tableId,
      (assignmentCountByTable.get(seat.tableId) ?? 0) + 1,
    );
  }

  for (const [inviteeId, count] of assignmentCountByInvitee) {
    if (count > 1) {
      errors.push({
        code: "invitee_assigned_more_than_once",
        message: "An attendee has more than one seat.",
        relatedIds: [inviteeId],
      });
    }
  }

  for (const [seatId, count] of assignmentCountBySeat) {
    if (count > 1) {
      errors.push({
        code: "seat_conflict",
        message: "A seat has more than one attendee.",
        relatedIds: [seatId],
      });
    }
  }

  for (const invitee of snapshot.invitees) {
    if (
      invitee.attendanceStatus === "confirmed" &&
      invitee.requiresSeat &&
      !assignmentCountByInvitee.has(invitee.id)
    ) {
      errors.push({
        code: "unassigned_attendee",
        message: `${invitee.fullName} still needs a seat.`,
        relatedIds: [invitee.id],
      });
    }
  }

  for (const [tableId, count] of assignmentCountByTable) {
    const table = tablesById.get(tableId);
    if (table && count > table.capacity) {
      errors.push({
        code: "table_over_capacity",
        message: `${table.name} is over capacity by ${count - table.capacity}.`,
        relatedIds: [table.id],
      });
    }
  }

  for (const party of snapshot.invitationParties) {
    const confirmed = snapshot.invitees.filter(
      (invitee) =>
        invitee.invitationPartyId === party.id && invitee.attendanceStatus === "confirmed",
    );
    addGroupedWarning(
      warnings,
      "split_invitation_party",
      party.label,
      confirmed,
      assignedSeatByInvitee,
    );
  }

  const keepTogetherGroups = new Map<Id, Invitee[]>();
  for (const invitee of snapshot.invitees) {
    if (invitee.attendanceStatus !== "confirmed" || !invitee.keepTogetherGroupId) continue;
    const group = keepTogetherGroups.get(invitee.keepTogetherGroupId) ?? [];
    group.push(invitee);
    keepTogetherGroups.set(invitee.keepTogetherGroupId, group);
  }
  for (const [groupId, invitees] of keepTogetherGroups) {
    addGroupedWarning(
      warnings,
      "keep_together_split",
      `Keep-together group ${groupId}`,
      invitees,
      assignedSeatByInvitee,
    );
  }

  const layout = layoutValidation(snapshot);
  errors.push(...layout.errors);
  warnings.push(...layout.warnings);
  return { canPublish: errors.length === 0, errors, warnings };
}

export function inspectWorkspace(workspace: SeatingWorkspace): PlannerView {
  const seatsById = new Map(workspace.draft.seats.map((seat) => [seat.id, seat]));
  const inviteesById = new Map(workspace.draft.invitees.map((invitee) => [invitee.id, invitee]));
  const assignmentsBySeatId = new Map<Id, Invitee>();
  const assignmentsByInviteeId = new Map<Id, Seat>();

  for (const assignment of workspace.draft.assignments) {
    const invitee = inviteesById.get(assignment.inviteeId);
    const seat = seatsById.get(assignment.seatId);
    if (invitee && seat) {
      assignmentsBySeatId.set(seat.id, invitee);
      assignmentsByInviteeId.set(invitee.id, seat);
    }
  }

  const confirmedInvitees = workspace.draft.invitees.filter(
    (invitee) => invitee.attendanceStatus === "confirmed",
  );
  const nonAttendingInvitees = workspace.draft.invitees.filter(
    (invitee) => invitee.attendanceStatus === "not_attending",
  );

  return {
    confirmedInvitees,
    nonAttendingInvitees,
    unassignedInvitees: confirmedInvitees.filter(
      (invitee) => invitee.requiresSeat && !assignmentsByInviteeId.has(invitee.id),
    ),
    assignmentsBySeatId,
    assignmentsByInviteeId,
    validation: validatePublication(workspace.draft),
    occupiedSeatCount: assignmentsBySeatId.size,
    totalSeatCount: workspace.draft.seats.length,
  };
}

function replaceAssignments(
  assignments: SeatAssignment[],
  inviteeId: Id,
  toSeatId: Id | null,
): SeatAssignment[] {
  const next = assignments.filter((assignment) => assignment.inviteeId !== inviteeId);
  if (toSeatId) next.push({ inviteeId, seatId: toSeatId });
  return next;
}

function applyMove(
  workspace: SeatingWorkspace,
  command: Extract<SeatingCommand, { type: "move_invitee" }>,
  context: CommandContext,
): DomainResult<SeatingWorkspace> {
  const invitee = workspace.draft.invitees.find((candidate) => candidate.id === command.inviteeId);
  if (!invitee) return fail("invitee_not_found", "The attendee no longer exists.");
  if (invitee.attendanceStatus !== "confirmed" || !invitee.requiresSeat) {
    return fail("invitee_not_eligible", `${invitee.fullName} is not eligible for a seat.`);
  }

  if (command.toSeatId && !workspace.draft.seats.some((seat) => seat.id === command.toSeatId)) {
    return fail("seat_not_found", "The destination seat no longer exists.");
  }

  const occupant = command.toSeatId
    ? workspace.draft.assignments.find(
        (assignment) =>
          assignment.seatId === command.toSeatId && assignment.inviteeId !== command.inviteeId,
      )
    : undefined;
  if (occupant) return fail("seat_occupied", "That seat was just occupied by another attendee.");

  const fromSeatId =
    workspace.draft.assignments.find((assignment) => assignment.inviteeId === command.inviteeId)
      ?.seatId ?? null;
  if (fromSeatId === command.toSeatId) return { ok: true, value: workspace };

  const auditEntry: AuditEntry = {
    id: context.auditId,
    kind: "seat_moved",
    actorId: context.actorId,
    occurredAt: context.at,
    inviteeId: command.inviteeId,
    fromSeatId,
    toSeatId: command.toSeatId,
    revisionNumber: null,
    reversesAuditId: null,
  };

  return {
    ok: true,
    value: {
      ...workspace,
      draft: {
        ...workspace.draft,
        version: workspace.draft.version + 1,
        assignments: replaceAssignments(
          workspace.draft.assignments,
          command.inviteeId,
          command.toSeatId,
        ),
      },
      auditLog: [...workspace.auditLog, auditEntry],
    },
  };
}

function applyUndo(
  workspace: SeatingWorkspace,
  command: Extract<SeatingCommand, { type: "undo_move" }>,
  context: CommandContext,
): DomainResult<SeatingWorkspace> {
  const original = workspace.auditLog.find(
    (entry) => entry.id === command.auditId && entry.kind === "seat_moved",
  );
  if (!original || !original.inviteeId) return fail("audit_not_found", "That move cannot be undone.");

  const currentSeatId =
    workspace.draft.assignments.find((item) => item.inviteeId === original.inviteeId)?.seatId ?? null;
  if (currentSeatId !== original.toSeatId) {
    return fail("undo_conflict", "The assignment changed after that move and cannot be overwritten.");
  }

  if (
    original.fromSeatId &&
    workspace.draft.assignments.some(
      (assignment) =>
        assignment.seatId === original.fromSeatId && assignment.inviteeId !== original.inviteeId,
    )
  ) {
    return fail("undo_conflict", "The previous seat is now occupied.");
  }

  return {
    ok: true,
    value: {
      ...workspace,
      draft: {
        ...workspace.draft,
        version: workspace.draft.version + 1,
        assignments: replaceAssignments(
          workspace.draft.assignments,
          original.inviteeId,
          original.fromSeatId,
        ),
      },
      auditLog: [
        ...workspace.auditLog,
        {
          id: context.auditId,
          kind: "seat_move_undone",
          actorId: context.actorId,
          occurredAt: context.at,
          inviteeId: original.inviteeId,
          fromSeatId: original.toSeatId,
          toSeatId: original.fromSeatId,
          revisionNumber: null,
          reversesAuditId: original.id,
        },
      ],
    },
  };
}

export function applyCommand(
  workspace: SeatingWorkspace,
  command: SeatingCommand,
  context: CommandContext,
): DomainResult<SeatingWorkspace> {
  if (command.expectedVersion !== workspace.draft.version) {
    return fail("stale_version", "The plan changed on another device. Refresh and try again.");
  }
  return command.type === "move_invitee"
    ? applyMove(workspace, command, context)
    : applyUndo(workspace, command, context);
}

export function publishDraft(
  workspace: SeatingWorkspace,
  context: CommandContext,
  revisionId: Id,
  acknowledgeLayoutWarnings = false,
): DomainResult<SeatingWorkspace> {
  const validation = validatePublication(workspace.draft);
  if (!validation.canPublish || (!acknowledgeLayoutWarnings && validation.warnings.some(w => w.code === "layout_clearance"))) {
    return {
      ok: false,
      error: {
        code: "publication_blocked",
        message: "Resolve all publishing errors before publishing.",
        validation,
      },
    };
  }

  const revisionNumber = (workspace.published?.revisionNumber ?? 0) + 1;
  const snapshot = cloneSnapshot(workspace.draft);
  const revision: PublishedRevision = {
    id: revisionId,
    revisionNumber,
    publishedAt: context.at,
    publishedBy: context.actorId,
    invitationParties: snapshot.invitationParties,
    invitees: snapshot.invitees,
    tables: snapshot.tables,
    seats: snapshot.seats,
    assignments: snapshot.assignments,
    venueLayout: snapshot.venueLayout,
  };

  return {
    ok: true,
    value: {
      ...workspace,
      published: revision,
      revisions: [...workspace.revisions, revision],
      draft: {
        ...workspace.draft,
        version: workspace.draft.version + 1,
        baseRevisionNumber: revisionNumber,
      },
      auditLog: [
        ...workspace.auditLog,
        {
          id: context.auditId,
          kind: "plan_published",
          actorId: context.actorId,
          occurredAt: context.at,
          inviteeId: null,
          fromSeatId: null,
          toSeatId: null,
          revisionNumber,
          reversesAuditId: null,
        },
      ],
    },
  };
}

export function restoreRevision(
  workspace: SeatingWorkspace,
  revisionId: Id,
  context: CommandContext,
): DomainResult<SeatingWorkspace> {
  const revision = workspace.revisions.find((candidate) => candidate.id === revisionId);
  if (!revision) return fail("revision_not_found", "The selected revision no longer exists.");

  const restored = cloneSnapshot(revision);
  const draft: DraftSeatingPlan = {
    id: workspace.draft.id,
    version: workspace.draft.version + 1,
    baseRevisionNumber: revision.revisionNumber,
    invitationParties: restored.invitationParties,
    invitees: restored.invitees,
    tables: restored.tables,
    seats: restored.seats,
    assignments: restored.assignments,
    venueLayout: restored.venueLayout ?? null,
  };

  return {
    ok: true,
    value: {
      ...workspace,
      draft,
      auditLog: [
        ...workspace.auditLog,
        {
          id: context.auditId,
          kind: "revision_restored",
          actorId: context.actorId,
          occurredAt: context.at,
          inviteeId: null,
          fromSeatId: null,
          toSeatId: null,
          revisionNumber: revision.revisionNumber,
          reversesAuditId: null,
        },
      ],
    },
  };
}

export function getTableForSeat(snapshot: SeatingSnapshot, seatId: Id) {
  const seatsById = new Map(snapshot.seats.map((seat) => [seat.id, seat]));
  const tableId = tableIdForSeat(seatsById, seatId);
  return snapshot.tables.find((table) => table.id === tableId) ?? null;
}


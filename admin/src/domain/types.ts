export type Id = string;

export type RsvpStatus = "pending" | "accepted" | "declined";
export type AttendanceStatus = "confirmed" | "not_attending";
export type TableShape = "round" | "rectangular";

export interface InvitationParty {
  id: Id;
  label: string;
  rsvpStatus: RsvpStatus;
  attendingCount: number;
}

export interface Invitee {
  id: Id;
  invitationPartyId: Id;
  fullName: string;
  attendanceStatus: AttendanceStatus;
  requiresSeat: boolean;
  tags: string[];
  keepTogetherGroupId: Id | null;
  privateNotes: string;
}

export interface SeatingTable {
  id: Id;
  name: string;
  number: number;
  shape: TableShape;
  capacity: number;
  seatOneAngle: number;
  /** Absent on legacy revisions; defaults to the two long sides. */
  sideCounts?: import("./tableLayout").SideCounts;
  /** Zero-based physical chair index, clockwise from the top-left. */
  seatOnePosition?: number;
}

export interface Seat {
  id: Id;
  tableId: Id;
  number: number;
}

export interface SeatAssignment {
  inviteeId: Id;
  seatId: Id;
}

export interface SeatingSnapshot {
  invitationParties: InvitationParty[];
  invitees: Invitee[];
  tables: SeatingTable[];
  seats: Seat[];
  assignments: SeatAssignment[];
}

export interface DraftSeatingPlan extends SeatingSnapshot {
  id: Id;
  version: number;
  baseRevisionNumber: number | null;
}

export interface PublishedRevision extends SeatingSnapshot {
  id: Id;
  revisionNumber: number;
  publishedAt: string;
  publishedBy: Id;
}

export type AuditKind =
  | "seat_moved"
  | "seat_move_undone"
  | "plan_published"
  | "revision_restored"
  | "invitee_updated"
  | "table_updated"
  | "rsvp_amended"
  | "guest_lookup_changed";

export interface AuditEntry {
  id: Id;
  kind: AuditKind;
  actorId: Id;
  occurredAt: string;
  inviteeId: Id | null;
  fromSeatId: Id | null;
  toSeatId: Id | null;
  revisionNumber: number | null;
  reversesAuditId: Id | null;
}

export interface SeatingWorkspace {
  draft: DraftSeatingPlan;
  published: PublishedRevision | null;
  revisions: PublishedRevision[];
  auditLog: AuditEntry[];
  guestLookupEnabled: boolean;
}

export type PublicationErrorCode =
  | "attendance_count_mismatch"
  | "unassigned_attendee"
  | "seat_conflict"
  | "invitee_assigned_more_than_once"
  | "table_over_capacity"
  | "ineligible_assignment";

export type SeatingWarningCode = "split_invitation_party" | "keep_together_split";

export interface PublicationIssue<TCode extends string> {
  code: TCode;
  message: string;
  relatedIds: Id[];
}

export interface PublicationValidation {
  canPublish: boolean;
  errors: PublicationIssue<PublicationErrorCode>[];
  warnings: PublicationIssue<SeatingWarningCode>[];
}

export interface PlannerView {
  confirmedInvitees: Invitee[];
  nonAttendingInvitees: Invitee[];
  unassignedInvitees: Invitee[];
  assignmentsBySeatId: ReadonlyMap<Id, Invitee>;
  assignmentsByInviteeId: ReadonlyMap<Id, Seat>;
  validation: PublicationValidation;
  occupiedSeatCount: number;
  totalSeatCount: number;
}

export interface CommandContext {
  actorId: Id;
  at: string;
  auditId: Id;
}

export type SeatingCommand =
  | {
      type: "move_invitee";
      expectedVersion: number;
      inviteeId: Id;
      toSeatId: Id | null;
    }
  | {
      type: "undo_move";
      expectedVersion: number;
      auditId: Id;
    };

export type SeatingDomainErrorCode =
  | "stale_version"
  | "invitee_not_found"
  | "invitee_not_eligible"
  | "seat_not_found"
  | "seat_occupied"
  | "audit_not_found"
  | "undo_conflict"
  | "publication_blocked"
  | "revision_not_found";

export interface SeatingDomainError {
  code: SeatingDomainErrorCode;
  message: string;
  validation?: PublicationValidation;
}

export type DomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SeatingDomainError };

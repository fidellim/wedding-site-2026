import type { Invitee, Id, SeatingTable, SeatingWorkspace } from "../domain/types";

export type RepositoryCommand =
  | { type: "move_invitee"; expectedVersion: number; inviteeId: Id; toSeatId: Id | null }
  | { type: "undo_move"; expectedVersion: number; auditId: Id }
  | { type: "upsert_invitee"; expectedVersion: number; invitee: Partial<Invitee> & Pick<Invitee, "fullName" | "invitationPartyId"> }
  | { type: "resolve_roster"; expectedVersion: number; invitationPartyId: Id; confirmedInviteeIds: Id[]; reason?: string }
  | { type: "amend_rsvp"; expectedVersion: number; invitationPartyId: Id; nextStatus: "accepted" | "declined"; nextAttendingCount: number; reason: string }
  | { type: "upsert_table"; expectedVersion: number; table: Partial<SeatingTable> & Pick<SeatingTable, "name" | "number" | "shape" | "capacity"> }
  | { type: "save_venue_layout"; expectedVersion: number; layout: import("../venue/layout").VenueLayout }
  | { type: "publish"; expectedVersion: number; acknowledgeLayoutWarnings?: boolean }
  | { type: "restore_revision"; expectedVersion: number; revisionId: Id }
  | { type: "set_guest_lookup"; enabled: boolean };

export interface SeatingRepository {
  load(): Promise<SeatingWorkspace>;
  execute(command: RepositoryCommand): Promise<SeatingWorkspace>;
  provisionGuestAccess(invitationPartyId: Id): Promise<string>;
  subscribe(onChange: () => void): () => void;
}

export class SeatingRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: string = "repository_error",
  ) {
    super(message);
    this.name = "SeatingRepositoryError";
  }
}

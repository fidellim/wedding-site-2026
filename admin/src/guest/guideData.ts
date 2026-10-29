import { ceremonyChairCount } from "../venue/ceremonyLayout";
import type { InvitationParty, SeatingSnapshot } from "../domain/types";
import { isVenueLayout } from "../venue/layout";

export interface SeatingDirectoryEntry {
  tableId: string;
  fullName: string;
  seatNumber?: number;
}

export interface GuideData {
  directory: SeatingDirectoryEntry[];
  revisionNumber: number | null;
  chairsApproved: boolean;
  ceremonyChairs: number;
  party: InvitationParty;
  snapshot: SeatingSnapshot;
}

/** Apply the same privacy boundary to authenticated previews as to guest RPC data. */
export function partyGuide(snapshot: SeatingSnapshot, partyId: string, chairsApproved = false, revisionNumber: number | null = null): GuideData | null {
  const party = snapshot.invitationParties.find(p => p.id === partyId);
  if (!party) return null;
  const invitees = snapshot.invitees.filter(i => i.invitationPartyId === partyId && i.attendanceStatus === "confirmed")
    .map(i => ({ ...i, tags: [], privateNotes: "", keepTogetherGroupId: null }));
  const allowed = new Set(invitees.map(i => i.id));
  const directory = snapshot.assignments.flatMap(assignment => {
    const person = snapshot.invitees.find(i => i.id === assignment.inviteeId && i.attendanceStatus === "confirmed");
    const seat = snapshot.seats.find(s => s.id === assignment.seatId);
    return person && seat ? [{ fullName: person.fullName, tableId: seat.tableId, ...(chairsApproved ? { seatNumber: seat.number } : {}) }] : [];
  });
  return { directory, party, chairsApproved, ceremonyChairs: ceremonyChairCount(snapshot), revisionNumber, snapshot: {
    venueLayout: snapshot.venueLayout,
    invitationParties: [party], invitees,
    assignments: snapshot.assignments.filter(a => allowed.has(a.inviteeId)),
    tables: snapshot.tables, seats: snapshot.seats,
  } };
}

export function parseGuide(value: unknown): GuideData | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") throw new Error("Invalid seating response");
  const data = value as Record<string, unknown>;
  const party = data.party as InvitationParty;
  if (!party || typeof party.id !== "string" || !Array.isArray(data.invitees) || !Array.isArray(data.assignments)
    || !Array.isArray(data.tables) || !Array.isArray(data.seats) || !isVenueLayout(data.venueLayout)) throw new Error("Invalid seating response");
  const guide = partyGuide({
    invitationParties: [party],
    invitees: data.invitees.map(i => ({ ...i, invitationPartyId: party.id, attendanceStatus: "confirmed", tags: [], privateNotes: "", keepTogetherGroupId: null })),
    assignments: data.assignments, tables: data.tables, seats: data.seats, venueLayout: data.venueLayout,
  }, party.id, data.chairsApproved === true, typeof data.revisionNumber === "number" ? data.revisionNumber : null);
  if (guide && data.directory !== undefined) {
    if (!Array.isArray(data.directory)) throw new Error("Invalid seating directory");
    guide.directory = data.directory.map(entry => {
      if (!entry || typeof entry !== "object" || typeof entry.fullName !== "string" || typeof entry.tableId !== "string"
        || !guide.snapshot.tables.some(t => t.id === entry.tableId)
        || (guide.chairsApproved && (!Number.isInteger(entry.seatNumber) || !guide.snapshot.seats.some(s => s.tableId === entry.tableId && s.number === entry.seatNumber)))) throw new Error("Invalid seating directory");
      return { fullName: entry.fullName, tableId: entry.tableId, ...(guide.chairsApproved ? { seatNumber: entry.seatNumber } : {}) };
    });
  }
  if (guide) guide.ceremonyChairs = typeof data.ceremonyChairs === "number" && Number.isInteger(data.ceremonyChairs) && data.ceremonyChairs >= 0 ? data.ceremonyChairs : 0;
  return guide;
}

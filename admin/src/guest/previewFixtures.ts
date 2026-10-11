import type { SeatingSnapshot } from "../domain/types";
import { defaultVenueLayout } from "../venue/layout";
import { partyGuide } from "./guideData";

/** Synthetic review cases, never real guest data; only mounted in Vite development. */
export function previewFixture(kind: "single" | "split") {
  const layout = defaultVenueLayout();
  layout.tables = {
    "sample-round": { x: -5, y: -4, rotation: 0, width: 1.8, depth: 1.8, dimensionsVerified: false },
    "sample-long": { x: 5, y: -4, rotation: 90, width: 3, depth: 1.2, dimensionsVerified: false },
  };
  const party = { id: "sample-party", label: "Sample invitation", rsvpStatus: "accepted" as const, attendingCount: kind === "single" ? 1 : 2 };
  const snapshot: SeatingSnapshot = {
    venueLayout: layout, invitationParties: [party],
    invitees: (kind === "single" ? ["Alex"] : ["Alex", "Jamie"]).map(name => ({ id: name, fullName: name, invitationPartyId: party.id,
      attendanceStatus: "confirmed", requiresSeat: true, tags: [], privateNotes: "", keepTogetherGroupId: null })),
    tables: [{ id: "sample-round", name: "Table 1", number: 1, shape: "round", capacity: 8, seatOneAngle: 0 },
      { id: "sample-long", name: "Table 2", number: 2, shape: "rectangular", capacity: 8, seatOneAngle: 0 }],
    seats: ["sample-round", "sample-long"].flatMap(tableId => Array.from({ length: 8 }, (_, i) => ({ id: `${tableId}-${i + 1}`, tableId, number: i + 1 }))),
    assignments: [{ inviteeId: "Alex", seatId: "sample-round-3" }, ...(kind === "split" ? [{ inviteeId: "Jamie", seatId: "sample-long-6" }] : [])],
  };
  return partyGuide(snapshot, party.id)!;
}

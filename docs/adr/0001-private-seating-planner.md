# Use an authenticated admin boundary for seating

---
status: proposed
---

The seating planner will be a private administrative surface on the existing
Netlify-hosted site, backed by Supabase Auth and database-enforced authorization
for Hannah and Fidel. A hidden URL or invite code is insufficient because the
planner exposes the full invitee list and privileged writes; the public
Supabase anonymous role must not be able to read or mutate seating data except
through narrowly scoped guest-facing operations.

The planner will use individually named Invitees and numbered Seats while
preserving the current collective, locked RSVP for each Invitation Party. The
Administrators will turn an accepted party-level Attending Count into named
Confirmed Attendees from their existing attendance list. The database remains
the canonical source for invitations, RSVPs, RSVP Amendments, tables, seats,
assignments, and published-plan state.

The planner will provide manual drag-and-drop over a visual Floor Plan, with
numbered Seats, validation, realtime updates between both Administrators, and
atomic conflict rejection when two moves target the same Seat. Editing affects
only a private draft; an explicit publish operation replaces the guest-visible
revision. An invite code may retrieve only its own party's assignments and a
privacy-safe Floor Plan, never the full guest list.

## Considered Options

- A hidden static page was rejected because obscurity is not authorization.
- A spreadsheet was rejected as the canonical store because RSVP changes and
  seating constraints would require fragile synchronization.
- A separate deployment remains possible, but is not currently justified when
  Netlify can host the admin route and Supabase can enforce the data boundary.

## Consequences

- Family invitations must be expanded into individually named Invitees before
  they can receive Seat Assignments.
- Publishing must be separate from editing so drafts are never revealed early.
- The guest-facing invitation will eventually need a narrowly scoped lookup for
  the published Seats belonging to its own Invitation Party.
- Guest RSVP submissions remain locked; Administrators correct them only by
  appending auditable RSVP Amendments.
- The venue and other third parties will not receive administrative access.

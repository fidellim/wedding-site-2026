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
database remains the canonical source for invitations, RSVPs, tables, seats,
assignments, and published-plan state. The exact rule that turns an accepted
party-level Attending Count into named Confirmed Attendees remains unresolved.

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

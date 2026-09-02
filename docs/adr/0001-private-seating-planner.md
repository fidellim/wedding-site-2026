---
status: proposed
---

# Use an authenticated admin boundary for seating

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
the canonical source for invitations, Invitees, RSVPs, RSVP Amendments,
Attendance Roster Changes, tables, seats, assignments, and published-plan
state.

The first release will provide manual Invitee entry and drag-and-drop assignment
to round or rectangular Tables with stable, clockwise numbered Seats. It will
validate counts and assignments, warn when an Invitation Party is split, show
realtime updates between both Administrators, and atomically reject conflicts
when two moves target the same Seat. Editing affects only a private draft; an
explicit publish operation replaces the guest-visible revision. An invite code
may retrieve only its own party's assignments, never the full guest list.

The visual venue Floor Plan and read-only offline access are deferred follow-up
capabilities. The admin editor is desktop/tablet-first, while all guest-facing
assignment views are mobile-friendly. Publishing does not notify Invitees.

The first release covers reception seating only and includes Invitees only;
the couple, vendors, and other non-RSVP participants are outside the planner.
An Administrator may mark a Confirmed Attendee as not requiring a Seat. Guest
seating remains completely hidden until the first plan is published.

There is exactly one editable Draft Seating Plan and one guest-visible
Published Seating Plan. Publishing validates and atomically snapshots the
entire plan as a new immutable revision; subsequent editing starts from that
revision without changing what Invitees see. The first guest-facing release
shows table and seat numbers without waiting for the later visual Floor Plan.

## Considered Options

- A hidden static page was rejected because obscurity is not authorization.
- A spreadsheet was rejected as the canonical store because RSVP changes and
  seating constraints would require fragile synchronization.
- A separate deployment remains possible, but is not currently justified when
  Netlify can host the admin route and Supabase can enforce the data boundary.

## Consequences

- Family invitations must be expanded into individually named Invitees before
  they can receive Seat Assignments.
- Every person, including a single-person Invitation Party, is an independent
  Invitee record. A multi-name text field is not used.
- Initially mapping an Attending Count to named Invitees does not amend the
  RSVP. Replacing those names later records an audited Attendance Roster Change
  even when the count stays the same.
- Publishing must be separate from editing so drafts are never revealed early.
- The guest-facing invitation will eventually need a narrowly scoped lookup for
  the published Seats belonging to its own Invitation Party.
- Guest RSVP submissions remain locked; Administrators correct them only by
  appending auditable RSVP Amendments.
- The venue and other third parties will not receive administrative access.
- Publishing is blocked when an accepted RSVP's Attending Count differs from
  its selected Confirmed Attendees.
- Publishing is also blocked by an unseated Confirmed Attendee, conflicting
  Seat Assignments, or table over-capacity; split-party and keep-together issues
  remain warnings.
- Late attendance changes clear affected assignments in the draft but preserve
  the previous assignment in audit history until a replacement is published.
- Seating notes, tags, and keep-together groups produce warnings rather than
  automatic assignments or hard constraints.
- Non-Attending Invitees remain available to Administrators for history and
  amendments but never appear in the seating queue or a published plan.
- Table setup captures name/number, round or rectangular shape, capacity, and
  Seat 1 orientation; numbered Seats are generated clockwise.
- Seating moves record the Administrator, old Seat, new Seat, and time. The
  first concurrent move wins, while the losing editor refreshes and retries.
- Supabase six-digit email OTP is the selected passwordless method while it
  remains available within the Free plan; only the two allowlisted
  Administrator identities can sign in.
- Restoring an older Plan Revision creates a new draft that must pass current
  validation and be explicitly republished.
- The published plan, guest lookup, assignments, history, and private notes are
  retained after the wedding as a Wedding Archive unless the couple later
  chooses to remove them.
- Undo is implemented as a new atomic move and fails rather than overwriting a
  newer concurrent change.
- Each seating move persists immediately; a disconnected admin editor becomes
  read-only rather than queueing offline changes.
- Either Administrator may publish the complete plan after reviewing its
  validation summary and confirming explicitly.
- Existing invite codes are reused only when cryptographically random;
  otherwise a separate high-entropy seating token protects guest lookup.
- Keep-Together Groups may cross Invitation Parties and produce optional,
  warning-only preferences.
- Guest lookup remains enabled after the wedding but Administrators retain a
  manual privacy switch to disable it. Published Wedding Archive revisions are
  immutable; corrections start from a restored draft and create a new revision.
- Production seating rows are retained indefinitely. Unassignment, capacity
  reduction, and revision restoration change current state without deleting
  records or cascading deletions.

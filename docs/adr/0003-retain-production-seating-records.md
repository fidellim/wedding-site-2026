---
status: accepted
---

# Retain all production seating records

Production seating records are never physically deleted. Unassigning an
Invitee clears the current Seat reference, capacity reductions make excess
Seats inactive, and restoring a Plan Revision makes the current layout inactive
before reactivating the retained records represented by the selected snapshot.
This uses more rows and requires active-record filters, but it preserves the
Wedding Archive and removes deletion and cascading deletion from normal seating
operations.

## Consequences

- Existing invitation, registry, RSVP function, policy, and trigger definitions
  are outside the seating migration boundary.
- Every seating foreign key restricts deletion instead of cascading or
  nullifying it.
- Direct browser writes to seating tables remain revoked; authenticated
  Administrators write through audited functions.
- Local SQL safety checks reject destructive statements before a rollback-only
  production validation script can be generated.

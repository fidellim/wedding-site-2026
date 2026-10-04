# Immersive Seating Guide

Status: first venue-preview milestone approved and implemented locally. Guest integration and editable wedding furniture remain follow-up work.

## Source authority

[`VENUE_MASTER_SPEC.md`](venue/VENUE_MASTER_SPEC.md) is the authoritative project
resource. The owner-supplied floor-plan diagram is incorporated in revision 1.2
for event-zone relationships and the sand strip; it supplies no measurements. Labeled stills in `venue/reference-images/` clarify that specification only.
The original video stays separately archived for resolving ambiguities and is
not a day-to-day development dependency. Verified physical facts must be added
to the master specification before implementation uses them.

## Agreed experience

- Give the Seating Guide its own page so guests can focus on finding their seats.
- Support both arrival-time seat finding and a preview before the wedding,
  with seat finding taking priority.
- Show table and seat assignments immediately, before exploration.
- Present a stylized 3D miniature with accurate table positions and key landmarks.
- Include a short, skippable camera journey, optional rotation and zoom, and a
  simple overhead view suitable for phones at the entrance.
- Enter the dedicated page from the invitation for the first release.
- Show the Invitation Party's assignments in a compact list. Selecting a person
  highlights their Seat and focuses the scene; single-person invitations select
  that person automatically.
- Maintain table positions and landmarks through the admin planner, with both
  guest views using the same layout. Permanent venue facts remain governed by
  the master specification, independently of editable wedding furniture.
- Start the camera journey only on a "Show my seat" action, allow skipping,
  and suppress movement when reduced motion is requested.
- The entrance refers to the early arrival/walkway area toward the ceremony.
  The lower lawn hosts the reception. Exact entrance coordinates and a verified
  walking route remain unconfirmed.
- Keep approximate previews private in admin until the owner approves the event
  layout. Publish table positions and Seat Assignments together; subsequent
  draft edits must not change the guest view.
- Limit name search and filtering to the current Invitation Party. Other tables
  may show their numbers, but not other parties' names.

## Immediate focus

Prioritize creation of the 3D wedding venue view. Invitation access integration
is explicitly deferred, including the choice of retaining existing invitation
links or issuing links with seating tokens. This does not widen guest access.

The approved first review milestone is a private, approximate venue preview:
ceremony approach, reception lawn, terrace, stairs, pavilion, waterfront,
paving, and restrained resort/landscape context, with an elevated overview,
entrance preset, rotation, zoom, and overhead view. Unknown dimensions remain
named parameters. The preview is implemented in the admin studio; see [implementation notes](venue/preview-implementation.md).

## Existing foundation

The repository contains a private published-seating lookup and administrative
table/seat diagrams. The guest-facing seating screen is not implemented.
The current table model lacks venue positions and physical dimensions. The
supplied master specification and labeled stills establish venue character and
spatial relationships, but measured dimensions and the actual wedding furniture
arrangement remain unconfirmed. Existing guest access is
scoped to an Invitation Party and excludes other parties' names.

## Deferred decisions and confirmations

- Confirm physical dimensions, furniture positions, and entrance placement
  before treating the preview as an approved event layout.
- Resolve secure invitation-to-guide access when guest integration resumes.

## Coordinate convention

Master specification revision 1.1 corrects the illustrative table heading to
`rotationZ`, consistent with Section 5's stable Z-up convention. No physical
measurement is implied by the illustrative JSON coordinates.

Further decisions will be recorded as the interview progresses.

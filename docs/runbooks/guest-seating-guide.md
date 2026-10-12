# Guest Seating Guide

Implemented locally. The owner reported the guest guide migration installed
with COMMIT. Production deployment, physical chair approval and guest release
remain pending.

## Venue presentation

The Seating Guide uses a full viewport venue canvas with floating identity and
view controls, plus a collapsible seating panel. On phones the panel sits at the
bottom, with the 3D framing lifted to keep the destination visible. Admin guest
previews keep this canvas contained within their preview area. The shared 3D
renderer uses the same landmark callout design and collision placement in all
venue views, including the admin Venue Preview. Callouts avoid seating overlays.

## Private review

Start `npm run dev`. Synthetic examples are available only in development:

- `/seating/?preview=single` — one person selected automatically.
- `/seating/?preview=split` — two people assigned to different tables.

These examples use sample names and sample table positions. They do not query
production or expose real guests. Production builds do not enable these URLs.

For actual seating records, sign in to `/admin/#guide`, or select **Guest guide
preview** in the studio. Choose the private draft or published revision and an
invitation party. The selector identifies single-person and split-table parties.
Only that party's confirmed people are shown. The physical-chair checkbox affects
the private preview; it does not release anything on its own.

Review table numbers, seat numbers, the roughly ten-second optional flight,
**Skip to my seat**, overhead reception view, whole venue view and phone layout.
The reception map stays available if WebGL fails. Reduced motion skips the flight.
Unapproved layouts highlight tables and display assigned seat numbers in text;
physical chair labels and highlights appear only after approval.

## Installation and release

The additive migration
`supabase/migrations/20261009000100_add_guest_seating_guide.sql` requires the
existing seating planner, physical table layout, shared venue layout and venue
reconstruction migrations. Install through the project's normal migration
workflow. It preserves planning records and creates an initially closed guide
release gate. It does not change the existing token-protected seating lookup.

Deploy the application build with the `/seating/` entry point. The invitation and
guide share the invitation's existing public Supabase connection configuration.

1. Review the private draft, then publish the complete valid plan in **Publish**.
2. In **Guest guide preview**, select that published revision and review a
   single-person invitation and a party seated across multiple tables.
3. Approve physical chairs only if their actual arrangement is confirmed.
4. Acknowledge the review once for all Invitation Parties, choose **Release guide**,
   then confirm the displayed revision. Enable guest lookup in **Publish** when ready.
5. Open an existing invitation link and verify **View your Seating Guide** appears
   under the venue information and leads to the correct party's assignments.

Publishing and releasing are distinct deliberate actions. The guide uses the
released immutable revision, including furniture positions and assignments.
Subsequent drafts **and subsequent publications** leave it unchanged until a new
reviewed revision is released. Releasing a stale revision fails. **Hide Seating
Guide** closes the guide gate; disabling guest lookup hides both lookup APIs.

## Access and privacy

`get_seating_guide_for_invite(p_code)` treats the existing personalized invitation
code as the party's credential, consistent with invitation and RSVP access.
Guests need no replacement link or new seating token. The server resolves the
code, checks both release and lookup gates, and returns only that party's
confirmed names and assignments. Other tables display numbers, not party names;
notes, tags, other parties and non-attendees are excluded. Admin previews apply
the same filtering. Anonymous ceremony chairs use an aggregate count without
returning other invitees' identities.

The dedicated page has no indexing, no referrer transmission and no cached seat
assignments. Invalid, missing, declined or unreleased invitations show no seating
data. Network failures offer a retry. The aerial sequence is a visual tour;
entrance coordinates and accessible walking directions still need verification.

## Verification

- `npm run build`
- `npm test`
- `npm run seating:check-sql-safety`
- `npm run test:venue-sql`

SQL checks run against ephemeral PostgreSQL, covering preservation, closed
release gates, party isolation, approval state, immutable release, stale review,
lookup disablement and admin-only release. Component checks cover immediate
assignments, single-person selection, split-table selection, fallback mapping,
chair approval and review gating. Browser checks use synthetic data only.

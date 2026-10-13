# Invitation validation and return visits

Guests enter using their invitation code. An unknown or missing code displays
the private-event gate; a successful `lookup_invite` response opens the invitation.

Successful server validation stores guest details in a per-code browser cache
for two hours. A returning guest with an unexpired cache opens immediately while
the invitation code is checked again in the background. A successful check
updates the guest details and starts a new two-hour period. Visits, RSVP edits,
network failures, timeouts, and HTTP errors do not extend that period.

An explicit empty lookup response clears the cache and closes access immediately,
including if the envelope animation has already started. Failed background
verification keeps recent cached access until its original deadline, then closes
access with the verification-unavailable message. A cache already expired at
page load requires successful live verification before admission.

Cache format v3 records `validatedAt`; the old format is ignored because its
timestamps could also reflect RSVP edits. Missing, malformed, future-dated, or
wrong-code cache entries cannot provide access. If browser storage is unavailable,
live verification still works. Seating and RSVP permissions continue to be
enforced by their server endpoints; this cache contains invitation guest details,
not seating assignments.

Run `npx vitest run script.test.js` for the invitation regression tests. They cover
valid, invalid, and missing codes; fresh and expired caches; background rejection
and refresh; network failures and timeouts; and rejection during envelope opening.
These are application changes and require deployment, with no database migration.

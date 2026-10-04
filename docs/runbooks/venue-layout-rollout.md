# Shared venue layout upgrade

This phase adds desktop/laptop admin layout editing. Guest access and the guest
seating screen are deferred. Existing tables start in the unplaced tray; their
seats, assignments, and published revisions remain intact.

## Validate locally

- `npm test`: seating, layout geometry, session undo/redo, and UI regression checks.
- `npm run test:venue-sql`: runs all migrations against ephemeral PostgreSQL with
  synthetic invitations. Checks record preservation, legacy snapshots, stale
  writes, rotated chair boundaries, acknowledgement, publication/restore, and
  administrator restrictions. It never reads credentials or connects to Supabase.
- `npm run build` and `npm run seating:check-sql-safety`.

## Upgrade an existing production seating planner

Do not rerun the full seating installation. Only the new migration
`supabase/migrations/20261002000100_add_shared_venue_layout.sql` is needed.
It adds a nullable layout column and functions, extends snapshot serialization,
and retains existing records and revisions. It contains no row deletion,
truncation, or production data reset.

1. Generate a rollback-only validation artifact with
   `npm run seating:prepare-venue-upgrade`.
2. Run the generated `supabase/.temp/venue-upgrade-validate.sql` in the project's
   SQL editor. It locks the draft and fingerprints all existing invitation,
   registry, and seating rows; any change aborts validation. The script ends in
   `ROLLBACK`. The layout column is excluded from comparisons because it is new.
3. Generate the installation artifact with
   `npm run seating:prepare-venue-upgrade -- --apply`. Review and run
   `supabase/.temp/venue-upgrade-apply.sql`. This performs the same preservation
   check and ends in `COMMIT`. Generation alone does not access the database.
4. Deploy the admin build after the migration. In Venue preview, select Edit
   table layout, place existing tables, then adjust position, heading, and sizes.
5. Review blockers and approximate clearance warnings in Publish. Acknowledgement
   applies to the current draft version; changing the draft requires reviewing
   warnings again. Layout, setup, and assignments publish atomically.

The old published revision remains readable during the upgrade and placement.
Restoring a legacy revision produces a draft without layout positions, requiring
placement before its next publication. Restoring a newer revision restores its
layout and assignments together while retaining database records.

## Storage and controls

One small JSON layout is overwritten in the current draft. A completed gesture
creates one save and a compact audit marker, not a snapshot per pointer movement.
Only publication stores a full layout revision. Undo/redo keeps up to 50 actions
in browser memory and writes resulting draft states through the normal save
function; refreshing or publishing clears session history. No undo-history
schema is introduced. History also clears when table definitions or a layout
from another tab change, preventing stale undo from overwriting those edits.

Dimensions are estimates unless an admin confirms individual table dimensions.
Chair space reserves 0.7 m around each table; conservative rotated bounding boxes
warn about overlap or less than 0.5 m clearance. These checks are planning aids,
not surveyed venue or fire-safety measurements. Assigned tables outside the
modeled reception lawn cannot publish. Resizing the lawn never rescales tables.

Table editing preserves seat IDs, clockwise numbering, and Seat 1 configuration.
Separate venue setup controls stage/dance floor placement and the entrance marker;
permanent venue structures cannot be dragged in the table editor.

## Editor opens but placing or saving tables fails

If the studio reports `Could not find the function public.admin_save_venue_layout`
in the schema cache, run [inspect-venue-schema.sql](../../scripts/inspect-venue-schema.sql)
in the same Supabase project configured by `VITE_SUPABASE_URL`.

- All three checks false: the shared venue migration is missing. Follow the
  rollback-only validation and apply steps above; do not rerun the full seating
  installation.
- All three checks true: run [venue-refresh-schema.sql](../../scripts/venue-refresh-schema.sql)
  to refresh API metadata, then refresh the studio and retry the save.
- Mixed results: the upgrade is incomplete. Inspect the results before reapplying;
  the additive migration intentionally fails if its column already exists.

The upgrade now requests a schema refresh inside the transaction, delivered only
when it commits. The refresh itself changes no application records. See
[Supabase's schema refresh instructions](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema).

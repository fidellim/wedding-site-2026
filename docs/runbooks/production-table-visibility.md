# Saved SDE and DJ visibility

In **Venue preview**, **Show SDE & DJ / Hide SDE & DJ** automatically saves the
choice to the shared draft as `venueLayout.productionTablesVisible`. This boolean
controls both crew tables, equipment and labels in 2D and 3D. Older layouts that
omit it remain visible. Failed saves keep the previous choice, and read-only
admins cannot change it.

For an existing database, apply
`supabase/migrations/20261102000100_add_production_table_visibility.sql` using the
normal migration process. It updates the layout validator only, accepting the
optional boolean and rejecting other types. It does not change existing rows or
published revisions. Full-install, validation and venue-upgrade scripts include it.

After saving, publish the plan and review/release the new guest guide revision
through the existing workflow. Guests see the released revision's choice; later
draft changes do not alter the live guide. Restoring a revision restores its
visibility along with the rest of the layout.

Validate with `npm test`, `npm run build`, `npm run test:venue-sql`, and
`npm run seating:check-sql-safety`. SQL tests use ephemeral PostgreSQL only.

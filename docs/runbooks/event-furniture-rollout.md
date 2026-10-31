# Couple and cake tables

The venue editor supports two optional pieces of event furniture, stored in
`venueLayout.eventFurniture`: `couple` and `cake`. They do not create numbered
guest tables, seats, or assignments.

For an existing database with shared venue layouts installed, apply only
`supabase/migrations/20261031000100_add_couple_and_cake_furniture.sql` through
the normal migration process before deploying the updated editor. It replaces
the layout validator and publication clearance checks without changing any
existing rows or published revisions. Full-install and legacy venue-upgrade
scripts also include this migration.

In **Venue preview → Edit table layout**, choose **Add couple & cake tables**.
This saves both pieces to the shared draft. Starting estimates are:

- Couple’s table: 1.8 × 0.75 m, with two chairs together behind it.
- Cake table: 0.9 m diameter, with a schematic three-tier cake.
- Placement: left of the stage when looking toward the LED from the guests’
  side, angled 30° inward. The cake sits in front, offset toward the stage.

The rotation control reads 330° because the venue plan's Y axis points down;
this corresponds to the approved 30° inward angle on this side of the stage.
These are adjustable starting estimates, not venue-confirmed measurements or
a cake-design specification. Review against the actual guest tables and any
side LED installation before publishing.

Drag either piece or select it under **Selected furniture** to edit position,
rotation, and dimensions. **Move to unplaced tray** removes it from the draft
layout; it can be placed again. Undo and redo use the existing layout history.
The stage and cake table move independently of the couple’s table after placement.

Both pieces appear in 2D and 3D, with the couple’s chairs included in footprint
checks. Furniture outside the reception lawn blocks publication; estimated
overlaps and clearance under 0.5 m produce acknowledgement warnings. Publishing
and releasing the guest guide remain separate existing actions. Older layouts
without event furniture render as before.

Verify locally with `npm test`, `npm run build`, `npm run test:venue-sql`, and
`npm run seating:check-sql-safety`. The SQL test uses ephemeral PostgreSQL and
does not connect to production.

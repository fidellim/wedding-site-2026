# Venue proportions and approach correction

Owner authorized this pass after reviewing the September 29 walkthrough analysis.
Source: [Shangri-la AD - 29-9-26.MOV](<reference-video/Shangri-la AD - 29-9-26.MOV>).
All numeric values remain modeling estimates pending measurements.

| Requested area | Before | Updated preview |
| --- | --- | --- |
| Approach stairs | Low, straight symmetric seven-riser flights across the canal | Taller thirteen-riser near-bank flight, 2.2 m rise, 0.3 m treads; landing turns onto the deck; no invented matching far-bank flight |
| Walkway | 12 m compressed approach | 36 m default, adjustable 24–72 m; extended ground, resort wall, planting, posts and canal |
| Ceremony area | 18 × 20 m default, width capped by lawn size | 24 × 26 m default, approximately 73% more area, independent width; custom new-format dimensions respected |
| Pavilion/tree connection | About 11 m of roof-to-plaza separation | 6 m default gap, adjustable 5.5–9 m; existing rectangular tree-bed footprint retained |
| Canal continuation | Channel ended near the plaza | Two bends carry the canal behind the ceremony connection and pavilion-side terrace; exact course interpreted from footage and owner's clarification |
| Excess terrace | Broad rectangular inland terrace behind the pavilion | Notched inland edge, smaller pavilion-side forecourt, resort massing moved to follow it |

The canal water is recessed inside the stone bank opening. The shared geometry
feeds 3D and SVG; repeated architectural details remain batched by material.
The optional cocktail fixtures stay on the trimmed terrace and clear of the tree.

Older saved setups receive normalized estimates in the local preview. Records,
table positions, guest assignments and custom landmark coordinates are not
rewritten. Save venue setup persists estimates through the existing action.
The optional server validation migration is prepared and tested but not applied
to production. Existing server validation already accepts additive fields.

The owner requested context for a later drone perspective. This pass creates
only the longer venue geometry and reframes existing presets. No drone feature,
new preset, flight path or animation was added.

## Validation

All 81 tests pass, including bridge/walkway clearance at parameter extremes,
continued canal outside the terrace, compact fixture positions, and old-layout
preview without automatic saves. Production build and SQL safety checks pass.
Ephemeral PostgreSQL tests cover optional estimate limits, legacy revisions,
atomic save/publication/restore and preservation of existing rows and assignments.

Browser review uses the owner's existing private draft with locally upgraded
proportion estimates. Screenshots contain venue geometry; they are not proof of
surveyed dimensions or of a saved/published setup.

- [Approach stairs and longer walkway](proportion-approach.png)
- [Ceremony and pavilion connection](proportion-ceremony.png)
- [Pavilion and continuing canal](proportion-pavilion.png)
- [Matching overhead plan](proportion-plan.png)

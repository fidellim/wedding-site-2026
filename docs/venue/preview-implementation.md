# Private venue preview

The first milestone is accessible in **Admin → Venue preview**, or `/admin/#venue`.
It remains behind the existing production admin boundary. Local development
without Supabase configuration uses the existing demo mode with synthetic data.
There is no guest route, publication action, or database mutation in this module.

## Source and scope

Follow [VENUE_MASTER_SPEC.md](VENUE_MASTER_SPEC.md), revision 1.7. Reference
images clarify appearance only. The model includes the ceremony approach,
canal/timber crossing context, patterned ceremony plaza, lower reception lawn, raised
terrace and stairs, timber pavilion, water, simplified resort massing and
landscaping. The supplied [floor-plan diagram](<reference-images/Floor Plan - Plaza Beach.png>)
establishes zone relationships and the sand strip; it has no scale or measured
dimensions. The video is not a runtime or development dependency.

This is an approximate architectural miniature for review, not a verified event
layout. The temporary HF stage, dance floor, ceremony décor and anonymous ceremony
chairs are included, together with the shared reception table preview. The owner
must approve the event layout before guest use.

## Implementation

- `admin/src/venue/venueModel.ts` owns dimension bounds, normalization, shared
  layout relationships, landmarks, and camera presets. Project Z is up and Y
  points toward water; `venueCoordinates.ts` maps project `(x, y, z)` to scene
  `(x, -y, z)` so the 3D display matches the approved 2D plan. The reception
  lawn stays centered on the origin.
- `buildVenue.ts` builds procedural geometry and small deterministic textures.
  Permanent geometry lives under `VENUE_ROOT`; the `WEDDING_LAYOUT`
  sibling contains the HF stage and dance floor built by `buildStage.ts`, plus
  the temporary décor and instanced chairs built by `buildCeremony.ts`.
- `VenueCanvas.tsx` owns the renderer lifecycle, constrained orbit controls,
  skippable camera transitions, reduced motion, context-loss fallback, and a
  shared-layout SVG plan. Dimension edits rebuild geometry without replacing
  the renderer. Unmounting disposes GPU resources.
- `VenuePreview.tsx` presents the private preview and explicit browser-local
  saving. Estimates are stored under `hf-venue-preview-v2`, normalized when
  loaded, and never written to seating records or published snapshots.

Three.js loads only when this admin section opens. The scene uses no external
model or texture downloads; generated textures are 512 pixels square. Foliage
is merged by material, shadows use a 1024-pixel map, pixel ratio is capped at
1.5, rendering is capped at 30 fps, and offscreen/hidden rendering is paused.
Camera and water motion respect reduced-motion preferences. A device without
WebGL can still use the overhead plan. GLB export can be added later if required;
procedural geometry keeps the present dimensions editable.

The ceremony approach includes one empty, stationary abra before the timber
bridge. Its curved dark wooden hull, benches, four canopy posts and burgundy
canopy follow the owner-supplied photograph and the
[Shangri-La Abu Dhabi gallery](https://www.shangri-la.com/abudhabi/shangrila/photos-videos/).
The bridge has a raised landing, stairs on both banks, sloping handrails,
vertical balusters and timber stringers, following the arrival contact-sheet
frames and `REF-02_narrow-path-timber-structure_018s.jpg`. The opposite-bank
path provides a stair landing. Boat and bridge dimensions, including seven
risers per flight, remain visual approximations. Both appear in the SVG plan.

The ceremony follows the owner's two-panel reference: a straight white aisle
replaces the reference's wavy carpet, leading to a low circular white platform
with an asymmetric white floral ring arch. The arch sits at the water-facing
end of the ceremony plaza, with the existing palms behind it. White floral
clusters flank the aisle and platform. The Ceremony camera shows this arrangement
from the guests' side; Overview and Overhead retain the approved site orientation.

`ceremonyLayout.ts` provides the same anonymous chair positions and rotations to
3D and SVG. Rows follow concentric arcs around the platform, with each chair
turned toward it and a clear straight aisle between the two sides. Chairs have
white fabric covers over their seats and backs, with pleated skirts to the floor.
The count is the sum of accepted RSVP attending headcounts, minus known confirmed
guests marked as requiring no separate seat, clamped per invitation party at zero.
Accepted attendees without completed names remain included. Reception assignments
never determine ceremony chair count, and no ceremony assignment records are
created. Updated workspaces and page reloads recalculate the count. External RSVP
changes depend on the existing repository refresh behavior. Rows widen for larger
counts; overflow is shown explicitly rather than dropping chairs from the count.
All décor dimensions and seating clearances remain approximate.

The implementation uses [Three.js](https://threejs.org/docs/) and its
[OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).

## Temporary estimates, not venue facts

All values below are DESIGN-DECISION placeholders pending FUTURE-CONFIRMATION.
They must not be promoted to measured facts without updating the master spec.
Units are meters except where stated. Slider ranges bound the preview rather
than expressing confidence intervals. The controls expose these values.

| Parameter | Initial estimate |
| --- | ---: |
| Lawn width (X) | 44 |
| Lawn depth (Y) | 16 |
| Sand strip to water | 10 |
| Waterfront edge height | 0.2 |
| Minimum terrace depth | 20 |
| Terrace elevation | 1.2 |
| Stair width | 10 |
| Stair count | 7 |
| Stair tread depth | 0.48 |
| Pavilion diameter | 9 |
| Pavilion post count | 12 |
| Pavilion eave height above floor | 3.3 |
| Pavilion roof rise | 1.8 |
| Pavilion floor above terrace | 0.12 |
| Pavilion setback from terrace front | 2 |
| Plaza width | 18 |
| Plaza depth | 20 |
| Approach path width | 3 |

The rectangular lawn perimeter is a temporary simplification. Pavilion X is
28% of lawn width to the left of the lawn origin; the ceremony/plaza area is
on the right, matching the owner-supplied floor-plan diagram. Plaza width is
capped at 48% of lawn width to preserve the adjacent cocktail area. These placements establish a reviewable composition, not surveyed
positions. The approach extends 12 m behind the terrace in the model. The
terrace expands when needed to contain the pavilion with 2 m of rear clearance;
its control is therefore a minimum depth. It also contains the ceremony plaza depth. Stair rise is terrace elevation
divided by step count; lawn-to-pavilion distance includes stair run and pavilion
setback. Roof overhang, simplified resort dimensions, trees, canal width, and
shoreline detail are visual modeling assumptions in `buildVenue.ts`.

The entrance preset refers to the ceremony approach. It is an elevated camera
view, not a verified walking route. Geographic north is not asserted. Both the SVG plan and standard 3D overview place the waterfront below the
terrace on screen. The explicit display transform does not change saved project
coordinates. Geometry, wedding furniture roots, and projected labels all use
that same transform.

## Validation and limits

Automated checks cover malformed saved estimates, dimension extremes,
stair/terrace/pavilion continuity, camera framing inputs, and WebGL failure.
Browser checks cover desktop and 390-pixel phone layouts, camera presets,
2D/3D switching, and saving/reloading dimensions. Actual phone hardware and
owner venue-recognition approval remain necessary before guest release.

When wedding furniture is added, store draft positions and the venue/layout
revision with the seating snapshot. Publish and restore those atomically with
assignments so private draft changes cannot alter guest views. Name filtering
must remain scoped to the current Invitation Party. Invitation access is deferred.

## Plan-to-scene orientation correction

Changing only the Pavilion camera did not fix the whole-plan mismatch: the 3D
view placed water behind the lawn while the approved 2D plan placed it below.
The renderer now reflects project Y through one explicit coordinate adapter.
Overview and Overhead preserve pavilion upper-left, ceremony upper-right, and
lawn followed by sand/water below. Preset camera targets are rendering-space
positions, and orbit is limited to ±45 degrees around that orientation.

The entrance preset is labeled Entrance and focuses the approach while keeping
the plan orientation. It is not a first-person view from the entrance. The
unchanged 2D plan is the visual reference. Regression checks project landmarks
through the scene transform and camera, testing both horizontal and vertical
ordering. The earlier single-axis tests were insufficient.

## Ceremony landscaping refinement

The ceremony palms now follow the lawn/water-facing plaza margin, based on
video frames 00:48, 01:00 and 01:04. The earlier arrival-side row misinterpreted
“behind the ceremony.” Three spaced date-palm-like trees replace that row and
the overlapping right-side perimeter rows. Their trunks stay to the right of
the stair opening as the approximate dimensions change. Approach palms stop
before the plaza instead of continuing into the ceremony paving.

Counts, heights, and offsets remain estimates. Broad-canopy trees remain in
side landscaping. Feathered palm leaves are merged into one material batch.
The approved architectural plan and its 3D coordinate mapping remain unchanged.

## Video material refinement

The owner-authorized video review is recorded in [video-review.md](video-review.md).
The plaza material now uses a central medallion, approximate starburst rays, and
broad circular bands; the retaining face uses a small procedural stone-block
texture. Neither change adds per-tile or per-block geometry. The video remains
an archival reference and is not imported by the application.


## HF stage preview — September 30, 2026

The owner approved an open platform for speeches and photos at the left edge of
reception, facing the adjacent dance floor. `buildStage.ts` adds temporary event
geometry beneath `WEDDING_LAYOUT`, separate from permanent architecture.

Initial adjustable estimates: platform 8 m wide × 3 m deep × 0.3 m high; backdrop
3 m above the platform; dance floor 8 × 8 m. A centered half-width front step is
0.6 m deep and half the platform height. The platform sits 0.5 m inside the lawn's
left boundary. Stage and dance floor are centered across the lawn depth.
These are design estimates, not surveyed dimensions or construction drawings.

Option 2 / 2A inform the flowing gold rail, hanging crystal-like strands, and
asymmetric pastel flowers with greenery. The ivory HF uses `images/logo-white.webp`. Full-length hanging strands with
warm-white light points continue behind the monogram, matching both references.
Four warm-white butterfly lights sit on slender stems, two per side at staggered
heights. Their reference-inspired silhouettes have tall swept upper wings,
scalloped lower lobes, folded panels, and delicate open wire bodies, without
prominent veins across the glowing surfaces. Florals use curved petals, layered blooms, gold centers, and tapered
leaves, merged by material for interactive review. The Floral detail camera
inspects the upper arrangement. A daylight/dusk toggle changes scene lighting;
butterfly lamps and a soft central stage wash remain illuminated.
The Stage camera faces the backdrop; other presets preserve venue orientation.
The 2D plan shares placement with 3D, and the dimension panel saves these estimates
using the existing browser-local preview mechanism.

## LED alternatives

The Center LED and Side LED controls select temporary event layouts. Both use a
fixed 5 × 3 m visible LED face, a 5.2 m ivory surround, and the ivory HF asset on
a deep burgundy screensaver. The stage camera is identical for both layouts.
Daylight/dusk, other camera presets, and the overhead plan retain the selection.
Only Center LED and Side LED are offered. Layout selection is session-only;
saved dimension estimates retain their existing behavior.

Center LED uses at least an 8 m stage width and a 3.8 m-high floral surround,
reported above the preview. Asymmetric floral columns and upper-corner sprays
frame the screen; light strands remain on its sides. The suspended monogram is
replaced by the on-screen HF. Screen bottom is 0.12 m above the platform.

Side LED retains the existing backdrop and suspended HF. Its frame is 0.8 m
beyond the cocktail-side stage end, on a schematic 5.2 × 1.2 m support footprint. The complete screen assembly
is angled 30° toward reception seating and moved forward to keep its rotated
support within the lawn.
Stage and dance floor shift together toward the beach when needed to leave a
1 m strip at the terrace-side lawn boundary. With the default 16 m lawn depth,
this is approximately a 2.22 m shift. A fit warning appears if the lawn is too shallow to retain
the beach-side margin. Support engineering and real pedestrian clearances still
require venue/AV confirmation; these supports are spatial placeholders.

Comparison images: `led-center-preview.png` and `led-side-preview.png`.


## Ceremony fountain

The dark circular structure visible in REF-04 (00:45) and REF-05 (00:58) is
represented in both 3D and the shared 2D plan near the plaza's water-facing edge,
offset toward the outer ceremony side (+plan X, away from the pavilion). Review
of 00:58–01:02 shows it left of the medallion when facing water, rather than
centered along the plaza edge. Initial placement keeps its base 1.5 m inside
both the water-facing and outer plaza edges; these setbacks are estimates.
Five dark stacked circular tiers use initial estimates of 3 m base diameter and
0.9 m total height, adjustable in Ceremony fountain dimensions. The owner
confirmed on October 4 that this is a fountain. Static water surfaces now fill
the tier basins in 3D and the shared 2D plan. Position and tier count remain
approximate. The visible structure label is removed in both views; the plan
retains an accessible fountain description. No water animation is added.


## Beach-edge stage and waterfront reveal — October 2, 2026

The approved default order toward the water is ceremony, dance floor, HF stage
and backdrop, sand, then waterfront. The stage sits 0.5 m inside the lawn's beach
boundary and is centered along plan X, together with the dance floor. It faces inland (negative
plan Y). Stage cameras, overhead geometry, and browser/server clearance checks
use this orientation. Small lawn estimates that cannot fit both footprints show
the existing dimensions notice.

All perspective presets allow a full 360° drag/swipe orbit; scroll and pinch
still zoom. Overhead retains its fixed top-down orientation. A softly illuminated
geometric interpretation of Sheikh Zayed Grand Mosque sits on the distant shore
behind the stage, with ivory domes and four minarets. It has no map label or
reveal caption, and remains visible in daylight and dusk.

Saved custom landmark coordinates are retained. In Adjust dimensions, use
Center stage at beach edge and Save venue setup to apply the beach-edge positions
to an existing shared draft. Table placements and assignments are preserved.


The Center LED and Side LED buttons now switch the rendered preview immediately.
The 5 × 3 m screen uses a 5.2 m surround and resized support geometry in both 3D
and the overhead plan. Center flowers leave room for the wider face. Both LED
options share a camera that frames the entire side assembly in landscape and
portrait. Opening Adjust dimensions retains the selected LED option, which is
persisted through Save venue setup.

## Video-informed architecture revision — 4 October 2026

Revision 1.8 adds `venueArchitecture.ts` as the shared footprint source for the
terrace outline, split coping walls, raised beds, planters and optional schematic
cocktail fixtures in 3D and SVG. Raised planting frames the plaza/pavilion
connection while the forecourt and stair opening remain clear. Pavilion roof
geometry is rounded, with broad pale counter segments over timber panels.

The new default sand-strip estimate is 3 m (previously 10 m); existing saved
parameters are not overwritten. Adjust dimensions offers a narrower-shoreline
preview and now updates geometry immediately, with Save venue setup remaining
the explicit shared-draft write. Horizontal plaza/pavilion positions are unchanged
pending recognition review rather than inferring a measured gap from footage.

Show cocktail fixtures is session-only, defaults off, and uses schematic volumes
and labels rather than claiming approved event furnishings. The fixtures live in
`WEDDING_LAYOUT`, separate from permanent geometry. Both views use the same
footprints; toggling and rebuilding dimensions retain the current visibility.

The preview explicitly awaits owner venue-recognition review. No guest route or
guest presentation changes were added. See `video-revision-2026-10-04.md` for
source timestamps and remaining assumptions. Earlier rectangular-terrace,
faceted-roof, deferred-fixture and 10 m sand-default descriptions are superseded
by this section; all dimensions remain unverified.


## September 29 walkthrough detail pass — 4 October 2026

Revision 1.9 follows the owner's request to apply the findings from
`Shangri-la AD - 29-9-26.MOV`. The shared architecture helper now defines the
bending approach, canal outline, bridge position and planting strips for 3D and
SVG. The route passes beside the bridge stairs with at least 0.35 m lateral
separation from the modeled stair foot, across supported approach widths.
This is a geometric preview check, not a certified accessibility measurement.

Bridge landing lattice, capped posts and decorative lanterns; canal posts and
sagging chains; stair-side chains; and a cream approach wall improve the arrival
context. The existing illustrative abra remains within the canal and clear of
the relocated bridge. Its presence is inherited from the earlier model, not
asserted by this walkthrough.

Plaza inlays remain circular in world space as plaza width/depth change. The
pavilion has a smoother domed profile with a flared eave, brown procedural roof
ribs, timber upper lattice, dark counter sills and lower panel framing. The separate resort massing
adds an upper arched gallery, cornices and terracotta eaves. The connection tree
bed has pale coping and low groundcover, with an exposed branching trunk and
smaller canopy clusters. Date palms have thicker patterned trunks and fuller
crowns; terrace pots have clustered shrubs. Small wall-light insets follow the
pavilion-side retaining-wall reference.

Repeated architectural details are merged into material batches; paving, palm
bark and roof ribs use generated 512 px textures. Rebuild disposal includes the
cocktail-fixture geometry. This pass changes no seating records or saved layout
coordinates. Existing dimensions remain the inputs to the upgraded geometry.
See [the source review](september29-update-2026-10-04.md) for evidence and limits.


## Owner proportion correction — 4 October 2026

Revision 1.10 replaces the 12 m approach with a 36 m adjustable default and the
low symmetric bridge with a near-bank longitudinal flight turning onto the
raised crossing. Thirteen risers, 0.3 m treads and 2.2 m rise are adjustable
estimates. The stair opening is left clear of the deck rail, and the pedestrian
walkway bypasses the stair footprint. Both SVG and 3D use the same bridge data.

The default ceremony area increases from 18 × 20 m to 24 × 26 m. Its width no
longer depends on 48% of lawn width. Pavilion placement derives from a 6 m
roof-edge-to-ceremony-edge gap rather than a fixed lawn-width fraction. The
connection tree bed retains its 4.5 × 2.6 m footprint. The inland terrace is
notched along the compact connection and cut back behind the pavilion. Canal
water and banks continue around that outline; bank geometry has a water opening
so the channel remains visible. Resort context follows the pavilion-side edge.
Optional cocktail fixture positions remain on the trimmed terrace.

`previewVenueLayout` fills optional estimate fields and enlarges legacy plaza
estimates only for the local preview. Existing table and landmark coordinates
are preserved; no data is saved on load. Saving uses the existing explicit
shared-draft action. New-format customized estimates are preserved on reload.
An additive optional validation migration bounds new values while accepting
old immutable revisions. No production migration was applied during this work.

Existing cameras are reframed to contain the longer site. No new camera preset,
drone control, flight path or animation was created.

The initial 12 m route, seven mirrored bridge risers, lawn-based plaza cap and
wide full-depth pavilion terrace described earlier are superseded by this pass.
See [proportion review and screenshots](proportion-update-2026-10-04.md).

## Curved canal terrace and planting — 4 October 2026

The owner's canal-side photograph clarified that the inland terrace edge must
follow the canal rather than form a square notch. The shared terrace polygon
now uses the venue-side bank contour, including both curved bends. Matching low
stone coping and evenly spaced chain posts follow that edge. A planted ribbon
replaces the straight pavilion-side hedge, with alternating palms and leafy
shade trees along the pavilion bend. The existing connection tree, compact
pavilion spacing, larger ceremony paving and canal course are retained.
Planting placement and dimensions remain visual estimates. Geometry tests cover
the shared contour and dry-land planting at parameter extremes; all 82 tests
and the production build pass. Browser review found no console errors.

- [Updated pavilion and canal planting](canal-contour-pavilion.png)
- [Matching curved terrace in plan](canal-contour-plan.png)

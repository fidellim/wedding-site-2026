# VENUE MASTER SPECIFICATION

**Project:** Interactive 3D Wedding Venue + Guest Seating Experience  
**Document role:** PRIMARY AND AUTHORITATIVE SOURCE OF TRUTH  
**Revision:** 1.7  
**Created:** 21 September 2026  
**Primary source used to author this specification:** user-supplied venue walkthrough video (`shangrila-venue.MP4`, approximately 150.5 seconds)  
**Intended use:** web-based 3D venue reconstruction, wedding-layout visualization, table/seat search, and guest navigation  

---

## 1. Authority of this document

This file is the single working source of truth for the 3D venue project.

The original video is evidence used to create this specification, but developers, coding agents, and 3D artists should **not independently reinterpret the video and override this document**.

When new verified measurements, coordinator drawings, floor plans, or venue information become available, update this document first. Implementation should then follow the updated revision of this document.

### Source priority

1. **`VENUE_MASTER_SPEC.md`** — authoritative.
2. **Owner-supplied floor-plan diagram, `reference-images/Floor Plan - Plaza Beach.png`** — event-zone relationships incorporated below; no scale or verified dimensions.
3. **Labeled reference stills in `reference-images/` (relative to this specification)** — visual clarification only.
4. **Original venue video** — archival evidence and ambiguity resolution only.
5. **Developer/modeler assumptions** — last resort; assumptions must remain parameterized and documented.

If a reference image seems to conflict with this document, follow this document until the document is deliberately revised.

---

All reference-image paths in this document are relative to `docs/venue/`.
The original video is available as archival evidence at
`reference-video/shangrila-venue.MP4`. It is not a runtime/build dependency;
day-to-day work should use this specification and the labeled stills.

## 2. Evidence-status system

Every geometric or visual decision should be treated as one of the following:

- **CONFIRMED-VISUAL** — clearly visible in the supplied video from one or more useful angles.
- **APPROXIMATED-VISUAL** — visible, but exact geometry, size, or position cannot be established reliably from the video.
- **UNKNOWN-DIMENSION** — the feature exists, but its real-world measurement is not known.
- **DESIGN-DECISION** — intentionally chosen for usability, performance, or clarity rather than copied literally from the venue.
- **FUTURE-CONFIRMATION** — must be replaced when a measured plan or venue dimension is supplied.

Do not turn an approximate visual judgment into a fake exact dimension.

---

## 3. Project objective

Create a recognizable, elegant, lightweight 3D representation of the real outdoor waterfront wedding venue that lets guests understand the physical setting and locate their assigned table or seat.

The experience should prioritize:

1. **venue recognition**;
2. **spatial orientation**;
3. **clear wedding seating layout**;
4. **smooth use on mobile phones**;
5. **easy editing of tables and guest assignments**;
6. **visual elegance appropriate for a wedding website**.

The goal is **not** to create a survey-grade architectural digital twin.

---

## 4. Non-goals

Do not spend unnecessary resources on:

- exact unseen building interiors;
- hidden structural construction;
- centimeter-perfect architecture inferred only from perspective footage;
- every paving joint as individual geometry;
- individual 3D grass blades;
- dense botanical simulation;
- physically simulated ocean waves;
- modeling rooms or site areas that guests will never see in the seating experience;
- baking the wedding furniture permanently into the venue mesh.

---

## 5. Project coordinate convention

Use a project-local coordinate system. This is **not a claim about geographic north**.

- **Z+** = vertical/up.
- Place the **origin `(0,0,0)` approximately at the center of the usable wedding lawn**.
- Define **Y+ as the direction from the resort/terrace side toward the waterfront**.
- Define **X+ as the viewer's right when standing on the resort/terrace side and looking toward the waterfront**.

This convention must remain stable so table coordinates do not change if the model is revised.

Do not label Y+ as geographic north unless a verified site plan establishes actual north.

---

# PART A — SITE RECONSTRUCTION

## 6. High-level spatial sequence

**Status: CONFIRMED-VISUAL / APPROXIMATED-VISUAL**

The walkthrough establishes the following experiential sequence:

```text
RESORT / ARRIVAL PATH
        ↓
CANAL-SIDE WALKWAY / TIMBER STRUCTURE
        ↓
LARGE PATTERNED PAVED PLAZA
        ↓
WATERFRONT EVENT ZONE
        ↓
MAIN GRASS LAWN
        ↔
RAISED TERRACE + TIMBER PAVILION
        ↓
OPEN WATERFRONT
```

For the web experience, the most important area is the relationship between:

```text
RESORT / TERRACE SIDE
        ↓
PAVILION + BROAD STEPS
        ↓
MAIN EVENT LAWN
        ↓
WATERFRONT
```

This relationship must remain visually legible from the default camera.

---

### Event-use clarification (owner-confirmed)

The early arrival/walkway area shown in the reference sequence is the entrance
and approach toward the ceremony. The lower main lawn is the reception area.
This establishes event use, not an exact ceremony footprint, entrance coordinate,
or verified walking route. Those details remain unconfirmed.

### Floor-plan relationship update (21 September 2026)

Source: [Floor Plan - Plaza Beach.png](<reference-images/Floor Plan - Plaza Beach.png>),
supplied by the owner as an additional floor-plan reference. This is a labeled
schematic with no scale bar or numeric dimensions. The following relationships
are adopted into this specification; exact coordinates remain approximate.

With the resort/arrival side above and the beach below in the drawing:

- The pavilion/bar and cocktail-hour zone occupy the left upper part of the site.
- The ceremony zone is adjacent on the right, with the welcome sign toward its
  arrival side. The ceremony approach leads toward this zone.
- The reception lawn extends across the site below both upper zones.
- Broad stairs lie along the lawn/terrace transition near the boundary between
  cocktail and ceremony zones.
- A visible strip labeled SAND separates the lawn from the BEACH side. Include
  a parameterized sand/beach strip before the water, rather than placing the
  water directly against the lawn. Exact shoreline and edging remain unknown.
- The stage at the left of the reception and adjacent dance floor are temporary
  wedding-layout elements. The welcome sign, guest book, photobooth, coffee and
  drinks stand, Pinkberry stand, and seat signage are also event fixtures, not
  permanent architecture. Record them for the subsequent furniture milestone.

In project coordinates, map drawing-right to X+ and beachward to Y+. This is a
local orientation convention, not geographic north. The pavilion therefore
sits on the X-negative side and ceremony/paved-plaza context on the X-positive
side of the lawn. The exact correspondence between the patterned paving seen
in the stills and the ceremony polygon is APPROXIMATED-VISUAL; do not treat the
colored overlay as a surveyed paving boundary.

### Display orientation agreement (owner correction)

The website's 2D plan is the approved visual arrangement. In the standard 3D
Overview and Overhead views, retain the same arrangement: pavilion/cocktail area
upper-left, ceremony upper-right, reception lawn below both, then sand and water
at the bottom. Do not use a camera reversal to compensate for a mirrored scene.

Keep stored/project coordinates stable. Because the plan's Y axis grows down
on screen, use one explicit display transform `(x, y, z) → (x, -y, z)` when
placing project geometry in the rendering scene. Apply it consistently to
permanent geometry, future wedding furniture, and projected labels. Camera
presets are specified in rendering coordinates. This is a DESIGN-DECISION for
matching the approved plan, not a new physical venue fact or a geographic axis.
The entrance preset focuses the approach while retaining the plan orientation;
it is not a first-person view looking from the entrance toward the water.

The initial venue preview must reflect these relationships. It may show named
event zones without baking temporary furniture into the venue. A scaled venue
plan and approved furniture positions are still required for accurate seating.

## 7. Arrival / approach zone

**Status: CONFIRMED-VISUAL for character; APPROXIMATED-VISUAL for exact layout**  
**Primary references:** REF-01, REF-02, REF-03

Visible characteristics:

- pale beige / warm natural-stone walking surfaces;
- landscaped resort setting;
- cream/beige resort walls and façades;
- palms and low planting;
- turquoise/blue-green canal-like water adjacent to the pedestrian route;
- dark timber pedestrian/bridge/stair elements;
- dark traditional-style lamp posts along parts of the route;
- narrow path segments between architecture, planting, and timber structure.

### Modeling requirement

The approach zone is contextual rather than central. Simplify it aggressively if necessary for web performance.

Do not let it consume more geometry or texture budget than the lawn, terrace, pavilion, or seating area.

### Recommended representation

- simplified resort wall masses;
- a narrow stone path;
- simplified canal surface;
- one recognizable dark timber bridge/stair form;
- a few palms, planting strips, and lamp-post silhouettes.

---

## 8. Patterned paved plaza

**Status: CONFIRMED-VISUAL**  
**Primary references:** REF-04, REF-05

A large open paved plaza acts as a visual transition before the lawn/waterfront area.

Visible characteristics:

- broad open area;
- warm beige, pink-beige, brown, and gray stone tones;
- a central circular medallion with a prominent starburst/sunburst motif and
  broad contrasting circular bands (video 00:48–01:00);
- the exact number of rays and tile dimensions remain approximated;
- palms placed around/near the plaza;
- waterfront visible beyond portions of the plaza;
- open resort landscape rather than an enclosed courtyard.

### Modeling requirement

Do **not** model each paving stone individually.

Represent the paving through one or more optimized materials/textures, optionally with a very low-relief normal map.

The overall pattern is more important than exact tile-by-tile reproduction.

Object name:

```text
PLAZA_PATTERNED
```

---

## 9. Main wedding lawn

**Status: CONFIRMED-VISUAL for existence, character, adjacency; APPROXIMATED-VISUAL for exact perimeter and dimensions**  
**Primary references:** REF-06, REF-07, REF-08, REF-14

The lawn is the primary wedding-event surface and the most important interactive area in the project.

Visible characteristics:

- broad flat green grass area;
- long open relationship with the waterfront;
- hardscape/terrace at the resort side;
- pavilion visible from the lawn;
- mature trees and resort landscaping around portions of the perimeter;
- lawn is substantially more open than the arrival zones;
- the waterfront provides a strong visual horizon.

### Geometry rules

Create the lawn as a **separate clean mesh**:

```text
VENUE_LAWN
```

It must support dynamic placement of:

- tables;
- chairs;
- stage;
- aisle;
- dance floor;
- decorative objects;
- table labels and interaction markers.

Do not bake furniture into `VENUE_LAWN`.

### Surface treatment

Use a realistic real-time grass material using:

- color texture variation;
- normal mapping;
- subtle roughness variation;
- optional lightweight macro variation.

Do not use dense 3D grass blades for the website version.

### Perimeter

Preserve the visible logic of lawn → waterfront and lawn → raised terrace/pavilion. Exact perimeter corners remain FUTURE-CONFIRMATION until a plan or dimensions are supplied.

---

## 10. Waterfront

**Status: CONFIRMED-VISUAL for presence and appearance; APPROXIMATED-VISUAL for exact shoreline geometry**  
**Primary references:** REF-06, REF-07, REF-13, REF-14

The waterfront is one of the strongest recognition/orientation features in the venue.

Visible characteristics:

- calm blue to blue-green water;
- low wave activity;
- bright open sky;
- distant shoreline/buildings visible across the water;
- occasional boat/marina context;
- pale stone edging/walls at portions of the venue boundary;
- uninterrupted open horizon over substantial portions of the lawn edge.

### Modeling requirement

Use lightweight animated real-time water.

Recommended techniques:

- scrolling normal maps;
- subtle reflection/refraction;
- low-amplitude vertex displacement only if inexpensive;
- environment reflection.

Do not use expensive fluid simulation.

Objects:

```text
WATER_SURFACE
WATERFRONT_EDGE
```

The water should remain visually recognizable from the default overview camera.

---

## 11. Raised terrace

**Status: CONFIRMED-VISUAL; dimensions UNKNOWN**  
**Primary references:** REF-08, REF-09, REF-10, REF-15

A raised hardscape terrace sits on the resort/pavilion side of the event lawn.

Visible characteristics:

- warm beige/pink-beige natural stone paving;
- terrace is visibly above lawn grade in at least part of the site;
- pale, visibly textured stone-block retaining faces with irregular joints
  (video 01:36–01:56);
- broad paved circulation around the pavilion;
- mature landscaping nearby;
- strong visual connection to both lawn and water.

Object:

```text
TERRACE_MAIN
```

Do not invent the exact terrace elevation. Define it as a parameter until measured.

---

## 12. Broad stairs between lawn and terrace

**Status: CONFIRMED-VISUAL; exact rise/run/width UNKNOWN**  
**Primary reference:** REF-09

A broad set of shallow stone steps connects levels near the lawn/terrace zone.

Visible characteristics:

- multiple wide shallow steps;
- light/warm stone finish;
- horizontal rhythm is visually stronger than vertical rise;
- dark timber/wood railing or edge structure is visible along at least one side in the reference view;
- stairs are broad enough to read as an architectural transition rather than a narrow domestic stair.

Object:

```text
STAIRS_MAIN
```

### Parameterize

```text
STAIR_TOTAL_WIDTH
STAIR_TOTAL_RISE
STAIR_COUNT
STAIR_TREAD_DEPTH
STAIR_RISER_HEIGHT
```

Do not derive fake precision from the video.

---

## 13. Timber pavilion / gazebo

**Status: CONFIRMED-VISUAL for form/material/position; exact polygon count and dimensions APPROXIMATED**  
**Primary references:** REF-08, REF-10, REF-11, REF-12, REF-13

The pavilion is a major venue landmark and should receive more modeling attention than background resort architecture.

### Location relationship

The pavilion sits on the paved/raised terrace adjacent to the main lawn and has direct views toward the waterfront.

### Visible characteristics

- open-sided pavilion/gazebo;
- approximately circular or multi-sided/polygonal plan;
- dark reddish-brown / mahogany-toned timber;
- repeated vertical support posts;
- continuous lower perimeter/counter/railing treatment;
- deep roof overhang;
- broad low-pitched polygonal/faceted roof form;
- shaded interior;
- stone-paved exterior terrace surrounding it;
- waterfront visible directly from/through the pavilion.

### Important visual clarification

Light-colored domed resort architecture is visible behind/near the pavilion in some views. Do **not** automatically merge that white/light dome into the pavilion roof. Treat the pavilion as the dark-timber roofed structure shown clearly in REF-10 through REF-13.

### Required hierarchy

```text
PAVILION_ROOT
    PAVILION_COLUMNS
    PAVILION_LOWER_PERIMETER
    PAVILION_RAILING_OR_COUNTER
    PAVILION_ROOF
    PAVILION_FLOOR
    PAVILION_INTERIOR_SIMPLE
```

### Modeling priority

From a distance the silhouette must read correctly:

1. wide low roof;
2. dark timber material;
3. rhythmic support posts;
4. open sides;
5. polygonal/circular overall footprint;
6. strong terrace/water relationship.

Interior detailing should remain restrained unless later required.

### Unknown parameters

```text
PAVILION_OUTER_DIAMETER
PAVILION_COLUMN_COUNT
PAVILION_COLUMN_HEIGHT
PAVILION_ROOF_EAVE_HEIGHT
PAVILION_ROOF_PEAK_HEIGHT
PAVILION_FLOOR_LEVEL
```

---

## 14. Resort architecture

**Status: CONFIRMED-VISUAL for architectural language; APPROXIMATED-VISUAL for exact geometry**  
**Primary references:** REF-01, REF-02, REF-08, REF-10

Visible architectural language includes:

- warm cream/beige/sand-colored exterior walls;
- resort-scale massing;
- arched openings in some façades;
- traditional/Middle Eastern-inspired details;
- parapets and decorative roofline features;
- occasional light-colored domed roof elements;
- warm/red/brown roof accents in some areas;
- natural-stone base or retaining elements;
- palms integrated into the resort landscape.

### Modeling requirement

These buildings exist primarily to make the venue recognizable.

Use simplified massing, low/medium polygon counts, and texture/baked-detail solutions.

Do not create unseen interiors.

Objects may be grouped under:

```text
RESORT_BACKGROUND
```

---

## 15. Landscaping

**Status: CONFIRMED-VISUAL for type/presence; APPROXIMATED-VISUAL for exact count and species**

Visible landscape types include:

- tall date-palm-like palms;
- mature broad-canopy trees;
- clipped/trimmed hedges;
- low shrub planting;
- planted edges beside paths;
- stone or hardscape planters in some areas;
- grass lawn;
- tree shade falling over paving.

### Palms behind the ceremony area

Owner clarification, 22 September 2026, using REF-05 alongside REF-04: the
prominent trees at the back of the patterned ceremony area are date-palm-like,
with tall exposed trunks and full crowns of arching, feathered fronds. Place
this palm grouping along the back perimeter of the ceremony area rather than
as a broad-canopy cluster intruding into the patterned plaza near the stairs.
This supersedes the earlier preview's interpretation of the ceremony cluster.

REF-04 still supports broad-canopy shade trees in the surrounding landscape;
those do not replace the palms at the ceremony backdrop. Palm character and
presence are CONFIRMED-VISUAL; the location behind the ceremony is owner-confirmed.
Exact species, count, dimensions, and spacing remain APPROXIMATED-VISUAL.
Keep the ceremony paving, approach opening, stair treads, and landing clear.

### Ceremony tree placement clarification

Frames 00:48, 01:00 and 01:04 show the prominent palm trunks along the
water-facing plaza boundary, with water visible behind them. “Behind the
ceremony” must not be interpreted as the arrival-side edge of the plan.
For this approximate preview, place the palm grouping at the terrace's
lawn/water-facing ceremony margin, to the right of the stair opening. Remove
the duplicate right-side perimeter rows and arrival-side ceremony row. Keep
broad-canopy trees in side landscaping, distinct from the palm backdrop.
This boundary mapping is a modeling interpretation of the video, not surveyed
tree coordinates; use three spaced palms as an approximate composition.
Maintain trunk clearance from the stair opening as dimensions change.

### Video cross-check (22 September 2026)

Review of timestamped video frames confirms date-palm-like crowns around the
plaza (00:36–01:00), with broad-leaf trees in side planting beds and beside the
terrace/stairs (01:04–01:08 and 01:48). These are distinct landscaping types;
do not replace all shade trees with palms. The video does not establish surveyed
tree coordinates or a new event layout. Preserve the owner's approved plan and
ceremony-backdrop interpretation. See [video-review.md](video-review.md).

### Web modeling rules

Use optimized assets:

- LOD trees;
- instancing;
- alpha-card foliage where useful;
- low-poly trunks;
- simplified hedges;
- baked AO where possible.

Trees may be shifted slightly if needed to prevent obstruction of the primary seating-map camera, but such shifts are a DESIGN-DECISION and should remain visually plausible.

Group:

```text
LANDSCAPING
    PALMS
    SHADE_TREES
    HEDGES
    SHRUBS
    PLANTERS
```

---

# PART B — MATERIAL AND LIGHTING LANGUAGE

## 16. Material palette

### 16.1 Paving / stone

**Status: CONFIRMED-VISUAL**

Primary palette:

- warm beige;
- muted pink-beige;
- tan;
- light brown;
- occasional gray-brown variation.

Finish should appear natural and slightly varied, not glossy marble.

Use normal/roughness variation rather than heavy geometry.

### 16.2 Timber

**Status: CONFIRMED-VISUAL**

Pavilion and timber structures use a dark warm reddish-brown / mahogany-like appearance.

Target characteristics:

- satin-to-matte wood;
- visible but restrained grain;
- deep warm brown tone;
- not black;
- not bright orange/red.

### 16.3 Resort walls

Warm cream/sand/beige plaster or stucco-like finish.

### 16.4 Water

Blue to blue-green, calm, bright, reflecting the sky.

### 16.5 Grass

Natural medium green with slight dry/bright variation visible under strong sun.

---

## 17. Lighting and atmosphere

**Status: CONFIRMED-VISUAL for source-video look; DESIGN-DECISION for final website presentation**

The video was recorded in strong bright daylight with clear sky and hard-to-medium shadows.

For the website, preserve the bright outdoor character but soften it slightly for elegance and readability.

Recommended default:

- warm late-afternoon-like sun rather than harsh midday glare;
- clean blue sky;
- soft-to-medium directional shadows;
- enough ambient fill to keep pavilion interior readable;
- restrained contrast;
- no heavy cinematic fog;
- no dramatic night lighting as the default experience.

Optional later feature: day/evening toggle, but it is not required for the first release.

---

# PART C — PARAMETRIC DIMENSIONS

## 18. Dimension policy

At Revision 1.0, the video is sufficient for visual reconstruction but **not for exact physical dimensions**.

All important measurements must therefore be implemented as parameters.

### Parameters requiring future confirmation

```text
LAWN_LENGTH
LAWN_WIDTH
LAWN_PERIMETER_PROFILE
TERRACE_ELEVATION_ABOVE_LAWN
TERRACE_WIDTH
STAIR_TOTAL_WIDTH
STAIR_TOTAL_RISE
STAIR_COUNT
PAVILION_OUTER_DIAMETER
PAVILION_FLOOR_LEVEL
WATERFRONT_EDGE_HEIGHT
DISTANCE_LAWN_TO_WATER_EDGE
DISTANCE_PAVILION_TO_LAWN
APPROACH_PATH_WIDTH
PLAZA_WIDTH
PLAZA_LENGTH
```

### Dimension update rule

When a verified measurement becomes available:

1. update it in this file;
2. increment document revision;
3. adjust dependent geometry parametrically;
4. do not manually distort unrelated geometry to compensate.

---

# PART D — WEDDING LAYOUT SYSTEM

## 19. Venue and wedding layout must remain separate

This is a mandatory architecture rule.

```text
VENUE = permanent architecture + landscape
WEDDING_LAYOUT = temporary event furniture + guest data
```

Changing a seating arrangement must **not** require remodelling or re-exporting the venue.

The venue model should be reusable for alternate table arrangements.

---

## 20. Required modular wedding assets

Create reusable assets rather than unique duplicated meshes.

Recommended asset IDs:

```text
TABLE_ROUND
TABLE_RECTANGULAR
CHAIR_STANDARD
CHAIR_COUPLE
STAGE
DANCE_FLOOR
AISLE_MARKER
ARCH_OR_BACKDROP
TABLE_NUMBER_MARKER
DECOR_PLACEHOLDER
```

Use instancing for chairs and repeated tables.

---

## 21. Table and chair naming convention

Every table must have a stable ID:

```text
TABLE_01
TABLE_02
TABLE_03
...
```

Optional individual chair IDs:

```text
CHAIR_TABLE01_01
CHAIR_TABLE01_02
CHAIR_TABLE01_03
...
```

Do not derive guest identity from visible mesh names. Guest data should remain in JSON/application data.

---

## 22. Wedding-layout data model

Recommended runtime data format:

```json
{
  "layoutVersion": "1.0",
  "tables": [
    {
      "id": "TABLE_01",
      "label": "Table 1",
      "type": "round",
      "position": [0.0, 0.0, 0.0],
      "rotationZ": 0,
      "seats": [
        {
          "seat": 1,
          "guestId": "G001",
          "guestName": "Guest Name"
        }
      ]
    }
  ]
}
```

Coordinates use the project coordinate convention defined in Section 5.
`rotationZ` is the table heading about the vertical Z axis, expressed in radians.

---

# PART E — GUEST INTERACTION

## 23. Default guest experience

When the 3D scene loads, show an elevated three-quarter overview containing as many of these as practical:

- main lawn;
- wedding tables;
- pavilion;
- waterfront;
- key surrounding landscaping;
- enough resort context for recognition.

The user should immediately understand where the event is taking place.

Avoid beginning inside the pavilion or at human-eye first-person level.

---

## 24. Required controls

Support:

- rotate/orbit;
- zoom;
- limited pan;
- reset view;
- touch gestures on mobile;
- mouse interaction on desktop.

Restrictions:

- prevent camera from going under the ground;
- prevent excessive zoom-out into empty space;
- prevent extreme clipping through buildings/trees;
- use sensible orbit limits.

---

## 25. Camera presets

Recommended preset names:

```text
OVERVIEW
FROM_ENTRANCE
PAVILION
WATERFRONT
SEATING_OVERVIEW
RESET
```

A `FIND_MY_TABLE` action is data-driven rather than a fixed camera preset.

All camera transitions should interpolate smoothly.

---

## 26. Find-my-table behavior

Provide a guest-name search field.

When a valid guest is selected:

1. locate the guest assignment;
2. highlight the assigned table;
3. optionally dim unrelated tables slightly;
4. smoothly move/orbit camera to a useful viewing angle;
5. show guest name and table number;
6. if individual chairs are assigned, highlight the correct chair;
7. provide a clear reset/back-to-overview action.

Example display:

```text
Guest Name
Table 06
Seat 04
```

Do not expose the full guest database unnecessarily when search suggestions can be handled privately/server-side if privacy becomes a concern.

---

## 27. Table interaction

### Hover / focus

- subtle highlight;
- reveal table number;
- avoid aggressive glow.

### Click / tap

- focus camera on table;
- show table label;
- optionally show guest names if the couple chooses to make them visible.

Use enlarged invisible hit areas so mobile tapping is forgiving.

---

# PART F — WEB 3D TECHNICAL REQUIREMENTS

## 28. Preferred delivery format

Preferred model format:

```text
GLB / glTF 2.0
```

Preferred website technologies may include:

- Three.js;
- React Three Fiber;
- Babylon.js;
- `<model-viewer>` for a simpler non-custom experience.

Three.js / React Three Fiber is preferred when implementing guest search, custom highlights, and camera animation.

---

## 29. Performance targets

The experience must work well on modern phones.

Recommended targets for first load:

- venue GLB ideally **5–15 MB**;
- preferably keep total core 3D payload below **20 MB** before optional high-resolution assets;
- compressed textures;
- shared materials;
- instanced repeated furniture;
- minimal draw calls;
- LOD vegetation;
- no unnecessarily high-resolution geometry.

Use:

- Meshopt and/or Draco where appropriate;
- KTX2/Basis textures;
- baked ambient occlusion;
- texture atlases when helpful;
- lazy loading for nonessential distant assets.

---

## 30. Suggested scene hierarchy

```text
VENUE_ROOT
│
├── SITE
│   ├── VENUE_LAWN
│   ├── TERRACE_MAIN
│   ├── STAIRS_MAIN
│   ├── PLAZA_PATTERNED
│   ├── APPROACH_PATHS
│   └── RETAINING_AND_EDGE_WALLS
│
├── WATERFRONT
│   ├── WATER_SURFACE
│   └── WATERFRONT_EDGE
│
├── PAVILION_ROOT
│   ├── PAVILION_COLUMNS
│   ├── PAVILION_LOWER_PERIMETER
│   ├── PAVILION_RAILING_OR_COUNTER
│   ├── PAVILION_ROOF
│   ├── PAVILION_FLOOR
│   └── PAVILION_INTERIOR_SIMPLE
│
├── RESORT_BACKGROUND
│
├── LANDSCAPING
│   ├── PALMS
│   ├── SHADE_TREES
│   ├── HEDGES
│   ├── SHRUBS
│   └── PLANTERS
│
├── ARRIVAL_CONTEXT
│   ├── CANAL
│   ├── TIMBER_BRIDGE_OR_STAIR
│   └── LAMP_POSTS
│
└── WEDDING_LAYOUT
    ├── TABLES
    ├── CHAIRS
    ├── STAGE
    ├── DANCE_FLOOR
    ├── AISLE
    ├── DECOR
    └── INTERACTION_MARKERS
```

---

# PART G — VISUAL STYLE

## 31. Final visual direction

The website should feel:

- elegant;
- warm;
- premium;
- romantic without becoming ornate;
- realistic but not hyper-photorealistic;
- clean enough that the seating information remains easy to read;
- recognizably based on the real venue.

Avoid:

- cartoon rendering;
- obvious videogame UI styling;
- raw CAD appearance;
- heavy outlines;
- excessive bloom;
- dark moody lighting as the default;
- oversaturated greens/blues;
- unrealistic glossy stone;
- extreme depth of field that obscures tables.

Think of the scene as an **interactive architectural wedding miniature** rather than a game level.

---

# PART H — RECONSTRUCTION RULES

## 32. What may be approximated

The following may be visually approximated until measurements exist:

- exact lawn dimensions;
- exact pavilion diameter;
- exact terrace elevation;
- exact stair count/dimensions if the footage does not resolve them;
- exact tree count and species;
- distant building geometry;
- distant shoreline detail;
- small planter positions;
- paving seam details.

Approximation must preserve the observed spatial relationships.

---

## 33. What should not be invented

Do not invent prominent:

- permanent stages;
- walls blocking the waterfront;
- additional pavilions in the main lawn;
- pools in the event lawn;
- large sculptures;
- bridges across the waterfront;
- permanent wedding arches;
- permanent table/furniture arrangements;
- enclosed pavilion walls;
- interior resort rooms not shown or needed.

Wedding décor is part of `WEDDING_LAYOUT`, not permanent venue architecture.

---

## 34. Proportion rules when dimensions are unknown

If the modeler must proceed before measured dimensions are available:

1. establish a temporary human-scale reference of 1.70 m;
2. use visible stair, railing, door, chair, or parapet proportions only as broad scale cues;
3. keep unknown values in named parameters;
4. avoid destructive mesh edits that make later scaling difficult;
5. prefer parented modular components;
6. document any temporary numeric values separately from confirmed dimensions.

The temporary numbers are implementation placeholders, not venue facts.

---

# PART I — REFERENCE IMAGE INDEX

## 35. Labeled references

These images are extracted from the supplied video and are intended to clarify this specification.

| Ref | Timestamp | File | Use |
|---|---:|---|---|
| REF-01 | 00:05 | `reference-images/REF-01_arrival-walkway_005s.jpg` | landscaped resort approach, paving, palms |
| REF-02 | 00:18 | `reference-images/REF-02_narrow-path-timber-structure_018s.jpg` | narrow path and dark timber structure near resort wall |
| REF-03 | 00:32 | `reference-images/REF-03_canal-approach_032s.jpg` | canal-side route and arrival character |
| REF-04 | 00:45 | `reference-images/REF-04_plaza-entry_045s.jpg` | transition into patterned plaza |
| REF-05 | 00:58 | `reference-images/REF-05_patterned-plaza_058s.jpg` | strongest plaza paving-pattern reference |
| REF-06 | 01:12 | `reference-images/REF-06_lawn-transition-waterfront_072s.jpg` | transition toward waterfront/event area |
| REF-07 | 01:26 | `reference-images/REF-07_main-lawn-waterfront_086s.jpg` | open lawn and waterfront horizon |
| REF-08 | 01:44 | `reference-images/REF-08_lawn-toward-pavilion_104s.jpg` | lawn-to-pavilion/resort relationship |
| REF-09 | 01:48 | `reference-images/REF-09_broad-stairs_108s.jpg` | broad stair geometry and terrace transition |
| REF-10 | 02:00 | `reference-images/REF-10_pavilion-frontal_120s.jpg` | pavilion full frontal form |
| REF-11 | 02:04 | `reference-images/REF-11_pavilion-close_124s.jpg` | pavilion timber structure and proportions |
| REF-12 | 02:08 | `reference-images/REF-12_pavilion-interior_128s.jpg` | posts, roof underside, lower perimeter/interior |
| REF-13 | 02:12 | `reference-images/REF-13_pavilion-to-water_132s.jpg` | pavilion-to-water sightline |
| REF-14 | 02:20 | `reference-images/REF-14_lawn-waterfront-from-terrace_140s.jpg` | lawn/waterfront relationship from raised side |
| REF-15 | 02:26 | `reference-images/REF-15_reverse-terrace-view_146s.jpg` | reverse terrace/paving/landscape context |

Contact sheets are also supplied for quick browsing:

```text
reference-images/REF-CONTACT-SHEET_site.jpg
reference-images/REF-CONTACT-SHEET_pavilion-terrace.jpg
```

---

# PART J — IMPLEMENTATION SEQUENCE

## 36. Recommended build order

### Phase 1 — blocking

1. establish coordinate system;
2. create approximate lawn plane;
3. create terrace level;
4. create waterfront plane/edge;
5. block stairs;
6. block pavilion silhouette;
7. add simplified resort masses;
8. test default camera.

### Phase 2 — visual identity

1. refine pavilion;
2. refine paving/terrace;
3. create plaza pattern;
4. add major trees/palms;
5. add water material;
6. establish lighting;
7. compare against reference images.

### Phase 3 — wedding functionality

1. add table/chair instancing;
2. implement layout JSON;
3. implement table selection;
4. implement guest search;
5. implement camera focus/highlighting;
6. test mobile interaction.

### Phase 4 — optimization

1. compress textures;
2. merge static background meshes where beneficial;
3. reduce draw calls;
4. add vegetation LOD;
5. compress GLB;
6. performance-test on a real phone.

### Phase 5 — accuracy pass

When real dimensions/floor plan are supplied:

1. update this specification;
2. recalibrate the lawn;
3. recalibrate terrace/stairs/pavilion;
4. reposition wedding furniture from normalized/project coordinates;
5. rerun camera and collision tests.

---

# PART K — ACCEPTANCE CRITERIA

## 37. Venue-recognition acceptance test

The reconstruction is acceptable when a person familiar with the venue can identify the setting from the 3D scene using the combined presence of:

- waterfront lawn;
- raised terrace;
- dark timber pavilion;
- warm resort architecture;
- patterned paving;
- palms and mature landscaping;
- water horizon.

Exact minor paving seams are not an acceptance criterion.

---

## 38. Seating-function acceptance test

The project is acceptable for seating use when:

- every table has a stable ID;
- guest assignments can be updated without editing the venue mesh;
- a guest can search their name;
- the correct table is highlighted;
- camera movement to the table is smooth;
- all tables are legible on mobile;
- the overview can be restored easily;
- scene performance remains comfortable on a modern mobile phone.

---

## 39. Data-change acceptance test

Changing `WEDDING_LAYOUT` should not require:

- re-exporting permanent architecture;
- remodeling the lawn;
- changing pavilion geometry;
- altering water/landscape geometry.

Only runtime furniture/data positioning should change.

---

# PART L — OPEN ITEMS FOR FUTURE CONFIRMATION

## 40. High-value measurements to request

The following would materially improve accuracy:

1. usable lawn length;
2. usable lawn width;
3. distance from lawn edge to waterfront wall/edge;
4. pavilion outer diameter/width;
5. distance between pavilion and nearest lawn edge;
6. terrace height above lawn;
7. main stair width and number of risers;
8. planned table diameter or dimensions;
9. planned aisle width;
10. stage/dance-floor dimensions;
11. venue/coordinator seating-layout drawing if available.

One or two reliable dimensions can be used to recalibrate the entire visual blockout, but they must first be recorded here before being treated as authoritative.

---

# PART M — INSTRUCTIONS TO ANY AI CODING OR 3D AGENT

## 41. Mandatory agent instruction

Use the following instruction at the start of any implementation task:

```text
Build and modify the 3D wedding venue strictly according to
docs/venue/VENUE_MASTER_SPEC.md.

docs/venue/VENUE_MASTER_SPEC.md is the authoritative source of truth.

Reference images are visual clarification only. Do not independently reinterpret
the original video in a way that conflicts with the master specification.

Never invent exact physical dimensions that are marked unknown. Keep unknown
measurements parameterized so they can be replaced when confirmed venue data
becomes available.

Keep permanent venue geometry separate from the wedding seating/furniture
system. Seating data must remain editable without rebuilding the venue.

Optimize all decisions for a responsive mobile web experience while preserving
the recognizable pavilion, lawn, terrace, waterfront, paving, resort, and
landscape relationships defined in the master specification.
```

---

## 42. Change-control note

Whenever a physical fact changes or becomes confirmed, add a revision entry below.

### Revision history

| Revision | Date | Change |
|---|---|---|
| 1.0 | 2026-09-21 | Initial venue specification derived from supplied walkthrough video; labeled reference set created. |
| 1.7 | 2026-09-22 | Clarified ceremony palms on the water-facing plaza margin from video; removed duplicate perimeter rows and kept stair clearance. |
| 1.6 | 2026-09-22 | Reviewed supplied archival video: clarified starburst plaza paving, textured retaining stone, and palm versus shade-tree character; documented timestamps without changing the approved site layout. |
| 1.5 | 2026-09-22 | REF-05 and owner clarification refine the ceremony backdrop to tall date-palm-like trees along its back edge, superseding the earlier broad-canopy cluster. |
| 1.4 | 2026-09-22 | Owner clarification from REF-04: mature shade trees and palms behind the ceremony area near the stairs; exact placement and count remain approximate. |
| 1.3 | 2026-09-21 | Owner correction: 3D must match the approved 2D plan on both axes; introduced an explicit plan-to-scene display transform without changing project coordinates. |
| 1.2 | 2026-09-21 | Incorporated owner-supplied floor-plan schematic: pavilion/cocktail left, ceremony right, reception lawn below both, sand strip before beach; dimensions remain unverified. |
| 1.1 | 2026-09-21 | Relocated resource pack to docs/venue; recorded owner clarification of ceremony approach and reception lawn; corrected example table heading to use the established Z-up convention. |

---

**END OF AUTHORITATIVE VENUE MASTER SPECIFICATION**

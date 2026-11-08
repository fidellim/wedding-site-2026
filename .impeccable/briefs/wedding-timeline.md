# Wedding day timeline

Mode: Read. Local extension of the existing invitation; approved reference and schedule supplied by the user.

## Direction contract

THESIS: A five-moment illustrated wedding timetable replaces the RSVP section visually. A continuous fine line and ring milestones connect the day without cards.

OWN-WORLD: Supplied warm beige background and brown transparent illustrations; existing Pinyon Script heading, Cormorant SC times, and Questrial event labels. Burgundy linework joins the invitation palette.

STORY: Guests follow arrival, ceremony, mingling, reception, and farewell in chronological order. The hero links directly to the schedule.

FIRST VIEWPORT: Centered calligraphic title above five equal desktop columns. Each moment has an illustration, time, ring marker, and label. Phones use one vertical route with illustrations left and text right.

FORM: User-pinned reference, no concept seed. Preserve later section colors by replacing the RSVP section element with a hidden inert container. Hide the RSVP deadline FAQ and preserve stored responses and existing form logic.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Content and assets

Confirmed: 2:30 PM Guest Arrival; 3:00 PM Ceremony; 4:30 PM Sips, Swirls & Mingling; 6:30 PM Reception; 9:30 PM Thank You!

All artwork was supplied by the user in images/timeline/*.png. WebP derivatives preserve transparency and original icon dimensions; the background may be downsampled. No generated artwork or added claims.

## Finish review

Verdict: implemented within the incumbent invitation; no visual-system replacement or DESIGN.md rewrite. Desktop uses five connected columns; below 760px the line becomes vertical. Time and event text remain live HTML in an ordered list, illustrations are decorative, and the hero has an explicit focus style. Existing reduced-motion reveal behavior is retained.

Assets: all five WebP icon derivatives verified pixel-identical to source RGBA pixels. Background reduced from 2000×1410 PNG to 1600×1128 WebP and inspected; no wash added. Combined image payload reduced from 243,921 to 23,894 bytes (90.2%). Original user artwork retained.

Verification: production build, 27 invitation tests, source DOM checks for schedule/hidden controls/link destination and unchanged later section order. Browser access host unavailable; desktop/mobile screenshots and rendered layout inspection could not be completed. Unrelated pre-existing type findings (1.25/1.28 leading, 10.4px year text, 0.08em tracking, and the existing heading skip) remain unchanged; no new ignores added.

## Confirmed refinements

The mobile spine is centered between equal columns. Times use Cormorant SC at 20–24px with old-style proportional numerals; labels use Questrial. Both fonts are bundled locally from Google Fonts with their SIL Open Font Licenses and preloaded.

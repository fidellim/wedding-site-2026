# Website update email

Scope: `emails/last-wedding-update.html`, an ordinary extension of `emails/wedding-update.html`. Product context: `PRODUCT.md`.

## Direction

Retain the incumbent wedding logo, Georgia headings and signature, Arial body, burgundy `#630000` headings, warm personal voice, and Gmail email/subject copy controls. The couple confirmed the original burgundy surround and cream letter. Explicit inline colors, HTML background attributes, light-only color-scheme declarations and a dark-mode CSS override preserve the palette in supporting clients. Forced recoloring by email apps remains outside HTML control.

## Content and action

Announce that the wedding-day timeline and reception seating plan are available. Distinguish assigned reception seats from open ceremony seating among the chairs provided. Direct guests to their original personalized invitation links and then the burgundy “Find my seat” button in the bottom-right corner of the screen. Sign Hannah & Fidel.

## Evidence and disposition

- The same hosted 200 × 150 wedding logo, Georgia/Arial pairing, burgundy headings, warm sign-off, and wedding hashtag are present in both emails.
- The update uses a 600px letter within a 632px wrapper, retaining the incumbent responsive padding and heading sizes.
- Burgundy is explicit on the body, wrapper and outer cell; cream is explicit on the letter. Thin `#e9d4c3` rules preserve the incumbent accent.
- All required guest instructions appear in the email body. Both copy controls remain outside `#email-content`; the clipboard handler clones only that table and supplies HTML and plain text.

The initial white version passed review; the subsequent palette correction restores the original email colors. Verify browser light/dark preferences and clipboard output for the renamed artifact. Existing design documents remain unchanged.

## Weather and ceremony update

The first few ceremony rows are reserved for the entourage; remaining chairs are open seating. A weather graphic plus accessible live text shows the November 15 Abu Dhabi city outlook: warm and dry, daytime high 28–29°C, checked November 8, 2026. Source: https://weather.metoffice.gov.uk/forecast/thqejqwk1. This is not a hotel-specific observation; no hourly or evening temperature is claimed. Forecasts change and must be rechecked before sending.

The preview and Gmail clipboard HTML use the externally hosted image at `https://tasteofserendipity.com/wp-content/uploads/2026/11/wedding-day-weather-forecast.png`. The image is included automatically when copying; manual photo insertion is no longer needed. Forecast text remains available when images are blocked.

## Weather graphic refinement

The couple requested a more refined weather image without source attribution, checked date, or a forecast link. These are removed from the guest-facing image, alt text, and email; factual provenance remains in the asset prompt sidecar. Keep the wedding date, city, daytime high, and warm/dry outlook, plus a short live-text note that forecasts may change.

## Approved letter refinement

Group timeline and reception updates under “New on our website,” with original invitation-link and bottom-right “Find my seat” guidance immediately after. Ceremony seating uses a smaller subheading. Retain major weather and attire sections, hosted graphic, palette and typography. Lightly tighten repetition, isolate the groom’s exclusive burgundy request in its own paragraph, and consolidate thanks and anticipation into one closing. No emojis.

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

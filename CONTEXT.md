# Wedding Invitation and Seating

This context describes who is invited, who will attend, and where each person
will sit at Hannah and Fidel's wedding.

## Language

**Invitation Party**:
One or more people who share an invite code and submit one collective RSVP with
an attending count.
_Avoid_: Family, household, guest

**Invitee**:
One individually named person included in an Invitation Party, whether or not
they will attend.
_Avoid_: Guest, seat

**RSVP**:
The Invitation Party's final, locked response stating whether anyone in the
party will attend and, if so, how many.
_Avoid_: Registration, booking

**Confirmed Attendee**:
An Invitee selected by an Administrator as one of the people represented by an
accepted RSVP's Attending Count.
_Avoid_: Accepted guest, attendee count

**Non-Attending Invitee**:
An Invitee not represented by their Invitation Party's current Attending Count;
they remain in planning history but are absent from seating and publication.
_Avoid_: Declined guest, removed guest

**Attending Count**:
The number of people attending from an Invitation Party; it does not identify
which Invitees are the Confirmed Attendees.
_Avoid_: Accepted guests, seats

**Attendance Roster Change**:
An audited replacement of one or more Confirmed Attendees that leaves the
Invitation Party's submitted Attending Count unchanged.
_Avoid_: RSVP amendment, name edit

**RSVP Amendment**:
An Administrator's recorded correction to a locked RSVP that preserves the
original response, the reason for the change, and when it was made.
_Avoid_: RSVP edit, overwrite

**Seating Plan**:
A draft or published arrangement of Confirmed Attendees across the reception's
numbered Seats and visual Floor Plan.
_Avoid_: Floor plan, guest list

**Floor Plan**:
The spatial arrangement of Tables and Seats that helps a Confirmed Attendee
locate their assigned place at the venue.
_Avoid_: Seating plan, room map

**Table**:
A named or numbered group of Seats with a fixed capacity.
_Avoid_: Section, group

**Seat**:
One numbered place at a Table that can hold at most one Confirmed Attendee.
_Avoid_: Spot, position

**Seat Assignment**:
The placement of one Confirmed Attendee into one Seat within a Seating Plan.
_Avoid_: Allocation, placement

**Retained Planning Record**:
A Table, Seat, or Seat Assignment that is no longer part of the current Draft
Seating Plan but remains in the Wedding Archive for historical integrity.
_Avoid_: Deleted record, removed row

**Seat Requirement**:
Whether a Confirmed Attendee must receive a numbered Seat before the Seating
Plan may be published.
_Avoid_: Attendance, seat assignment

**Published Seating Plan**:
The Seating Plan revision currently eligible to be revealed to Confirmed
Attendees through their private invitation links.
_Avoid_: Live plan, final plan

**Draft Seating Plan**:
The editable Seating Plan that is visible only to Administrators and does not
change what Invitees see until it is published.
_Avoid_: Working copy, live plan

**Plan Revision**:
An immutable snapshot created when the entire valid Draft Seating Plan is
published atomically.
_Avoid_: Partial publish, autosave

**Publishing Error**:
A seating inconsistency that prevents a Draft Seating Plan from becoming a Plan
Revision, such as an unseated Confirmed Attendee or an RSVP count mismatch.
_Avoid_: Warning, preference

**Seating Warning**:
A non-blocking concern such as a split Invitation Party or violated
keep-together preference that Administrators may deliberately accept.
_Avoid_: Publishing error, validation failure

**Keep-Together Group**:
An optional preference that two or more Confirmed Attendees, including people
from different Invitation Parties, should share a Table.
_Avoid_: Invitation party, required assignment

**Wedding Archive**:
The retained Published Seating Plan and guest-facing lookup preserved after the
wedding as part of the couple's record of the event.
_Avoid_: Expired plan, deleted plan

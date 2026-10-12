import { useMemo, useRef, useState } from "react";
import type { SeatingWorkspace } from "../domain/types";
import type { RepositoryCommand } from "../data/seatingRepository";
import { partyGuide } from "./guideData";
import { SeatingGuide } from "./SeatingGuide";

export default function GuidePreview({ workspace, disabled, execute, onOpenPublish }: {
  workspace: SeatingWorkspace; disabled: boolean; execute: (command: RepositoryCommand) => Promise<boolean>;
  onOpenPublish?: () => void;
}) {
  const [source, setSource] = useState<"draft" | "published">("draft");
  const snapshot = source === "published" ? workspace.published : workspace.draft;
  const parties = snapshot?.invitationParties.filter(p => p.rsvpStatus === "accepted") ?? [];
  const [partyId, setPartyId] = useState("");
  const activeParty = parties.find(p => p.id === partyId)?.id ?? parties[0]?.id ?? "";
  const [chairsApproved, setChairsApproved] = useState(false);
  const [reviewedId, setReviewedId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const releaseSection = useRef<HTMLElement>(null);
  const data = useMemo(() => snapshot ? partyGuide(snapshot, activeParty, chairsApproved,
    source === "published" ? workspace.published?.revisionNumber ?? null : null) : null, [snapshot, activeParty, chairsApproved, source, workspace.published]);
  const releaseAvailable = workspace.guideRelease !== undefined;
  const canRelease = releaseAvailable && !disabled && source === "published" && !!workspace.published?.venueLayout
    && reviewedId === workspace.published.id;
  const released = workspace.revisions.find(r => r.id === workspace.guideRelease?.revisionId);
  const visibleToGuests = !!released && workspace.guestLookupEnabled;
  const releaseBlocker = !releaseAvailable ? "The guest guide database upgrade must be installed before release is available."
    : !workspace.published ? "Publish a valid seating plan first, then return here to review it."
    : source !== "published" ? "Choose the published revision in step 1 to review it for release."
    : !workspace.published.venueLayout ? "This published revision has no venue layout. Add one in Venue preview, then publish the updated plan."
    : reviewedId !== workspace.published.id ? "Complete the preview checks, then acknowledge your review below."
    : disabled ? "Release is unavailable while editing is paused. Use a connected desktop or tablet and wait for any save to finish."
    : null;
  return <section className="guide-admin">
    <header className="guide-admin-heading">
      <h1>Guest guide preview</h1>
      <p>Check what guests will see through their invitation link, then release the reviewed seating guide when it is ready.</p>
    </header>
    <div className="guide-admin-status">
      <div><strong>{visibleToGuests ? `Guests can see revision ${released.revisionNumber}` : "Guests cannot access the Seating Guide"}</strong>
        <p>{released ? (workspace.guestLookupEnabled ? "Draft changes and new publications do not change the released guide." : `Revision ${released.revisionNumber} is released, but guest lookup is disabled in Publish.`) : "The guide stays private until you release a published revision."}</p>
      </div>
      <button className="text-button guide-admin-link" onClick={() => { releaseSection.current?.scrollIntoView({ block: "start" }); releaseSection.current?.focus({ preventScroll: true }); }}>Go to release settings</button>
    </div>
    <section className="guide-admin-section" aria-labelledby="guide-choose-title">
      <h2 id="guide-choose-title">1. Choose a preview</h2>
      <p>Use the draft to check work in progress. Select a published revision when you are ready to review for release. The Invitation Party selector only changes the preview; approval covers all Invitation Parties.</p>
      <div className="guide-admin-fields">
      <label>Plan <select value={source} onChange={e => { setSource(e.target.value as "draft" | "published"); setReviewedId(null); }}>
        <option value="draft">Private draft</option><option value="published" disabled={!workspace.published}>Published revision {workspace.published?.revisionNumber}</option>
      </select></label>
      <label>Invitation party <select value={activeParty} onChange={e => setPartyId(e.target.value)}>
        {!parties.length && <option value="">No accepted parties</option>}
        {parties.map(p => {
          const ids = new Set(snapshot?.invitees.filter(i => i.invitationPartyId === p.id && i.attendanceStatus === "confirmed").map(i => i.id));
          const tableIds = new Set(snapshot?.assignments.filter(a => ids.has(a.inviteeId)).map(a => snapshot?.seats.find(s => s.id === a.seatId)?.tableId).filter(Boolean));
          return <option key={p.id} value={p.id}>{p.label}{ids.size === 1 ? " · single person" : tableIds.size > 1 ? " · split tables" : ""}</option>;
        })}
      </select></label>
      </div>
      {!workspace.published && <p className="guide-admin-note">No published plan yet. You can still preview the private draft. {onOpenPublish && <button className="text-button" onClick={onOpenPublish}>Go to Publish</button>}</p>}
    </section>
    <section className="guide-admin-section" aria-labelledby="guide-review-title">
      <h2 id="guide-review-title">2. Check the guest experience</h2>
      <p>Switch invitation parties above to review a single person and a party seated across multiple tables.</p>
      <ul className="guide-admin-checks">
        <li>Check each person’s table and seat number.</li>
        <li>Try the venue tour, Skip to my seat, and the overhead view when a venue layout is available.</li>
        <li>Check the guide on a phone before releasing.</li>
      </ul>
      <div className="guide-admin-chair-option">
        <label className="guide-admin-checkbox"><input type="checkbox" checked={chairsApproved} onChange={e => { setChairsApproved(e.target.checked); setReviewedId(null); }} aria-describedby="guide-chair-help" /><span>I approve the physical chair arrangement for this preview and release. <small>Optional</small></span></label>
        <p id="guide-chair-help">Only approve if the actual chair positions are confirmed. Leave unchecked to highlight tables and show seat numbers in text. Checking this does not release the guide.</p>
      </div>
      <div className="guide-admin-preview-caption"><strong>{source === "draft" ? "Private draft preview" : `Published revision ${workspace.published?.revisionNumber} preview`}</strong><span>{parties.find(p => p.id === activeParty)?.label ?? "No party selected"} · Only this party’s guests are shown</span></div>
      {data ? <SeatingGuide key={`${source}-${activeParty}-${chairsApproved}-${source === "published" ? workspace.published?.id : workspace.draft.version}`} data={data} /> : <p className="guide-admin-note">No accepted invitation party is available. Add an accepted party with confirmed attendees in Invitees to preview their guide.</p>}
    </section>
    <section className="guide-admin-section guide-admin-release" id="guide-release" ref={releaseSection} tabIndex={-1} aria-labelledby="guide-release-heading">
      <h2 id="guide-release-heading">3. Release the reviewed guide</h2>
      <p>Approve once per published revision to release the guide for all Invitation Parties through their existing invitation links. Future draft changes and publications need a separate review and release.</p>
      {!workspace.guestLookupEnabled && <p className="guide-admin-note">Guest lookup is disabled. After releasing, enable it in Publish so guests can access the guide. {onOpenPublish && <button className="text-button" onClick={onOpenPublish}>Go to Publish</button>}</p>}
      <label className="guide-admin-checkbox"><input type="checkbox" checked={!!workspace.published && reviewedId === workspace.published.id} disabled={source !== "published" || !workspace.published}
        onChange={e => setReviewedId(e.target.checked ? workspace.published?.id ?? null : null)} />I reviewed this published layout with a single-person invitation and a party across multiple tables.</label>
      <p className="guide-admin-release-reason" id="guide-release-reason" role="status">{releaseBlocker ?? `Revision ${workspace.published?.revisionNumber} is reviewed and ready to release. You will confirm before it is shared.`}</p>
      <div className="guide-admin-release-actions"><button className="primary-button" disabled={!canRelease} aria-describedby="guide-release-reason" onClick={() => dialog.current?.showModal()}>Release guide</button>
      {workspace.guideRelease?.revisionId && <button className="text-button" disabled={disabled} onClick={() => void execute({ type: "release_guide", revisionId: null, chairsApproved: false })}>Hide Seating Guide</button>}
      </div>
    </section>
    <dialog className="publish-modal" ref={dialog} aria-labelledby="guide-release-title">
      <h2 id="guide-release-title">Release revision {workspace.published?.revisionNumber}?</h2>
      <p>This releases the guide for all Invitation Parties. Guests will reach this reviewed layout and their own party’s assignments through their existing invitation links. {chairsApproved ? "Individual chairs will be highlighted." : "Tables will be highlighted with seat numbers shown in text."}</p>
      <div className="publish-modal-actions"><button className="secondary-button" autoFocus onClick={() => dialog.current?.close()}>Keep private</button>
        <button className="primary-button" disabled={!canRelease} onClick={() => { dialog.current?.close(); if (workspace.published) void execute({ type: "release_guide", revisionId: workspace.published.id, chairsApproved }); }}>Release guide</button></div>
    </dialog>
  </section>;
}

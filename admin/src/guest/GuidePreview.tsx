import { useMemo, useRef, useState } from "react";
import type { SeatingWorkspace } from "../domain/types";
import type { RepositoryCommand } from "../data/seatingRepository";
import { partyGuide } from "./guideData";
import { SeatingGuide } from "./SeatingGuide";

export default function GuidePreview({ workspace, disabled, execute }: {
  workspace: SeatingWorkspace; disabled: boolean; execute: (command: RepositoryCommand) => Promise<boolean>;
}) {
  const [source, setSource] = useState<"draft" | "published">("draft");
  const snapshot = source === "published" ? workspace.published : workspace.draft;
  const parties = snapshot?.invitationParties.filter(p => p.rsvpStatus === "accepted") ?? [];
  const [partyId, setPartyId] = useState("");
  const activeParty = parties.find(p => p.id === partyId)?.id ?? parties[0]?.id ?? "";
  const [chairsApproved, setChairsApproved] = useState(false);
  const [reviewedId, setReviewedId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const data = useMemo(() => snapshot ? partyGuide(snapshot, activeParty, chairsApproved,
    source === "published" ? workspace.published?.revisionNumber ?? null : null) : null, [snapshot, activeParty, chairsApproved, source, workspace.published]);
  const releaseAvailable = workspace.guideRelease !== undefined;
  const canRelease = releaseAvailable && !disabled && source === "published" && !!workspace.published?.venueLayout
    && reviewedId === workspace.published.id;
  const released = workspace.revisions.find(r => r.id === workspace.guideRelease?.revisionId);
  return <section className="guide-admin">
    <div className="page-heading"><div><p className="eyebrow">Private guest preview</p><h1>Their first look.</h1></div></div>
    <div className="surface-card">
      <p>Preview exactly what an invitation party will see. Draft previews stay private; releasing uses the reviewed published revision.</p>
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
      <label><input type="checkbox" checked={chairsApproved} onChange={e => { setChairsApproved(e.target.checked); setReviewedId(null); }} />I approve the physical chair arrangement for this preview and release.</label>
    </div>
    {data ? <SeatingGuide key={`${source}-${activeParty}-${chairsApproved}-${source === "published" ? workspace.published?.id : workspace.draft.version}`} data={data} /> : <p>No invitation party is available for preview.</p>}
    <div className="surface-card">
      <p className="eyebrow">Guest release</p>
      <h2>{released ? `Guests can see revision ${released.revisionNumber}.` : "The new Seating Guide is private."}</h2>
      {!releaseAvailable && <p>The guest guide database upgrade must be installed before release is available. Private previews are available now.</p>}
      {!workspace.guestLookupEnabled && <p>Guest lookup is disabled. Enable it in Publish when you are ready to share the reviewed guide.</p>}
      <label><input type="checkbox" checked={!!workspace.published && reviewedId === workspace.published.id} disabled={source !== "published" || !workspace.published}
        onChange={e => setReviewedId(e.target.checked ? workspace.published?.id ?? null : null)} />I reviewed this published layout with a single-person invitation and a party across multiple tables.</label>
      <button className="primary-button" disabled={!canRelease} onClick={() => dialog.current?.showModal()}>Release reviewed guide</button>
      {workspace.guideRelease?.revisionId && <button className="text-button" disabled={disabled} onClick={() => void execute({ type: "release_guide", revisionId: null, chairsApproved: false })}>Hide Seating Guide</button>}
    </div>
    <dialog className="publish-modal" ref={dialog} aria-labelledby="guide-release-title">
      <h2 id="guide-release-title">Release revision {workspace.published?.revisionNumber}?</h2>
      <p>Guests will reach this reviewed layout and their party’s assignments through their existing invitation links. {chairsApproved ? "Individual chairs will be highlighted." : "Tables will be highlighted with seat numbers shown in text."}</p>
      <div className="publish-modal-actions"><button className="secondary-button" autoFocus onClick={() => dialog.current?.close()}>Keep private</button>
        <button className="primary-button" disabled={!canRelease} onClick={() => { dialog.current?.close(); if (workspace.published) void execute({ type: "release_guide", revisionId: workspace.published.id, chairsApproved }); }}>Release guide</button></div>
    </dialog>
  </section>;
}

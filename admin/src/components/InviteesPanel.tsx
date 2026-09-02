import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Id, InvitationParty, Invitee, SeatingWorkspace } from "../domain/types";
import type { RepositoryCommand } from "../data/seatingRepository";

interface InviteesPanelProps {
  workspace: SeatingWorkspace;
  disabled: boolean;
  execute: (command: RepositoryCommand) => Promise<boolean>;
}

function PartyRoster({
  party,
  invitees,
  version,
  disabled,
  execute,
  onEditInvitee,
}: {
  party: InvitationParty;
  invitees: Invitee[];
  version: number;
  disabled: boolean;
  execute: InviteesPanelProps["execute"];
  onEditInvitee: (invitee: Invitee) => void;
}) {
  const current = useMemo(
    () => invitees.filter((invitee) => invitee.attendanceStatus === "confirmed").map((invitee) => invitee.id),
    [invitees],
  );
  const [selected, setSelected] = useState<Set<Id>>(() => new Set(current));
  const [reason, setReason] = useState("");
  const [amendmentOpen, setAmendmentOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<"accepted" | "declined">(
    party.rsvpStatus === "declined" ? "declined" : "accepted",
  );
  const [nextCount, setNextCount] = useState(Math.max(1, party.attendingCount));
  const [amendmentReason, setAmendmentReason] = useState("");
  useEffect(() => setSelected(new Set(current)), [current]);
  useEffect(() => {
    setNextStatus(party.rsvpStatus === "declined" ? "declined" : "accepted");
    setNextCount(Math.max(1, party.attendingCount));
    setAmendmentOpen(false);
    setAmendmentReason("");
  }, [party.rsvpStatus, party.attendingCount]);

  const expected = party.rsvpStatus === "accepted" ? party.attendingCount : 0;
  const changed = current.length !== selected.size || current.some((id) => !selected.has(id));
  const amendmentChanged = party.rsvpStatus !== nextStatus ||
    party.attendingCount !== (nextStatus === "declined" ? 0 : nextCount);

  return (
    <article className="roster-card">
      <header>
        <div>
          <p className="eyebrow">{party.rsvpStatus}</p>
          <h3>{party.label}</h3>
        </div>
        <span className={`count-badge${selected.size === expected ? " is-good" : " is-alert"}`}>
          {selected.size}/{expected}
        </span>
      </header>
      <div className="roster-list">
        {invitees.map((invitee) => (
          <div className="roster-person" key={invitee.id}>
            <input
              id={`roster-${invitee.id}`}
              type="checkbox"
              checked={selected.has(invitee.id)}
              disabled={disabled || party.rsvpStatus !== "accepted"}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(invitee.id); else next.delete(invitee.id);
                setSelected(next);
              }}
            />
            <label htmlFor={`roster-${invitee.id}`}>{invitee.fullName}</label>
            {!invitee.requiresSeat && <small>No separate seat</small>}
            <button className="text-button" type="button" disabled={disabled} onClick={() => onEditInvitee(invitee)}>Edit</button>
          </div>
        ))}
        {!invitees.length && <p className="empty-state">Add each person in this invitation.</p>}
      </div>
      {changed && current.length > 0 && (
        <label>
          <span>Reason for changing the named attendees</span>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Guest contacted us…" />
        </label>
      )}
      <button
        className="secondary-button"
        type="button"
        disabled={disabled || !changed || selected.size !== expected || (current.length > 0 && !reason.trim())}
        onClick={() => void execute({
          type: "resolve_roster",
          expectedVersion: version,
          invitationPartyId: party.id,
          confirmedInviteeIds: [...selected],
          reason: reason.trim() || undefined,
        })}
      >
        Save attending names
      </button>
      <button
        className="text-button amendment-toggle"
        type="button"
        disabled={disabled}
        onClick={() => setAmendmentOpen((open) => !open)}
      >
        {amendmentOpen ? "Cancel RSVP amendment" : "Record RSVP amendment"}
      </button>
      {amendmentOpen && (
        <div className="amendment-form">
          <label>
            <span>New response</span>
            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as "accepted" | "declined")}>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
          </label>
          <label>
            <span>New attending count</span>
            <input
              type="number"
              min={nextStatus === "accepted" ? 1 : 0}
              value={nextStatus === "declined" ? 0 : nextCount}
              disabled={nextStatus === "declined"}
              onChange={(event) => setNextCount(Number(event.target.value))}
            />
          </label>
          <label className="full-width">
            <span>Reason</span>
            <input value={amendmentReason} onChange={(event) => setAmendmentReason(event.target.value)} placeholder="Guest contacted us…" />
          </label>
          <button
            className="danger-button full-width"
            type="button"
            disabled={disabled || !amendmentChanged || !amendmentReason.trim() || (nextStatus === "accepted" && nextCount < 1)}
            onClick={() => void execute({
              type: "amend_rsvp",
              expectedVersion: version,
              invitationPartyId: party.id,
              nextStatus,
              nextAttendingCount: nextStatus === "declined" ? 0 : nextCount,
              reason: amendmentReason.trim(),
            })}
          >
            Save audited amendment
          </button>
        </div>
      )}
    </article>
  );
}

export function InviteesPanel({ workspace, disabled, execute }: InviteesPanelProps) {
  const [editingInviteeId, setEditingInviteeId] = useState<Id | null>(null);
  const [partyId, setPartyId] = useState(workspace.draft.invitationParties[0]?.id ?? "");
  const [fullName, setFullName] = useState("");
  const [requiresSeat, setRequiresSeat] = useState(true);
  const [tags, setTags] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");

  const resetInviteeForm = () => {
    setEditingInviteeId(null);
    setFullName("");
    setRequiresSeat(true);
    setTags("");
    setPrivateNotes("");
  };

  const editInvitee = (invitee: Invitee) => {
    setEditingInviteeId(invitee.id);
    setPartyId(invitee.invitationPartyId);
    setFullName(invitee.fullName);
    setRequiresSeat(invitee.requiresSeat);
    setTags(invitee.tags.join(", "));
    setPrivateNotes(invitee.privateNotes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addInvitee = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await execute({
      type: "upsert_invitee",
      expectedVersion: workspace.draft.version,
      invitee: {
        id: editingInviteeId ?? undefined,
        invitationPartyId: partyId,
        fullName,
        requiresSeat,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        privateNotes: privateNotes.trim(),
      },
    });
    if (saved) resetInviteeForm();
  };

  return (
    <div className="stack-layout">
      <section className="surface-card">
        <div className="panel-heading">
          <div><p className="eyebrow">Individual records</p><h2>{editingInviteeId ? "Edit invitee" : "Add an invitee"}</h2></div>
          {editingInviteeId && <button className="text-button" type="button" onClick={resetInviteeForm}>Cancel edit</button>}
        </div>
        <form className="inline-form" onSubmit={(event) => void addInvitee(event)}>
          <label>
            <span>Invitation Party</span>
            <select value={partyId} disabled={Boolean(editingInviteeId)} onChange={(event) => setPartyId(event.target.value)}>
              {workspace.draft.invitationParties.map((party) => <option key={party.id} value={party.id}>{party.label}</option>)}
            </select>
          </label>
          <label className="grow-field">
            <span>Full name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label className="check-field">
            <input type="checkbox" checked={requiresSeat} onChange={(event) => setRequiresSeat(event.target.checked)} />
            <span>Requires a seat</span>
          </label>
          <label className="grow-field"><span>Tags (comma-separated)</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Child, accessibility" /></label>
          <label className="grow-field"><span>Private seating notes</span><input value={privateNotes} onChange={(event) => setPrivateNotes(event.target.value)} placeholder="Visible only to Hannah and Fidel" /></label>
          <button className="primary-button" disabled={disabled || !partyId || !fullName.trim()}>{editingInviteeId ? "Save person" : "Add person"}</button>
        </form>
      </section>

      <section>
        <div className="panel-heading">
          <div><p className="eyebrow">Attendance reconciliation</p><h2>Invitation Parties</h2></div>
          <p className="helper-text">Named attendees must exactly match each submitted RSVP count.</p>
        </div>
        <div className="roster-grid">
          {workspace.draft.invitationParties.map((party) => (
            <PartyRoster
              key={party.id}
              party={party}
              invitees={workspace.draft.invitees.filter((invitee) => invitee.invitationPartyId === party.id)}
              version={workspace.draft.version}
              disabled={disabled}
              execute={execute}
              onEditInvitee={editInvitee}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

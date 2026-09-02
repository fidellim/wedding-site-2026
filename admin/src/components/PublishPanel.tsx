import { inspectWorkspace } from "../domain/seating";
import type { SeatingWorkspace } from "../domain/types";
import type { RepositoryCommand } from "../data/seatingRepository";
import { useState } from "react";

export function PublishPanel({
  workspace,
  disabled,
  execute,
  provisionGuestAccess,
}: {
  workspace: SeatingWorkspace;
  disabled: boolean;
  execute: (command: RepositoryCommand) => Promise<boolean>;
  provisionGuestAccess: (invitationPartyId: string) => Promise<string | null>;
}) {
  const validation = inspectWorkspace(workspace).validation;
  const [linkMessage, setLinkMessage] = useState("");
  const publish = () => {
    if (!window.confirm("Publish this complete seating plan to invited guests?")) return;
    void execute({ type: "publish", expectedVersion: workspace.draft.version });
  };

  const copyGuestLink = async (invitationPartyId: string) => {
    setLinkMessage("");
    const token = await provisionGuestAccess(invitationPartyId);
    if (!token) return;
    const link = new URL("/", window.location.origin);
    link.searchParams.set("code", invitationPartyId);
    link.searchParams.set("seating", token);
    try {
      await navigator.clipboard.writeText(link.toString());
      setLinkMessage("A new secure seating link was copied. Creating another link for this party replaces it.");
    } catch {
      setLinkMessage(`Copy this secure link now: ${link.toString()}`);
    }
  };

  return (
    <div className="publish-layout">
      <section className="surface-card publication-card">
        <p className="eyebrow">Publication gate</p>
        <h2>{validation.canPublish ? "Ready when you are." : "The draft still needs attention."}</h2>
        <p className="helper-text">Publishing creates one immutable revision. Guests continue seeing the previous revision until this completes.</p>
        <div className="validation-columns">
          <div>
            <h3>Blocking errors <span>{validation.errors.length}</span></h3>
            {validation.errors.map((issue, index) => <div className="issue error-issue" key={`${issue.code}-${index}`}><strong>{issue.code.replaceAll("_", " ")}</strong><p>{issue.message}</p></div>)}
            {!validation.errors.length && <p className="empty-state">No blocking errors.</p>}
          </div>
          <div>
            <h3>Warnings <span>{validation.warnings.length}</span></h3>
            {validation.warnings.map((issue, index) => <div className="issue warning-issue" key={`${issue.code}-${index}`}><strong>{issue.code.replaceAll("_", " ")}</strong><p>{issue.message}</p></div>)}
            {!validation.warnings.length && <p className="empty-state">No warnings.</p>}
          </div>
        </div>
        <button className="primary-button publish-button" disabled={disabled || !validation.canPublish} onClick={publish}>Publish complete plan</button>
      </section>

      <aside className="publish-sidebar">
        <section className="surface-card">
          <p className="eyebrow">Guest access</p>
          <h3>{workspace.guestLookupEnabled ? "Lookup enabled" : "Lookup disabled"}</h3>
          <p className="helper-text">The section remains hidden until a revision exists. This switch can later protect the Wedding Archive.</p>
          <button className="secondary-button" disabled={disabled} onClick={() => void execute({ type: "set_guest_lookup", enabled: !workspace.guestLookupEnabled })}>
            {workspace.guestLookupEnabled ? "Disable lookup" : "Enable lookup"}
          </button>
        </section>
        <section className="surface-card">
          <p className="eyebrow">Party-only links</p>
          <h3>Secure seating access</h3>
          <p className="helper-text">Each action rotates that party’s private seating token. Share only the copied link with that invitation party.</p>
          <div className="guest-link-list">
            {workspace.draft.invitationParties
              .filter((party) => party.rsvpStatus === "accepted")
              .map((party) => (
                <div key={party.id}>
                  <span>{party.label}</span>
                  <button
                    className="text-button"
                    disabled={disabled || !workspace.published}
                    onClick={() => void copyGuestLink(party.id)}
                  >
                    Copy new link
                  </button>
                </div>
              ))}
          </div>
          {linkMessage && <p className="link-message" role="status">{linkMessage}</p>}
        </section>
        <section className="surface-card">
          <p className="eyebrow">Published history</p>
          <h3>{workspace.published ? `Revision ${workspace.published.revisionNumber}` : "Not published"}</h3>
          <div className="revision-list">
            {[...workspace.revisions].reverse().map((revision) => (
              <div className="revision-row" key={revision.id}>
                <div><strong>Revision {revision.revisionNumber}</strong><small>{new Date(revision.publishedAt).toLocaleString()}</small></div>
                <button className="text-button" disabled={disabled} onClick={() => void execute({ type: "restore_revision", expectedVersion: workspace.draft.version, revisionId: revision.id })}>Restore as draft</button>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { inspectWorkspace } from "./domain/seating";
import type { SeatingRepository } from "./data/seatingRepository";
import { useSeatingWorkspace } from "./hooks/useSeatingWorkspace";
import { InviteesPanel } from "./components/InviteesPanel";
import { TablesPanel } from "./components/TablesPanel";
import { PlannerPanel } from "./components/PlannerPanel";
import { PublishPanel } from "./components/PublishPanel";

type Section = "overview" | "invitees" | "tables" | "planner" | "publish";

const navigation: { id: Section; label: string; short: string }[] = [
  { id: "overview", label: "Overview", short: "01" },
  { id: "invitees", label: "Invitees", short: "02" },
  { id: "tables", label: "Tables", short: "03" },
  { id: "planner", label: "Seat planner", short: "04" },
  { id: "publish", label: "Publish", short: "05" },
];

export function App({
  repository,
  adminName,
  demo = false,
  onSignOut,
}: {
  repository: SeatingRepository;
  adminName: string;
  demo?: boolean;
  onSignOut?: () => Promise<void>;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [mobileReadOnly, setMobileReadOnly] = useState(
    () => window.matchMedia("(max-width: 720px)").matches,
  );
  const {
    workspace,
    loading,
    busy,
    online,
    message,
    execute,
    reload,
    lastMoveAuditId,
    provisionGuestAccess,
  } = useSeatingWorkspace(repository);
  const planner = useMemo(() => workspace ? inspectWorkspace(workspace) : null, [workspace]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setMobileReadOnly(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (loading && !workspace) return <main className="loading-screen">Preparing the seating studio…</main>;
  if (!workspace || !planner) {
    return <main className="loading-screen"><div><h1>Could not open the planner.</h1><p>{message}</p><button className="primary-button" onClick={() => void reload()}>Try again</button></div></main>;
  }

  const disabled = busy || !online || mobileReadOnly;

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <div className="nav-brand"><span>H</span><i>&amp;</i><span>F</span></div>
        <div className="nav-copy"><p>Seating Studio</p><small>15 · 11 · 2026</small></div>
        <nav aria-label="Admin sections">
          {navigation.map((item) => (
            <button key={item.id} className={section === item.id ? "is-active" : ""} onClick={() => setSection(item.id)}>
              <span>{item.short}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="nav-footer">
          <p>{adminName}</p>
          <span className={online ? "status-online" : "status-offline"}>{online ? "Online · autosaving" : "Offline · read only"}</span>
          {onSignOut && <button className="text-button" onClick={() => void onSignOut()}>Sign out</button>}
        </div>
      </aside>

      <main className="admin-main">
        {demo && <div className="demo-banner"><strong>Local demo mode</strong><span>No Supabase project is connected; changes exist only in memory.</span></div>}
        {!online && <div className="offline-banner">Connection lost. Editing is paused until the latest plan can be loaded.</div>}
        {mobileReadOnly && <div className="mobile-banner">Mobile view is read-only. Use a tablet or desktop to edit the plan.</div>}
        {message && <div className="message-banner" role="status">{message}</div>}

        {section === "overview" && (
          <section>
            <div className="page-heading"><div><p className="eyebrow">Welcome back, {adminName}</p><h1>Every place, considered.</h1></div><button className="secondary-button" onClick={() => setSection("planner")}>Open seat planner</button></div>
            <div className="metric-grid">
              <article><span>Confirmed</span><strong>{planner.confirmedInvitees.length}</strong><small>named attendees</small></article>
              <article><span>Assigned</span><strong>{planner.occupiedSeatCount}</strong><small>numbered seats</small></article>
              <article><span>Unassigned</span><strong>{planner.unassignedInvitees.length}</strong><small>still need a place</small></article>
              <article><span>Tables</span><strong>{workspace.draft.tables.length}</strong><small>{planner.totalSeatCount} total seats</small></article>
            </div>
            <div className="overview-grid">
              <section className="surface-card progress-card">
                <p className="eyebrow">Publication readiness</p>
                <h2>{planner.validation.canPublish ? "The plan is valid." : `${planner.validation.errors.length} items need attention.`}</h2>
                <div className="progress-track"><span style={{ width: `${planner.confirmedInvitees.length ? Math.round(((planner.confirmedInvitees.length - planner.unassignedInvitees.length) / planner.confirmedInvitees.length) * 100) : 0}%` }} /></div>
                <p>{planner.confirmedInvitees.length - planner.unassignedInvitees.length} of {planner.confirmedInvitees.length} confirmed attendees are ready.</p>
                <button className="text-button" onClick={() => setSection("publish")}>Review validation →</button>
              </section>
              <section className="surface-card activity-card">
                <p className="eyebrow">Latest activity</p>
                <div className="activity-list">
                  {[...workspace.auditLog].reverse().slice(0, 6).map((entry) => <div key={entry.id}><span className="activity-dot" /><div><strong>{entry.kind.replaceAll("_", " ")}</strong><small>{new Date(entry.occurredAt).toLocaleString()}</small></div></div>)}
                  {!workspace.auditLog.length && <p className="empty-state">Your saved changes will appear here.</p>}
                </div>
              </section>
            </div>
          </section>
        )}
        {section === "invitees" && <InviteesPanel workspace={workspace} disabled={disabled} execute={execute} />}
        {section === "tables" && <TablesPanel workspace={workspace} disabled={disabled} execute={execute} />}
        {section === "planner" && (
          <PlannerPanel
            workspace={workspace}
            disabled={disabled}
            execute={execute}
            lastMoveAuditId={lastMoveAuditId}
          />
        )}
        {section === "publish" && (
          <PublishPanel
            workspace={workspace}
            disabled={disabled}
            execute={execute}
            provisionGuestAccess={provisionGuestAccess}
          />
        )}
      </main>
    </div>
  );
}

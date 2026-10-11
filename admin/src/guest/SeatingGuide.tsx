import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { VenuePlan } from "../venue/VenuePlan";
import { TableFurniture } from "../venue/TableFurniture";
import { physicalChairs, previewVenueLayout } from "../venue/layout";
import type { FurnitureTarget } from "../venue/VenueInspection";
import type { LabelObstacle } from "../venue/landmarkLabels";
import type { GuideData } from "./guideData";
import "../venue/venue.css";
import "./guide.css";
import logoUrl from "../../../images/hf-logo-burgundy.webp";

const VenueCanvas = lazy(() => import("../venue/VenueCanvas").then(m => ({ default: m.VenueCanvas })));

export function SeatingGuide({ data }: { data: GuideData }) {
  const { snapshot, chairsApproved } = data;
  const root = useRef<HTMLElement>(null);
  const partyPanelId = useId();
  const viewMenuId = useId();
  const controls = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [framing, setFraming] = useState<{ exclusions: LabelObstacle[]; lift: number }>({ exclusions: [], lift: 0 });
  const [personId, setPersonId] = useState<string | null>(() => snapshot.invitees.length === 1 ? snapshot.invitees[0].id : null);
  const [view, setView] = useState<"3d" | "plan">("3d");
  const [receptionOnly, setReceptionOnly] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [dusk, setDusk] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [tourLabel, setTourLabel] = useState("");
  const [request, setRequest] = useState<{ target: FurnitureTarget; tour: boolean; key: number } | null>(null);
  const onUnavailable = useCallback(() => { setUnavailable(true); setView("plan"); setTourLabel(""); }, []);
  const layout = useMemo(() => snapshot.venueLayout ? previewVenueLayout(snapshot.venueLayout) : null, [snapshot.venueLayout]);
  const assignment = snapshot.assignments.find(a => a.inviteeId === personId);
  const seat = snapshot.seats.find(s => s.id === assignment?.seatId);
  const table = snapshot.tables.find(t => t.id === seat?.tableId);
  const target: FurnitureTarget | null = seat ? { tableId: seat.tableId, ...(chairsApproved ? { seatNumber: seat.number } : {}) } : null;
  const person = snapshot.invitees.find(i => i.id === personId);
  // Avoid suggesting physical chair positions before the owner approves them.
  const furnitureSnapshot = useMemo(() => chairsApproved ? snapshot : { ...snapshot, assignments: [] }, [chairsApproved, snapshot]);
  function selectPerson(id: string) {
    setPersonId(id); setTourLabel("");
    const selected = snapshot.seats.find(s => s.id === snapshot.assignments.find(a => a.inviteeId === id)?.seatId);
    setRequest(selected ? { target: { tableId: selected.tableId, ...(chairsApproved ? { seatNumber: selected.number } : {}) }, tour: false, key: (request?.key ?? 0) + 1 } : null);
  }
  function showSeat() {
    if (!target) return;
    setView("3d"); setRequest({ target, tour: true, key: (request?.key ?? 0) + 1 });
  }
  useEffect(() => {
    const container = root.current;
    const stage = container?.querySelector(".venue-stage");
    if (!container || !stage) return;
    const overlays = Array.from(container.querySelectorAll("[data-guide-overlay], .venue-skip"));
    const back = container.parentElement?.querySelector(".guide-back");
    if (back) overlays.push(back);
    function measure() {
      const bounds = stage!.getBoundingClientRect();
      const exclusions = overlays.map(element => {
        const box = element.getBoundingClientRect();
        return { left: box.left - bounds.left, top: box.top - bounds.top, width: box.width, height: box.height };
      }).filter(box => box.width > 0 && box.height > 0);
      const panel = container!.querySelector(".guide-seats")?.getBoundingClientRect();
      const lift = bounds.width <= 680 && panel ? Math.min(panel.height / 3, bounds.height * .12) : 0;
      const next = { exclusions, lift };
      setFraming(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
    if (typeof ResizeObserver === "undefined") { measure(); return; }
    const observer = new ResizeObserver(measure);
    observer.observe(stage); overlays.forEach(element => observer.observe(element)); measure();
    return () => observer.disconnect();
  }, [expanded, view, tourLabel, menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !controls.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [menuOpen]);
  const placement = table && layout?.tables[table.id];
  const chair = chairsApproved && table && placement && physicalChairs(table, placement).find(c => c.number === seat?.number);

  return <section className={`seating-guide seating-guide--canvas${dusk && view === "3d" ? " seating-guide--evening" : ""}`} ref={root} aria-label="Your seating guide">
    <header className="guide-heading guide-heading--logo" data-guide-overlay><img src={logoUrl} alt="Hannah & Fidel" width="512" height="512" /><h1 className="guide-sr-only">Your seating guide</h1></header>
    <div className="guide-layout">
    <aside className="guide-seats" aria-label="Your seats" data-guide-overlay>
    <button className="guide-panel-toggle" aria-expanded={expanded} aria-controls={partyPanelId} onClick={() => setExpanded(!expanded)}>
      Your seats <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={expanded ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} /></svg>
    </button>
    <div id={partyPanelId} hidden={!expanded} className="guide-party" aria-label="Your invitation party">
      {snapshot.invitees.map(invitee => {
        const assignedSeat = snapshot.seats.find(s => s.id === snapshot.assignments.find(a => a.inviteeId === invitee.id)?.seatId);
        const assignedTable = snapshot.tables.find(t => t.id === assignedSeat?.tableId);
        return <button key={invitee.id} aria-pressed={personId === invitee.id} onClick={() => selectPerson(invitee.id)}>
          <strong>{invitee.fullName}</strong><span>{assignedTable && assignedSeat ? `Table ${assignedTable.number} · Seat ${assignedSeat.number}` : invitee.requiresSeat ? "Your place will be shared soon" : "No separate seat assigned"}</span>
        </button>;
      })}
      {!snapshot.invitees.length && <p>Your party’s seating details will be shared soon.</p>}
    </div>
    <div className="guide-destination" aria-live="polite">
      {person && table && seat ? <p><strong>{person.fullName}</strong><span>Table {table.number} <i>·</i> Seat {seat.number}</span></p> : <p>{person ? "Your seating details will be shared soon." : "Choose your name to find your place."}</p>}
      <button disabled={!target || !placement || unavailable} onClick={showSeat}>Show my seat <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 19 19 5M5 5h14v14" /></svg></button>
    </div>
    {!chairsApproved && target && <p className="guide-footnote">Your table is highlighted. We’ll show your individual chair once its position is confirmed.</p>}
    </aside>
    <div className="guide-experience">
    {layout ? <div className={`guide-scene-card${view === "3d" ? " guide-scene-card--3d" : ""}`}>
      <div className="guide-controls" ref={controls} data-guide-overlay onKeyDown={event => {
        if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
      }}>
        <button className="guide-menu-toggle" ref={menuButton} aria-expanded={menuOpen} aria-controls={viewMenuId} onClick={() => setMenuOpen(!menuOpen)}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={menuOpen ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>Views
        </button>
        <div id={viewMenuId} className="guide-viewbar" data-open={menuOpen} aria-label="Venue views" data-guide-overlay>
          <button aria-pressed={view === "3d"} disabled={unavailable} onClick={() => { setView("3d"); setRequest(null); setTourLabel(""); setMenuOpen(false); }}>3D venue</button>
          <button aria-pressed={view === "plan"} onClick={() => { setView("plan"); setTourLabel(""); setMenuOpen(false); }}>Overhead view</button>
          {view === "3d" && <button className="guide-landmark-toggle" aria-pressed={showLabels} onClick={() => setShowLabels(!showLabels)}>Landmarks</button>}
          {view === "plan" && <button onClick={() => setReceptionOnly(!receptionOnly)}>{receptionOnly ? "Whole venue" : "Reception"}</button>}
        {view === "3d" && <button className="guide-lighting-toggle" role="switch" aria-checked={dusk} aria-label="Evening lighting" title={dusk ? "Switch to Daylight" : "Switch to Evening"} onClick={() => setDusk(!dusk)}>
          <span className="guide-lighting-track" aria-hidden="true"><span className="guide-lighting-thumb">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{dusk ? <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>}</svg>
          </span></span><span>{dusk ? "Evening" : "Daylight"}</span>
        </button>}
        </div>
      </div>
      <div className="venue-stage">
        {view === "3d" && !unavailable ? <Suspense fallback={<p className="guide-loading" role="status">Preparing the venue…</p>}><VenueCanvas
          parameters={layout.parameters} led={layout.led} snapshot={furnitureSnapshot} layout={layout}
          preset="overview" resetKey={0} labels={showLabels} labelExclusions={framing.exclusions} cameraLift={framing.lift} dusk={dusk} onUnavailable={onUnavailable}
          ceremonyChairs={data.ceremonyChairs} highlightTarget={target} focusRequest={request} onTourLabel={setTourLabel}
        /></Suspense> : <VenuePlan parameters={layout.parameters} led={layout.led} landmarks={layout.landmarks} receptionOnly={receptionOnly} ceremonyChairs={data.ceremonyChairs}>
          <TableFurniture snapshot={furnitureSnapshot} layout={layout} showSeatNumbers={chairsApproved} guestView />
          {placement && <g transform={`translate(${placement.x},${placement.y}) rotate(${placement.rotation})`}>
            <circle data-guide-highlight="" cx={chair ? chair.x : 0} cy={chair ? chair.y : 0}
              r={chair ? .4 : Math.max(placement.width, placement.depth) / 2 + .8} fill="none" stroke="#ad6433" strokeWidth=".16" />
          </g>}
        </VenuePlan>}
        {tourLabel && <p className="guide-tour-label" role="status" data-guide-overlay>{tourLabel}</p>}
      </div>
      <p className="guide-scene-note" data-guide-overlay>{unavailable ? "The overhead view is available on this device." : view === "3d" ? "Drag to look around · pinch or scroll to zoom" : "Your selected place is outlined in gold."} <span>Venue preview · positions are approximate.</span></p>
    </div> : <p className="guide-empty" role="status" data-guide-overlay>The venue view will be available once the table layout is ready.</p>}
    <p className="guide-welcome">Enjoy a little tour of the venue before we celebrate together.</p>
    </div>
    </div>
  </section>;
}

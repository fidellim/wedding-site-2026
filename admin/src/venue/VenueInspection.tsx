import { createPortal } from "react-dom";
import type { SeatingDirectoryEntry } from "../guest/guideData";
import { tableLabel } from "./tableLabel";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SeatingSnapshot } from "../domain/types";

export interface FurnitureTarget { tableId: string; seatNumber?: number }
interface Peek { target: FurnitureTarget; x: number; y: number }
interface Inspection {
  active: FurnitureTarget | null;
  chairsEnabled: boolean;
  guestName: (target: FurnitureTarget) => string;
  peek: (value: Peek | null) => void;
  select: (target: FurnitureTarget | null) => void;
}
const Context = createContext<Inspection | null>(null);
export const useVenueInspection = () => useContext(Context);
export function sameTarget(a: FurnitureTarget | null, b: FurnitureTarget) {
  return a?.tableId === b.tableId && a.seatNumber === b.seatNumber;
}
export function seatGuest(snapshot: SeatingSnapshot, tableId: string, number: number) {
  const seat = snapshot.seats.find(s => s.tableId === tableId && s.number === number);
  const assignment = snapshot.assignments.find(a => a.seatId === seat?.id);
  return snapshot.invitees.find(i => i.id === assignment?.inviteeId)?.fullName ?? "Unassigned";
}
export function VenueInspection({ snapshot, children, directory, chairsApproved = true, onInspect, resetKey, controlsHost }: {
  snapshot: SeatingSnapshot; children: ReactNode; directory?: SeatingDirectoryEntry[]; chairsApproved?: boolean; onInspect?: () => void; resetKey?: string | number; controlsHost?: HTMLElement | null;
}) {
  const guestView = directory !== undefined;
  const normalize = (target: FurnitureTarget) => chairsApproved ? target : { tableId: target.tableId };
  const guestName = (target: FurnitureTarget) => directory
    ? directory.find(entry => entry.tableId === target.tableId && entry.seatNumber === target.seatNumber)?.fullName ?? "No guest assigned"
    : seatGuest(snapshot, target.tableId, target.seatNumber!);
  const [selected, setSelected] = useState<FurnitureTarget | null>(null);
  const [hover, setHover] = useState<Peek | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setSelected(null); setHover(null);
  }, [resetKey]);
  function peek(value: Peek | null) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (value) setHover({ ...value, target: normalize(value.target) });
    else hoverTimer.current = setTimeout(() => setHover(null), 180);
  }
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  const returnFocus = useRef<HTMLElement | SVGElement | null>(null);
  const table = snapshot.tables.find(t => t.id === selected?.tableId);
  const active = table ? selected : null;
  function select(target: FurnitureTarget | null) {
    if (target && !document.activeElement?.closest(".venue-seat-details") && (document.activeElement instanceof HTMLElement || document.activeElement instanceof SVGElement)) returnFocus.current = document.activeElement;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setSelected(target ? normalize(target) : null); setHover(null);
    if (target) onInspect?.();
  }
  function close() { returnFocus.current?.focus(); select(null); }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && (selected || hover)) { if (selected) returnFocus.current?.focus(); setSelected(null); setHover(null); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [selected, hover]);
  const hoveredTable = snapshot.tables.find(t => t.id === hover?.target.tableId);
  const inspectionControls = <div className={`venue-inspection-controls${guestView ? " guide-inspection-controls" : ""}`} data-guide-overlay={guestView ? "" : undefined}>
      {!guestView && <span>Hover a seat to peek · click or tap a seat or table for details</span>}
      <label>{guestView ? "Explore tables" : "Inspect table"} <select value={table?.id ?? ""} onChange={e => select(e.target.value ? { tableId: e.target.value } : null)}>
        <option value="">Choose a table</option>
        {snapshot.tables.map(t => <option key={t.id} value={t.id}>{tableLabel(t.name)}</option>)}
      </select></label>
    </div>;
  return <Context.Provider value={{ active: active ?? hover?.target ?? null, peek, select, chairsEnabled: chairsApproved, guestName }}>
    {guestView ? controlsHost && createPortal(inspectionControls, controlsHost) : inspectionControls}
    <div className={`venue-inspection${guestView ? " guide-inspection" : ""}`} onClick={event => { if (!(event.target instanceof Element) || !event.target.closest("[data-furniture-target], .venue-seat-details, button")) select(null); }}>
      {children}
      {!active && hover && hoveredTable && <div role="tooltip" className="venue-seat-tooltip" style={{ left: Math.max(8, Math.min(hover.x, window.innerWidth - 280)), top: Math.max(8, Math.min(hover.y + 12, window.innerHeight - 90)) }} onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }} onMouseLeave={() => peek(null)}>
        <strong>{hover.target.seatNumber === undefined ? tableLabel(hoveredTable.name) : guestName(hover.target)}</strong>
        <span>{tableLabel(hoveredTable.name)}{hover.target.seatNumber === undefined ? " · Click to view guests" : ` · Seat ${hover.target.seatNumber}`}</span>
      </div>}
      {active && table && <section className="venue-seat-details" aria-label="Seating details" data-guide-overlay={guestView ? "" : undefined}>
        <button className="venue-seat-close" aria-label="Close seating details" onClick={close}>×</button>
        <p>{tableLabel(table.name)}{active.seatNumber !== undefined && ` · Seat ${active.seatNumber}`}</p>
        {active.seatNumber !== undefined ? <><h2>{guestName(active)}</h2><button onClick={() => select({ tableId: table.id })}>View all seats at this table</button></> : <><h2>Guests at this table</h2><ol>{directory ? directory.filter(entry => entry.tableId === table.id).sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0)).map((entry, index) => <li key={index}>{chairsApproved ? <button onClick={() => select({ tableId: table.id, seatNumber: entry.seatNumber })}><span>Seat {entry.seatNumber}</span><strong>{entry.fullName}</strong></button> : <span className="guide-table-guest">{entry.fullName}</span>}</li>) : snapshot.seats.filter(s => s.tableId === table.id).sort((a, b) => a.number - b.number).map(s => <li key={s.id}><button aria-pressed={false} onClick={() => select({ tableId: table.id, seatNumber: s.number })}><span>Seat {s.number}</span><strong>{seatGuest(snapshot, table.id, s.number)}</strong></button></li>)}</ol>{directory && !directory.some(entry => entry.tableId === table.id) && <p>No guests assigned to this table.</p>}</>}
      </section>}
    </div>
  </Context.Provider>;
}

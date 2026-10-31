import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { SeatingSnapshot } from "../domain/types";
import { VenuePlan } from "./VenueCanvas";
import { TableFurniture } from "./TableFurniture";
import { estimatedPlacement, footprint, layoutValidation, type Point, type TablePlacement, type VenueLayout } from "./layout";
import { eventFurnitureEstimates, eventFurnitureFootprint, eventFurnitureKinds, eventFurnitureNames } from "./eventFurniture";

export function LayoutEditor({ snapshot, layout, disabled, save, undo, redo, canUndo, canRedo }: {
  snapshot: SeatingSnapshot; layout: VenueLayout; disabled: boolean;
  save: (l: VenueLayout) => Promise<boolean>; undo: () => Promise<void>; redo: () => Promise<void>; canUndo: boolean; canRedo: boolean;
}) {
  const [selected, setSelected] = useState(snapshot.tables[0]?.id ?? "");
  const [gesture, setGesture] = useState<{ id: string; placement: TablePlacement } | null>(null);
  const drag = useRef<{ id: string; start: Point; before: TablePlacement; moved: boolean } | null>(null);
  const [status, setStatus] = useState("");
  useEffect(() => { if (!snapshot.tables.some(t => t.id === selected) && !eventFurnitureKinds.some(kind => selected === `event:${kind}`)) setSelected(snapshot.tables[0]?.id ?? "event:couple"); }, [snapshot.tables, selected]);
  useEffect(() => { if (disabled) { drag.current = null; setGesture(null); } }, [disabled]);
  function withPlacement(id: string, p: TablePlacement | null) {
    const kind = eventFurnitureKinds.find(kind => id === `event:${kind}`);
    if (kind) {
      const eventFurniture = { ...layout.eventFurniture };
      if (p) eventFurniture[kind] = p; else delete eventFurniture[kind];
      return { ...layout, eventFurniture };
    }
    const tables = { ...layout.tables };
    if (p) tables[id] = p; else delete tables[id];
    return { ...layout, tables };
  }
  const shown = gesture ? withPlacement(gesture.id, gesture.placement) : layout;
  const items = [
    ...snapshot.tables.map(t => ({ id: t.id, label: `${t.number} · ${t.name}`, targetLabel: `Position table ${t.number}: ${t.name}`,
      placement: shown.tables[t.id], round: t.shape === "round", bounds: shown.tables[t.id] ? footprint(t, shown.tables[t.id]) : null })),
    ...eventFurnitureKinds.map(kind => ({ id: `event:${kind}`, label: eventFurnitureNames[kind], targetLabel: `Position ${eventFurnitureNames[kind]}`,
      placement: shown.eventFurniture?.[kind], round: kind === "cake", bounds: shown.eventFurniture?.[kind] ? eventFurnitureFootprint(kind, shown.eventFurniture[kind]!) : null })),
  ];
  const item = items.find(item => item.id === selected);
  const validation = layoutValidation({ ...snapshot, venueLayout: shown });
  const commit = async (id: string, p: TablePlacement | null) => {
    if (disabled) return;
    setStatus("Saving layout…");
    setStatus(await save(withPlacement(id, p)) ? "Draft layout saved." : "Layout was not saved. Review the message above and try again.");
  };
  function point(e: PointerEvent<SVGGElement>): Point | null {
    const svg = e.currentTarget.ownerSVGElement, matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const local = p.matrixTransform(matrix.inverse()); return { x: local.x, y: local.y };
  }
  return <section className="layout-editor surface-card" aria-label="Table layout editor">
    <div className="panel-heading"><div><h2>Give every table its place.</h2><p>Drag guest tables, the couple’s table, and the cake table on the lawn. Save changes to the shared draft.</p></div>
      <div className="layout-actions"><button className="secondary-button" disabled={disabled || !canUndo} onClick={() => void undo()}>Undo layout</button><button className="secondary-button" disabled={disabled || !canRedo} onClick={() => void redo()}>Redo layout</button></div>
    </div>
    <div className="layout-editor-grid"><div className="layout-map">
      <VenuePlan parameters={layout.parameters} led={layout.led} landmarks={layout.landmarks} receptionOnly interactive>
        <TableFurniture snapshot={snapshot} layout={shown} />
        {items.map(item => {
          const p = item.placement, f = item.bounds; if (!p || !f) return null;
          return <g key={item.id} role="button" tabIndex={0} aria-label={item.targetLabel} aria-pressed={selected === item.id}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(item.id); } }}
            onPointerDown={e => { setSelected(item.id); if (disabled || e.button !== 0) return; const start = point(e); if (!start) return;
              e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: item.id, start, before: p, moved: false }; }}
            onPointerMove={e => { const d = drag.current; if (!d || d.id !== item.id || disabled) return; const now = point(e); if (!now) return;
              const x = Math.round((d.before.x + now.x - d.start.x) * 10) / 10, y = Math.round((d.before.y + now.y - d.start.y) * 10) / 10;
              d.moved = x !== d.before.x || y !== d.before.y; setGesture({ id: item.id, placement: { ...d.before, x, y } }); }}
            onPointerUp={() => { const d = drag.current; drag.current = null; setGesture(null); if (d?.moved && gesture && !disabled) void commit(d.id, gesture.placement); }}
            onPointerCancel={() => { drag.current = null; setGesture(null); }}
            onLostPointerCapture={() => { drag.current = null; setGesture(null); }}>
            <rect x={f.x - f.halfWidth} y={f.y - f.halfDepth} width={f.halfWidth * 2} height={f.halfDepth * 2} rx=".15" fill="transparent" stroke={selected === item.id ? "#753248" : "transparent"} strokeWidth=".09" strokeDasharray=".2 .15" />
          </g>;
        })}
      </VenuePlan>
      <p className="helper-text">Chair space and clearance checks are estimates. Use the table controls for precise adjustments.</p>
    </div><aside className="layout-controls">
      <label>Selected furniture<select aria-label="Selected furniture" value={selected} onChange={e => setSelected(e.target.value)}>{items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {item?.placement && <TableControls key={`${selected}-${JSON.stringify(item.placement)}`} placement={item.placement} round={item.round} disabled={disabled} onSave={p => void commit(item.id, p)} />}
      {item?.placement && <button className="text-button" disabled={disabled} onClick={() => void commit(item.id, null)}>Move to unplaced tray</button>}
      <h3>Couple &amp; cake tables</h3>
      <p className="helper-text">Two chairs for the couple; a separate cake display. No numbered guest seats. Sizes and positions start as estimates.</p>
      {!layout.eventFurniture?.couple && !layout.eventFurniture?.cake ? <button className="secondary-button unplaced-table" disabled={disabled} onClick={async () => {
        setSelected("event:couple"); setStatus("Saving layout…");
        setStatus(await save({ ...layout, eventFurniture: eventFurnitureEstimates(layout) }) ? "Couple and cake tables added to the shared draft." : "Layout was not saved. Review the message above and try again.");
      }}>Add couple &amp; cake tables</button> : eventFurnitureKinds.filter(kind => !layout.eventFurniture?.[kind]).map(kind => <button key={kind} className="secondary-button unplaced-table" disabled={disabled} onClick={() => {
        setSelected(`event:${kind}`); void commit(`event:${kind}`, eventFurnitureEstimates(layout)[kind]);
      }}>Place {eventFurnitureNames[kind]}</button>)}
      <p className="helper-text">Starting layout: left of the stage when facing the LED, angled 30° inward. Cake in front, offset toward the stage.</p>
      <h3>Unplaced tables</h3><p className="helper-text">Add a table to the lawn, then drag it into position.</p>
      {snapshot.tables.filter(t => !layout.tables[t.id]).map(t => <button className="secondary-button unplaced-table" key={t.id} disabled={disabled} onClick={() => { setSelected(t.id); void commit(t.id, estimatedPlacement(t)); }}>Place {t.number} · {t.name}</button>)}
      {!!snapshot.tables.length && !snapshot.tables.some(t => !layout.tables[t.id]) && <p>All guest tables are placed.</p>}
      {!snapshot.tables.length && <p>Create tables in the Tables section first.</p>}
    </aside></div>
    {validation.errors.map(e => <p className="issue error-issue" key={`${e.code}-${e.relatedIds.join()}`}>{e.message}</p>)}
    {validation.warnings.map(w => <p className="issue warning-issue" key={`${w.message}`}>{w.message}</p>)}
    <p role="status">{status}</p>
  </section>;
}
function TableControls({ placement, round, disabled, onSave }: { placement: TablePlacement; round: boolean; disabled: boolean; onSave: (p: TablePlacement) => void }) {
  const [p, setP] = useState(placement);
  return <form onSubmit={e => { e.preventDefault(); onSave({ ...p, depth: round ? p.width : p.depth }); }}>
    <div className="layout-number-fields">{(["x", "y", "rotation", "width", ...(round ? [] : ["depth"])] as const).map(key => <label key={key}>{({ x: "X position (m)", y: "Y position (m)", rotation: "Rotation (°)", width: round ? "Diameter (m)" : "Width (m)", depth: "Depth (m)" })[key]}
      <input aria-label={key === "width" && round ? "Diameter (m)" : ({ x: "X position (m)", y: "Y position (m)", rotation: "Rotation (°)", width: "Width (m)", depth: "Depth (m)" })[key]} type="number" required disabled={disabled} min={key === "rotation" ? 0 : key === "width" || key === "depth" ? .5 : -200} max={key === "rotation" ? 359.9 : key === "width" || key === "depth" ? 10 : 200} step={key === "width" || key === "depth" ? ".05" : ".1"} value={p[key as keyof Pick<TablePlacement, "x" | "y" | "width" | "depth" | "rotation">]} onChange={e => setP({ ...p, [key]: e.target.valueAsNumber })} />
    </label>)}</div>
    <label className="layout-verified"><input type="checkbox" checked={p.dimensionsVerified} disabled={disabled} onChange={e => setP({ ...p, dimensionsVerified: e.target.checked })} />Table dimensions confirmed by venue</label>
    <button className="primary-button" disabled={disabled}>Save table adjustments</button>
  </form>;
}

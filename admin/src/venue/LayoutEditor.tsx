import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { SeatingSnapshot } from "../domain/types";
import { VenuePlan } from "./VenueCanvas";
import { TableFurniture } from "./TableFurniture";
import { estimatedPlacement, footprint, layoutValidation, type Point, type TablePlacement, type VenueLayout } from "./layout";

export function LayoutEditor({ snapshot, layout, disabled, save, undo, redo, canUndo, canRedo }: {
  snapshot: SeatingSnapshot; layout: VenueLayout; disabled: boolean;
  save: (l: VenueLayout) => Promise<boolean>; undo: () => Promise<void>; redo: () => Promise<void>; canUndo: boolean; canRedo: boolean;
}) {
  const [selected, setSelected] = useState(snapshot.tables[0]?.id ?? "");
  const [gesture, setGesture] = useState<{ id: string; placement: TablePlacement } | null>(null);
  const drag = useRef<{ id: string; start: Point; before: TablePlacement; moved: boolean } | null>(null);
  const [status, setStatus] = useState("");
  useEffect(() => { if (!snapshot.tables.some(t => t.id === selected)) setSelected(snapshot.tables[0]?.id ?? ""); }, [snapshot.tables, selected]);
  useEffect(() => { if (disabled) { drag.current = null; setGesture(null); } }, [disabled]);
  const table = snapshot.tables.find(t => t.id === selected);
  const placement = table ? layout.tables[table.id] : undefined;
  const shown = gesture ? { ...layout, tables: { ...layout.tables, [gesture.id]: gesture.placement } } : layout;
  const validation = layoutValidation({ ...snapshot, venueLayout: shown });
  const commit = async (id: string, p: TablePlacement | null) => {
    if (disabled) return;
    const tables = { ...layout.tables };
    if (p) tables[id] = p; else delete tables[id];
    setStatus("Saving layout…");
    setStatus(await save({ ...layout, tables }) ? "Draft layout saved." : "Layout was not saved. Review the message above and try again.");
  };
  function point(e: PointerEvent<SVGGElement>): Point | null {
    const svg = e.currentTarget.ownerSVGElement, matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const local = p.matrixTransform(matrix.inverse()); return { x: local.x, y: local.y };
  }
  return <section className="layout-editor surface-card" aria-label="Table layout editor">
    <div className="panel-heading"><div><p className="eyebrow">Shared draft · approximate dimensions</p><h2>Give every table its place.</h2><p>Drag tables on the reception lawn. Numbered chairs move with their table.</p></div>
      <div className="layout-actions"><button className="secondary-button" disabled={disabled || !canUndo} onClick={() => void undo()}>Undo layout</button><button className="secondary-button" disabled={disabled || !canRedo} onClick={() => void redo()}>Redo layout</button></div>
    </div>
    <div className="layout-editor-grid"><div className="layout-map">
      <VenuePlan parameters={layout.parameters} led={layout.led} landmarks={layout.landmarks} receptionOnly interactive>
        <TableFurniture snapshot={snapshot} layout={shown} />
        {snapshot.tables.map(t => {
          const p = shown.tables[t.id]; if (!p) return null;
          const f = footprint(t, p);
          return <g key={t.id} role="button" tabIndex={0} aria-label={`Position table ${t.number}: ${t.name}`} aria-pressed={selected === t.id}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(t.id); } }}
            onPointerDown={e => { setSelected(t.id); if (disabled || e.button !== 0) return; const start = point(e); if (!start) return;
              e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: t.id, start, before: p, moved: false }; }}
            onPointerMove={e => { const d = drag.current; if (!d || d.id !== t.id || disabled) return; const now = point(e); if (!now) return;
              const x = Math.round((d.before.x + now.x - d.start.x) * 10) / 10, y = Math.round((d.before.y + now.y - d.start.y) * 10) / 10;
              d.moved = x !== d.before.x || y !== d.before.y; setGesture({ id: t.id, placement: { ...d.before, x, y } }); }}
            onPointerUp={() => { const d = drag.current; drag.current = null; setGesture(null); if (d?.moved && gesture && !disabled) void commit(d.id, gesture.placement); }}
            onPointerCancel={() => { drag.current = null; setGesture(null); }}
            onLostPointerCapture={() => { drag.current = null; setGesture(null); }}>
            <rect x={p.x - f.halfWidth} y={p.y - f.halfDepth} width={f.halfWidth * 2} height={f.halfDepth * 2} rx=".15" fill="transparent" stroke={selected === t.id ? "#753248" : "transparent"} strokeWidth=".09" strokeDasharray=".2 .15" />
          </g>;
        })}
      </VenuePlan>
      <p className="helper-text">Chair space and clearance checks are estimates. Use the table controls for precise adjustments.</p>
    </div><aside className="layout-controls">
      <label>Selected table<select aria-label="Selected table" value={selected} onChange={e => setSelected(e.target.value)}>{snapshot.tables.map(t => <option key={t.id} value={t.id}>{t.number} · {t.name}</option>)}</select></label>
      {table && placement && <TableControls key={`${selected}-${JSON.stringify(placement)}`} placement={placement} round={table.shape === "round"} disabled={disabled} onSave={p => void commit(table.id, p)} />}
      {table && placement && <button className="text-button" disabled={disabled} onClick={() => void commit(table.id, null)}>Move to unplaced tray</button>}
      <h3>Unplaced tables</h3><p className="helper-text">Add a table to the lawn, then drag it into position.</p>
      {snapshot.tables.filter(t => !layout.tables[t.id]).map(t => <button className="secondary-button unplaced-table" key={t.id} disabled={disabled} onClick={() => { setSelected(t.id); void commit(t.id, estimatedPlacement(t)); }}>Place {t.number} · {t.name}</button>)}
      {!snapshot.tables.some(t => !layout.tables[t.id]) && <p>All tables are placed.</p>}
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
      <input aria-label={key === "width" && round ? "Diameter (m)" : ({ x: "X position (m)", y: "Y position (m)", rotation: "Rotation (°)", width: "Width (m)", depth: "Depth (m)" })[key]} type="number" required disabled={disabled} min={key === "rotation" ? 0 : key === "width" || key === "depth" ? .5 : -200} max={key === "rotation" ? 359.9 : key === "width" || key === "depth" ? 10 : 200} step="0.1" value={p[key as keyof Pick<TablePlacement, "x" | "y" | "width" | "depth" | "rotation">]} onChange={e => setP({ ...p, [key]: e.target.valueAsNumber })} />
    </label>)}</div>
    <label className="layout-verified"><input type="checkbox" checked={p.dimensionsVerified} disabled={disabled} onChange={e => setP({ ...p, dimensionsVerified: e.target.checked })} />Table dimensions confirmed by venue</label>
    <button className="primary-button" disabled={disabled}>Save table adjustments</button>
  </form>;
}

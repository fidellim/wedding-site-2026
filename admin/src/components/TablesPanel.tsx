import { defaultSideCounts, rectangularChairs, tableSides, validSideCounts, type SideCounts } from "../domain/tableLayout";
import { TableDiagram } from "./TableDiagram";
import { useState, type FormEvent } from "react";
import type { SeatingWorkspace, TableShape } from "../domain/types";
import type { RepositoryCommand } from "../data/seatingRepository";

export function TablesPanel({
  workspace,
  disabled,
  execute,
}: {
  workspace: SeatingWorkspace;
  disabled: boolean;
  execute: (command: RepositoryCommand) => Promise<boolean>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [number, setNumber] = useState(() => workspace.draft.tables.length + 1);
  const [capacity, setCapacity] = useState(8);
  const [shape, setShape] = useState<TableShape>("round");
  const [seatOneAngle, setSeatOneAngle] = useState(0);
  const [sideCounts, setSideCounts] = useState<SideCounts>(() => defaultSideCounts(8));
  const [seatOnePosition, setSeatOnePosition] = useState(0);
  const layoutValid = validSideCounts(sideCounts, capacity);
  const chairs = rectangularChairs(sideCounts);
  const preview = { id: editingId ?? "preview", name: name || "Table preview", number, capacity,
    shape, seatOneAngle, sideCounts, seatOnePosition };
  const changeCapacity = (value: number) => {
    const next = Math.min(30, Math.max(0, Math.trunc(value)));
    setCapacity(next);
    setSideCounts(defaultSideCounts(next));
    setSeatOnePosition(0);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setNumber(Math.max(0, ...workspace.draft.tables.map((table) => table.number)) + 1);
    setCapacity(8);
    setShape("round");
    setSeatOneAngle(0);
    setSideCounts(defaultSideCounts(8));
    setSeatOnePosition(0);
  };

  const editTable = (tableId: string) => {
    const table = workspace.draft.tables.find((candidate) => candidate.id === tableId);
    if (!table) return;
    setEditingId(table.id);
    setName(table.name);
    setNumber(table.number);
    setCapacity(table.capacity);
    setShape(table.shape);
    setSeatOneAngle(table.seatOneAngle);
    setSideCounts(table.sideCounts ?? defaultSideCounts(table.capacity));
    setSeatOnePosition(table.seatOnePosition ?? 0);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || !layoutValid) return;
    const saved = await execute({
      type: "upsert_table",
      expectedVersion: workspace.draft.version,
      table: { id: editingId ?? undefined, name, number, capacity, shape, seatOneAngle, sideCounts, seatOnePosition },
    });
    if (saved) {
      const nextNumber = editingId
        ? Math.max(0, ...workspace.draft.tables.map((table) => table.number)) + 1
        : number + 1;
      setEditingId(null);
      setName("");
      setNumber(nextNumber);
      setCapacity(8);
      setShape("round");
      setSeatOneAngle(0);
      setSideCounts(defaultSideCounts(8));
      setSeatOnePosition(0);
    }
  };

  return (
    <div className="stack-layout">
      <section className="surface-card">
        <div className="panel-heading">
          <div><p className="eyebrow">Reception setup</p><h2>{editingId ? "Edit table" : "Create a table"}</h2></div>
          {editingId && <button className="text-button" type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
        <form className="inline-form" onSubmit={(event) => void save(event)}>
          <label className="grow-field"><span>Table name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="White Lily" required /></label>
          <label><span>Number</span><input type="number" min="1" value={number} onChange={(event) => setNumber(Number(event.target.value))} /></label>
          <label><span>Shape</span><select value={shape} onChange={(event) => {
            setShape(event.target.value as TableShape);
            if (event.target.value === "round") { setSideCounts(defaultSideCounts(capacity)); setSeatOnePosition(0); }
          }}><option value="round">Round</option><option value="rectangular">Rectangular</option></select></label>
          <label><span>Capacity</span><input type="number" min="1" max="30" value={capacity} onChange={(event) => changeCapacity(Number(event.target.value))} /></label>
          {shape === "round" && <label><span>Seat 1 angle (0° = top)</span><input type="number" min="0" max="359" value={seatOneAngle} onChange={(event) => setSeatOneAngle(Number(event.target.value))} /></label>}
          {shape === "rectangular" && <fieldset className="chair-settings" disabled={disabled}>
            <legend>Chairs per side</legend>
            {tableSides.map((side) => <label key={side}><span>{side[0].toUpperCase() + side.slice(1)}</span>
              <input type="number" min="0" max="30" value={sideCounts[side]} onChange={(event) => {
                setSideCounts({ ...sideCounts, [side]: Math.min(30, Math.max(0, Number(event.target.value))) });
                setSeatOnePosition(0);
              }} /></label>)}
            <p className="helper-text">{tableSides.reduce((sum, side) => sum + sideCounts[side], 0)} of {capacity} chairs configured. Changing capacity resets this arrangement.</p>
            {!layoutValid && <p role="alert">Side counts must total the table capacity.</p>}
          </fieldset>}
          {shape === "rectangular" && layoutValid && <label><span>Seat 1 chair</span><select value={seatOnePosition} onChange={(event) => setSeatOnePosition(Number(event.target.value))}>
            {chairs.map((chair, index) => <option key={index} value={index}>{chair.side} · chair {chair.index + 1} clockwise</option>)}
          </select></label>}
          <button className="primary-button" disabled={disabled || !name.trim() || !layoutValid}>{editingId ? "Save table" : "Create table"}</button>
        </form>
        {capacity >= 1 && capacity <= 30 && layoutValid && <div className="table-preview">
          <p className="helper-text">{shape === "rectangular" ? "Select a physical chair below to make it Seat 1. Changing side counts resets Seat 1 to the first clockwise chair." : "Preview · clockwise from the chosen angle."}</p>
          <TableDiagram table={preview} renderSeat={(seatNumber) => <button type="button" className={`chair-preview${seatNumber === 1 ? " is-first" : ""}`}
            disabled={disabled || shape === "round"} aria-label={`Make current seat ${seatNumber} Seat 1`}
            onClick={() => setSeatOnePosition((seatOnePosition + seatNumber - 1) % capacity)}>{seatNumber === 1 ? "Seat 1 ↻" : seatNumber}</button>} />
        </div>}
        <p className="helper-text table-form-note">Seat numbers run clockwise from the chosen orientation. Capacity can shrink only when it would not remove an assignment.</p>
      </section>
      <div className="table-summary-grid">
        {workspace.draft.tables.map((table) => (
          <article className="summary-card" key={table.id}>
            <span className="table-icon" aria-hidden="true">{table.shape === "round" ? "○" : "▭"}</span>
            <div className="summary-copy"><p>Table {String(table.number).padStart(2, "0")}</p><h3>{table.name}</h3><small>{table.capacity} numbered seats · {table.shape === "round" ? `Seat 1 at ${table.seatOneAngle}°` : "Clockwise from the selected chair"}</small></div>
            <button className="text-button" type="button" disabled={disabled} onClick={() => editTable(table.id)}>Edit</button>
          </article>
        ))}
      </div>
    </div>
  );
}

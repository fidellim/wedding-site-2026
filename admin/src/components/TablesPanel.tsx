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

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setNumber(Math.max(0, ...workspace.draft.tables.map((table) => table.number)) + 1);
    setCapacity(8);
    setShape("round");
    setSeatOneAngle(0);
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
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await execute({
      type: "upsert_table",
      expectedVersion: workspace.draft.version,
      table: { id: editingId ?? undefined, name, number, capacity, shape, seatOneAngle },
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
          <label><span>Shape</span><select value={shape} onChange={(event) => setShape(event.target.value as TableShape)}><option value="round">Round</option><option value="rectangular">Rectangular</option></select></label>
          <label><span>Capacity</span><input type="number" min="1" max="30" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label>
          <label><span>Seat 1 orientation</span><input type="number" min="0" max="359" value={seatOneAngle} onChange={(event) => setSeatOneAngle(Number(event.target.value))} /></label>
          <button className="primary-button" disabled={disabled || !name.trim()}>{editingId ? "Save table" : "Create table"}</button>
        </form>
        <p className="helper-text table-form-note">Seat numbers run clockwise from the chosen orientation. Capacity can shrink only when it would not remove an assignment.</p>
      </section>
      <div className="table-summary-grid">
        {workspace.draft.tables.map((table) => (
          <article className="summary-card" key={table.id}>
            <span className="table-icon" aria-hidden="true">{table.shape === "round" ? "○" : "▭"}</span>
            <div className="summary-copy"><p>Table {String(table.number).padStart(2, "0")}</p><h3>{table.name}</h3><small>{table.capacity} numbered seats · Seat 1 at {table.seatOneAngle}°</small></div>
            <button className="text-button" type="button" disabled={disabled} onClick={() => editTable(table.id)}>Edit</button>
          </article>
        ))}
      </div>
    </div>
  );
}

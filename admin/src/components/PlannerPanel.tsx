import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { inspectWorkspace } from "../domain/seating";
import type { Id, Invitee, Seat, SeatingWorkspace } from "../domain/types";
import type { RepositoryCommand } from "../data/seatingRepository";
import { TableDiagram } from "./TableDiagram";
import { AttendeeChip } from "./AttendeeChip";
import { useState, type ReactNode } from "react";

interface PlannerPanelProps {
  workspace: SeatingWorkspace;
  disabled: boolean;
  execute: (command: RepositoryCommand) => Promise<boolean>;
  lastMoveAuditId: Id | null;
}

function SeatTarget({
  seat,
  tableNumber,
  invitee,
  selectedInvitee,
  disabled,
  onSelectInvitee,
  onPlace,
}: {
  seat: Seat;
  tableNumber: number;
  invitee?: Invitee;
  selectedInvitee: Id | null;
  disabled: boolean;
  onSelectInvitee: (id: Id) => void;
  onPlace: (seatId: Id) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: seat.id, disabled: disabled || !!invitee });
  return (
    <div
      ref={setNodeRef}
      className={`seat-target${invitee ? " is-occupied" : ""}${isOver ? " is-over" : ""}`}
      onClick={() => {
        if (!disabled && !invitee && selectedInvitee) onPlace(seat.id);
      }}
    >
      <span className="seat-number">T{String(tableNumber).padStart(2, "0")}-S{String(seat.number).padStart(2, "0")}</span>
      {invitee ? (
        <AttendeeChip
          invitee={invitee}
          selected={selectedInvitee === invitee.id}
          disabled={disabled}
          onSelect={() => onSelectInvitee(invitee.id)}
        />
      ) : (
        <button type="button" className="empty-seat" disabled={disabled || !selectedInvitee} aria-label={`Assign selected attendee to table ${tableNumber} seat ${seat.number}`}>Available</button>
      )}
    </div>
  );
}

function UnassignedZone({ children }: { children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: "unassigned" });
  return <div ref={setNodeRef} className={`unassigned-list${isOver ? " is-over" : ""}`}>{children}</div>;
}

export function PlannerPanel({ workspace, disabled, execute, lastMoveAuditId }: PlannerPanelProps) {
  const planner = inspectWorkspace(workspace);
  const [selectedInvitee, setSelectedInvitee] = useState<Id | null>(null);
  const [draggedId, setDraggedId] = useState<Id | null>(null);
  const draggedInvitee = workspace.draft.invitees.find((invitee) => invitee.id === draggedId);
  const [view, setView] = useState<"visual" | "list">("visual");
  const [expandedId, setExpandedId] = useState<Id | null>(null);
  const visibleExpandedId = workspace.draft.tables.some((table) => table.id === expandedId) ? expandedId : null;
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const visibleInvitees = planner.unassignedInvitees.filter((invitee) =>
    invitee.fullName.toLocaleLowerCase().includes(query),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const move = async (inviteeId: Id, toSeatId: Id | null) => {
    if (disabled || (toSeatId && planner.assignmentsBySeatId.has(toSeatId))) return;
    const saved = await execute({
      type: "move_invitee",
      expectedVersion: workspace.draft.version,
      inviteeId,
      toSeatId,
    });
    if (saved) setSelectedInvitee(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    if (!event.over) return;
    const destination = String(event.over.id);
    void move(String(event.active.id), destination === "unassigned" ? null : destination);
  };

  return (
    <DndContext sensors={sensors} onDragStart={(event) => setDraggedId(String(event.active.id))} onDragCancel={() => setDraggedId(null)} onDragEnd={onDragEnd}>
      <div className="planner-layout">
        <aside className="planner-sidebar">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Work queue</p>
              <h2>Unassigned</h2>
            </div>
            <span className="count-badge">{planner.unassignedInvitees.length}</span>
          </div>
          <p className="helper-text">Drag a name onto a seat, or select a name and then an available seat.</p>
          <div className="field">
            <label htmlFor="unassigned-search">Search unassigned guests</label>
            <input
              id="unassigned-search"
              type="search"
              placeholder="Type a guest name"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedInvitee(null);
              }}
            />
          </div>
          {search && (
            <button className="text-button" type="button" onClick={() => setSearch("")}>
              Clear search
            </button>
          )}
          {query && (
            <p className="helper-text" role="status">
              Showing {visibleInvitees.length} of {planner.unassignedInvitees.length} unassigned guests
            </p>
          )}
          <UnassignedZone>
            {visibleInvitees.map((invitee) => (
              <AttendeeChip
                key={invitee.id}
                invitee={invitee}
                selected={selectedInvitee === invitee.id}
                disabled={disabled}
                onSelect={() => setSelectedInvitee(invitee.id)}
              />
            ))}
            {!planner.unassignedInvitees.length && <p className="empty-state">Everyone has a place.</p>}
            {planner.unassignedInvitees.length > 0 && !visibleInvitees.length && (
              <p className="empty-state">No guests match. Try another name or clear the search.</p>
            )}
          </UnassignedZone>
        </aside>

        <section className="table-canvas">
          <div className="canvas-toolbar">
            <div>
              <p className="eyebrow">Reception layout</p>
              <h2>Numbered seats</h2>
            </div>
            <div className="canvas-actions">
              <p>{planner.occupiedSeatCount} of {planner.totalSeatCount} seats assigned</p>
              <button
                className="secondary-button"
                type="button"
                disabled={disabled || !lastMoveAuditId}
                onClick={() => lastMoveAuditId && void execute({
                  type: "undo_move",
                  expectedVersion: workspace.draft.version,
                  auditId: lastMoveAuditId,
                })}
              >
                Undo latest move
              </button>
            </div>
          </div>
          <div className="view-toolbar">
            <div className="view-switch" role="group" aria-label="Seating view">
              <button type="button" aria-pressed={view === "visual"} onClick={() => setView("visual")}>Visual</button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
            </div>
            {selectedInvitee && !disabled && <button type="button" className="text-button" onClick={() => void move(selectedInvitee, null)}>Move selected attendee to Unassigned</button>}
          </div>
          {view === "visual" && <p className="helper-text">Expand for full names and larger controls. Scroll within larger diagrams to see every seat. Seats run clockwise.</p>}
          {!workspace.draft.tables.length && <p className="empty-state">Create a table in Tables to start assigning seats.</p>}
          <div className="table-grid">
            {workspace.draft.tables.filter((table) => !visibleExpandedId || table.id === visibleExpandedId).map((table) => {
              const seats = workspace.draft.seats
                .filter((seat) => seat.tableId === table.id)
                .sort((a, b) => a.number - b.number);
              const renderSeat = (number: number) => {
                const seat = seats.find((candidate) => candidate.number === number);
                return seat && <SeatTarget seat={seat} tableNumber={table.number}
                  invitee={planner.assignmentsBySeatId.get(seat.id)} selectedInvitee={selectedInvitee}
                  disabled={disabled} onSelectInvitee={setSelectedInvitee}
                  onPlace={(seatId) => selectedInvitee && void move(selectedInvitee, seatId)} />;
              };
              return (
                <article className={`seating-table table-${table.shape}${expandedId === table.id ? " expanded-table" : ""}`} key={table.id}>
                  <header>
                    <span>Table {table.number}</span>
                    <h3>{table.name}</h3>
                    <small>{seats.filter((seat) => planner.assignmentsBySeatId.has(seat.id)).length}/{table.capacity}</small>
                  </header>
                  <button type="button" className="text-button table-expand" aria-expanded={expandedId === table.id}
                    onClick={() => setExpandedId(expandedId === table.id ? null : table.id)}>
                    {expandedId === table.id ? "Back to all tables" : `Expand table ${table.number}`}
                  </button>
                  {view === "visual" ? <TableDiagram table={table} expanded={expandedId === table.id} renderSeat={renderSeat} /> : (
                    <div className="seat-grid">{seats.map((seat) => <div key={seat.id}>{renderSeat(seat.number)}</div>)}</div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
      <DragOverlay>{draggedInvitee && <div className="dragged-attendee">{draggedInvitee.fullName}</div>}</DragOverlay>
    </DndContext>
  );
}

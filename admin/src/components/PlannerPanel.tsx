import {
  DndContext,
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
  const { isOver, setNodeRef } = useDroppable({ id: seat.id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`seat-target${invitee ? " is-occupied" : ""}${isOver ? " is-over" : ""}`}
      onClick={() => {
        if (!invitee && selectedInvitee) onPlace(seat.id);
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
        <span className="empty-seat">Available</span>
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const move = async (inviteeId: Id, toSeatId: Id | null) => {
    const saved = await execute({
      type: "move_invitee",
      expectedVersion: workspace.draft.version,
      inviteeId,
      toSeatId,
    });
    if (saved) setSelectedInvitee(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const destination = String(event.over.id);
    void move(String(event.active.id), destination === "unassigned" ? null : destination);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
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
          <UnassignedZone>
            {planner.unassignedInvitees.map((invitee) => (
              <AttendeeChip
                key={invitee.id}
                invitee={invitee}
                selected={selectedInvitee === invitee.id}
                disabled={disabled}
                onSelect={() => setSelectedInvitee(invitee.id)}
              />
            ))}
            {!planner.unassignedInvitees.length && <p className="empty-state">Everyone has a place.</p>}
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
          <div className="table-grid">
            {workspace.draft.tables.map((table) => {
              const seats = workspace.draft.seats
                .filter((seat) => seat.tableId === table.id)
                .sort((a, b) => a.number - b.number);
              return (
                <article className={`seating-table table-${table.shape}`} key={table.id}>
                  <header>
                    <span>Table {table.number}</span>
                    <h3>{table.name}</h3>
                    <small>{seats.filter((seat) => planner.assignmentsBySeatId.has(seat.id)).length}/{table.capacity}</small>
                  </header>
                  <div className="seat-grid">
                    {seats.map((seat) => (
                      <SeatTarget
                        key={seat.id}
                        seat={seat}
                        tableNumber={table.number}
                        invitee={planner.assignmentsBySeatId.get(seat.id)}
                        selectedInvitee={selectedInvitee}
                        disabled={disabled}
                        onSelectInvitee={setSelectedInvitee}
                        onPlace={(seatId) => selectedInvitee && void move(selectedInvitee, seatId)}
                      />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </DndContext>
  );
}

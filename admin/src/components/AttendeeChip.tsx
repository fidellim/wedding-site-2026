import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import type { Invitee } from "../domain/types";

interface AttendeeChipProps {
  invitee: Invitee;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

export function AttendeeChip({ invitee, selected, disabled, onSelect }: AttendeeChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: invitee.id,
    disabled,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`attendee-chip${selected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <span className="attendee-initials" aria-hidden="true">
        {invitee.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}
      </span>
      <span>{invitee.fullName}</span>
    </button>
  );
}


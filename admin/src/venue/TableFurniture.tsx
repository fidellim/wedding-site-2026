import { tableLabel, tableTopLabel } from "./tableLabel";
import { useVenueInspection, sameTarget, seatGuest, type FurnitureTarget } from "./VenueInspection";
import type { SeatingSnapshot } from "../domain/types";
import { physicalChairs, type VenueLayout } from "./layout";

export function TableFurniture({ snapshot, layout }: { snapshot: SeatingSnapshot; layout: VenueLayout }) {
  const inspection = useVenueInspection();
  function interaction(target: FurnitureTarget, label: string) {
    if (!inspection) return {};
    return {
      role: "button", tabIndex: 0, "aria-label": label, "aria-pressed": sameTarget(inspection.active, target),
      "data-furniture-target": "", className: "venue-furniture-target",
      onClick: (event: React.MouseEvent<SVGGElement>) => { event.stopPropagation(); event.currentTarget.focus(); inspection.select(target); },
      onMouseEnter: (event: React.MouseEvent<SVGGElement>) => inspection.peek({ target, x: event.clientX, y: event.clientY }),
      onMouseLeave: () => inspection.peek(null),
      onFocus: (event: React.FocusEvent<SVGGElement>) => { const rect = event.currentTarget.getBoundingClientRect(); inspection.peek({ target, x: rect.right, y: rect.top }); },
      onBlur: () => inspection.peek(null),
      onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inspection.select(target); } },
    };
  }
  return <g>{snapshot.tables.map(t => {
    const p = layout.tables[t.id]; if (!p) return null;
    return <g key={t.id} transform={`translate(${p.x},${p.y}) rotate(${p.rotation})`}>
      <g {...interaction({ tableId: t.id }, `${tableLabel(t.name)} · View guests`)}>
      {t.shape === "round" ? <circle r={p.width / 2} fill="#fbf4e5" stroke="#7c634a" strokeWidth=".06" />
        : <rect x={-p.width / 2} y={-p.depth / 2} width={p.width} height={p.depth} rx=".08" fill="#fbf4e5" stroke="#7c634a" strokeWidth=".06" />}
      </g>
      {physicalChairs(t, p).map(chair => {
        const seat = snapshot.seats.find(s => s.tableId === t.id && s.number === chair.number);
        const assignment = snapshot.assignments.find(a => a.seatId === seat?.id);
        const name = snapshot.invitees.find(i => i.id === assignment?.inviteeId)?.fullName;
        return <g key={chair.number} {...interaction({ tableId: t.id, seatNumber: chair.number }, `${tableLabel(t.name)} · Seat ${chair.number} · ${seatGuest(snapshot, t.id, chair.number)}`)} transform={`translate(${chair.x},${chair.y})`}>
          <circle r=".22" fill={assignment ? "#753248" : "#e4d2ad"} stroke="#725c46" strokeWidth=".04" />
          <text transform={`rotate(${-p.rotation})`} textAnchor="middle" dominantBaseline="central" fontSize=".21" fill={assignment ? "white" : "#342b25"}>{chair.number}</text>
          {!inspection && <title>{tableLabel(t.name)} · Seat {chair.number}{name ? ` · ${name}` : " · Empty"}</title>}
        </g>;
      })}
      <text pointerEvents="none" transform={`rotate(${-p.rotation})`} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(.72, p.width * .95 / Math.max(1, tableTopLabel(t.name).length * .57))} fontWeight="700" fill="#273b29" stroke="#fffdf7" strokeWidth=".09" paintOrder="stroke">{tableTopLabel(t.name)}</text>
      {!inspection && <title>Table {t.number}: {t.name}{p.dimensionsVerified ? "" : " · Estimated dimensions"}</title>}
    </g>;
  })}</g>;
}

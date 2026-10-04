import type { SeatingSnapshot } from "../domain/types";
import { physicalChairs, type VenueLayout } from "./layout";

export function TableFurniture({ snapshot, layout }: { snapshot: SeatingSnapshot; layout: VenueLayout }) {
  return <g>{snapshot.tables.map(t => {
    const p = layout.tables[t.id]; if (!p) return null;
    return <g key={t.id} transform={`translate(${p.x},${p.y}) rotate(${p.rotation})`}>
      {t.shape === "round" ? <circle r={p.width / 2} fill="#fbf4e5" stroke="#7c634a" strokeWidth=".06" />
        : <rect x={-p.width / 2} y={-p.depth / 2} width={p.width} height={p.depth} rx=".08" fill="#fbf4e5" stroke="#7c634a" strokeWidth=".06" />}
      {physicalChairs(t, p).map(chair => {
        const seat = snapshot.seats.find(s => s.tableId === t.id && s.number === chair.number);
        const assignment = snapshot.assignments.find(a => a.seatId === seat?.id);
        const name = snapshot.invitees.find(i => i.id === assignment?.inviteeId)?.fullName;
        return <g key={chair.number} transform={`translate(${chair.x},${chair.y})`}>
          <circle r=".22" fill={assignment ? "#753248" : "#e4d2ad"} stroke="#725c46" strokeWidth=".04" />
          <text transform={`rotate(${-p.rotation})`} textAnchor="middle" dominantBaseline="central" fontSize=".21" fill={assignment ? "white" : "#342b25"}>{chair.number}</text>
          <title>{t.name} · Seat {chair.number}{name ? ` · ${name}` : " · Empty"}</title>
        </g>;
      })}
      <text transform={`rotate(${-p.rotation})`} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(.3, p.width * .85 / Math.max(1, t.name.length * .6))} fill="#46392e">{t.name}</text>
      <title>Table {t.number}: {t.name}{p.dimensionsVerified ? "" : " · Estimated dimensions"}</title>
    </g>;
  })}</g>;
}

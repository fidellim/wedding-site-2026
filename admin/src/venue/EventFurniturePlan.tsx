import type { VenueLayout } from "./layout";
import { coupleChairs, eventFurnitureKinds, eventFurnitureNames } from "./eventFurniture";

export function EventFurniture({ layout }: { layout: VenueLayout }) {
  return <g>{eventFurnitureKinds.map(kind => {
    const p = layout.eventFurniture?.[kind]; if (!p) return null;
    return <g key={kind} data-event-furniture={kind} transform={`translate(${p.x},${p.y}) rotate(${p.rotation})`}>
      <title>{eventFurnitureNames[kind]} · {kind === "couple" ? "Bride and groom · two chairs" : "Cake display · no guest seats"}{p.dimensionsVerified ? "" : " · Estimated dimensions"}</title>
      {kind === "couple" ? <>
        {coupleChairs(p).map((chair, index) => <g key={index} data-couple-chair="" transform={`translate(${chair.x},${chair.y})`}>
          <rect x="-.23" y="-.23" width=".46" height=".46" rx=".08" fill="#fffdf7" stroke="#a88a52" strokeWidth=".045" />
          <path d="M -.2 .2 H .2" stroke="#a88a52" strokeWidth=".07" />
        </g>)}
        <rect x={-p.width / 2} y={-p.depth / 2} width={p.width} height={p.depth} rx=".08" fill="#fffdf7" stroke="#a88a52" strokeWidth=".06" />
      </> : <>
        <circle r={p.width / 2} fill="#fffdf7" stroke="#a88a52" strokeWidth=".05" />
        <circle r={p.width * .28} fill="#f4ead7" stroke="#a88a52" strokeWidth=".035" />
        <circle r={p.width * .16} fill="#fffdf7" stroke="#a88a52" strokeWidth=".025" />
      </>}
      <g transform={`rotate(${-p.rotation})`} pointerEvents="none">
        <path d={kind === "couple" ? "M .5 .5 L 1.2 1.4 H 1.5" : "M -.35 -.35 L -1.1 -1.2 H -1.5"} fill="none" stroke="#7c634a" strokeWidth=".04" />
        <text x={kind === "couple" ? 1.6 : -1.6} y={kind === "couple" ? 1.4 : -1.2}
          textAnchor={kind === "couple" ? "start" : "end"} dominantBaseline="central" fontSize=".65" fontWeight="600" fill="#46392e" stroke="#fffdf7" strokeWidth=".08" paintOrder="stroke">{eventFurnitureNames[kind]}</text>
      </g>
    </g>;
  })}</g>;
}

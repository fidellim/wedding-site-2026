import { equipmentDescriptions, productionEquipment } from "./productionEquipment";

/** Plan projections share the equipment's exact table-relative positions with 3D. */
export function ProductionEquipmentPlan({ kind }: { kind: string }) {
  const colors = { case: "#303238", metal: "#a6adb3", screen: "#50787f", control: "#bda36e" };
  return <g aria-label={`${equipmentDescriptions[kind]} · Representative equipment`}>
    {productionEquipment(kind).map((part, index) => <g key={index} data-production-equipment={part.name}>
      {part.shape === "disc" ? <circle cx={part.x} cy={part.y} r={part.width / 2} fill={colors[part.finish]} />
        : part.shape === "headband" ? <path d={`M ${part.x - part.width / 2} ${part.y} a ${part.width / 2} ${part.depth / 2} 0 0 0 ${part.width} 0`} fill="none" stroke={colors[part.finish]} strokeWidth=".025" />
        : <rect x={part.x - part.width / 2} y={part.y - part.depth / 2} width={part.width} height={part.depth} fill={colors[part.finish]} />}
    </g>)}
  </g>;
}

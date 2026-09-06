import type { SeatingTable } from "./types";

export const tableSides = ["top", "right", "bottom", "left"] as const;
export type TableSide = typeof tableSides[number];
export type SideCounts = Record<TableSide, number>;

export function defaultSideCounts(capacity: number): SideCounts {
  return { top: Math.ceil(capacity / 2), right: 0, bottom: Math.floor(capacity / 2), left: 0 };
}

export function validSideCounts(counts: SideCounts, capacity: number) {
  return tableSides.every((side) => Number.isInteger(counts[side]) && counts[side] >= 0)
    && tableSides.reduce((sum, side) => sum + counts[side], 0) === capacity;
}

export function rectangularChairs(counts: SideCounts) {
  return tableSides.flatMap((side) => Array.from({ length: counts[side] }, (_, index) => ({ side, index })));
}

export function tableLayout(table: SeatingTable, expanded = false) {
  const seatWidth = expanded ? 200 : 116;
  const seatHeight = expanded ? 120 : 70;
  const gap = 18;
  const insetX = seatWidth / 2 + gap;
  const insetY = seatHeight / 2 + gap;
  if (table.shape === "round") {
    // The diagonal spacing keeps horizontal name cards apart at every angle.
    const radius = Math.max(145, (Math.hypot(seatWidth, seatHeight) + gap) / (2 * Math.sin(Math.PI / Math.max(2, table.capacity))));
    const cx = radius + insetX;
    const cy = radius + insetY;
    const surfaceRadius = Math.max(65, radius - Math.hypot(seatWidth, seatHeight) / 2 - gap);
    return {
      width: cx * 2, height: cy * 2, seatWidth, seatHeight,
      surface: { left: cx - surfaceRadius, top: cy - surfaceRadius, width: surfaceRadius * 2, height: surfaceRadius * 2 },
      seats: Array.from({ length: table.capacity }, (_, index) => {
        const angle = ((table.seatOneAngle + index * 360 / table.capacity) * Math.PI) / 180;
        return { number: index + 1, x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) };
      }),
    };
  }
  const counts = table.sideCounts ?? defaultSideCounts(table.capacity);
  const chairs = rectangularChairs(counts);
  const width = Math.max(300, Math.max(counts.top, counts.bottom) * (seatWidth + gap));
  const height = Math.max(170, Math.max(counts.left, counts.right) * (seatHeight + gap));
  const left = seatWidth + gap * 2;
  const top = seatHeight + gap * 2;
  const first = table.seatOnePosition ?? 0;
  return {
    width: width + left * 2, height: height + top * 2, seatWidth, seatHeight,
    surface: { left, top, width, height },
    seats: chairs.map(({ side, index }, position) => {
      const fraction = (index + .5) / counts[side];
      const x = side === "top" ? left + fraction * width : side === "bottom" ? left + (1 - fraction) * width : side === "right" ? left + width + insetX : left - insetX;
      const y = side === "right" ? top + fraction * height : side === "left" ? top + (1 - fraction) * height : side === "top" ? top - insetY : top + height + insetY;
      return { number: (position - first + table.capacity) % table.capacity + 1, x, y };
    }),
  };
}

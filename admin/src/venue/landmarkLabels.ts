export interface LabelObstacle { left: number; top: number; width: number; height: number }
interface Anchor { id: string; x: number; y: number; width: number; height: number }
export interface LandmarkCallout extends Anchor { left: number; top: number; lineX: number; lineY: number }
const order = ["lawn", "stage", "plaza", "entrance", "pavilion", "sand", "water"];
const preferred: Record<string, [number, number]> = {
  lawn: [44, -22], stage: [42, 20], plaza: [40, -54], entrance: [28, -52],
  pavilion: [-190, -36], sand: [-130, 24], water: [36, 18],
};

/** Screen-space placement preserves the physical anchor without covering it with a tag. */
export function placeLandmarkLabels(anchors: Anchor[], width: number, height: number, obstacles: readonly LabelObstacle[] = []): LandmarkCallout[] {
  const placed: LandmarkCallout[] = [];
  const padding = 12, gap = 10;
  for (const anchor of [...anchors].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))) {
    if (anchor.width > width - padding * 2 || anchor.height > height - padding * 2) continue;
    const first = preferred[anchor.id] ?? [30, -40];
    const offsets: [number, number][] = [first, [28, -anchor.height - 18], [-anchor.width - 28, -anchor.height - 18],
      [28, 24], [-anchor.width - 28, 24], [-anchor.width / 2, -anchor.height - 72], [-anchor.width / 2, 70]];
    for (const [dx, dy] of offsets) {
      const left = Math.max(padding, Math.min(width - padding - anchor.width, anchor.x + dx));
      const top = Math.max(padding, Math.min(height - padding - anchor.height, anchor.y + dy));
      if ([...placed, ...obstacles].some(p => left < p.left + p.width + gap && left + anchor.width + gap > p.left
        && top < p.top + p.height + gap && top + anchor.height + gap > p.top)) continue;
      // Do not put the tag on its own anchor, even when clamped at a viewport edge.
      if (anchor.x >= left - 8 && anchor.x <= left + anchor.width + 8 && anchor.y >= top - 8 && anchor.y <= top + anchor.height + 8) continue;
      placed.push({ ...anchor, left, top, lineX: Math.max(left, Math.min(left + anchor.width, anchor.x)), lineY: Math.max(top, Math.min(top + anchor.height, anchor.y)) });
      break;
    }
  }
  return placed;
}

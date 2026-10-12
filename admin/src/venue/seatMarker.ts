import { placeLandmarkLabels, type LabelObstacle } from "./landmarkLabels";

interface MarkerAnchor { x: number; y: number; visible: boolean }
interface MarkerSize { width: number; height: number }

/** Keep the selected seat readable, including when its projected position leaves the view. */
export function placeSeatMarker(anchor: MarkerAnchor, size: MarkerSize, width: number, height: number, obstacles: readonly LabelObstacle[]) {
  const overlaps = (box: LabelObstacle) => obstacles.some(p => box.left < p.left + p.width + 10
    && box.left + box.width + 10 > p.left && box.top < p.top + p.height + 10 && box.top + box.height + 10 > p.top);
  const covered = obstacles.some(p => anchor.x >= p.left && anchor.x <= p.left + p.width && anchor.y >= p.top && anchor.y <= p.top + p.height);
  if (anchor.visible && !covered) {
    const callout = placeLandmarkLabels([{ id: "seat", ...anchor, ...size }], width, height, obstacles)[0];
    if (callout) return { ...callout, edge: false, angle: 0 };
  }
  const padding = 16, maxX = width - padding - size.width, maxY = height - padding - size.height;
  if (maxX < padding || maxY < padding) return null;
  const dx = anchor.x - width / 2, dy = anchor.y - height / 2;
  const distance = Math.min((width / 2 - padding - size.width / 2) / Math.max(Math.abs(dx), .001),
    (height / 2 - padding - size.height / 2) / Math.max(Math.abs(dy), .001));
  const desired = { left: width / 2 + dx * distance - size.width / 2, top: height / 2 + dy * distance - size.height / 2 };
  const candidates: LabelObstacle[] = [];
  for (let i = 0; i <= 20; i++) {
    const x = padding + (maxX - padding) * i / 20, y = padding + (maxY - padding) * i / 20;
    candidates.push({ left: x, top: padding, ...size }, { left: x, top: maxY, ...size },
      { left: padding, top: y, ...size }, { left: maxX, top: y, ...size });
  }
  const score = (box: LabelObstacle) => (box.left - desired.left) ** 2 + (box.top - desired.top) ** 2;
  const box = candidates.filter(box => !overlaps(box)).sort((a, b) => score(a) - score(b))[0];
  return box ? { ...box, x: anchor.x, y: anchor.y, lineX: 0, lineY: 0, edge: true,
    angle: Math.atan2(anchor.y - box.top - size.height / 2, anchor.x - box.left - size.width / 2) } : null;
}

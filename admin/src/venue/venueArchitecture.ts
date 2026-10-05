import { normalizeParameters, venueLayout, type VenueParameters } from "./venueModel";

export interface PlanPoint { x: number; y: number }
/** A continuous strip with mitered corners, shared by the canal banks and water. */
export function ribbonPolygon(points: PlanPoint[], width: number): PlanPoint[] {
  const sides = [-1, 1].map(side => points.map((point, i) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1;
    const next = i < points.length - 1 ? after : point, prev = i < points.length - 1 ? point : before;
    const segmentLength = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
    const cosine = Math.abs((dx * (next.x - prev.x) + dy * (next.y - prev.y)) / (length * segmentLength));
    const offset = side * width / 2 / Math.max(.5, cosine);
    return { x: point.x - dy / length * offset, y: point.y + dx / length * offset };
  }));
  return [...sides[0], ...sides[1].reverse()];
}

/** Even spacing along a polyline, including its curved sections. */
function spacedPoints(points: PlanPoint[], spacing: number): PlanPoint[] {
  const result: PlanPoint[] = [{ ...points[0] }];
  let remaining = spacing;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    let distance = remaining;
    for (; distance <= length; distance += spacing) {
      const t = distance / length;
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    remaining = distance - length;
  }
  return result;
}

/** Video-informed reconstruction. Distances and the unseen canal course remain estimates. */
export function venueArchitecture(input: VenueParameters) {
  const p = normalizeParameters(input), l = venueLayout(p), half = p.lawnWidth / 2;
  const stairLeft = l.stairX - p.stairWidth / 2, stairRight = l.stairX + p.stairWidth / 2;
  const curveRight = half - .5;
  const curveLeft = Math.min(curveRight - .2, Math.max(stairRight + .4, l.plazaX - l.plazaWidth * .4));
  const frontage = Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return { x: curveLeft + (curveRight - curveLeft) * t,
      y: l.terraceFront + Math.sin(t * Math.PI) * Math.min(1.2, p.stairCount * p.stairTread * .4) };
  });
  const connectionBoundary = l.plazaX - l.plazaWidth / 2 - .5;
  const retainingEdges = [
    [{ x: l.terraceLeft, y: l.terraceFront }, { x: stairLeft, y: l.terraceFront }],
    [{ x: stairRight, y: l.terraceFront }, ...frontage.filter(point => point.x >= stairRight), { x: half, y: l.terraceFront }],
  ];
  const gapLeft = l.pavilionX + p.pavilionDiameter * .585 + .8;
  const gapRight = l.plazaX - l.plazaWidth / 2 - .5;
  const gapWidth = gapRight - gapLeft;
  const beds = [{ id: "connection", x: (gapLeft + gapRight) / 2,
    y: l.terraceFront - 6, width: Math.min(4.5, gapWidth), depth: 2.6 }];
  const potCount = Math.max(0, Math.min(3, Math.floor((stairLeft - l.terraceLeft - 1) / 2.2)));
  const pots = Array.from({ length: potCount }, (_, i) => ({ x: l.terraceLeft + 1.1 + i * 2.2, y: l.terraceFront - .9, radius: .55 }));
  // Compact fixtures use two longitudinal rows, outside the tree planter.
  const fixtures = [
    { id: "guest-book", label: "Guest book", x: gapLeft + gapWidth * .25, y: l.pavilionTerraceBack + 2.2, width: 1.2, depth: .6, height: .85 },
    { id: "photobooth", label: "Photobooth", x: gapLeft + gapWidth * .75, y: l.pavilionTerraceBack + 2.2, width: 2, depth: 1.2, height: 2 },
    { id: "pinkberry", label: "Pinkberry stand", x: gapLeft + gapWidth * .25, y: l.terraceFront - 3, width: 1.5, depth: .7, height: 1 },
    { id: "seat-sign", label: "Seat signage", x: gapLeft + gapWidth * .75, y: l.terraceFront - 3, width: .8, depth: .3, height: 1.6 },
  ].filter(fixture => fixture.x - fixture.width / 2 > gapLeft && fixture.x + fixture.width / 2 < gapRight);

  const canalX = l.plazaX - p.approachWidth / 2 - 2.3;
  const bridgeWidth = Math.min(2.4, p.approachWidth), deckSpan = 3.4 + bridgeWidth * 2;
  const flightRun = p.bridgeStepCount * p.bridgeTread;
  const bridgeY = l.entranceY + Math.min(10, p.approachLength - bridgeWidth / 2 - flightRun - 8);
  const flightX = canalX + deckSpan / 2 - bridgeWidth / 2;
  const flightTopY = bridgeY + bridgeWidth / 2;
  const bridge = { x: canalX, y: bridgeY, width: bridgeWidth, deckSpan, rise: p.bridgeHeight,
    steps: p.bridgeStepCount, tread: p.bridgeTread, flightX, flightTopY, flightRun,
    flightBottomY: flightTopY + flightRun };
  // The visible stair flight runs along the bank and turns at the landing to cross the canal.
  const bypassX = flightX + bridgeWidth / 2 + .6 + p.approachWidth / 2;
  const pathCenters = [
    { x: bypassX, y: l.entranceY },
    { x: bypassX, y: bridge.flightBottomY + 1 },
    { x: l.plazaX, y: l.terraceBack - 6 },
    { x: l.plazaX, y: l.terraceBack },
  ];
  const pathLeft = pathCenters.map(point => ({ x: point.x - p.approachWidth / 2, y: point.y }));
  const pathRight = pathCenters.map(point => ({ x: point.x + p.approachWidth / 2, y: point.y }));
  const approach = [...pathLeft, ...pathRight.slice().reverse()];
  const canalSpine = [{ x: canalX, y: l.entranceY }, { x: canalX, y: l.terraceBack - 7 },
    ...Array.from({ length: 8 }, (_, i) => {
      const angle = (i + 1) / 8 * Math.PI / 2;
      return { x: canalX - 4 + Math.cos(angle) * 4, y: l.terraceBack - 7 + Math.sin(angle) * 4 };
    }), { x: connectionBoundary - 2.7, y: l.terraceBack - 3 },
    { x: connectionBoundary - 2.7, y: l.pavilionTerraceBack - 7 },
    ...Array.from({ length: 8 }, (_, i) => {
      const angle = (i + 1) / 8 * Math.PI / 2;
      return { x: connectionBoundary - 6.7 + Math.cos(angle) * 4, y: l.pavilionTerraceBack - 7 + Math.sin(angle) * 4 };
    }), { x: l.terraceLeft + 2, y: l.pavilionTerraceBack - 3 }];
  const canal = ribbonPolygon(canalSpine, 3.4);
  const bankSpine = canalSpine.map(point => ({ ...point }));
  bankSpine[0].y -= .3; bankSpine[bankSpine.length - 1].x -= .3;
  const canalBank = ribbonPolygon(bankSpine, 4);
  // The terrace shares the venue-side bank contour instead of a rectangular notch.
  // The first ribbon side is right of the downstream direction: toward the venue.
  const canalTerraceEdge = ribbonPolygon(canalSpine, 4).slice(1, canalSpine.length);
  const terrace = [{ x: l.terraceLeft, y: canalTerraceEdge.at(-1)!.y },
    ...canalTerraceEdge.slice().reverse(),
    { x: canalTerraceEdge[0].x, y: l.terraceBack }, { x: half, y: l.terraceBack },
    { x: half, y: l.terraceFront }, ...frontage.slice().reverse(), { x: l.terraceLeft, y: l.terraceFront }];
  const canalCurvePosts = spacedPoints(canalTerraceEdge, 2.5);
  // A planted ribbon follows the pavilion bend, leaving ceremony paving clear.
  const canalPlantingSpine = ribbonPolygon(canalSpine, 6.8).slice(11, canalSpine.length);
  const canalPlanting = ribbonPolygon(canalPlantingSpine, 1.1);
  const canalTrees = spacedPoints(canalPlantingSpine, 5.5).map((point, i) => ({ ...point, kind: i % 2 ? "shade" : "palm" }));
  const approachBeds = pathRight.slice(0, -1).flatMap((point, i) => {
    const depth = pathRight[i + 1].y - point.y;
    const count = Math.max(1, Math.floor(depth / 5));
    return Array.from({ length: count }, (_, j) => ({ x: Math.max(point.x, pathRight[i + 1].x) + .8,
      y: point.y + depth * (j + .5) / count, width: 1.1, depth: Math.min(3.5, depth / count - .6) }));
  });
  // Support the longer walking route and the bridge stair foot without paving over the water.
  const apron = [{ x: canalX + 1.7, y: l.entranceY }, { x: bypassX + p.approachWidth / 2 + 1.5, y: l.entranceY },
    { x: bypassX + p.approachWidth / 2 + 1.5, y: l.terraceBack },
    { x: l.plazaX - p.approachWidth / 2, y: l.terraceBack }, { x: canalX + 1.7, y: l.terraceBack - 7 }];

  return { terrace, retainingEdges, beds, pots, fixtures, stairLeft, stairRight,
    approach, pathLeft, pathRight, canal, canalSpine, canalBank, canalTerraceEdge, canalCurvePosts,
    canalPlanting, canalPlantingSpine, canalTrees, canalX, bridgeY, bridge, approachBeds, apron };
}
export function polygonPoints(points: PlanPoint[]) { return points.map(p => `${p.x},${p.y}`).join(" "); }

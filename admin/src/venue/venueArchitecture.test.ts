import { describe, expect, it } from "vitest";
import { venueArchitecture } from "./venueArchitecture";
import { defaultParameters, normalizeParameters, parameterDefinitions, parameterKeys, venueLayout } from "./venueModel";

describe("video-informed terrace circulation", () => {
  it("keeps the canal-side route clear of the bridge stairs and planting as path width changes", () => {
    for (const approachWidth of [2, 3, 5]) {
      const p = { ...defaultParameters, approachWidth }, a = venueArchitecture(p), l = venueLayout(p);
      // Stair flight runs along the canal bank; the walkway bypasses its outer side.
      const stairFoot = a.bridge.flightX + a.bridge.width / 2;
      expect(a.pathLeft[0].x).toBeGreaterThan(stairFoot + .3);
      expect(a.pathLeft[1].x).toBeGreaterThan(stairFoot + .3);
      expect(a.pathLeft.at(-1)?.y).toBe(l.terraceBack);
      expect((a.pathLeft.at(-1)!.x + a.pathRight.at(-1)!.x) / 2).toBe(l.plazaX);
      for (const bed of a.approachBeds) expect(bed.x - bed.width / 2).toBeGreaterThan(Math.min(...a.pathRight.map(point => point.x)));
      expect(a.approach.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    }
  });
  it("extends the approach and returns the canal behind the pavilion without cutting the plaza", () => {
    const p = defaultParameters, a = venueArchitecture(p), l = venueLayout(p);
    expect(l.terraceBack - l.entranceY).toBe(36);
    expect(l.plazaWidth * p.plazaLength).toBeGreaterThan(18 * 20 * 1.5);
    expect(a.canalSpine.at(-1)!.x).toBeLessThan(l.pavilionX);
    expect(a.canalSpine.at(-1)!.y).toBeLessThan(l.pavilionTerraceBack);
    const inside = (point: { x: number; y: number }) => {
      let contained = false;
      for (let i = 0, j = a.terrace.length - 1; i < a.terrace.length; j = i++) {
        const first = a.terrace[i], second = a.terrace[j];
        if ((first.y > point.y) !== (second.y > point.y)
          && point.x < (second.x - first.x) * (point.y - first.y) / (second.y - first.y) + first.x) contained = !contained;
      }
      return contained;
    };
    expect(a.canal.every(point => !inside(point))).toBe(true);
    expect(a.beds.find(bed => bed.id === "connection")?.width).toBe(4.5);
  });
  it("keeps the turning flight and bypass ordered across all approach extremes", () => {
    for (const edge of ["min", "max"] as const) {
      const p = normalizeParameters(Object.fromEntries(parameterKeys.map(key => [key, parameterDefinitions[key][edge]])));
      const a = venueArchitecture(p), l = venueLayout(p);
      expect(a.bridge.flightBottomY).toBeLessThan(l.terraceBack - 6);
      expect(a.pathLeft.every((point, i, points) => i === 0 || point.y > points[i - 1].y)).toBe(true);
      expect(a.bridge.flightX - a.bridge.width / 2).toBeCloseTo(a.canalX + 1.7);
      expect(a.bridge.flightTopY).toBeCloseTo(a.bridgeY + a.bridge.width / 2);
      expect(a.bridge.steps * a.bridge.tread).toBeCloseTo(a.bridge.flightRun);
      expect(a.canal.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    }
  });
  it("leaves the stair opening clear of parapets and planters across dimension extremes", () => {
    const samples = [defaultParameters, ...(["min", "max"] as const).map(edge => normalizeParameters(Object.fromEntries(parameterKeys.map(key => [key, parameterDefinitions[key][edge]])))),
      { ...defaultParameters, lawnWidth: 24, stairWidth: 16 }];
    for (const p of samples) {
      const a = venueArchitecture(p), l = venueLayout(p);
      expect(a.retainingEdges[0].every(point => point.x <= a.stairLeft)).toBe(true);
      expect(a.retainingEdges[1].every(point => point.x >= a.stairRight)).toBe(true);
      for (const pot of a.pots) expect(pot.x + pot.radius).toBeLessThan(a.stairLeft);
      for (const bed of a.beds) {
        expect(bed.y - bed.depth / 2).toBeGreaterThan(l.terraceBack);
        expect(bed.y + bed.depth / 2).toBeLessThan(l.terraceFront - 2);
      }
      expect(a.terrace.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    }
  });
  it("places schematic fixtures between the pavilion roof and ceremony paving", () => {
    const p = defaultParameters, l = venueLayout(p), a = venueArchitecture(p);
    expect(a.fixtures).toHaveLength(4);
    for (const fixture of a.fixtures) {
      expect(fixture.x - fixture.width / 2).toBeGreaterThan(l.pavilionX + p.pavilionDiameter * .585);
      expect(fixture.x + fixture.width / 2).toBeLessThan(l.plazaX - l.plazaWidth / 2);
      expect(fixture.y + fixture.depth / 2).toBeLessThan(l.terraceFront - 2);
      expect(fixture.y - fixture.depth / 2).toBeGreaterThan(l.pavilionTerraceBack);
    }
    const narrow = { ...p, lawnWidth: 24, pavilionDiameter: 12 }, n = venueLayout(narrow);
    expect(n.plazaX - n.plazaWidth / 2 - n.pavilionX - narrow.pavilionDiameter * .585).toBeCloseTo(narrow.pavilionPlazaGap);
  });
  it("follows the curved canal bank with terrace edging and keeps planting on dry land", () => {
    for (const p of [defaultParameters, ...(["min", "max"] as const).map(edge => normalizeParameters(Object.fromEntries(parameterKeys.map(key => [key, parameterDefinitions[key][edge]]))))]) {
      const a = venueArchitecture(p);
      const inside = (point: { x: number; y: number }) => {
        let contained = false;
        for (let i = 0, j = a.terrace.length - 1; i < a.terrace.length; j = i++) {
          const first = a.terrace[i], second = a.terrace[j];
          if ((first.y > point.y) !== (second.y > point.y)
            && point.x < (second.x - first.x) * (point.y - first.y) / (second.y - first.y) + first.x) contained = !contained;
        }
        return contained;
      };
      expect(a.canalTerraceEdge.length).toBeGreaterThan(16);
      for (const point of a.canalTerraceEdge) expect(a.terrace).toContainEqual(point);
      expect(a.canalPlanting.every(inside)).toBe(true);
      expect(a.canalTrees.every(inside)).toBe(true);
      expect(a.canalTrees.some(tree => tree.kind === "palm")).toBe(true);
      expect(a.canalTrees.some(tree => tree.kind === "shade")).toBe(true);
      expect(a.canalCurvePosts.length).toBeGreaterThan(8);
    }
  });
});

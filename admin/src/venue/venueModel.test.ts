import { planToSceneScale, toScenePosition } from "./venueCoordinates";
import { Group, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ceremonyStructure, ceremonyPalms, ledLayout, LED_WIDTH, stageLayout, cameraView, defaultParameters, normalizeParameters, parameterDefinitions, parameterKeys, venueLayout, viewPresets } from "./venueModel";

describe("private venue preview parameters", () => {
  it("recovers from corrupt or old browser estimates without invalid geometry", () => {
    expect(normalizeParameters(null)).toEqual(defaultParameters);
    const recovered = normalizeParameters({ lawnWidth: -500, lawnLength: Infinity, terraceHeight: "huge", pavilionColumns: 11, stairCount: 1000 });
    expect(recovered.lawnWidth).toBe(24);
    expect(recovered.lawnLength).toBe(defaultParameters.lawnLength);
    expect(recovered.terraceHeight).toBe(defaultParameters.terraceHeight);
    expect(recovered.pavilionColumns).toBe(12);
    expect(recovered.stairCount).toBe(12);
  });

  it("keeps the pavilion on the terrace and joins the steps to the lawn across allowed extremes", () => {
    for (const edge of ["min", "max"] as const) {
      const p = normalizeParameters(Object.fromEntries(parameterKeys.map(key => [key, parameterDefinitions[key][edge]])));
      const layout = venueLayout(p);
      expect(layout.terraceFront + p.stairCount * p.stairTread).toBeCloseTo(layout.lawnBack);
      expect(layout.pavilionY + p.pavilionDiameter / 2).toBeLessThan(layout.terraceFront);
      expect(layout.pavilionY - p.pavilionDiameter / 2).toBeGreaterThan(layout.terraceBack);
      expect(layout.waterY).toBeGreaterThan(p.lawnLength / 2);
    }
    const p = { ...defaultParameters, terraceDepth: 10, pavilionDiameter: 12, pavilionLawnGap: 5 };
    const layout = venueLayout(p);
    expect(layout.pavilionY - 6).toBeGreaterThan(layout.terraceBack);
  });

  it("follows the supplied floor plan without treating it as a measured drawing", () => {
    const p = defaultParameters, layout = venueLayout(p);
    expect(layout.pavilionX).toBeLessThan(0);
    expect(layout.plazaX).toBeGreaterThan(0);
    expect(layout.pavilionY).toBeLessThan(layout.lawnBack);
    expect(layout.plazaY).toBeLessThan(layout.lawnBack);
    expect(layout.waterY - p.lawnLength / 2).toBe(p.waterSetback);
    expect(layout.plazaX + layout.plazaWidth / 2).toBeCloseTo(p.lawnWidth / 2);
  });

  it("keeps cameras above the architecture and frames portrait views farther away", () => {
    for (const view of viewPresets) {
      const v = cameraView(defaultParameters, view.id);
      expect(v.position.every(Number.isFinite)).toBe(true);
      expect(v.position[2]).toBeGreaterThan((view.id === "stage" || view.id === "floral") ? defaultParameters.stageHeight : 10);
      expect(v.target[2]).toBeGreaterThanOrEqual(0);
    }
    const overview = cameraView(defaultParameters, "overview"), reverse = cameraView(defaultParameters, "reverse");
    expect(reverse.target).toEqual(overview.target);
    expect(reverse.position[0] - reverse.target[0]).toBeCloseTo(-(overview.position[0] - overview.target[0]));
    expect(reverse.position[1] - reverse.target[1]).toBeCloseTo(-(overview.position[1] - overview.target[1]));
    expect(reverse.position[2]).toBe(overview.position[2]);
    expect(cameraView(defaultParameters, "overview", .65).position[2]).toBeGreaterThan(cameraView(defaultParameters, "overview", 1.5).position[2]);
  });
});

// Project real model positions through the same Z-up camera used by VenueCanvas.
describe("3D landmark orientation", () => {
  // Event closeups face the décor from the guests' side; site views retain plan orientation.
  for (const preset of viewPresets.filter(view => view.id !== "stage" && view.id !== "floral" && view.id !== "ceremony" && view.id !== "reverse")) {
    it(`keeps pavilion left of ceremony in ${preset.label}`, () => {
      const p = defaultParameters, layout = venueLayout(p);
      const view = cameraView(p, preset.id);
      const camera = new PerspectiveCamera(40, 1.5, .2, 600);
      camera.up.set(0, 0, 1);
      camera.position.fromArray(view.position);
      camera.lookAt(new Vector3(...view.target));
      camera.updateMatrixWorld();
      const pavilion = new Vector3(...toScenePosition([layout.pavilionX, layout.pavilionY, p.terraceHeight])).project(camera);
      const ceremony = new Vector3(...toScenePosition([layout.plazaX, layout.plazaY, p.terraceHeight])).project(camera);
      expect(pavilion.x).toBeLessThan(ceremony.x);
    });
  }
});

describe("2D and 3D floor-plan agreement", () => {
  for (const preset of ["overview", "overhead"] as const) {
    it(`preserves the entire approved plan arrangement in ${preset}`, () => {
      const p = defaultParameters, l = venueLayout(p);
      const v = cameraView(p, preset);
      const camera = new PerspectiveCamera(40, 1.5, .2, 600);
      camera.up.set(0, 0, 1); camera.position.fromArray(v.position);
      camera.lookAt(new Vector3(...v.target)); camera.updateMatrixWorld();
      const model = new Group(); model.scale.fromArray(planToSceneScale); model.updateMatrixWorld();
      const screen = (x: number, y: number) => {
        const point = model.localToWorld(new Vector3(x, y, 0)).project(camera);
        return { x: point.x, y: -point.y };
      };
      const pavilion = screen(l.pavilionX, l.pavilionY);
      const ceremony = screen(l.plazaX, l.plazaY);
      const lawn = screen(0, 0), beach = screen(0, l.waterY);
      expect(pavilion.x).toBeLessThan(ceremony.x);
      expect(pavilion.x).toBeLessThan(lawn.x);
      expect(ceremony.x).toBeGreaterThan(lawn.x);
      expect(pavilion.y).toBeLessThan(lawn.y);
      expect(ceremony.y).toBeLessThan(lawn.y);
      expect(beach.y).toBeGreaterThan(lawn.y);
    });
  }
});

it("keeps ceremony palm trunks on the water-facing margin and clear of stairs", () => {
  for (const lawnWidth of [24, 44, 70]) for (const stairWidth of [5, 10, 16]) {
    const p = { ...defaultParameters, lawnWidth, stairWidth };
    const layout = venueLayout(p);
    for (const tree of ceremonyPalms(p)) {
      expect(tree.x - .28).toBeGreaterThan(layout.stairX + stairWidth / 2);
      expect(tree.x + .28).toBeLessThan(lawnWidth / 2);
      expect(tree.y).toBeGreaterThan(layout.plazaY);
      expect(tree.y + .28).toBeLessThan(layout.terraceFront);
    }
  }
});


describe("temporary reception stage", () => {
  it("centers stage and dance floor on the beach edge, facing inland", () => {
    const p = defaultParameters, l = stageLayout(p);
    expect(l.centerX).toBe(0);
    expect(l.danceX).toBe(l.centerX);
    expect(l.backY).toBe(p.lawnLength / 2 - .5);
    expect(l.danceY + p.danceFloorSize / 2).toBeCloseTo(l.frontY - l.stepDepth);
    expect(l.danceY - p.danceFloorSize / 2).toBeGreaterThan(-p.lawnLength / 2);
    expect(ledLayout({ ...p, lawnLength: 10, stageDepth: 5, danceFloorSize: 9 }, "center").fits).toBe(false);
  });
  it("frames the whole backdrop from its guest-facing side in landscape and portrait", () => {
    for (const aspect of [1.5, .65]) {
      const p = defaultParameters, l = stageLayout(p), view = cameraView(p, "stage", aspect);
      expect(view.position[1]).toBeGreaterThan(-l.frontY);
      const camera = new PerspectiveCamera(40, aspect, .2, 600);
      camera.up.set(0, 0, 1); camera.position.fromArray(view.position);
      camera.lookAt(new Vector3(...view.target)); camera.updateMatrixWorld();
      for (const y of [-p.stageWidth / 2, p.stageWidth / 2]) for (const z of [p.stageHeight, p.stageHeight + p.backdropHeight]) {
        const projected = new Vector3(...toScenePosition([l.centerX + y, l.backY, z])).project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(1);
        expect(Math.abs(projected.y)).toBeLessThan(1);
        expect(projected.z).toBeLessThan(1);
      }
    }
  });
});


describe("LED layout comparisons", () => {
  it("keeps the side screen and its support on the default lawn with a terrace-side passage", () => {
    const p = defaultParameters, d = ledLayout(p, "side");
    expect(stageLayout(p).centerX - d.screenX - ((LED_WIDTH + .2) / 2)).toBeGreaterThanOrEqual(-p.lawnWidth / 2 + 1);
    expect(stageLayout(p).centerX + p.stageWidth / 2).toBeLessThan(p.lawnWidth / 2);
    expect(d.screenX - ((LED_WIDTH + .2) / 2) - p.stageWidth / 2).toBeCloseTo(.8);
    expect(d.fits).toBe(true);
    expect(ledLayout({ ...p, lawnLength: 10 }, "side").fits).toBe(false);
  });
  it("uses an identical camera for both LED options and frames their outer corners", () => {
    for (const aspect of [1.5, .65]) {
      const p = defaultParameters, stage = stageLayout(p);
      const view = cameraView(p, "stage", aspect, "center");
      expect(cameraView(p, "stage", aspect, "side")).toEqual(view);
      const camera = new PerspectiveCamera(40, aspect, .2, 600);
      camera.up.set(0, 0, 1); camera.position.fromArray(view.position);
      camera.lookAt(new Vector3(...view.target)); camera.updateMatrixWorld();
      for (const mode of ["center", "side"] as const) {
        const d = ledLayout(p, mode);
        for (const y of [stage.centerX - d.screenX - ((LED_WIDTH + .2) / 2), stage.centerX + d.width / 2]) for (const z of [0, 5.3]) {
          const projected = new Vector3(...toScenePosition([y, stage.backY, z])).project(camera);
          expect(Math.abs(projected.x)).toBeLessThan(1);
          expect(Math.abs(projected.y)).toBeLessThan(1);
        }
      }
    }
  });
});


it("keeps the diagonal screen support on the lawn with terrace clearance", () => {
  const p = defaultParameters, d = ledLayout(p, "side"), stage = stageLayout(p);
  for (const x of [-((LED_WIDTH + .2) / 2), ((LED_WIDTH + .2) / 2)]) for (const y of [-1, .2]) {
    const planY = stage.backY - .18 - d.screenForward - x * Math.sin(d.screenAngle) - y * Math.cos(d.screenAngle);
    const planX = stage.centerX - d.screenX - x * Math.cos(d.screenAngle) + y * Math.sin(d.screenAngle);
    expect(planX).toBeGreaterThan(-p.lawnWidth / 2);
    expect(planY).toBeGreaterThanOrEqual(-p.lawnLength / 2 + 1 - 1e-8);
    expect(planY).toBeLessThan(p.lawnLength / 2);
  }
});


it("places the tiered structure beyond the medallion toward the outer ceremony side", () => {
  const p = defaultParameters, plaza = venueLayout(p), structure = ceremonyStructure(p);
  // At 00:58–01:02 it is left of the medallion when facing water: +plan X.
  expect(structure.x - structure.radius).toBeGreaterThan(plaza.plazaX);
  expect(structure.x + structure.radius).toBeLessThanOrEqual(plaza.plazaX + plaza.plazaWidth / 2);
  expect(structure.y + structure.radius).toBeLessThan(plaza.terraceFront);
});

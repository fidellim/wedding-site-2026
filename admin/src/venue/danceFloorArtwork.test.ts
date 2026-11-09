import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildStage } from "./buildStage";
import { defaultParameters } from "./venueModel";
import { planToSceneScale } from "./venueCoordinates";

describe("dance floor wedding artwork", () => {
  it("keeps lettering readable through the venue's reflected coordinates", () => {
    const stage = buildStage(defaultParameters);
    const venue = new THREE.Group();
    venue.scale.fromArray(planToSceneScale);
    venue.add(stage.root);
    venue.updateMatrixWorld(true);
    const artwork = stage.root.getObjectByName("DANCE_FLOOR_WEDDING_ARTWORK")!;
    const origin = artwork.localToWorld(new THREE.Vector3());
    const right = artwork.localToWorld(new THREE.Vector3(1, 0, 0)).sub(origin);
    const top = artwork.localToWorld(new THREE.Vector3(0, 1, 0)).sub(origin);
    // Looking toward the stage: artwork top points south, right points west.
    expect(right.x).toBeLessThan(0);
    expect(top.y).toBeLessThan(0);
    expect(new THREE.Vector3().crossVectors(right, top).z).toBeGreaterThan(0);
    stage.dispose();
  });

  it("renders brand burgundy without venue lighting or tone mapping changing its hue", () => {
    const stage = buildStage(defaultParameters);
    const artwork = stage.root.getObjectByName("DANCE_FLOOR_WEDDING_ARTWORK") as THREE.Mesh;
    expect(artwork.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    const material = artwork.material as THREE.MeshBasicMaterial;
    expect(material.color.getHexString()).toBe("630000");
    expect(material.toneMapped).toBe(false);
    expect(material.fog).toBe(false);
    stage.dispose();
  });
});

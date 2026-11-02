import { expect, it } from "vitest";
import { InstancedMesh, Mesh } from "three";
import { buildCeremony } from "./buildCeremony";
import { ceremonyLayout } from "./ceremonyLayout";
import { defaultParameters } from "./venueModel";

it("renders the shared square platform and full chair footprint with ground-grown flowers and no arch", () => {
  const layout = ceremonyLayout(defaultParameters, 48), ceremony = buildCeremony(defaultParameters, 48);
  try {
    const platform = ceremony.root.getObjectByName("CEREMONY_WHITE_SQUARE_PLATFORM");
    expect(platform).toBeInstanceOf(Mesh);
    if (!(platform instanceof Mesh)) throw new Error("Platform mesh missing");
    platform.geometry.computeBoundingBox();
    const bounds = platform.geometry.boundingBox!;
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(4.6);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(4.6);
    expect(platform.position.y - 2.3).toBeLessThan(layout.aisleEnd);
    expect(ceremony.root.getObjectByName("CEREMONY_CIRCULAR_ARCH_FRAME")).toBeUndefined();
    expect(ceremony.root.getObjectByName("CEREMONY_ARCH_SUPPORT")).toBeUndefined();
    expect(ceremony.root.getObjectByName("CEREMONY_FLORAL_STEMS")).toBeInstanceOf(InstancedMesh);
    const chairs = ceremony.root.getObjectByName("CEREMONY_UNASSIGNED_CHAIRS");
    expect(chairs).toBeInstanceOf(InstancedMesh);
    if (!(chairs instanceof InstancedMesh)) throw new Error("Chair mesh missing");
    expect(chairs.count).toBe(48);
    chairs.geometry.computeBoundingBox();
    const footprint = chairs.geometry.boundingBox!;
    expect(footprint.max.x - footprint.min.x).toBeCloseTo(layout.chair.footprintWidth);
    expect(footprint.max.y - footprint.min.y).toBeCloseTo(layout.chair.footprintWidth);
    expect(layout.chair.seatWidth).toBe(.5);
  } finally {
    ceremony.dispose();
  }
});

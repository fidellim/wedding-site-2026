import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Reusable, metre-scale banquet chair. Z is up; local +Y faces the table. */
export function banquetChairGeometry() {
  const cushion = new RoundedBoxGeometry(.44, .43, .085, 2, .035);
  cushion.translate(0, 0, .475);

  const back = new RoundedBoxGeometry(.405, .07, .37, 3, .033);
  const positions = back.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    // Wrap the edges forward and gently recline the upper back.
    positions.setXYZ(i, x * (1 + z * .18), positions.getY(i) - .2 - (z + .185) * .14 + x * x * 1.1, z + .735);
  }
  back.computeVertexNormals();
  const upholstery = mergeGeometries([cushion, back])!;

  const pieces: THREE.BufferGeometry[] = [];
  const tube = (start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
    const direction = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius * .85, radius, direction.length(), 8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    geometry.translate((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
    pieces.push(geometry.toNonIndexed()); geometry.dispose();
  };
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    tube(new THREE.Vector3(x * .205, y * .19, .018), new THREE.Vector3(x * .17, y * .16, .44), .018);
  }
  for (const x of [-1, 1]) {
    tube(new THREE.Vector3(x * .17, -.16, .43), new THREE.Vector3(x * .17, -.24, .88), .014);
    tube(new THREE.Vector3(x * .17, -.16, .43), new THREE.Vector3(x * .17, .16, .43), .015);
  }
  for (const y of [-1, 1]) tube(new THREE.Vector3(-.17, y * .16, .43), new THREE.Vector3(.17, y * .16, .43), .015);
  const frame = mergeGeometries(pieces)!;
  // Two material groups, one shared geometry and one selectable mesh per seat.
  const geometry = mergeGeometries([upholstery, frame], true)!;
  for (const part of [cushion, back, upholstery, frame, ...pieces]) part.dispose();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

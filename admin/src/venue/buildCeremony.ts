import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ceremonyLayout } from "./ceremonyLayout";
import type { VenueParameters } from "./venueModel";

/** Temporary ceremony décor. Local +Y faces the water. */
export function buildCeremony(p: VenueParameters, chairCount: number) {
  const layout = ceremonyLayout(p, chairCount);
  const root = new THREE.Group(); root.name = "CEREMONY_LAYOUT";
  const materials: THREE.Material[] = [];
  const mat = (color: string) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: .8 }); materials.push(material); return material;
  };
  const white = mat("#fffdf6"), blossom = mat("#fffef8"), ivory = mat("#f0e8cf"), leaves = mat("#536b43");
  const cloth = mat("#fffdf9"); cloth.roughness = 1;
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const platformGeometry = new THREE.BoxGeometry(layout.platformSize, layout.platformSize, layout.platformHeight);
  add("CEREMONY_WHITE_SQUARE_PLATFORM", platformGeometry, white, layout.platformX, layout.platformY, layout.floor + layout.platformHeight / 2);
  add("CEREMONY_STRAIGHT_WHITE_AISLE", new THREE.BoxGeometry(layout.aisleWidth, layout.aisleEnd - layout.aisleStart, .025), white,
    layout.platformX, (layout.aisleStart + layout.aisleEnd) / 2, layout.floor + .015);

  const flowerCenters: THREE.Vector3[] = [], stemBases: THREE.Vector3[] = [];
  let seed = 173;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  const cluster = (x: number, y: number, spread: number, height: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * spread;
      const stemX = x + Math.cos(angle) * radius, stemY = y + Math.sin(angle) * radius;
      // Dense low blooms with a few airy stems breaking the silhouette.
      const rise = i % 7 === 0 ? height * (.8 + random() * .2) : height * (.2 + random() * .48);
      flowerCenters.push(new THREE.Vector3(stemX, stemY, layout.floor + .12 + rise));
      stemBases.push(new THREE.Vector3(x + (stemX - x) * .65, y + (stemY - y) * .65, layout.floor + .025));
    }
  };
  for (const point of layout.platformFlowers) cluster(point.x, point.y, point.spread, point.height, 85);
  for (const point of layout.flowers) cluster(point.x, point.y, .25, .34, 24);

  const petalGeometry = new THREE.SphereGeometry(1, 6, 4);
  const petals = new THREE.InstancedMesh(petalGeometry, blossom, flowerCenters.length * 6); petals.name = "CEREMONY_WHITE_FLOWER_PETALS";
  const centers = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), ivory, flowerCenters.length); centers.name = "CEREMONY_FLOWER_CENTERS";
  const foliage = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 3), leaves, flowerCenters.length * 2); foliage.name = "CEREMONY_FLORAL_GREENERY";
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), leaves, flowerCenters.length); stems.name = "CEREMONY_FLORAL_STEMS";
  const dummy = new THREE.Object3D(), stemAxis = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();
  flowerCenters.forEach((center, index) => {
    const base = stemBases[index];
    direction.subVectors(center, base);
    dummy.position.copy(base).addScaledVector(direction, .5);
    dummy.quaternion.setFromUnitVectors(stemAxis, direction.clone().normalize());
    dummy.scale.set(.006, direction.length(), .006); dummy.updateMatrix(); stems.setMatrixAt(index, dummy.matrix);
    const size = .055 + random() * .05;
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + random() * .2;
      dummy.position.set(center.x + Math.cos(angle) * size * .7, center.y - .035, center.z + Math.sin(angle) * size * .7);
      dummy.rotation.set(0, -angle, 0); dummy.scale.set(size, size * .36, size * .6); dummy.updateMatrix(); petals.setMatrixAt(index * 6 + i, dummy.matrix);
    }
    dummy.position.copy(center); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(size * .32); dummy.updateMatrix(); centers.setMatrixAt(index, dummy.matrix);
    for (let i = 0; i < 2; i++) {
      dummy.position.copy(base).lerp(center, i ? .65 : .38);
      dummy.position.x += (i ? 1 : -1) * size * .55;
      dummy.rotation.set(.4, i ? .7 : -.7, .2); dummy.scale.set(size * .55, size * .22, size * 1.6); dummy.updateMatrix(); foliage.setMatrixAt(index * 2 + i, dummy.matrix);
    }
  });
  for (const mesh of [stems, foliage, petals, centers]) { mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); }

  const chairPieces: THREE.BufferGeometry[] = [];
  const chairBox = (width: number, depth: number, height: number, x: number, y: number, z: number) => {
    const geometry = new THREE.BoxGeometry(width, depth, height); geometry.translate(x, y, z); chairPieces.push(geometry);
  };
  const { seatWidth, skirtWidth, pleatDepth } = layout.chair;
  chairBox(seatWidth, seatWidth, .065, 0, 0, .46);
  chairBox(seatWidth, .085, .43, 0, -seatWidth / 2 + .03, .7);
  // Four softly flared, pleated fabric panels hide the chair legs down to the floor.
  const skirtVertices: number[] = [], skirtIndices: number[] = [];
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2, start = skirtVertices.length / 3;
    for (let i = 0; i <= 12; i++) for (const bottom of [false, true]) {
      const along = (i / 12 - .5) * (bottom ? skirtWidth : seatWidth);
      const outward = bottom ? skirtWidth / 2 + pleatDepth * Math.cos(i * Math.PI) : seatWidth / 2;
      skirtVertices.push(along * Math.cos(angle) - outward * Math.sin(angle),
        along * Math.sin(angle) + outward * Math.cos(angle), bottom ? .025 + .007 * Math.sin(i * Math.PI / 2) : .46);
    }
    for (let i = 0; i < 12; i++) {
      const a = start + i * 2; skirtIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const skirt = new THREE.BufferGeometry(); skirt.setAttribute("position", new THREE.Float32BufferAttribute(skirtVertices, 3));
  skirt.setIndex(skirtIndices); skirt.computeVertexNormals();
  // Keep the same attributes as the box pieces for merging.
  skirt.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(skirtVertices.length / 3 * 2), 2));
  chairPieces.push(skirt); cloth.side = THREE.DoubleSide;
  const chairGeometry = mergeGeometries(chairPieces)!; chairPieces.forEach(geometry => geometry.dispose());
  const chairs = new THREE.InstancedMesh(chairGeometry, cloth, chairCount); chairs.name = "CEREMONY_UNASSIGNED_CHAIRS"; chairs.castShadow = true; chairs.receiveShadow = true;
  layout.chairs.forEach((chair, index) => {
    dummy.position.set(chair.x, chair.y, layout.floor); dummy.rotation.set(0, 0, chair.rotation); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); chairs.setMatrixAt(index, dummy.matrix);
  });
  root.add(chairs);
  return { root, dispose() {
    root.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    materials.forEach(material => material.dispose());
  } };
}

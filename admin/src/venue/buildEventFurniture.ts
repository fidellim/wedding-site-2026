import * as THREE from "three";
import type { VenueLayout } from "./layout";
import { coupleChairs, eventFurnitureKinds } from "./eventFurniture";

/** Event pieces have no guest seating targets. Meshes share the furniture disposal lifecycle. */
export function buildEventFurniture(root: THREE.Group, layout: VenueLayout, chairGeometry: THREE.BufferGeometry, materials: THREE.Material[]) {
  if (!eventFurnitureKinds.some(kind => layout.eventFurniture?.[kind])) return;
  const linen = new THREE.MeshStandardMaterial({ color: "#fff9ed", roughness: .9 });
  const gold = new THREE.MeshStandardMaterial({ color: "#a88a52", metalness: .7, roughness: .3 });
  const icing = new THREE.MeshStandardMaterial({ color: "#fffdf7", roughness: .7 });
  materials.push(linen, gold, icing);
  const mesh = (group: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const object = new THREE.Mesh(geometry, material); object.name = name; object.position.set(x, y, z);
    object.castShadow = true; object.receiveShadow = true; group.add(object); return object;
  };
  const cylinder = (radius: number, height: number) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 32); geometry.rotateX(Math.PI / 2); return geometry;
  };
  eventFurnitureKinds.forEach(kind => {
    const p = layout.eventFurniture?.[kind]; if (!p) return;
    const group = new THREE.Group(); group.name = `EVENT_${kind.toUpperCase()}`;
    group.position.set(p.x, p.y, 0); group.rotation.z = p.rotation * Math.PI / 180; root.add(group);
    if (kind === "couple") {
      mesh(group, "COUPLE_TABLE", new THREE.BoxGeometry(p.width, p.depth, .7), linen, 0, 0, .4);
      coupleChairs(p).forEach((chair, index) => {
        const object = mesh(group, index === 0 ? "BRIDE_CHAIR" : "GROOM_CHAIR", chairGeometry, [linen, gold], chair.x, chair.y, 0);
        object.rotation.z = Math.PI;
      });
      for (const side of [-1, 1]) {
        mesh(group, "PLACE_SETTING", cylinder(Math.min(.16, p.width / 8, p.depth / 3), .018), gold, side * p.width / 4, 0, .762);
        mesh(group, "DINNER_PLATE", cylinder(Math.min(.135, p.width / 9, p.depth / 3.5), .02), icing, side * p.width / 4, 0, .777);
      }
    } else {
      mesh(group, "CAKE_TABLE", cylinder(p.width / 2, .7), linen, 0, 0, .4);
      const radius = Math.min(.26, p.width * .32);
      mesh(group, "CAKE_STAND", cylinder(radius * 1.12, .035), gold, 0, 0, .775);
      for (let tier = 0; tier < 3; tier++) {
        const r = radius * (1 - tier * .23), z = .8 + tier * .2;
        mesh(group, `CAKE_TIER_${tier + 1}`, cylinder(r, .2), icing, 0, 0, z + .1);
        mesh(group, "CAKE_RIBBON", cylinder(r + .002, .018), gold, 0, 0, z + .025);
      }
    }
  });
}

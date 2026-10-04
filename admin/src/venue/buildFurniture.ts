import * as THREE from "three";
import type { SeatingSnapshot } from "../domain/types";
import { planToSceneScale } from "./venueCoordinates";
import { physicalChairs, type VenueLayout } from "./layout";

export function buildFurniture(snapshot: SeatingSnapshot, layout: VenueLayout) {
  const root = new THREE.Group(); root.name = "TABLE_FURNITURE"; root.scale.fromArray(planToSceneScale);
  const cloth = new THREE.MeshStandardMaterial({ color: "#f8f0df", roughness: .9 });
  const chair = new THREE.MeshStandardMaterial({ color: "#c9aa76", roughness: .8 });
  const occupied = new THREE.MeshStandardMaterial({ color: "#753248", roughness: .8 });
  const materials: THREE.Material[] = [cloth, chair, occupied];
  const add = (parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  snapshot.tables.forEach(table => {
    const p = layout.tables[table.id]; if (!p) return;
    const group = new THREE.Group(); group.name = `TABLE_${table.id}`; group.position.set(p.x, p.y, 0); group.rotation.z = p.rotation * Math.PI / 180; root.add(group);
    const geometry = table.shape === "round" ? new THREE.CylinderGeometry(p.width / 2, p.width / 2, .72, 32) : new THREE.BoxGeometry(p.width, p.depth, .72);
    if (table.shape === "round") geometry.rotateX(Math.PI / 2);
    add(group, geometry, cloth, 0, 0, .4);
    physicalChairs(table, p).forEach(c => {
      const seat = snapshot.seats.find(s => s.tableId === table.id && s.number === c.number);
      const assigned = snapshot.assignments.some(a => a.seatId === seat?.id);
      const mesh = add(group, new THREE.BoxGeometry(.4, .4, .48), assigned ? occupied : chair, c.x, c.y, .25);
      mesh.name = `SEAT_${seat?.id ?? c.number}`;
    });
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#fbf4e5"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#46392e";
      ctx.font = "bold 64px sans-serif";
      const fontSize = Math.min(64, 64 * (canvas.width - 32) / Math.max(1, ctx.measureText(table.name).width));
      ctx.font = `bold ${fontSize}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(table.name, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }); materials.push(mat);
      const marker = add(group, new THREE.PlaneGeometry(p.width * .85, p.width * .85 / 4), mat, 0, 0, .77); marker.rotation.z = -group.rotation.z;
      // Undo the plan-to-scene Y reflection for text, keeping the furniture in place.
      marker.scale.y = -1;
    }
  });
  return { root, dispose() {
    root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    materials.forEach(m => { if (m instanceof THREE.MeshBasicMaterial) m.map?.dispose(); m.dispose(); });
  } };
}

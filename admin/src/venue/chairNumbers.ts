import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Number-only cards share geometry and reuse one texture per seat number across all tables. */
export function chairNumberCards(materials: THREE.Material[], anisotropy = 1) {
  const cache = new Map<number, THREE.MeshBasicMaterial>();
  let geometry: THREE.BufferGeometry | undefined;
  return (chair: THREE.Mesh, seatNumber: number) => {
    let material = cache.get(seatNumber);
    if (!material) {
      const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.fillStyle = seatNumber === 1 ? "#9b793e" : "#753248"; ctx.fillRect(0, 0, 256, 256);
      const border = seatNumber === 1 ? 10 : 6;
      ctx.fillStyle = "#fffdf7"; ctx.fillRect(border, border, 256 - border * 2, 256 - border * 2);
      ctx.fillStyle = "#421221"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      const text = String(seatNumber), underlined = seatNumber === 6 || seatNumber === 9;
      ctx.font = "bold 256px sans-serif";
      const initial = ctx.measureText(text);
      const initialHeight = (initial.actualBoundingBoxAscent ?? 256 * .72) + (initial.actualBoundingBoxDescent ?? 0);
      const font = Math.floor(256 * Math.min(212 / Math.max(1, initial.width), (underlined ? 192 : 212) / Math.max(1, initialHeight)));
      ctx.font = `bold ${font}px sans-serif`;
      const metrics = ctx.measureText(text);
      const ascent = metrics.actualBoundingBoxAscent ?? font * .72, descent = metrics.actualBoundingBoxDescent ?? 0;
      const x = 128 + ((metrics.actualBoundingBoxLeft ?? 0) - (metrics.actualBoundingBoxRight ?? 0)) / 2;
      ctx.fillText(text, x, (underlined ? 118 : 128) + (ascent - descent) / 2);
      if (underlined) ctx.fillRect(80, 226, 96, 5);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = anisotropy;
      material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
      cache.set(seatNumber, material); materials.push(material);
    }
    if (!geometry) {
      const back = new THREE.PlaneGeometry(.34, .28); back.rotateX(Math.PI / 2); back.translate(0, -.3, .75);
      const front = new THREE.PlaneGeometry(.34, .28); front.rotateY(Math.PI); front.rotateX(Math.PI / 2); front.translate(0, -.12, .75);
      const top = new THREE.PlaneGeometry(.34, .28); top.translate(0, .02, .527);
      // One draw call per chair for all three surfaces, rather than three separate meshes.
      geometry = mergeGeometries([back, front, top])!;
      [back, front, top].forEach(part => part.dispose());
    }
    const cards = new THREE.Mesh(geometry, material); cards.name = "CHAIR_NUMBERS";
    // Undo the venue root's reflection for lettering while leaving the chair in place.
    cards.scale.x = -1;
    cards.userData.furnitureTarget = chair.userData.furnitureTarget;
    chair.add(cards);
  };
}

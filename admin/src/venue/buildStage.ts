import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import logoUrl from "../../../images/logo-white.webp";
import { ledLayout, LED_WIDTH, LED_HEIGHT, stageLayout, type LedLayout, type VenueParameters } from "./venueModel";

/** Event décor, kept separate from permanent venue geometry. Local +Y faces guests. */
export function buildStage(input: VenueParameters, mode: LedLayout = "none") {
  const design = ledLayout(input, mode);
  const p = { ...input, stageWidth: design.width, backdropHeight: design.height };
  const centered = mode === "center";
  const layout = stageLayout(p), root = new THREE.Group(); root.name = "HF_STAGE";
  root.position.set(layout.centerX, layout.centerY, .025); root.rotation.z = Math.PI;
  const materials: THREE.Material[] = [];
  const mat = (color: string, metalness = 0) => {
    const result = new THREE.MeshStandardMaterial({ color, metalness, roughness: metalness ? .32 : .8 });
    materials.push(result); return result;
  };
  const ivory = mat("#f4ead7"), gold = mat("#c5a15b", .65), crystal = mat("#f5eee0", .25);
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  add("PLATFORM", new THREE.BoxGeometry(p.stageWidth, p.stageDepth, p.stageHeight), ivory, 0, 0, p.stageHeight / 2);
  add("FRONT_STEP", new THREE.BoxGeometry(layout.stepWidth, layout.stepDepth, p.stageHeight / 2), ivory, 0, p.stageDepth / 2 + layout.stepDepth / 2, p.stageHeight / 4);
  add("DANCE_FLOOR", new THREE.BoxGeometry(p.danceFloorSize, p.danceFloorSize, .04), ivory, 0, layout.centerY - layout.danceY, 0);
  const back = -p.stageDepth / 2 + .18, base = p.stageHeight;
  const top = (t: number) => base + p.backdropHeight * (centered ? .93 + .07 * Math.cos((t - .5) * Math.PI * 2) : .91 + .09 * Math.cos(t * Math.PI * 2.4));
  const railPoints = Array.from({ length: 65 }, (_, i) => new THREE.Vector3((i / 64 - .5) * p.stageWidth, back, top(i / 64)));
  add("FLOWING_GOLD_RAIL", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints), 96, .026, 6, false), gold);
  const rod = (x: number, bottom: number, upper: number, radius: number, material: THREE.Material, name: string) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, upper - bottom, 6); geometry.rotateX(Math.PI / 2);
    add(name, geometry, material, x, back, (upper + bottom) / 2);
  };
  for (const t of [0, .16, .33, .67, .84, 1]) rod((t - .5) * p.stageWidth, base, top(t), .018, gold, "GOLD_UPRIGHT");
  if (!centered) for (const x of [-.42, .42]) rod(x, base + p.backdropHeight * .65 + .55, top(x / p.stageWidth + .5), .005, gold, "LOGO_SUSPENSION");
  const strandLight = mat("#fff2ce");
  strandLight.emissive.set("#ffe4a8"); strandLight.emissiveIntensity = 2;
  const beads: THREE.BufferGeometry[] = [];
  for (let i = 1; i < 42; i++) {
    const t = i / 42, x = (t - .5) * p.stageWidth;
    if (centered && Math.abs(x) < LED_WIDTH / 2 + .3) continue;
    // The references continue the light curtain behind the lettering; HF sits in front.
    const bottom = base + .18 + (i % 5) * .11;
    rod(x, bottom, top(t), .004, crystal, "HANGING_STRAND");
    for (let z = bottom; z < top(t); z += .15) {
      const bead = new THREE.OctahedronGeometry(.018); bead.scale(1, 1, 1.7); bead.translate(x, back, z); beads.push(bead);
    }
  }
  const mergedBeads = mergeGeometries(beads); beads.forEach(g => g.dispose());
  if (mergedBeads) add("ILLUMINATED_STRAND_DROPS", mergedBeads, strandLight);
  const palette = ["#fff3dd", "#e8bfc7", "#efc2a0", "#b7cddd", "#cdbbd9", "#526d40", "#839660", "#cda352"].map(color => mat(color));
  palette.forEach(material => { material.side = THREE.DoubleSide; });
  const flowers: THREE.BufferGeometry[][] = palette.map(() => []);
  let seed = 47; const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  // Curved, tapered surfaces give petals and leaves a silhouette at close range.
  const petal = (length: number, width: number, cup: number) => {
    const vertices: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 6; row++) for (let col = 0; col <= 4; col++) {
      const t = row / 6, u = col / 2 - 1;
      vertices.push(u * width * Math.sin(Math.PI * t) ** .7, cup * (t * t + u * u * .4), t * length);
      if (row < 6 && col < 4) { const n = row * 5 + col; indices.push(n, n + 1, n + 5, n + 1, n + 6, n + 5); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  };
  const cluster = (x: number, z: number, spread: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * spread;
      const center = new THREE.Vector3(x + Math.cos(a) * r, back + .15 + random() * .42, Math.max(base + .09, z + Math.sin(a) * r * .8));
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler((random() - .5) * .9, random() * Math.PI * 2, (random() - .5) * .9));
      const color = i % 5, size = .075 + random() * .095, layered = i % 3 === 0;
      for (let layer = 0; layer < (layered ? 3 : 1); layer++) {
        const petals = layered ? 7 : 6, length = size * (1 - layer * .23);
        for (let j = 0; j < petals; j++) {
          const geometry = petal(length, length * .53, length * .3);
          geometry.rotateY(j * Math.PI * 2 / petals + layer * .45); geometry.translate(0, layer * .022, 0);
          geometry.applyQuaternion(tilt); geometry.translate(center.x, center.y, center.z); flowers[color].push(geometry);
        }
      }
      const core = new THREE.SphereGeometry(size * .22, 7, 5); core.scale(1, .6, 1); core.translate(0, .025, 0); core.applyQuaternion(tilt); core.translate(center.x, center.y, center.z); flowers[7].push(core);
      for (let j = 0; j < 2; j++) {
        const leaf = petal(size * 2, size * .45, .03); leaf.rotateY(a + j * 2.3); leaf.rotateZ(.5);
        leaf.translate(center.x, center.y - .09, center.z - .04); flowers[5 + j].push(leaf);
      }
    }
  };
  if (centered) {
    // Floral columns and upper-corner sprays frame, rather than cover, the LED face.
    for (const [x, z, spread] of [[-2.8,3.35,.5],[2.9,3.5,.55],[-3.35,2.65,.45],[3.4,2.3,.5],[-3.1,1.5,.48],[3.2,.65,.55],[-2.85,.3,.5],[2.85,.25,.48]]) {
      cluster(x + Math.sign(x) * .5, base + z, spread, 80);
    }
  } else {
  for (const [fraction, height, spread] of [[-.47,.82,.48],[-.24,.94,.42],[.17,.7,.42],[.44,.89,.52]]) cluster(fraction * p.stageWidth, base + height * p.backdropHeight, spread, 65);
  for (const [fraction, height, spread] of [[-.43,.3,.5],[-.3,.18,.55],[.27,.2,.58],[.45,.35,.46]]) cluster(fraction * p.stageWidth, base + height * p.backdropHeight, spread, 60);
  for (const fraction of [-.44, -.32, -.2, .2, .32, .44]) cluster(fraction * p.stageWidth, base + .22, .38, 42);
  }
  flowers.forEach((pieces, i) => {
    // Normalize attributes before merging the different flower and leaf surfaces.
    pieces.forEach(piece => piece.deleteAttribute("uv"));
    const merged = mergeGeometries(pieces); pieces.forEach(g => g.dispose());
    if (merged) add(i > 4 && i < 7 ? "FLORAL_LEAVES" : "FLOWER_PETALS_AND_CENTERS", merged, palette[i]);
  });
  const luminous = mat("#fff3cf"); luminous.emissive.set("#ffe6ac"); luminous.emissiveIntensity = 2.5; luminous.side = THREE.DoubleSide;
  const wireMaterial = mat("#e5d5ac", .45);
  // Reference lamps: swept upper wings, scalloped lower lobes and exposed wire bodies.
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
    const butterfly = new THREE.Group(); butterfly.name = "BUTTERFLY_LIGHT";
    const x = side * (centered ? (i ? 3.25 : 3.85) : p.stageWidth * (i ? .35 : .47)), y = back + .85, z = base + (i ? 1.12 : 1.85);
    butterfly.position.set(x, y, z); butterfly.rotation.y = side * (i ? -.28 : .12);
    butterfly.rotation.z = side * (i ? -.18 : .14);
    butterfly.scale.setScalar(i ? .78 : 1); root.add(butterfly);
    const stem = new THREE.CylinderGeometry(.009, .013, z - base, 6); stem.rotateX(Math.PI / 2);
    add("BUTTERFLY_STEM", stem, wireMaterial, x, y, (z + base) / 2);
    for (const sign of [-1, 1]) {
      const wingRoot = new THREE.Group();
      // Different folds show the thin sculptural panels, as in the two photo angles.
      wingRoot.rotation.z = sign * (sign === side ? .18 : .62); butterfly.add(wingRoot);
      const shape = new THREE.Shape(); shape.moveTo(0, 0);
      shape.bezierCurveTo(.11, .23, .31, .66, .67, .98);
      shape.bezierCurveTo(.74, 1.06, .76, 1.03, .73, .91);
      shape.bezierCurveTo(.74, .83, .66, .78, .65, .72);
      shape.bezierCurveTo(.68, .67, .58, .63, .57, .56);
      shape.bezierCurveTo(.6, .51, .47, .41, .43, .36);
      shape.bezierCurveTo(.6, .42, .71, .35, .64, .25);
      shape.bezierCurveTo(.81, .2, .73, .06, .6, .055);
      shape.bezierCurveTo(.67, -.035, .53, -.09, .42, -.065);
      shape.bezierCurveTo(.28, -.1, .11, -.045, 0, 0);
      const geometry = new THREE.ShapeGeometry(shape, 22); geometry.scale(sign, 1, 1); geometry.rotateX(Math.PI / 2);
      const wing = new THREE.Mesh(geometry, luminous); wing.name = "SWEPT_LUMINOUS_WING"; wingRoot.add(wing);
    }
    const wire = (points: THREE.Vector3[]) => {
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .006, 5, false), wireMaterial);
      mesh.name = "BUTTERFLY_WIRE_BODY"; butterfly.add(mesh);
    };
    // Open teardrop body and fine antennae rather than lines across the lit wings.
    for (const sign of [-1, 1]) {
      wire([new THREE.Vector3(0, .025, .09), new THREE.Vector3(sign * .07, .045, -.06), new THREE.Vector3(sign * .045, .03, -.22), new THREE.Vector3(0, .02, -.29)]);
      wire([new THREE.Vector3(0, .025, .04), new THREE.Vector3(sign * .04, .035, .14), new THREE.Vector3(sign * .12, .035, .22)]);
    }
    const light = new THREE.PointLight("#ffdf9e", 3, 3, 2); light.position.set(0, .25, .3); butterfly.add(light);
  }
  // A soft stage wash keeps the monogram and central flowers readable at dusk.
  const stageWash = new THREE.PointLight("#ffe8c0", 9, 10, 2);
  stageWash.position.set(0, back + 2, base + p.backdropHeight * .7); root.add(stageWash);
  const logoTexture = new THREE.TextureLoader().load(logoUrl); logoTexture.colorSpace = THREE.SRGBColorSpace;
  const logoMaterial = new THREE.MeshStandardMaterial({ map: logoTexture, color: "#fff3db", transparent: true, alphaTest: .1, side: THREE.DoubleSide, roughness: .8 }); materials.push(logoMaterial);
  if (!centered) {
    const logoGeometry = new THREE.PlaneGeometry(1.35, 1.35); logoGeometry.rotateX(Math.PI / 2);
    add("IVORY_HF_MONOGRAM", logoGeometry, logoMaterial, 0, back + .06, base + p.backdropHeight * .65);
  }
  if (mode !== "none") {
    const screenBottom = centered ? base + .12 : .35;
    const screenZ = screenBottom + LED_HEIGHT / 2, screenY = back + design.screenForward;
    const screenGroup = new THREE.Group(); screenGroup.name = "LED_SCREEN_ASSEMBLY";
    screenGroup.position.set(design.screenX, screenY, 0); screenGroup.rotation.z = design.screenAngle; root.add(screenGroup);
    const screenPart = (mesh: THREE.Mesh) => {
      mesh.position.x -= design.screenX; mesh.position.y -= screenY;
      screenGroup.add(mesh);
    };
    screenPart(add("LED_IVORY_SURROUND", new THREE.BoxGeometry(LED_WIDTH + .2, .24, LED_HEIGHT + .2), ivory, design.screenX, screenY - .14, screenZ));
    const screenMaterial = new THREE.MeshBasicMaterial({ color: "#421221", side: THREE.DoubleSide, toneMapped: false }); materials.push(screenMaterial);
    const screenGeometry = new THREE.PlaneGeometry(LED_WIDTH, LED_HEIGHT); screenGeometry.rotateX(Math.PI / 2);
    screenPart(add("LED_5_BY_3M_FACE", screenGeometry, screenMaterial, design.screenX, screenY, screenZ));
    const screenLogoMaterial = new THREE.MeshBasicMaterial({ map: logoTexture, color: "#fff0d4", transparent: true, alphaTest: .1, side: THREE.DoubleSide, toneMapped: false }); materials.push(screenLogoMaterial);
    const screenLogo = new THREE.PlaneGeometry(2, 2); screenLogo.rotateX(Math.PI / 2);
    screenPart(add("LED_HF_SCREENSAVER", screenLogo, screenLogoMaterial, design.screenX, screenY + .012, screenZ));
    if (mode === "side") {
      screenPart(add("LED_SUPPORT_FOOTPRINT", new THREE.BoxGeometry(LED_WIDTH + .2, 1.2, .16), ivory, design.screenX, screenY - .4, .08));
      screenPart(add("LED_SUPPORT_PLINTH", new THREE.BoxGeometry(LED_WIDTH - .2, .4, .35), ivory, design.screenX, screenY - .15, .175));
    }
  }
  return { root, dispose() {
    root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    materials.forEach(material => material.dispose()); logoTexture.dispose();
  } };
}

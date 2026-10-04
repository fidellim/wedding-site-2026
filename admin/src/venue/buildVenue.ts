import { buildStage } from "./buildStage";
import { planToSceneScale } from "./venueCoordinates";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ceremonyStructure, ceremonyPalms, stageLayout, venueLayout, type LedLayout, type VenueParameters } from "./venueModel";

/** Z-up, origin at the reception lawn. Every number is a documented visual placeholder. */
export function buildVenue(p: VenueParameters, led: LedLayout = "none") {
  const root = new THREE.Group(); root.name = "VENUE_ROOT"; root.scale.fromArray(planToSceneScale);
  const l = venueLayout(p);
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const material = (color: string, roughness = .9) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness }); materials.push(m); return m;
  };
  const stone = material("#d2bda1"), paleStone = material("#e3d1b6"), edge = material("#baa58a");
  const timber = material("#543529"), woodLight = material("#79503b"), roofMat = material("#50362c");
  const plaster = material("#e7d6b7"), recess = material("#8f816b");
  const leaf = material("#59774b"), leafLight = material("#738950"), bark = material("#88735a");
  recess.side = THREE.DoubleSide;
  leaf.side = THREE.DoubleSide; leafLight.side = THREE.DoubleSide;
  const group = (name: string, parent = root) => { const g = new THREE.Group(); g.name = name; parent.add(g); return g; };
  const site = group("SITE"), pavilion = group("PAVILION_ROOT"), landscape = group("LANDSCAPING"), resort = group("RESORT_BACKGROUND"), arrival = group("ARRIVAL_CONTEXT"), waterfront = group("WATERFRONT");
  arrival.position.z = p.terraceHeight;
  const box = (parent: THREE.Group, name: string, x: number, y: number, z: number, w: number, d: number, h: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat);
    mesh.position.set(x, y, z); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const cylinder = (parent: THREE.Group, name: string, x: number, y: number, z: number, top: number, bottom: number, height: number, mat: THREE.Material, sides = 16) => {
    const geo = new THREE.CylinderGeometry(top, bottom, height, sides); geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat); mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const beam = (parent: THREE.Group, name: string, a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6), mat);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.name = name; mesh.castShadow = true; parent.add(mesh);
  };
  // Small deterministic procedural textures avoid large downloads and individual tile geometry.
  function surfaceTexture(kind: "grass" | "stone" | "plaza" | "water" | "sand" | "wall") {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    let seed = 91;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    ctx.fillStyle = kind === "grass" ? "#789052" : kind === "water" ? "#809ca2" : "#d4c1a8"; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 18000; i++) {
      ctx.fillStyle = `rgba(${kind === "grass" ? "38,66,21" : "96,80,62"},${random() * .12})`;
      ctx.fillRect(random() * 512, random() * 512, kind === "grass" ? 2 : 4, 2);
    }
    if (kind === "stone") {
      for (let y = 0; y < 512; y += 64) for (let x = -64; x < 512; x += 128) {
        const offset = y % 128 ? 64 : 0;
        ctx.fillStyle = `rgba(120,94,77,${random() * .15})`; ctx.fillRect(x + offset, y, 126, 62);
        ctx.strokeStyle = "rgba(109,92,72,.22)"; ctx.lineWidth = 1; ctx.strokeRect(x + offset, y, 128, 64);
      }
    }
    if (kind === "plaza") {
      // Video 00:48–01:00: broad bands around a circular medallion and starburst.
      for (const [radius, width, color] of [[235, 22, "#a88b7d"], [210, 12, "#e8d8b8"], [190, 7, "#89847a"]] as const) {
        ctx.beginPath(); ctx.arc(256, 256, radius, 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, half = Math.PI / 15;
        ctx.beginPath(); ctx.moveTo(256 + 83 * Math.cos(a - half), 256 + 83 * Math.sin(a - half));
        ctx.lineTo(256 + 189 * Math.cos(a), 256 + 189 * Math.sin(a));
        ctx.lineTo(256 + 83 * Math.cos(a + half), 256 + 83 * Math.sin(a + half));
        ctx.closePath(); ctx.fillStyle = i % 2 ? "#a18e80" : "#949389"; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(256, 256, 80, 0, Math.PI * 2); ctx.fillStyle = "#a99184"; ctx.fill();
      // Fine joints remain a material detail, not individual paving geometry.
      ctx.strokeStyle = "rgba(238,225,204,.32)"; ctx.lineWidth = 1;
      for (let y = 0; y < 512; y += 24) for (let x = -24; x < 512; x += 48) {
        ctx.strokeRect(x + (y % 48 ? 24 : 0), y, 48, 24);
      }
    }
    if (kind === "wall") {
      ctx.fillStyle = "#b5a795"; ctx.fillRect(0, 0, 512, 512);
      for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
        const x = col * 128 + (row % 2 ? 64 : 0), y = row * 64;
        ctx.beginPath(); ctx.moveTo(x + 4 + random() * 5, y + 4);
        ctx.lineTo(x + 119, y + 3 + random() * 5); ctx.lineTo(x + 124, y + 51);
        ctx.lineTo(x + 114, y + 60); ctx.lineTo(x + 5, y + 57);
        ctx.closePath(); ctx.fillStyle = ["#d7c9b5", "#e2d4bf", "#cdbda6"][Math.floor(random() * 3)]; ctx.fill();
        ctx.strokeStyle = "rgba(248,238,218,.5)"; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    if (kind === "water") {
      for (let i = 0; i < 160; i++) {
        ctx.beginPath(); const y = random() * 512; ctx.moveTo(0, y); ctx.bezierCurveTo(160, y - 5, 320, y + 6, 512, y); ctx.strokeStyle = `rgba(225,242,230,${random() * .3})`; ctx.lineWidth = random() * 2; ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4; textures.push(texture); return texture;
  }
  const grassTexture = surfaceTexture("grass"); grassTexture.repeat.set(8, 6);
  const grass = material("#ffffff"); grass.map = grassTexture; grass.bumpMap = grassTexture; grass.bumpScale = .025;
  const paving = material("#ffffff"); const pavingTexture = surfaceTexture("stone"); pavingTexture.repeat.set(8, 4); paving.map = pavingTexture; paving.bumpMap = pavingTexture; paving.bumpScale = .015;
  const retainingStone = material("#ffffff");
  const wallTexture = surfaceTexture("wall"); wallTexture.repeat.set(8, 1);
  retainingStone.map = wallTexture; retainingStone.bumpMap = wallTexture; retainingStone.bumpScale = .035;
  const sandMat = material("#e9dfc9"); sandMat.map = surfaceTexture("sand");
  const plazaMat = material("#ffffff"); plazaMat.map = surfaceTexture("plaza");
  box(site, "VENUE_LAWN_BASE", 0, 0, -.4, p.lawnWidth, p.lawnLength, .8, edge);
  box(site, "VENUE_LAWN", 0, 0, -.02, p.lawnWidth, p.lawnLength, .08, grass);
  box(site, "TERRACE_LAWN_TRANSITION", 0, (l.lawnBack + l.terraceFront) / 2, -.25, p.lawnWidth, l.lawnBack - l.terraceFront, .5, stone);
  box(site, "TERRACE_MAIN", 0, (l.terraceFront + l.terraceBack) / 2, (p.terraceHeight - .8) / 2, p.lawnWidth, l.terraceDepth, p.terraceHeight + .8, retainingStone);
  box(site, "TERRACE_PAVING", 0, (l.terraceFront + l.terraceBack) / 2, p.terraceHeight + .025, p.lawnWidth, l.terraceDepth, .05, paving);
  // Stairs rise from the lawn toward the terrace without shifting the lawn origin.
  for (let i = 0; i < p.stairCount; i++) {
    const h = (i + 1) * p.terraceHeight / p.stairCount;
    box(site, "STAIRS_MAIN", l.stairX, l.lawnBack - (i + .5) * p.stairTread, h / 2, p.stairWidth, p.stairTread, h, paleStone);
  }
  const railX = l.stairX - p.stairWidth / 2;
  for (let i = 0; i <= p.stairCount; i += 2) {
    const z = i * p.terraceHeight / p.stairCount;
    cylinder(site, "STAIR_RAIL_POST", railX, l.lawnBack - i * p.stairTread, z + .5, .09, .09, 1, timber, 8);
  }
  beam(site, "STAIR_HANDRAIL", new THREE.Vector3(railX, l.lawnBack, 1), new THREE.Vector3(railX, l.terraceFront, p.terraceHeight + 1), .07, timber);
  // Broad lower landing bridges lawn and the paved arrival plaza; no asserted pedestrian route.
  box(site, "PLAZA_PATTERNED", l.plazaX, l.plazaY, p.terraceHeight + .035, l.plazaWidth, p.plazaLength, .07, plazaMat);
  const structure = ceremonyStructure(p), darkStone = material("#252726", .7);
  const tiered = group("CEREMONY_TIERED_STRUCTURE");
  for (let i = 0; i < structure.tiers; i++) {
    const radius = structure.radius * (1 - i * .105), height = structure.height / structure.tiers;
    cylinder(tiered, "DARK_CIRCULAR_TIER", structure.x, structure.y, structure.z + height * (i + .5), radius, radius, height, darkStone, 64);
  }

  box(site, "APPROACH_PATHS", l.plazaX, (l.entranceY + l.terraceBack) / 2, p.terraceHeight - .1, p.approachWidth, l.terraceBack - l.entranceY, .2, paving);
  box(arrival, "CANAL_BANK", l.plazaX - p.approachWidth / 2 - 2.3, (l.entranceY + l.terraceBack) / 2, -.3, 4, l.terraceBack - l.entranceY, .3, paleStone);
  const waterTexture = surfaceTexture("water"); waterTexture.repeat.set(8, 8);
  const waterMaterial = material("#79afb3", .3); waterMaterial.map = waterTexture; waterMaterial.bumpMap = waterTexture; waterMaterial.bumpScale = .1; waterMaterial.metalness = .12;
  box(arrival, "CANAL", l.plazaX - p.approachWidth / 2 - 2.3, (l.entranceY + l.terraceBack) / 2, -.12, 3.4, l.terraceBack - l.entranceY, .05, waterMaterial);
  const canalX = l.plazaX - p.approachWidth / 2 - 2.3;
  box(arrival, "CANAL_OPPOSITE_BANK_PATH", canalX - 3.15, (l.entranceY + l.terraceBack) / 2, -.1, 2.9, l.terraceBack - l.entranceY, .2, paving);
  const bridge = group("TIMBER_STAIR_BRIDGE", arrival);
  bridge.position.set(canalX, l.entranceY + 6, 0);
  // REF-02 and the arrival video show a raised crossing with inclined timber rails.
  // Heights and tread dimensions remain visual approximations.
  const bridgeHalfSpan = 2.05, bridgeHeight = 1.05, bridgeSteps = 7, bridgeTread = .3;
  box(bridge, "BRIDGE_LANDING", 0, 0, bridgeHeight - .1, bridgeHalfSpan * 2, 2.1, .2, timber);
  for (let i = 0; i < 14; i++) box(bridge, "BRIDGE_DECK_PLANK", -bridgeHalfSpan + (i + .5) * bridgeHalfSpan * 2 / 14, 0, bridgeHeight + .015, .27, 2.1, .03, woodLight);
  for (const end of [-1, 1]) {
    for (let i = 0; i < bridgeSteps; i++) {
      const height = bridgeHeight * (bridgeSteps - i) / bridgeSteps;
      box(bridge, "BRIDGE_STAIR_TREAD", end * (bridgeHalfSpan + (i + .5) * bridgeTread), 0, height / 2, bridgeTread, 2.1, height, timber);
      box(bridge, "BRIDGE_STAIR_NOSING", end * (bridgeHalfSpan + (i + .5) * bridgeTread), 0, height + .015, bridgeTread + .025, 2.14, .03, woodLight);
    }
  }
  for (const side of [-1, 1]) {
    const y = side * 1.02;
    box(bridge, "BRIDGE_HANDRAIL", 0, y, bridgeHeight + 1.05, bridgeHalfSpan * 2, .13, .13, woodLight);
    for (let i = 0; i <= 12; i++) box(bridge, "BRIDGE_BALUSTER", -bridgeHalfSpan + i * bridgeHalfSpan * 2 / 12, y, bridgeHeight + .5, .07, .07, 1, timber);
    for (const end of [-1, 1]) {
      const outerX = end * (bridgeHalfSpan + bridgeSteps * bridgeTread);
      for (let i = 0; i <= bridgeSteps; i++) {
        const x = end * (bridgeHalfSpan + i * bridgeTread), z = bridgeHeight * (1 - i / bridgeSteps);
        box(bridge, i === 0 || i === bridgeSteps ? "BRIDGE_NEWEL" : "BRIDGE_STAIR_BALUSTER", x, y, z + .53, i === 0 || i === bridgeSteps ? .18 : .07, .12, 1.06, timber);
      }
      beam(bridge, "BRIDGE_SLOPING_HANDRAIL", new THREE.Vector3(end * bridgeHalfSpan, y, bridgeHeight + 1.05), new THREE.Vector3(outerX, y, 1.05), .075, woodLight);
      beam(bridge, "BRIDGE_STRINGER", new THREE.Vector3(end * bridgeHalfSpan, y, bridgeHeight - .15), new THREE.Vector3(outerX, y, .02), .12, timber);
    }
  }

  // Stationary, unoccupied Shangri-La-style abra before the approach bridge.
  const abra = group("ABRA_BOAT", arrival);
  abra.position.set(canalX, l.entranceY + 2.5, -.095);
  const hullMaterial = material("#34291f", .65), canopyMaterial = material("#762d39", .9), canopyTrim = material("#e7cfa2");
  hullMaterial.side = THREE.DoubleSide;
  const hullVertices: number[] = [], hullIndices: number[] = [], hullSegments = 32;
  for (const [width, length, height] of [[.44, 1.8, -.3], [.72, 2.05, .1], [.82, 2.2, .42]]) {
    for (let i = 0; i < hullSegments; i++) {
      const angle = i * Math.PI * 2 / hullSegments;
      hullVertices.push(Math.cos(angle) * width, Math.sin(angle) * length, height + Math.pow(Math.abs(Math.sin(angle)), 8) * .16);
    }
  }
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < hullSegments; i++) {
    const a = ring * hullSegments + i, b = ring * hullSegments + (i + 1) % hullSegments;
    hullIndices.push(a, b, a + hullSegments, b, b + hullSegments, a + hullSegments);
  }
  const hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute("position", new THREE.Float32BufferAttribute(hullVertices, 3)); hullGeometry.setIndex(hullIndices); hullGeometry.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeometry, hullMaterial); hull.name = "ABRA_CURVED_HULL"; hull.castShadow = true; hull.receiveShadow = true; abra.add(hull);
  const deckShape = new THREE.Shape(); deckShape.absellipse(0, 0, .69, 2, 0, Math.PI * 2, false, 0);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(deckShape, 32), woodLight); deck.name = "ABRA_DECK"; deck.position.z = .15; deck.receiveShadow = true; abra.add(deck);
  for (let i = 0; i < hullSegments; i++) {
    const a = i * Math.PI * 2 / hullSegments, b = (i + 1) * Math.PI * 2 / hullSegments;
    const rim = (angle: number) => new THREE.Vector3(Math.cos(angle) * .82, Math.sin(angle) * 2.2, .44 + Math.pow(Math.abs(Math.sin(angle)), 8) * .16);
    beam(abra, "ABRA_GUNWALE", rim(a), rim(b), .045, timber);
  }
  for (const y of [-.7, .7]) {
    box(abra, "ABRA_BENCH", 0, y, .49, 1.18, .38, .12, woodLight);
    box(abra, "ABRA_BENCH_BACK", 0, y + Math.sign(y) * .17, .74, 1.18, .075, .42, woodLight);
  }
  for (const x of [-.64, .64]) for (const y of [-1.12, 1.12]) box(abra, "ABRA_CANOPY_POST", x, y, 1.13, .075, .075, 1.94, timber);
  const canopyShape = new THREE.Shape();
  canopyShape.moveTo(-.87, 1.98); canopyShape.quadraticCurveTo(0, 2.3, .87, 1.98); canopyShape.lineTo(.87, 1.93); canopyShape.quadraticCurveTo(0, 2.25, -.87, 1.93); canopyShape.closePath();
  const canopyGeometry = new THREE.ExtrudeGeometry(canopyShape, { depth: 2.56, bevelEnabled: false, curveSegments: 12 }); canopyGeometry.rotateX(Math.PI / 2);
  const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial); canopy.name = "ABRA_BURGUNDY_CANOPY"; canopy.position.y = 1.28; canopy.castShadow = true; abra.add(canopy);
  for (const x of [-.87, .87]) {
    box(abra, "ABRA_CANOPY_VALANCE", x, 0, 1.91, .025, 2.56, .15, canopyMaterial);
    box(abra, "ABRA_CANOPY_TRIM", x, 0, 1.84, .03, 2.56, .025, canopyTrim);
    for (let i = 0; i < 12; i++) {
      const shape = new THREE.Shape(); shape.moveTo(-.08, 0); shape.lineTo(.08, 0); shape.lineTo(0, -.09); shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(Math.PI / 2); geometry.rotateZ(Math.PI / 2);
      const motif = new THREE.Mesh(geometry, canopyTrim); canopyTrim.side = THREE.DoubleSide; motif.name = "ABRA_CANOPY_PATTERN";
      motif.position.set(x + Math.sign(x) * .017, -1.17 + i * .21, 1.97); abra.add(motif);
    }
  }
  box(waterfront, "WATERFRONT_EDGE", 0, p.lawnLength / 2 + .3, p.waterfrontEdgeHeight / 2, p.lawnWidth + 2, .6, p.waterfrontEdgeHeight, paleStone);
  box(waterfront, "BEACH_SAND", 0, (p.lawnLength / 2 + l.waterY) / 2, -.12, p.lawnWidth + 2, p.waterSetback, .2, sandMat);
  box(waterfront, "WATER_SURFACE", -10, l.waterY + 75, -.2, 280, 150, .08, waterMaterial);
  // Distant shoreline is deliberately low-detail context.
  for (let i = 0; i < 32; i++) box(waterfront, "DISTANT_SHORE", -140 + i * 9, l.waterY + 149, .5 + (i % 4) * .3, 7, 3, 1 + (i % 4) * .6, paleStone);
  // A quiet architectural Easter egg across the water: ivory domes and four minarets.
  const mosque = group("SHEIKH_ZAYED_MOSQUE", waterfront);
  mosque.position.set(stageLayout(p).centerX, l.waterY + 143, 0);
  const marble = material("#e6e4e9", .65);
  marble.emissive.set("#b5b9df"); marble.emissiveIntensity = .32;
  const trim = material("#d1bd88", .5); trim.emissive.set("#ead4a2"); trim.emissiveIntensity = .25;
  box(mosque, "MOSQUE_TERRACE", 0, 0, .45, 50, 17, .9, paleStone);
  box(mosque, "PRAYER_HALL", 0, 1, 3.5, 30, 11, 6, marble);
  const mosqueDome = (x: number, y: number, base: number, radius: number) => {
    cylinder(mosque, "DOME_DRUM", x, y, base + .35, radius, radius, .7, marble, 24);
    const geometry = new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    geometry.rotateX(Math.PI / 2); geometry.scale(1, 1, 1.2);
    const mesh = new THREE.Mesh(geometry, marble); mesh.name = "IVORY_DOME";
    mesh.position.set(x, y, base + .7); mosque.add(mesh);
    cylinder(mosque, "DOME_FINIAL", x, y, base + .7 + radius * 1.2 + .45, .02, .12, .9, trim, 8);
  };
  mosqueDome(0, 2, 6.5, 4.5);
  for (const x of [-10, 10]) mosqueDome(x, 2, 6.5, 2.9);
  for (let i = -4; i <= 4; i++) {
    box(mosque, "ARCADE", i * 4.6, -5, 2.4, 4.3, 2.8, 3.8, marble);
    mosqueDome(i * 4.6, -5, 4.3, 1.6);
  }
  for (const x of [-22, 22]) for (const y of [-6, 6]) {
    cylinder(mosque, "MINARET_BASE", x, y, 2.5, 1.15, 1.4, 5, marble);
    cylinder(mosque, "MINARET_SHAFT", x, y, 9, .6, .9, 9, marble);
    for (const z of [5, 12, 15]) cylinder(mosque, "MINARET_BALCONY", x, y, z, 1, 1, .35, marble);
    cylinder(mosque, "MINARET_LANTERN", x, y, 14.2, .5, .6, 2.4, marble);
    mosqueDome(x, y, 15.2, .7);
    cylinder(mosque, "MINARET_SPIRE", x, y, 17.1, 0, .22, 1.2, trim, 8);
  }

  const floor = p.terraceHeight + p.pavilionFloorOffset, radius = p.pavilionDiameter / 2, count = p.pavilionColumns;
  cylinder(pavilion, "PAVILION_FLOOR", l.pavilionX, l.pavilionY, floor, radius, radius, .18, stone, count);
  const posts = group("PAVILION_COLUMNS", pavilion), panels = group("PAVILION_LOWER_PERIMETER", pavilion), railing = group("PAVILION_RAILING_OR_COUNTER", pavilion);
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count, next = (i + 1) * Math.PI * 2 / count;
    const x = l.pavilionX + Math.cos(a) * radius * .86, y = l.pavilionY + Math.sin(a) * radius * .86;
    box(posts, "TIMBER_POST", x, y, floor + p.pavilionColumnHeight / 2, .18, .18, p.pavilionColumnHeight, timber);
    const end = new THREE.Vector3(l.pavilionX + Math.cos(next) * radius * .86, l.pavilionY + Math.sin(next) * radius * .86, floor + 1.1);
    // One open bay provides an entrance; all upper sides stay open.
    if (i !== count - 3) {
      const start = new THREE.Vector3(x, y, floor + 1.1);
      beam(railing, "COUNTER", start, end, .13, woodLight);
      const panel = box(panels, "LOWER_PANEL", (x + end.x) / 2, (y + end.y) / 2, floor + .5, start.distanceTo(end), .1, .95, timber); panel.rotation.z = Math.atan2(end.y - y, end.x - x);
    }
    beam(posts, "ROOF_BRACE", new THREE.Vector3(x, y, floor + p.pavilionColumnHeight - .6), new THREE.Vector3(l.pavilionX + Math.cos(a) * radius * .62, l.pavilionY + Math.sin(a) * radius * .62, floor + p.pavilionColumnHeight), .065, woodLight);
  }
  const eave = floor + p.pavilionColumnHeight;
  // Broad faceted roof with deep overhang; resort dome is a separate background object.
  cylinder(pavilion, "PAVILION_ROOF", l.pavilionX, l.pavilionY, eave + p.pavilionRoofRise / 2, radius * .22, radius * 1.17, p.pavilionRoofRise, roofMat, count);
  cylinder(pavilion, "ROOF_FASCIA", l.pavilionX, l.pavilionY, eave, radius * 1.17, radius * 1.17, .18, timber, count);
  cylinder(pavilion, "ROOF_CAP", l.pavilionX, l.pavilionY, eave + p.pavilionRoofRise, radius * .22, radius * .24, .12, woodLight, count);
  const interior = group("PAVILION_INTERIOR_SIMPLE", pavilion);
  cylinder(interior, "CENTRAL_COUNTER", l.pavilionX, l.pavilionY, floor + .5, .9, .9, 1, woodLight, count);
  // Warm resort massing, recessed arches, and a separate light dome.
  for (let i = 0; i < 3; i++) {
    const x = -p.lawnWidth * .24 - i * 6, y = l.terraceBack - 3.5, h = i === 0 ? 8.8 : 6;
    box(resort, "RESORT_MASS", x, y, p.terraceHeight + h / 2, 5.6, 6, h, plaster);
    box(resort, "RESORT_PARAPET", x, y, p.terraceHeight + h, 6, 6.4, .35, paleStone);
    for (let j = -1; j <= 1; j++) {
      const shape = new THREE.Shape(); shape.moveTo(-.6, 0); shape.lineTo(.6, 0); shape.lineTo(.6, 1.6); shape.absarc(0, 1.6, .6, 0, Math.PI, false); shape.lineTo(-.6, 0);
      const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(Math.PI / 2);
      const arch = new THREE.Mesh(geometry, recess); arch.position.set(x + j * 2.1, y + 3.01, p.terraceHeight + 1.3); resort.add(arch);
    }
  }
  const domeGeometry = new THREE.SphereGeometry(2.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); domeGeometry.rotateX(Math.PI / 2);
  const dome = new THREE.Mesh(domeGeometry, paleStone); dome.name = "RESORT_DOME"; dome.position.set(-p.lawnWidth * .24, l.terraceBack - 3.5, p.terraceHeight + 9); resort.add(dome);
  // Merge foliage geometry by material after construction to keep draw calls low.
  const foliage: THREE.BufferGeometry[][] = [[], [], []];
  const datePalmLeaf = material("#718475"); datePalmLeaf.side = THREE.DoubleSide;
  function palm(x: number, y: number, z: number, height: number, feathered = true) {
    cylinder(landscape, "PALM_TRUNK", x, y, z + height / 2, .16, .28, height, bark, 7);
    const frondCount = feathered ? 28 : 11;
    for (let f = 0; f < frondCount; f++) {
      const a = f * Math.PI * 2 / frondCount, length = 3.1 + (f % 3) * .35;
      const vertices: number[] = [], indices: number[] = [];
      for (let s = 0; s <= 9; s++) {
        const t = s / 9, width = Math.sin(t * Math.PI) * (feathered ? .055 : .4);
        const centerX = x + Math.cos(a) * length * t, centerY = y + Math.sin(a) * length * t;
        const centerZ = z + height + Math.sin(t * Math.PI) * (feathered && f % 2 ? 1.65 : .8) - t * t * 1.1;
        vertices.push(centerX - Math.sin(a) * width, centerY + Math.cos(a) * width, centerZ,
          centerX + Math.sin(a) * width, centerY - Math.cos(a) * width, centerZ);
        if (s < 9) { const v = s * 2; indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
      }
      if (feathered) {
        // Paired narrow leaflets give date-palm fronds a feathered rather than ribbon silhouette.
        for (let s = 1; s < 18; s++) for (const side of [-1, 1]) {
          const t = s / 18, spread = Math.sin(t * Math.PI) * .75;
          const cx = x + Math.cos(a) * length * t, cy = y + Math.sin(a) * length * t;
          const cz = z + height + Math.sin(t * Math.PI) * (f % 2 ? 1.65 : .8) - t * t * 1.1;
          const base = vertices.length / 3;
          vertices.push(cx, cy, cz,
            cx + Math.cos(a) * .18, cy + Math.sin(a) * .18, cz,
            cx + Math.cos(a) * .38 - Math.sin(a) * spread * side,
            cy + Math.sin(a) * .38 + Math.cos(a) * spread * side, cz - .12);
          indices.push(base, base + 1, base + 2);
        }
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); foliage[feathered ? 2 : f % 2].push(geometry);
    }
  }
  for (let i = 0; i < 3; i++) palm(-(p.lawnWidth / 2 - 2), l.terraceBack + 2 + i * l.terraceDepth / 3, p.terraceHeight, 6.8 + i * .4);
  for (let i = 0; i < 3; i++) {
    const x = l.plazaX + p.approachWidth / 2 + 2.4, y = l.entranceY + 2 + i * 3;
    palm(x, y, p.terraceHeight, 5.4 + i * .3);
    cylinder(arrival, "LAMP_POSTS", l.plazaX - p.approachWidth / 2 + .2, y + 2, 1.5, .045, .07, 3, timber, 6);
    box(arrival, "LAMP_LANTERN", l.plazaX - p.approachWidth / 2 + .2, y + 2, 3.1, .3, .3, .4, paleStone);
  }
  function shadeTree(x: number, y: number, z: number) {
    cylinder(landscape, "SHADE_TREE_TRUNK", x, y, z + 2.2, .18, .34, 4.4, bark, 7);
    for (let j = 0; j < 7; j++) {
      const geometry = new THREE.IcosahedronGeometry(1.8 + (j % 2) * .3, 1);
      geometry.scale(1.3, 1.15, .8); geometry.translate(x + Math.cos(j * 2.4) * 1.7, y + Math.sin(j * 2.4) * 1.5, z + 4.6 + (j % 3) * .4); foliage[j % 2].push(geometry);
    }
  }
  for (let i = 0; i < 4; i++) {
    shadeTree(i < 2 ? p.lawnWidth / 2 + 1.5 : -p.lawnWidth / 2 + 3,
      l.terraceBack + 3 + (i % 2) * 9, p.terraceHeight);
  }
  // Video 00:48–01:04: water-facing plaza margin, outside the stair opening.
  for (const tree of ceremonyPalms(p)) palm(tree.x, tree.y, tree.z, tree.height);
  for (let i = 0; i < foliage.length; i++) {
    const pieces = foliage[i].map(geometry => { const result = geometry.index ? geometry.toNonIndexed() : geometry.clone(); result.deleteAttribute("uv"); geometry.dispose(); return result; });
    const merged = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    if (merged) { const mesh = new THREE.Mesh(merged, i === 2 ? datePalmLeaf : i ? leafLight : leaf); mesh.name = "LANDSCAPING_FOLIAGE"; mesh.castShadow = true; mesh.receiveShadow = true; landscape.add(mesh); }
  }
  box(landscape, "HEDGE", p.lawnWidth / 2 - .5, (l.terraceFront + l.terraceBack) / 2, p.terraceHeight + .5, 1, l.terraceDepth - 1, 1, leaf);
  // Temporary wedding furniture remains separate from the permanent venue.
  const weddingLayout = new THREE.Group(); weddingLayout.name = "WEDDING_LAYOUT"; weddingLayout.scale.fromArray(planToSceneScale);
  const stage = buildStage(p, led); weddingLayout.add(stage.root);
  return { root, weddingLayout, waterTexture,
    dispose() {
      stage.dispose();
      root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    },
  };
}

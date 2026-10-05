import { venueArchitecture } from "./venueArchitecture";
import { buildStage } from "./buildStage";
import { planToSceneScale } from "./venueCoordinates";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ceremonyStructure, ceremonyPalms, stageLayout, venueLayout, type LedLayout, type VenueParameters, normalizeParameters } from "./venueModel";

/** Z-up, origin at the reception lawn. Every number is a documented visual placeholder. */
export function buildVenue(input: VenueParameters, led: LedLayout = "none") {
  const p = normalizeParameters(input);
  const root = new THREE.Group(); root.name = "VENUE_ROOT"; root.scale.fromArray(planToSceneScale);
  const l = venueLayout(p), architecture = venueArchitecture(p);
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const material = (color: string, roughness = .9) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness }); materials.push(m); return m;
  };
  const stone = material("#d2bda1"), paleStone = material("#e3d1b6"), edge = material("#baa58a");
  const timber = material("#543529"), woodLight = material("#79503b"), roofMat = material("#ffffff");
  const plaster = material("#e7d6b7"), recess = material("#8f816b");
  const leaf = material("#59774b"), leafLight = material("#738950"), bark = material("#88735a");
  recess.side = THREE.DoubleSide;
  leaf.side = THREE.DoubleSide; leafLight.side = THREE.DoubleSide;
  const group = (name: string, parent = root) => { const g = new THREE.Group(); g.name = name; parent.add(g); return g; };
  const site = group("SITE"), pavilion = group("PAVILION_ROOT"), landscape = group("LANDSCAPING"), resort = group("RESORT_BACKGROUND"), arrival = group("ARRIVAL_CONTEXT"), waterfront = group("WATERFRONT");
  arrival.position.z = p.terraceHeight;
  // Small architectural details are merged by material before rendering.
  const details = group("VENUE_ARCHITECTURAL_DETAILS");
  const iron = material("#39332c", .75), brass = material("#b69654", .6);
  const lanternGlass = material("#e6dfc5", .45);
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
  function chain(a: THREE.Vector3, b: THREE.Vector3, sag = .16) {
    const points = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return a.clone().lerp(b, t).add(new THREE.Vector3(0, 0, -4 * sag * t * (1 - t)));
    });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, .018, 4, false), iron);
    mesh.name = "SAGGING_CHAIN"; details.add(mesh);
  }
  function lantern(x: number, y: number, base: number) {
    cylinder(details, "LANTERN_BASE", x, y, base + .12, .12, .22, .24, brass, 12);
    cylinder(details, "LANTERN_SHAFT", x, y, base + .85, .035, .06, 1.4, iron, 8);
    cylinder(details, "LANTERN_GOLD_COLLAR", x, y, base + 1.42, .08, .1, .18, brass, 10);
    cylinder(details, "LANTERN_GLASS", x, y, base + 1.72, .11, .09, .4, lanternGlass, 6);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      beam(details, "LANTERN_FRAME", new THREE.Vector3(x + .09 * Math.cos(angle), y + .09 * Math.sin(angle), base + 1.52),
        new THREE.Vector3(x + .11 * Math.cos(angle), y + .11 * Math.sin(angle), base + 1.92), .013, iron);
    }
    cylinder(details, "LANTERN_CAP", x, y, base + 1.96, .04, .17, .16, iron, 8);
    cylinder(details, "LANTERN_FINIAL", x, y, base + 2.08, 0, .04, .12, iron, 8);
  }
  function polygonSurface(parent: THREE.Group, name: string, points: { x: number; y: number }[], z: number, mat: THREE.Material) {
    const shape = new THREE.Shape(points.map(point => new THREE.Vector2(point.x, point.y)));
    const geometry = new THREE.ShapeGeometry(shape);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 12, uv.getY(i) / 12);
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.z = z; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  // Small deterministic procedural textures avoid large downloads and individual tile geometry.
  function surfaceTexture(kind: "grass" | "stone" | "plaza" | "water" | "sand" | "wall" | "roof" | "bark") {
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
    if (kind === "roof" || kind === "bark") {
      ctx.fillStyle = kind === "roof" ? "#78604b" : "#796148"; ctx.fillRect(0, 0, 512, 512);
      if (kind === "roof") for (let x = 0; x < 512; x += 8) {
        ctx.fillStyle = "#9a7c63"; ctx.fillRect(x, 0, 1, 512);
        ctx.fillStyle = "#584538"; ctx.fillRect(x + 6, 0, 2, 512);
      }
      else for (let y = 0; y < 512; y += 32) for (let x = -32; x < 512; x += 64) {
        const offset = (y / 32) % 2 ? 32 : 0;
        ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + offset + 32, y + 28); ctx.lineTo(x + offset + 64, y);
        ctx.strokeStyle = "#b49a77"; ctx.lineWidth = 4; ctx.stroke();
      }
    }
    if (kind === "plaza") {
      // Video 00:48–01:00: broad bands around a circular medallion and starburst.
      for (const [radius, width, color] of [[235, 18, "#a58e80"], [210, 16, "#dacdb6"], [190, 9, "#88877b"]] as const) {
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
  // Preserve circular inlays in world space on a rectangular plaza.
  plazaMat.map.repeat.set(1, p.plazaLength / l.plazaWidth);
  plazaMat.map.offset.y = (1 - p.plazaLength / l.plazaWidth) / 2;
  roofMat.map = surfaceTexture("roof"); roofMat.bumpMap = roofMat.map; roofMat.bumpScale = .018;
  bark.map = surfaceTexture("bark"); bark.bumpMap = bark.map; bark.bumpScale = .05;
  box(site, "VENUE_LAWN_BASE", 0, 0, -.4, p.lawnWidth, p.lawnLength, .8, edge);
  box(site, "VENUE_LAWN", 0, 0, -.02, p.lawnWidth, p.lawnLength, .08, grass);
  box(site, "TERRACE_LAWN_TRANSITION", 0, (l.lawnBack + l.terraceFront) / 2, -.25, p.lawnWidth, l.lawnBack - l.terraceFront, .5, stone);
  const terraceShape = new THREE.Shape(architecture.terrace.map(point => new THREE.Vector2(point.x, point.y)));
  const terraceBase = new THREE.Mesh(new THREE.ExtrudeGeometry(terraceShape, { depth: p.terraceHeight + .8, bevelEnabled: false }), retainingStone);
  terraceBase.position.z = -.8; terraceBase.name = "TERRACE_MAIN"; terraceBase.receiveShadow = true; site.add(terraceBase);
  const terracePaving = new THREE.Mesh(new THREE.ShapeGeometry(terraceShape), paving);
  const terraceUvs = terracePaving.geometry.getAttribute("uv");
  for (let i = 0; i < terraceUvs.count; i++) terraceUvs.setXY(i, (terraceUvs.getX(i) + p.lawnWidth / 2) / p.lawnWidth, (terraceUvs.getY(i) - l.terraceBack) / l.terraceDepth);
  terracePaving.position.z = p.terraceHeight + .03; terracePaving.name = "TERRACE_PAVING"; terracePaving.receiveShadow = true; site.add(terracePaving);
  // Low coping walls enclose the raised forecourt, with a clear stair opening.
  for (const points of architecture.retainingEdges) for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    const wall = box(site, "TERRACE_PARAPET", (a.x + b.x) / 2, (a.y + b.y) / 2, p.terraceHeight + .35, length, .28, .7, retainingStone);
    wall.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    const cap = box(site, "TERRACE_COPING", (a.x + b.x) / 2, (a.y + b.y) / 2, p.terraceHeight + .72, length, .38, .09, paleStone);
    cap.rotation.z = wall.rotation.z;
    if (i % 5 === 1) {
      const inset = box(details, "TERRACE_WALL_LIGHT", (a.x + b.x) / 2, (a.y + b.y) / 2 + .15, p.terraceHeight + .3,
        .22, .04, .09, iron); inset.rotation.z = wall.rotation.z;
    }
  }
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
  for (let i = 0; i < p.stairCount; i += 2) {
    const next = Math.min(i + 2, p.stairCount);
    for (const height of [.4, .75]) chain(
      new THREE.Vector3(railX, l.lawnBack - i * p.stairTread, i * p.terraceHeight / p.stairCount + height),
      new THREE.Vector3(railX, l.lawnBack - next * p.stairTread, next * p.terraceHeight / p.stairCount + height), .09);
  }
  // Broad lower landing bridges lawn and the paved arrival plaza; no asserted pedestrian route.
  box(site, "PLAZA_PATTERNED", l.plazaX, l.plazaY, p.terraceHeight + .035, l.plazaWidth, p.plazaLength, .07, plazaMat);
  const structure = ceremonyStructure(p), darkStone = material("#252726", .7);
  const fountain = group("CEREMONY_FOUNTAIN");
  const fountainWater = material("#79afb3", .25); fountainWater.metalness = .12;
  for (let i = 0; i < structure.tiers; i++) {
    const radius = structure.radius * (1 - i * .105), height = structure.height / structure.tiers;
    cylinder(fountain, "FOUNTAIN_STONE_TIER", structure.x, structure.y, structure.z + height * (i + .5), radius, radius, height, darkStone, 64);
    cylinder(fountain, "FOUNTAIN_BASIN_WATER", structure.x, structure.y, structure.z + height * (i + 1) + .008, radius - .06, radius - .06, .012, fountainWater, 64);
  }

  polygonSurface(site, "APPROACH_PATHS", architecture.approach, p.terraceHeight + .035, paving);
  const canalX = architecture.canalX;
  const approachShape = new THREE.Shape(architecture.apron.map(point => new THREE.Vector2(point.x, point.y)));
  const approachBase = new THREE.Mesh(new THREE.ExtrudeGeometry(approachShape, { depth: p.terraceHeight + .5, bevelEnabled: false }), retainingStone);
  approachBase.name = "APPROACH_GROUND_BASE"; approachBase.position.z = -p.terraceHeight - .5; approachBase.receiveShadow = true; arrival.add(approachBase);
  polygonSurface(arrival, "APPROACH_STONE_APRON", architecture.apron, .025, paving);
  const bankShape = new THREE.Shape(architecture.canalBank.map(point => new THREE.Vector2(point.x, point.y)));
  bankShape.holes.push(new THREE.Path(architecture.canal.map(point => new THREE.Vector2(point.x, point.y))));
  const bank = new THREE.Mesh(new THREE.ExtrudeGeometry(bankShape, { depth: .4, bevelEnabled: false }), retainingStone);
  bank.name = "CONTINUOUS_CANAL_BANK"; bank.position.z = -.4; bank.receiveShadow = true; arrival.add(bank);
  const waterTexture = surfaceTexture("water"); waterTexture.repeat.set(8, 8);
  const waterMaterial = material("#79afb3", .3); waterMaterial.map = waterTexture; waterMaterial.bumpMap = waterTexture; waterMaterial.bumpScale = .1; waterMaterial.metalness = .12;
  polygonSurface(arrival, "CANAL", architecture.canal, -.12, waterMaterial);
  for (let i = 1; i < architecture.canalTerraceEdge.length; i++) {
    const a = architecture.canalTerraceEdge[i - 1], b = architecture.canalTerraceEdge[i];
    const coping = box(details, "CURVED_CANAL_TERRACE_COPING", (a.x + b.x) / 2, (a.y + b.y) / 2,
      p.terraceHeight + .045, Math.hypot(b.x - a.x, b.y - a.y) + .03, .24, .09, paleStone);
    coping.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
  }
  for (const [i, point] of architecture.canalCurvePosts.entries()) {
    cylinder(details, "CURVED_CANAL_CHAIN_POST", point.x, point.y, p.terraceHeight + .5, .065, .09, 1, timber, 10);
    cylinder(details, "CURVED_CANAL_POST_CAP", point.x, point.y, p.terraceHeight + 1, .085, .085, .1, timber, 10);
    if (i > 0) {
      const previous = architecture.canalCurvePosts[i - 1];
      chain(new THREE.Vector3(previous.x, previous.y, p.terraceHeight + .85), new THREE.Vector3(point.x, point.y, p.terraceHeight + .85));
    }
  }
  box(arrival, "CANAL_OPPOSITE_BANK_PATH", canalX - 3.15, (l.entranceY + l.terraceBack - 7) / 2, -.1, 2.9, p.approachLength - 7, .2, paving);
  const b = architecture.bridge;
  // Repeat posts along the long canal; interrupt them at the bridge and stair access.
  const postCount = Math.ceil((p.approachLength - 7) / 2.4) + 1;
  const canalPosts = Array.from({ length: postCount }, (_, i) =>
    l.entranceY + i / (postCount - 1) * (p.approachLength - 7));
  for (let i = 0; i < canalPosts.length; i++) {
    const y = canalPosts[i];
    if (y > b.y - b.width / 2 - .5 && y < b.flightBottomY + .5) continue;
    cylinder(details, "CANAL_CHAIN_POST", canalX + 1.9, y, p.terraceHeight + .5, .065, .09, 1, timber, 10);
    cylinder(details, "CANAL_POST_CAP", canalX + 1.9, y, p.terraceHeight + 1, .085, .085, .1, timber, 10);
    if (i > 0 && !(canalPosts[i - 1] > b.y - b.width / 2 - .5 && canalPosts[i - 1] < b.flightBottomY + .5)) {
      chain(new THREE.Vector3(canalX + 1.9, canalPosts[i - 1], p.terraceHeight + .85),
        new THREE.Vector3(canalX + 1.9, y, p.terraceHeight + .85));
    }
  }
  const bridge = group("TIMBER_STAIR_BRIDGE", arrival);
  bridge.position.set(b.x, b.y, 0);
  const halfSpan = b.deckSpan / 2, halfWidth = b.width / 2, localFlightX = b.flightX - b.x;
  box(bridge, "BRIDGE_DECK", 0, 0, b.rise - .1, b.deckSpan, b.width, .2, timber);
  for (let i = 0; i < 24; i++) box(bridge, "BRIDGE_DECK_PLANK", -halfSpan + (i + .5) * b.deckSpan / 24,
    0, b.rise + .015, b.deckSpan / 24 - .02, b.width, .03, woodLight);
  // A longitudinal flight reaches the near-bank landing, then turns 90° onto the deck.
  for (let i = 0; i < b.steps; i++) {
    const height = b.rise * (b.steps - i) / b.steps;
    box(bridge, "APPROACH_STAIR_TREAD", localFlightX, halfWidth + (i + .5) * b.tread,
      height / 2, b.width, b.tread, height, timber);
    box(bridge, "APPROACH_STAIR_NOSING", localFlightX, halfWidth + (i + .5) * b.tread,
      height + .015, b.width + .035, b.tread + .02, .03, woodLight);
  }
  for (const x of [-halfSpan + halfWidth, halfSpan - halfWidth]) {
    box(bridge, "BRIDGE_LANDING_SUPPORT", x, 0, b.rise / 2, .3, b.width - .15, b.rise, timber);
  }
  for (const side of [-1, 1]) {
    const y = side * halfWidth;
    // Keep the stair opening clear at the near-bank landing.
    const railEnd = side === 1 ? halfSpan - b.width : halfSpan;
    for (const z of [.3, .65, 1.05]) box(bridge, "BRIDGE_LATTICE_RAIL", (-halfSpan + railEnd) / 2,
      y, b.rise + z, railEnd + halfSpan, .065, z === 1.05 ? .12 : .055, woodLight);
    const balusters = Math.ceil((railEnd + halfSpan) / .32);
    for (let i = 0; i <= balusters; i++) box(bridge, "BRIDGE_BALUSTER", -halfSpan + i / balusters * (railEnd + halfSpan), y,
      b.rise + .52, .055, .055, 1, timber);
    for (const x of [-halfSpan, railEnd]) {
      box(bridge, "BRIDGE_CAPPED_POST", x, y, b.rise + .55, .22, .22, 1.1, timber);
      box(bridge, "BRIDGE_POST_CAP", x, y, b.rise + 1.14, .32, .32, .12, woodLight);
      lantern(b.x + x, b.y + y, p.terraceHeight + b.rise + 1.2);
    }
    const stairX = localFlightX + side * halfWidth;
    for (let i = 0; i <= b.steps; i++) {
      const z = b.rise * (1 - i / b.steps);
      box(bridge, i === 0 || i === b.steps ? "APPROACH_STAIR_NEWEL" : "APPROACH_STAIR_BALUSTER",
        stairX, halfWidth + i * b.tread, z + .53, i === 0 || i === b.steps ? .18 : .065, .12, 1.06, timber);
    }
    beam(bridge, "APPROACH_SLOPING_HANDRAIL", new THREE.Vector3(stairX, halfWidth, b.rise + 1.05),
      new THREE.Vector3(stairX, halfWidth + b.flightRun, 1.05), .07, woodLight);
    beam(bridge, "APPROACH_STAIR_STRINGER", new THREE.Vector3(stairX, halfWidth, b.rise - .15),
      new THREE.Vector3(stairX, halfWidth + b.flightRun, .02), .12, timber);
  }

  // Stationary, unoccupied abra alongside the bridge, within the modeled canal.
  const abra = group("ABRA_BOAT", arrival);
  abra.position.set(canalX, architecture.bridgeY - 4.5, -.095);
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
  // 01:28: lawn meets a sandy shoreline; no continuous concrete seawall is asserted.
  box(waterfront, "LAWN_SAND_EDGE", 0, p.lawnLength / 2, -p.waterfrontEdgeHeight / 2, p.lawnWidth, .12, p.waterfrontEdgeHeight, sandMat);
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
      // September 29 close view: dark timber sill over framed mahogany panels.
      const counter = box(railing, "TIMBER_COUNTER_SILL", (x + end.x) / 2, (y + end.y) / 2, floor + 1.1, start.distanceTo(end) + .1, .38, .08, woodLight);
      counter.rotation.z = Math.atan2(end.y - y, end.x - x);
      const panel = box(panels, "LOWER_PANEL", (x + end.x) / 2, (y + end.y) / 2, floor + .5, start.distanceTo(end), .1, .95, timber); panel.rotation.z = Math.atan2(end.y - y, end.x - x);
    }
    const bayAngle = Math.atan2(end.y - y, end.x - x), bayLength = Math.hypot(end.x - x, end.y - y);
    const bayCenterX = (x + end.x) / 2, bayCenterY = (y + end.y) / 2;
    const bayBox = (name: string, along: number, z: number, width: number, height: number) => {
      const mesh = box(details, name, bayCenterX + along * Math.cos(bayAngle), bayCenterY + along * Math.sin(bayAngle), z, width, .14, height, woodLight);
      mesh.rotation.z = bayAngle;
    };
    if (i !== count - 3) {
      for (const z of [.12, .9]) bayBox("PAVILION_PANEL_FRAME", 0, floor + z, bayLength - .08, .065);
      for (const along of [-bayLength / 2 + .14, bayLength / 2 - .14]) bayBox("PAVILION_PANEL_STILE", along, floor + .51, .055, .78);
    }
    for (const z of [-.48, -.28, -.08]) bayBox("PAVILION_UPPER_LATTICE", 0, floor + p.pavilionColumnHeight + z, bayLength, .045);
    const latticeCount = Math.max(2, Math.floor(bayLength / .2));
    for (let j = 1; j < latticeCount; j++) bayBox("PAVILION_LATTICE_SLAT", (j / latticeCount - .5) * bayLength, floor + p.pavilionColumnHeight - .28, .035, .4);
    beam(posts, "ROOF_BRACE", new THREE.Vector3(x, y, floor + p.pavilionColumnHeight - .6), new THREE.Vector3(l.pavilionX + Math.cos(a) * radius * .62, l.pavilionY + Math.sin(a) * radius * .62, floor + p.pavilionColumnHeight), .065, woodLight);
  }
  const eave = floor + p.pavilionColumnHeight;
  // 02:00: rounded timber pavilion roof, separate from the pale resort dome.
  const profile = [new THREE.Vector2(radius * 1.17, 0), new THREE.Vector2(radius * 1.1, .10),
    new THREE.Vector2(radius, p.pavilionRoofRise * .18)];
  for (let i = 1; i <= 20; i++) {
    const t = i / 20 * Math.PI / 2;
    profile.push(new THREE.Vector2(radius * Math.cos(t), p.pavilionRoofRise * (.18 + .82 * Math.sin(t))));
  }
  const roofGeometry = new THREE.LatheGeometry(profile, 96); roofGeometry.rotateX(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeometry, roofMat); roof.name = "PAVILION_ROOF";
  roof.position.set(l.pavilionX, l.pavilionY, eave); roof.castShadow = true; pavilion.add(roof);
  cylinder(pavilion, "ROOF_FASCIA", l.pavilionX, l.pavilionY, eave, radius * 1.17, radius * 1.17, .18, timber, 64);
  cylinder(pavilion, "ROOF_EAVE_TRIM", l.pavilionX, l.pavilionY, eave + .10, radius * 1.18, radius * 1.18, .055, woodLight, 64);
  const interior = group("PAVILION_INTERIOR_SIMPLE", pavilion);
  cylinder(interior, "CENTRAL_COUNTER", l.pavilionX, l.pavilionY, floor + .5, .9, .9, 1, woodLight, count);
  // Warm resort massing, recessed arches, and a separate light dome.
  for (let i = 0; i < 3; i++) {
    const x = l.pavilionX - i * 6, y = l.pavilionTerraceBack - 9, h = i === 0 ? 8.8 : 6;
    box(resort, "RESORT_MASS", x, y, p.terraceHeight + h / 2, 5.6, 6, h, plaster);
    box(resort, "RESORT_CORNICE", x, y + 3.12, p.terraceHeight + h * .62, 5.8, .25, .18, paleStone);
    box(resort, "RESORT_TERRACOTTA_EAVE", x, y + 3.3, p.terraceHeight + h - .4, 6.2, .8, .18, woodLight);
    box(resort, "RESORT_PARAPET", x, y, p.terraceHeight + h, 6, 6.4, .35, paleStone);
    for (let j = -1; j <= 1; j++) {
      const shape = new THREE.Shape(); shape.moveTo(-.6, 0); shape.lineTo(.6, 0); shape.lineTo(.6, 1.6); shape.absarc(0, 1.6, .6, 0, Math.PI, false); shape.lineTo(-.6, 0);
      const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(Math.PI / 2);
      const arch = new THREE.Mesh(geometry, recess); arch.position.set(x + j * 2.1, y + 3.01, p.terraceHeight + 1.3); resort.add(arch);
      const upperArch = new THREE.Mesh(geometry.clone(), recess); upperArch.name = "RESORT_UPPER_ARCH";
      upperArch.position.set(x + j * 1.7, y + 3.015, p.terraceHeight + h - 3.1); resort.add(upperArch);
    }
  }
  const domeGeometry = new THREE.SphereGeometry(2.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); domeGeometry.rotateX(Math.PI / 2);
  const dome = new THREE.Mesh(domeGeometry, paleStone); dome.name = "RESORT_DOME"; dome.position.set(l.pavilionX, l.pavilionTerraceBack - 9, p.terraceHeight + 9); resort.add(dome);
  // Merge foliage geometry by material after construction to keep draw calls low.
  const foliage: THREE.BufferGeometry[][] = [[], [], []];
  const datePalmLeaf = material("#65754d"); datePalmLeaf.side = THREE.DoubleSide;
  function palm(x: number, y: number, z: number, height: number, feathered = true) {
    cylinder(landscape, "PALM_TRUNK", x, y, z + height / 2, .28, .4, height, bark, 12);
    const frondCount = feathered ? 36 : 11;
    for (let f = 0; f < frondCount; f++) {
      const a = f * Math.PI * 2 / frondCount, length = 3.4 + (f % 3) * .4;
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
  for (let i = 0; i < 3; i++) palm(l.terraceLeft + 2, l.pavilionTerraceBack + 2 + i * (l.terraceFront - l.pavilionTerraceBack - 4) / 2, p.terraceHeight, 6.8 + i * .4);
  for (const [i, bed] of architecture.approachBeds.entries()) {
    box(landscape, "APPROACH_PLANTING_SOIL", bed.x, bed.y, p.terraceHeight + .025, bed.width, bed.depth, .06, bark);
    for (let j = 0; j < 4; j++) cylinder(details, "APPROACH_LOW_PLANTS", bed.x + (j % 2 ? .2 : -.2), bed.y + (j / 3 - .5) * bed.depth * .8,
      p.terraceHeight + .25, .12, .25, .45, leafLight, 6);
    if (i % 2 === 0) palm(bed.x, bed.y, p.terraceHeight, 5.4 + (i % 3) * .6);
  }
  const approachWallX = Math.max(...architecture.pathRight.map(point => point.x)) + 2;
  box(arrival, "APPROACH_RESORT_WALL", approachWallX, (l.entranceY + l.terraceBack) / 2, 2.5, .4, p.approachLength, 5, plaster);
  function shadeTree(x: number, y: number, z: number) {
    cylinder(landscape, "SHADE_TREE_TRUNK", x, y, z + 2.2, .18, .34, 4.4, bark, 7);
    for (let j = 0; j < 5; j++) {
      const angle = j * Math.PI * 2 / 5;
      beam(details, "SHADE_TREE_BRANCH", new THREE.Vector3(x, y, z + 2.7),
        new THREE.Vector3(x + Math.cos(angle) * 1.8, y + Math.sin(angle) * 1.5, z + 4.7), .09, bark);
    }
    for (let j = 0; j < 20; j++) {
      const angle = j * 2.4, spread = j < 14 ? 2.2 : .9;
      const geometry = new THREE.IcosahedronGeometry(1.05 + (j % 3) * .14, 2);
      geometry.scale(1.2, 1, .85); geometry.translate(x + Math.cos(angle) * spread, y + Math.sin(angle) * spread,
        z + 5 + (j % 4) * .3); foliage[j % 2].push(geometry);
    }
  }
  polygonSurface(landscape, "CURVED_CANAL_PLANTING_SOIL", architecture.canalPlanting, p.terraceHeight + .055, bark);
  for (let i = 1; i < architecture.canalPlantingSpine.length; i++) {
    const a = architecture.canalPlantingSpine[i - 1], b = architecture.canalPlantingSpine[i];
    const hedge = box(details, "CURVED_CANAL_HEDGE", (a.x + b.x) / 2, (a.y + b.y) / 2,
      p.terraceHeight + .4, Math.hypot(b.x - a.x, b.y - a.y) + .06, .75, .7, leaf);
    hedge.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
  }
  for (const tree of architecture.canalTrees) {
    if (tree.kind === "palm") palm(tree.x, tree.y, p.terraceHeight, 6.4);
    else shadeTree(tree.x, tree.y, p.terraceHeight);
  }
  for (const bed of architecture.beds) {
    box(landscape, "RAISED_PLANTING_BED", bed.x, bed.y, p.terraceHeight + .22, bed.width, bed.depth, .44, retainingStone);
    box(landscape, "PLANTING_SOIL", bed.x, bed.y, p.terraceHeight + .45, bed.width - .22, bed.depth - .22, .04, bark);
    for (const side of [-1, 1]) {
      box(details, "PLANTER_STONE_COPING", bed.x, bed.y + side * (bed.depth / 2 - .08), p.terraceHeight + .48, bed.width + .08, .22, .08, paleStone);
      box(details, "PLANTER_STONE_COPING", bed.x + side * (bed.width / 2 - .08), bed.y, p.terraceHeight + .48, .22, bed.depth, .08, paleStone);
    }
    if (bed.id === "connection") {
      shadeTree(bed.x, bed.y, p.terraceHeight + .45);
      box(landscape, "PLANTER_GROUNDCOVER", bed.x, bed.y, p.terraceHeight + .49, bed.width - .4, bed.depth - .4, .08, leaf);
    } else box(landscape, "TERRACE_HEDGE", bed.x, bed.y + bed.depth / 2 - .25, p.terraceHeight + .9, bed.width - .3, .5, .9, leaf);
  }
  for (const pot of architecture.pots) {
    cylinder(landscape, "TERRACE_PLANTER", pot.x, pot.y, p.terraceHeight + .3, pot.radius, pot.radius * .65, .6, paleStone, 24);
    for (let j = 0; j < 5; j++) {
      const angle = j * Math.PI * 2 / 5;
      const geometry = new THREE.IcosahedronGeometry(pot.radius * .62, 1);
      geometry.scale(.8, .8, 1.2); geometry.translate(pot.x + Math.cos(angle) * pot.radius * .4, pot.y + Math.sin(angle) * pot.radius * .4,
        p.terraceHeight + .95 + (j % 2) * .2); foliage[j % 2].push(geometry);
    }
  }
  for (let i = 0; i < 2; i++) shadeTree(p.lawnWidth / 2 + 1.5, l.terraceBack + 3 + i * 9, p.terraceHeight);
  // Video 00:48–01:04: water-facing plaza margin, outside the stair opening.
  for (const tree of ceremonyPalms(p)) palm(tree.x, tree.y, tree.z, tree.height);
  for (let i = 0; i < foliage.length; i++) {
    const pieces = foliage[i].map(geometry => { const result = geometry.index ? geometry.toNonIndexed() : geometry.clone(); result.deleteAttribute("uv"); geometry.dispose(); return result; });
    const merged = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    if (merged) { const mesh = new THREE.Mesh(merged, i === 2 ? datePalmLeaf : i ? leafLight : leaf); mesh.name = "LANDSCAPING_FOLIAGE"; mesh.castShadow = true; mesh.receiveShadow = true; landscape.add(mesh); }
  }
  box(landscape, "HEDGE", p.lawnWidth / 2 - .5, (l.terraceFront + l.terraceBack) / 2, p.terraceHeight + .5, 1, l.terraceDepth - 1, 1, leaf);
  const detailBatches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  details.updateMatrixWorld(true);
  for (const object of [...details.children]) {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) continue;
    const geometry = object.geometry.clone().applyMatrix4(object.matrix);
    const batch = detailBatches.get(object.material) ?? []; batch.push(geometry); detailBatches.set(object.material, batch);
    object.geometry.dispose(); details.remove(object);
  }
  for (const [mat, geometries] of detailBatches) {
    const geometry = mergeGeometries(geometries); geometries.forEach(piece => piece.dispose());
    if (geometry) { const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = true; mesh.receiveShadow = true; details.add(mesh); }
  }
  // Temporary wedding furniture remains separate from the permanent venue.
  const weddingLayout = new THREE.Group(); weddingLayout.name = "WEDDING_LAYOUT"; weddingLayout.scale.fromArray(planToSceneScale);
  const stage = buildStage(p, led); weddingLayout.add(stage.root);
  const cocktailFixtures = group("COCKTAIL_FIXTURES", weddingLayout); cocktailFixtures.visible = false;
  for (const fixture of architecture.fixtures) {
    box(cocktailFixtures, fixture.id, fixture.x, fixture.y, p.terraceHeight + fixture.height / 2, fixture.width, fixture.depth, fixture.height, plaster);
    box(cocktailFixtures, "FIXTURE_TOP", fixture.x, fixture.y, p.terraceHeight + fixture.height, fixture.width + .08, fixture.depth + .08, .06, timber);
  }
  return { root, weddingLayout, waterTexture,
    dispose() {
      stage.dispose();
      cocktailFixtures.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    },
  };
}

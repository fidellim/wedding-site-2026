import { polygonPoints, venueArchitecture } from "./venueArchitecture";
import type { ReactNode } from "react";
import type { SeatingSnapshot } from "../domain/types";
import { buildFurniture } from "./buildFurniture";
import { buildCeremony } from "./buildCeremony";
import { ceremonyChairCount, ceremonyLayout } from "./ceremonyLayout";
import type { VenueLayout } from "./layout";
import { toScenePosition } from "./venueCoordinates";
import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildVenue } from "./buildVenue";
import { ceremonyPalms, ceremonyStructure, cameraView, LED_WIDTH, ledLayout, stageLayout, venueLandmarks, venueLayout, type LedLayout, type VenueParameters, type ViewPreset, normalizeParameters } from "./venueModel";

interface Props {
  parameters: VenueParameters;
  preset: ViewPreset;
  resetKey: number;
  labels: boolean;
  dusk: boolean;
  led: LedLayout;
  cocktailFixtures?: boolean;
  onUnavailable: () => void;
  snapshot?: SeatingSnapshot;
  layout?: VenueLayout;
}
export function VenueCanvas({ parameters, preset, resetKey, labels, dusk, led, onUnavailable, snapshot, layout, cocktailFixtures = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setView: (preset: ViewPreset, instant?: boolean) => void; stop: () => void; setDusk: (dusk: boolean) => void; setParameters: (parameters: VenueParameters, led: LedLayout) => void; setCocktailFixtures: (visible: boolean) => void; setFurniture: (snapshot?: SeatingSnapshot, layout?: VenueLayout) => void } | null>(null);
  const labelElements = useRef(new Map<string, HTMLSpanElement>());
  const initialPreset = useRef(preset); initialPreset.current = preset;
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" }); }
    catch { onUnavailable(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute("aria-label", "Interactive 3D venue. Drag to rotate, pinch or scroll to zoom. Use view buttons for keyboard navigation.");
    renderer.domElement.setAttribute("role", "img");
    container.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#e7ebe5"); scene.fog = new THREE.Fog("#e7ebe5", 180, 330);
    const camera = new THREE.PerspectiveCamera(40, 1, .2, 600); camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .09; controls.screenSpacePanning = false;
    // Guests can discover the opposite shore by orbiting all the way around.
    controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = .015; controls.maxPolarAngle = Math.PI * .43;
    controls.minDistance = 14; controls.maxDistance = 260; controls.maxTargetRadius = 38;
    controls.cursor.set(0, 8, 0); controls.zoomSpeed = .8; controls.rotateSpeed = .65;
    const hemisphere = new THREE.HemisphereLight("#fff9e9", "#a1ad8e", 2.3); hemisphere.position.set(0, 0, 80); scene.add(hemisphere);
    const sun = new THREE.DirectionalLight("#fff0d4", 3.3); sun.position.set(-40, -20, 65); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -85; sun.shadow.camera.right = 85; sun.shadow.camera.top = 85; sun.shadow.camera.bottom = -85; sun.shadow.camera.far = 200; sun.shadow.normalBias = .08; sun.shadow.bias = -.0002; scene.add(sun);
    let currentParameters = parameters;
    let currentLed = led;
    let venue = buildVenue(currentParameters, currentLed); scene.add(venue.root, venue.weddingLayout);
    let currentLayout = layout;
    let furniture: ReturnType<typeof buildFurniture> | null = null;
    let ceremony: ReturnType<typeof buildCeremony> | null = null;
    let landmarks = venueLandmarks(currentParameters, currentLed);
    function arrange(nextSnapshot?: SeatingSnapshot, nextLayout?: VenueLayout) {
      if (furniture) { scene.remove(furniture.root); furniture.dispose(); furniture = null; }
      if (ceremony) { ceremony.root.removeFromParent(); ceremony.dispose(); }
      ceremony = buildCeremony(currentParameters, nextSnapshot ? ceremonyChairCount(nextSnapshot) : 0);
      venue.weddingLayout.add(ceremony.root);
      currentLayout = nextLayout;
      landmarks = venueLandmarks(currentParameters, currentLed).map(l => {
        const point = l.id === "stage" ? nextLayout?.landmarks.stage : l.id === "entrance" ? nextLayout?.landmarks.entrance : undefined;
        return point ? { ...l, position: [point.x, point.y, l.position[2]] } : l;
      });
      if (nextSnapshot && nextLayout) {
        furniture = buildFurniture(nextSnapshot, nextLayout); scene.add(furniture.root);
        const stage = venue.weddingLayout.getObjectByName("HF_STAGE");
        if (stage) {
          stage.position.x = nextLayout.landmarks.stage.x; stage.position.y = nextLayout.landmarks.stage.y;
          const floor = stage.getObjectByName("DANCE_FLOOR");
          if (floor) { floor.position.x = stage.position.x - nextLayout.landmarks.danceFloor.x; floor.position.y = stage.position.y - nextLayout.landmarks.danceFloor.y; }
        }
      }
    }
    arrange(snapshot, layout);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;
    let transition: { start: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3 } | null = null;
    let frame = 0, last = 0, visible = true, disposed = false;
    function stop() { transition = null; setMoving(false); }
    function setView(view: ViewPreset, instant = false) {
      const v = cameraView(currentParameters, view, camera.aspect, currentLed);
      const to = new THREE.Vector3(...v.position), toTarget = new THREE.Vector3(...v.target);
      if (currentLayout && (view === "stage" || view === "floral")) {
        const delta = new THREE.Vector3(currentLayout.landmarks.stage.x - stageLayout(currentParameters).centerX, -(currentLayout.landmarks.stage.y - stageLayout(currentParameters).centerY), 0);
        to.add(delta); toTarget.add(delta);
      }
      controls.enableRotate = view !== "overhead";
      controls.minDistance = view === "floral" ? 1 : view === "stage" ? 6 : 14;
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      controls.maxDistance = Math.max(260, to.distanceTo(toTarget) * 1.3);
      if (instant || reduced) { stop(); camera.position.copy(to); controls.target.copy(toTarget); controls.update(); }
      else { transition = { start: performance.now(), from: camera.position.clone(), to, fromTarget: controls.target.clone(), toTarget }; setMoving(true); }
    }
    api.current = { setView, stop, setCocktailFixtures(visible) { const fixtures = venue.weddingLayout.getObjectByName("COCKTAIL_FIXTURES"); if (fixtures) fixtures.visible = visible; }, setDusk(value) {
      scene.background = new THREE.Color(value ? "#30384e" : "#e7ebe5");
      if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(scene.background);
      hemisphere.intensity = value ? .65 : 2.3;
      hemisphere.color.set(value ? "#a5b4db" : "#fff9e9");
      sun.intensity = value ? .45 : 3.3;
      renderer.toneMappingExposure = value ? 1.05 : 1.25;
    }, setParameters(next, nextLed) {
      if (currentParameters === next && currentLed === nextLed) return;
      scene.remove(venue.root, venue.weddingLayout); venue.dispose();
      currentParameters = next; currentLed = nextLed; venue = buildVenue(next, nextLed); landmarks = venueLandmarks(next, nextLed);
      scene.add(venue.root, venue.weddingLayout); setView(initialPreset.current, true);
    }, setFurniture: arrange };
    function onMotion() { reduced = motion.matches; if (reduced && transition) { camera.position.copy(transition.to); controls.target.copy(transition.toTarget); stop(); } }
    motion.addEventListener("change", onMotion);
    controls.addEventListener("start", stop);
    const size = () => {
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
    };
    const resize = new ResizeObserver(size); resize.observe(container); size(); setView(initialPreset.current, true);
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; }); observer.observe(container);
    const onLost = (event: Event) => { event.preventDefault(); onUnavailable(); }; renderer.domElement.addEventListener("webglcontextlost", onLost);
    function draw(now: number) {
      if (disposed) return;
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || now - last < 1000 / 30) return;
      last = now;
      if (transition) {
        const t = Math.min(1, (now - transition.start) / 1050), ease = t * t * (3 - 2 * t);
        camera.position.lerpVectors(transition.from, transition.to, ease); controls.target.lerpVectors(transition.fromTarget, transition.toTarget, ease);
        if (t === 1) stop();
      }
      controls.update();
      // Pan remains on the venue's horizontal plane, never below lawn grade.
      controls.target.z = Math.max(0, controls.target.z);
      if (!reduced) venue.waterTexture.offset.x = now * .000003;
      renderer.render(scene, camera);
      for (const landmark of landmarks) {
        const element = labelElements.current.get(landmark.id); if (!element) continue;
        const projected = new THREE.Vector3(...toScenePosition(landmark.position)).project(camera);
        element.style.visibility = projected.z > 1 || projected.z < -1 || Math.abs(projected.x) > .94 || Math.abs(projected.y) > .9 ? "hidden" : "visible";
        element.style.left = `${(projected.x * .5 + .5) * container.clientWidth}px`;
        element.style.top = `${(-projected.y * .5 + .5) * container.clientHeight}px`;
      }
    }
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true; cancelAnimationFrame(frame); api.current = null;
      resize.disconnect(); observer.disconnect(); motion.removeEventListener("change", onMotion);
      controls.removeEventListener("start", stop); controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      furniture?.dispose(); ceremony?.dispose(); venue.dispose(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [onUnavailable]);

  useEffect(() => { api.current?.setDusk(dusk); }, [dusk, onUnavailable]);

  useEffect(() => { api.current?.setParameters(parameters, led); }, [parameters, led]);

  useEffect(() => { api.current?.setFurniture(snapshot, layout); }, [snapshot, layout, parameters, led]);

  useEffect(() => { api.current?.setCocktailFixtures(cocktailFixtures); }, [cocktailFixtures, parameters, led, onUnavailable]);

  useEffect(() => { api.current?.setView(preset); }, [preset, resetKey]);
  return <div className="venue-canvas" ref={host}>
    <div className={`venue-labels${labels ? "" : " is-hidden"}`} aria-hidden="true">
      {venueLandmarks(parameters, led).map(item => <span key={item.id} ref={element => { if (element) labelElements.current.set(item.id, element); else labelElements.current.delete(item.id); }} className={`venue-map-label venue-map-label-${item.id}`}><i />{item.label}</span>)}
    </div>
    {moving && <button className="venue-skip" onClick={() => api.current?.setView(preset, true)}>Skip movement</button>}
  </div>;
}

/** Always available, including on devices without WebGL. Uses the same parametric layout. */
export function VenuePlan({ parameters: input, led = "none", landmarks, children, receptionOnly = false, interactive = false, ceremonyChairs = 0, cocktailFixtures = false }: { parameters: VenueParameters; led?: LedLayout; landmarks?: VenueLayout["landmarks"]; children?: ReactNode; receptionOnly?: boolean; interactive?: boolean; ceremonyChairs?: number; cocktailFixtures?: boolean }) {
  const titleId = useId(), descriptionId = useId();
  const p = normalizeParameters(input);
  const l = venueLayout(p), left = l.terraceLeft - 6, top = l.entranceY - 5;
  const originalStage = stageLayout(p), design = ledLayout(p, led), structure = ceremonyStructure(p);
  const stagePoint = landmarks?.stage ?? { x: originalStage.centerX, y: originalStage.centerY };
  const dancePoint = landmarks?.danceFloor ?? { x: originalStage.danceX, y: originalStage.danceY };
  const entrance = landmarks?.entrance ?? { x: l.plazaX, y: l.entranceY + 4 };
  const width = p.lawnWidth / 2 + 5 - left, height = l.waterY + 15 - top;
  const ceremony = ceremonyLayout(p, ceremonyChairs), architecture = venueArchitecture(p);
  return <svg className="venue-plan" viewBox={receptionOnly ? `${-p.lawnWidth / 2 - 2} ${-p.lawnLength / 2 - 2} ${p.lawnWidth + 4} ${p.lawnLength + 4}` : `${left} ${top} ${width} ${height}`} role={interactive ? "group" : "img"} aria-labelledby={titleId} aria-describedby={descriptionId}>
    <title id={titleId}>Venue overhead plan</title>
    <desc id={descriptionId}>The ceremony approach leads to the ceremony area on the right. The pavilion and cocktail area sit to its left. The reception lawn lies below both, followed by the sand strip and waterfront. The HF stage sits just before the sand, facing the dance floor and ceremony inland. Positions and dimensions are approximate.</desc>
    <rect x={left} y={top} width={width} height={height} fill="#f2eee4" />
    <rect x={left} y={l.waterY} width={width} height="15" fill="#a4c5c5" />
    <rect x={-p.lawnWidth / 2} y={p.lawnLength / 2} width={p.lawnWidth} height={p.waterSetback} fill="#e5d5b7" />
    <rect x={-p.lawnWidth / 2} y={l.lawnBack} width={p.lawnWidth} height={p.lawnLength} fill="#b6c69a" />
    <polygon data-venue-terrace="" points={polygonPoints(architecture.terrace)} fill="#dfceb5" />
    <rect x={l.plazaX - l.plazaWidth / 2} y={l.terraceFront - p.plazaLength} width={l.plazaWidth} height={p.plazaLength} fill="#d9c3b5" />
    {[.37, .41, .46].map(r => <circle key={r} cx={l.plazaX} cy={l.plazaY} r={l.plazaWidth * r} fill="none" stroke="#b69e8a" strokeWidth=".35" />)}
    {Array.from({ length: 12 }, (_, i) => {
      const angle = i * Math.PI / 6, r = l.plazaWidth;
      return <polygon key={`inlay-${i}`} points={polygonPoints([
        { x: l.plazaX + r * .16 * Math.cos(angle - Math.PI / 15), y: l.plazaY + r * .16 * Math.sin(angle - Math.PI / 15) },
        { x: l.plazaX + r * .37 * Math.cos(angle), y: l.plazaY + r * .37 * Math.sin(angle) },
        { x: l.plazaX + r * .16 * Math.cos(angle + Math.PI / 15), y: l.plazaY + r * .16 * Math.sin(angle + Math.PI / 15) },
      ])} fill={i % 2 ? "#a18e80" : "#949389"} />;
    })}
    <g aria-label="Ceremony fountain">
      <title>Ceremony fountain · approximate dimensions</title>
      {Array.from({ length: structure.tiers }, (_, i) => <circle key={i} cx={structure.x} cy={structure.y} r={structure.radius * (1 - i * .105) - .03} fill="#79afb3" stroke="#303330" strokeWidth=".06" />)}
    </g>
    <polygon points={polygonPoints(architecture.apron)} fill="#dfceb5" />
    <polygon data-venue-approach="" points={polygonPoints(architecture.approach)} fill="#d9c3b5" />
    <polygon data-canal-bank="" points={polygonPoints(architecture.canalBank)} fill="#e3d1b6" />
    <rect x={architecture.canalX - 4.6} y={l.entranceY} width="2.9" height={p.approachLength - 7} fill="#d9c3b5" />
    <polygon data-venue-canal="" points={polygonPoints(architecture.canal)} fill="#79afb3" stroke="#e3d1b6" strokeWidth=".3" />
    {architecture.approachBeds.map((bed, i) => <rect key={i} x={bed.x - bed.width / 2} y={bed.y - bed.depth / 2} width={bed.width} height={bed.depth} fill="#718354" />)}
    <polyline points={polygonPoints(architecture.pathRight)} fill="none" stroke="#c8b699" strokeWidth=".1" />
    <g transform={`translate(${architecture.canalX},${architecture.bridgeY})`}>
      <g aria-label="Stationary abra boat beside the bridge" transform="translate(0,-4.5)">
        <title>Empty abra boat with a burgundy canopy</title>
        <ellipse rx=".82" ry="2.2" fill="#34291f" stroke="#79503b" strokeWidth=".1" />
        <rect x="-.87" y="-1.28" width="1.74" height="2.56" rx=".12" fill="#762d39" stroke="#e7cfa2" strokeWidth=".07" />
      </g>
      <g aria-label="Timber bridge with turning approach stairs">
        <title>Long stair flight beside the canal turns onto a raised bridge landing</title>
        <rect x={-architecture.bridge.deckSpan / 2} y={-architecture.bridge.width / 2}
          width={architecture.bridge.deckSpan} height={architecture.bridge.width} fill="#543529" />
        {Array.from({ length: architecture.bridge.steps }, (_, i) => <rect key={i}
          x={architecture.bridge.flightX - architecture.bridge.x - architecture.bridge.width / 2}
          y={architecture.bridge.width / 2 + i * architecture.bridge.tread} width={architecture.bridge.width}
          height={architecture.bridge.tread} fill="#79503b" stroke="#543529" strokeWidth=".055" />)}
        {[-1, 1].map(side => <path key={side}
          d={`M ${architecture.bridge.flightX - architecture.bridge.x + side * architecture.bridge.width / 2} ${architecture.bridge.width / 2} v ${architecture.bridge.flightRun}`}
          stroke="#543529" strokeWidth=".12" />)}
      </g>
    </g>
    {!receptionOnly && <g aria-label={`Ceremony with ${ceremonyChairs} unassigned chairs`}>
      <title>Straight white aisle, circular platform and white floral arch · {ceremonyChairs} chairs without assignments</title>
      <rect x={ceremony.platformX - ceremony.aisleWidth / 2} y={ceremony.aisleStart} width={ceremony.aisleWidth} height={ceremony.aisleEnd - ceremony.aisleStart} fill="#fffdf6" stroke="#d4cebd" strokeWidth=".06" />
      <circle cx={ceremony.platformX} cy={ceremony.platformY} r={ceremony.platformRadius} fill="#fffdf6" stroke="#d4cebd" strokeWidth=".08" />
      <path d={`M ${ceremony.platformX - ceremony.archRadius} ${ceremony.archY} H ${ceremony.platformX + ceremony.archRadius}`} stroke="#f8f5e5" strokeWidth=".5" />
      {ceremony.flowers.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r=".28" fill="#fffef1" stroke="#809261" strokeWidth=".07" />)}
      {ceremony.chairs.map((chair, index) => <g key={index} data-ceremony-chair="" transform={`translate(${chair.x},${chair.y}) rotate(${chair.rotation * 180 / Math.PI})`} fill="#fffdf9" stroke="#c5beac" strokeWidth=".055">
        <rect x="-.25" y="-.25" width=".5" height=".5" rx=".05" />
        <path d="M -.23 -.2 H .23" strokeWidth=".08" />
      </g>)}
    </g>}
    <g aria-label="Terrace walls and landscaping">
      <polyline data-canal-terrace-edge="" points={polygonPoints(architecture.canalTerraceEdge)} fill="none" stroke="#c8b699" strokeWidth=".24" />
      <polygon data-canal-planting="" points={polygonPoints(architecture.canalPlanting)} fill="#59774b" stroke="#c8b699" strokeWidth=".1" />
      {architecture.canalCurvePosts.map((point, i) => <circle key={`canal-post-${i}`} cx={point.x} cy={point.y} r=".09" fill="#543529" />)}
      {architecture.canalTrees.map((tree, i) => <circle key={`canal-tree-${i}`} cx={tree.x} cy={tree.y} r={tree.kind === "palm" ? 1.5 : 2.5} fill="#718354" fillOpacity=".7" />)}
      {architecture.retainingEdges.map((points, i) => <polyline key={i} points={polygonPoints(points)} fill="none" stroke="#a9967c" strokeWidth=".38" />)}
      {architecture.beds.map(bed => <g key={bed.id} data-planting-bed={bed.id}>
        <rect x={bed.x - bed.width / 2} y={bed.y - bed.depth / 2} width={bed.width} height={bed.depth} fill="#718354" stroke="#c8b699" strokeWidth=".2" />
        {bed.id === "connection" && <circle cx={bed.x} cy={bed.y} r="2.5" fill="#718354" fillOpacity=".6" />}
      </g>)}
      {ceremonyPalms(p).map((tree, i) => <circle key={`palm-${i}`} cx={tree.x} cy={tree.y} r="1.5" fill="#718475" fillOpacity=".7" />)}
      {[0, 1].map(i => <circle key={`shade-${i}`} cx={p.lawnWidth / 2 + 1.5} cy={l.terraceBack + 3 + i * 9} r="2.5" fill="#718354" fillOpacity=".6" />)}
      <rect x={p.lawnWidth / 2 - 1} y={l.terraceBack + .5} width="1" height={l.terraceDepth - 1} fill="#59774b" />
      {architecture.pots.map((pot, i) => <circle key={i} cx={pot.x} cy={pot.y} r={pot.radius} fill="#718354" stroke="#c8b699" strokeWidth=".15" />)}
    </g>
    {cocktailFixtures && <g aria-label="Planned cocktail fixtures · schematic positions">
      {architecture.fixtures.map(fixture => <g key={fixture.id} data-cocktail-fixture={fixture.id}>
        <rect x={fixture.x - fixture.width / 2} y={fixture.y - fixture.depth / 2} width={fixture.width} height={fixture.depth} fill="#f6ead4" stroke="#795842" strokeWidth=".08" />
        <text x={fixture.x} y={fixture.y + fixture.depth / 2 + .8} textAnchor="middle" fontFamily="sans-serif" fontSize=".65" fill="#334e3d">{fixture.label}</text>
      </g>)}
    </g>}
    <circle cx={l.pavilionX} cy={l.pavilionY} r={p.pavilionDiameter * .585} fill="#795842" />
    {Array.from({ length: p.stairCount }, (_, i) => <rect key={i} x={l.stairX - p.stairWidth / 2} y={l.lawnBack - (i + 1) * p.stairTread} width={p.stairWidth} height={p.stairTread} fill="#e9ddc9" stroke="#c1b29a" strokeWidth=".08" />)}
    <g transform={`translate(${stagePoint.x},${stagePoint.y}) rotate(180)`} fill="#f4ead7" stroke="#b89c67" strokeWidth=".08">
      <rect x={-design.width / 2} y={-p.stageDepth / 2} width={design.width} height={p.stageDepth} />
      <rect x={-originalStage.stepWidth / 2} y={p.stageDepth / 2} width={originalStage.stepWidth} height={originalStage.stepDepth} />
      <path d={`M ${-design.width / 2} ${-p.stageDepth / 2 + .18} H ${design.width / 2}`} stroke="#b89650" strokeWidth=".2" />
      {led !== "none" && <g transform={`translate(${design.screenX},${-p.stageDepth / 2 + .18 + design.screenForward}) rotate(${design.screenAngle * 180 / Math.PI})`}>
        <rect x={-(LED_WIDTH + .2) / 2} y={led === "side" ? -1 : -.26} width={LED_WIDTH + .2} height={led === "side" ? 1.2 : .24} fill="#421221"><title>5 × 3 m LED screen and support</title></rect>
      </g>}
    </g>
    <rect x={dancePoint.x - p.danceFloorSize / 2} y={dancePoint.y - p.danceFloorSize / 2} width={p.danceFloorSize} height={p.danceFloorSize} fill="#f4ead7" stroke="#b89c67" strokeWidth=".08" />
    <g fill="#675437" textAnchor="middle" fontFamily="sans-serif" fontSize=".85">
      <text x={stagePoint.x} y={stagePoint.y}>HF stage</text>
      <text x={dancePoint.x} y={dancePoint.y}>Dance floor</text>
    </g>
    <g fill="#334e3d" textAnchor="middle" fontFamily="sans-serif" fontSize="1.6">
      <text x={p.lawnWidth * .23} y={-p.lawnLength / 2 + 1.5}>Reception lawn</text><text x="0" y={l.waterY + 7}>Waterfront</text>
      <text x={l.plazaX} y={l.plazaY}>Ceremony</text>
      <text x="0" y={p.lawnLength / 2 + p.waterSetback / 2}>Beach / sand</text>
      <text x={l.pavilionX} y={l.pavilionY + p.pavilionDiameter * .75}>Pavilion</text>
      <text x={entrance.x + 3} y={entrance.y - 1} textAnchor="end">Ceremony approach</text>
      <text x={-p.lawnWidth * .22} y={l.terraceBack + 4}>Cocktail terrace</text>
    </g>
    {children}
  </svg>;
}

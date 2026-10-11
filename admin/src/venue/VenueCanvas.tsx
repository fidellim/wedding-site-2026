import { placeLandmarkLabels, type LabelObstacle } from "./landmarkLabels";
import { flightViews, seatDestination } from "../guest/flight";
import { useVenueInspection, sameTarget, type FurnitureTarget } from "./VenueInspection";
import type { SeatingSnapshot } from "../domain/types";
import { buildFurniture } from "./buildFurniture";
import { buildCeremony } from "./buildCeremony";
import { ceremonyChairCount, ceremonyLayout } from "./ceremonyLayout";
import type { VenueLayout } from "./layout";
import { toScenePosition } from "./venueCoordinates";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildVenue } from "./buildVenue";
import { cameraView, stageLayout, venueLandmarks, type LedLayout, type VenueParameters, type ViewPreset } from "./venueModel";

interface Props {
  parameters: VenueParameters;
  preset: ViewPreset;
  resetKey: number;
  labels: boolean;
  dusk: boolean;
  led: LedLayout;
  cocktailFixtures?: boolean;
  ceremonyChairs?: number;
  labelExclusions?: readonly LabelObstacle[];
  cameraLift?: number;
  highlightTarget?: FurnitureTarget | null;
  focusRequest?: { target: FurnitureTarget; tour: boolean; key: number } | null;
  onTourLabel?: (label: string) => void;
  onUnavailable: () => void;
  snapshot?: SeatingSnapshot;
  layout?: VenueLayout;
}
export function VenueCanvas({ parameters, preset, resetKey, labels, dusk, led, onUnavailable, snapshot, layout, cocktailFixtures = false, ceremonyChairs, labelExclusions = [], cameraLift = 0, highlightTarget, focusRequest, onTourLabel }: Props) {
  const exclusionRef = useRef(labelExclusions); exclusionRef.current = labelExclusions;
  const liftRef = useRef(cameraLift); liftRef.current = cameraLift;
  const ceremonyCountRef = useRef(ceremonyChairs); ceremonyCountRef.current = ceremonyChairs;
  const guestTarget = useRef(highlightTarget); guestTarget.current = highlightTarget;
  const tourLabel = useRef(onTourLabel); tourLabel.current = onTourLabel;
  const inspection = useVenueInspection();
  const inspectionRef = useRef(inspection); inspectionRef.current = inspection;
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setView: (preset: ViewPreset, instant?: boolean) => void; focus: (target: FurnitureTarget, tour: boolean) => void; skip: () => void; stop: () => void; setDusk: (dusk: boolean) => void; setParameters: (parameters: VenueParameters, led: LedLayout) => void; setCocktailFixtures: (visible: boolean) => void; setFurniture: (snapshot?: SeatingSnapshot, layout?: VenueLayout) => void } | null>(null);
  const leaderElements = useRef(new Map<string, SVGGElement>());
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
    renderer.domElement.setAttribute("aria-label", highlightTarget !== undefined ? "Interactive 3D venue. Drag to rotate, pinch or scroll to zoom. Choose your name in the seating panel to highlight your place." : "Interactive 3D venue. Drag to rotate, pinch or scroll to zoom. Click a seat or table for seating details. Use view buttons and the Inspect table menu for keyboard navigation.");
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
    let currentSnapshot = snapshot;
    let furniture: ReturnType<typeof buildFurniture> | null = null;
    let ceremony: ReturnType<typeof buildCeremony> | null = null;
    let landmarks = venueLandmarks(currentParameters, currentLed);
    function arrange(nextSnapshot?: SeatingSnapshot, nextLayout?: VenueLayout) {
      if (furniture) { scene.remove(furniture.root); furniture.dispose(); furniture = null; }
      if (ceremony) { ceremony.root.removeFromParent(); ceremony.dispose(); }
      ceremony = buildCeremony(currentParameters, ceremonyCountRef.current ?? (nextSnapshot ? ceremonyChairCount(nextSnapshot) : 0));
      venue.weddingLayout.add(ceremony.root);
      currentLayout = nextLayout; currentSnapshot = nextSnapshot;
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
    const raycaster = new THREE.Raycaster();
    const outline = new THREE.BoxHelper(new THREE.Object3D(), highlightTarget !== undefined ? "#ad6433" : "#edb84b");
    if (highlightTarget !== undefined && !Array.isArray(outline.material)) outline.material.depthTest = false; outline.visible = false; scene.add(outline);
    let outlined: THREE.Object3D | null = null;
    function hit(event: PointerEvent): FurnitureTarget | null {
      if (!furniture) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const object = raycaster.intersectObjects(furniture.root.children, true)[0]?.object;
      return object?.userData.furnitureTarget ?? object?.parent?.userData.furnitureTarget ?? null;
    }
    const pointers = new Set<number>();
    let press: { x: number; y: number; id: number; dragged: boolean } | null = null;
    function pointerDown(event: PointerEvent) {
      pointers.add(event.pointerId);
      if (pointers.size > 1) { if (press) press.dragged = true; return; }
      press = { x: event.clientX, y: event.clientY, id: event.pointerId, dragged: event.button !== 0 };
      inspectionRef.current?.peek(null);
    }
    function pointerMove(event: PointerEvent) {
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press.dragged = true;
      if (pointers.size || event.pointerType === "touch") return;
      const target = hit(event);
      renderer.domElement.style.cursor = target ? "pointer" : "grab";
      inspectionRef.current?.peek(target ? { target, x: event.clientX, y: event.clientY } : null);
    }
    function pointerUp(event: PointerEvent) {
      pointers.delete(event.pointerId);
      if (press?.id === event.pointerId) {
        if (!press.dragged && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 6) inspectionRef.current?.select(hit(event));
        press = null;
      }
    }
    function pointerCancel(event: PointerEvent) { pointers.delete(event.pointerId); press = null; inspectionRef.current?.peek(null); }
    function pointerLeave() { inspectionRef.current?.peek(null); }
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerCancel);
    renderer.domElement.addEventListener("pointerleave", pointerLeave);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;
    let transition: { start: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3 } | null = null;
    let frame = 0, last = 0, visible = true, disposed = false;
    let journey: { start: number; positions: THREE.CatmullRomCurve3; targets: THREE.CatmullRomCurve3 } | null = null;
    function stop() { transition = null; journey = null; controls.enabled = true; setMoving(false); tourLabel.current?.(""); }
    function skip() {
      if (journey) { camera.position.copy(journey.positions.getPoint(1)); controls.target.copy(journey.targets.getPoint(1)); }
      else if (transition) { camera.position.copy(transition.to); controls.target.copy(transition.toTarget); }
      stop(); controls.update();
    }
    function focus(target: FurnitureTarget, tour: boolean) {
      if (!currentSnapshot || !currentLayout) return;
      const end = seatDestination(currentSnapshot, currentLayout, target, camera.aspect);
      if (!end) return;
      stop(); controls.enableRotate = true; controls.minDistance = 3; controls.maxTargetRadius = Infinity;
      if (!tour || reduced) { camera.position.fromArray(end.position); controls.target.fromArray(end.target); controls.update(); return; }
      const views = flightViews(currentSnapshot, currentLayout, target, camera.aspect);
      if (!views) return;
      journey = { start: performance.now(), positions: new THREE.CatmullRomCurve3(views.map(v => new THREE.Vector3(...v.position))), targets: new THREE.CatmullRomCurve3(views.map(v => new THREE.Vector3(...v.target))) };
      camera.position.copy(journey.positions.getPoint(0)); controls.target.copy(journey.targets.getPoint(0));
      controls.enabled = false; setMoving(true); tourLabel.current?.("Ceremony approach");
    }
    function setView(view: ViewPreset, instant = false) {
      stop();
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
    api.current = { setView, stop, focus, skip, setCocktailFixtures(visible) { const fixtures = venue.weddingLayout.getObjectByName("COCKTAIL_FIXTURES"); if (fixtures) fixtures.visible = visible; }, setDusk(value) {
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
    function onMotion() { reduced = motion.matches; if (reduced && (transition || journey)) skip(); }
    motion.addEventListener("change", onMotion);
    controls.addEventListener("start", stop);
    const labelSizes = new Map<string, { width: number; height: number }>();
    void document.fonts?.ready.then(() => labelSizes.clear());
    const size = () => {
      labelSizes.clear();
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.setViewOffset(width, height, 0, liftRef.current, width, height); camera.updateProjectionMatrix(); renderer.setSize(width, height);
    };
    const resize = new ResizeObserver(size); resize.observe(container); size(); setView(initialPreset.current, true);
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; }); observer.observe(container);
    const onLost = (event: Event) => { event.preventDefault(); onUnavailable(); }; renderer.domElement.addEventListener("webglcontextlost", onLost);
    let previousLift = liftRef.current;
    function draw(now: number) {
      if (disposed) return;
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || now - last < 1000 / 30) return;
      last = now;
      if (previousLift !== liftRef.current) { previousLift = liftRef.current; size(); }
      if (journey) {
        const t = Math.min(1, (now - journey.start) / 10000);
        camera.position.copy(journey.positions.getPoint(t)); controls.target.copy(journey.targets.getPoint(t));
        tourLabel.current?.(t < .30 ? "Ceremony approach" : t < .63 ? "Ceremony area" : t < .90 ? "Reception" : "Your place");
        if (t === 1) stop();
      }
      if (transition) {
        const t = Math.min(1, (now - transition.start) / 1050), ease = t * t * (3 - 2 * t);
        camera.position.lerpVectors(transition.from, transition.to, ease); controls.target.lerpVectors(transition.fromTarget, transition.toTarget, ease);
        if (t === 1) stop();
      }
      controls.update();
      // Pan remains on the venue's horizontal plane, never below lawn grade.
      controls.target.z = Math.max(0, controls.target.z);
      if (!reduced) venue.waterTexture.offset.x = now * .000003;
      let nextOutlined: THREE.Object3D | null = null;
      const active = guestTarget.current ?? inspectionRef.current?.active;
      if (active && furniture) furniture.root.traverse(object => {
        const target: FurnitureTarget | undefined = object.userData.furnitureTarget;
        if (target && sameTarget(active, target)) nextOutlined = object;
      });
      if (nextOutlined !== outlined) { outlined = nextOutlined; outline.visible = !!outlined; if (outlined) outline.setFromObject(outlined); }
      if (outlined) outline.update();
      // Keep names on the table tops readable from either side of the venue.
      const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const textAngle = Math.atan2(cameraRight.y, cameraRight.x);
      furniture?.root.children.forEach(table => {
        const marker = table.getObjectByName("TABLE_NAME");
        if (marker) marker.rotation.z = -textAngle - table.rotation.z;
      });
      renderer.render(scene, camera);
      const anchors: { id: string; x: number; y: number; width: number; height: number }[] = [];
      const width = container.clientWidth, height = container.clientHeight;
      for (const landmark of landmarks) {
        const element = labelElements.current.get(landmark.id); if (!element) continue;
        const projected = new THREE.Vector3(...toScenePosition(landmark.position)).project(camera);
        const x = (projected.x * .5 + .5) * width, y = (-projected.y * .5 + .5) * height;
        const clipped = projected.z > 1 || projected.z < -1 || Math.abs(projected.x) > .94 || Math.abs(projected.y) > .9;
        element.style.visibility = "hidden";
        const leader = leaderElements.current.get(landmark.id); if (leader) leader.style.visibility = "hidden";
        if (clipped) continue;
        let dimensions = labelSizes.get(landmark.id);
        if (!dimensions) {
          dimensions = { width: element.offsetWidth, height: element.offsetHeight };
          if (dimensions.width) labelSizes.set(landmark.id, dimensions);
        }
        if (dimensions.width) anchors.push({ id: landmark.id, x, y, ...dimensions });
      }
      for (const callout of placeLandmarkLabels(anchors, width, height, exclusionRef.current)) {
        const element = labelElements.current.get(callout.id)!;
        element.style.visibility = "visible"; element.style.left = `${callout.left}px`; element.style.top = `${callout.top}px`;
        const leader = leaderElements.current.get(callout.id);
        const line = leader?.querySelector("line"), dot = leader?.querySelector("circle");
        if (leader && line && dot) {
          leader.style.visibility = "visible";
          line.setAttribute("x1", String(callout.x)); line.setAttribute("y1", String(callout.y));
          line.setAttribute("x2", String(callout.lineX)); line.setAttribute("y2", String(callout.lineY));
          dot.setAttribute("cx", String(callout.x)); dot.setAttribute("cy", String(callout.y));
        }
      }
    }
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true; cancelAnimationFrame(frame); api.current = null;
      resize.disconnect(); observer.disconnect(); motion.removeEventListener("change", onMotion);
      controls.removeEventListener("start", stop); controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerleave", pointerLeave);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      outline.geometry.dispose();
      if (Array.isArray(outline.material)) outline.material.forEach(material => material.dispose()); else outline.material.dispose();
      furniture?.dispose(); ceremony?.dispose(); venue.dispose(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [onUnavailable]);

  useEffect(() => { api.current?.setDusk(dusk); }, [dusk, onUnavailable]);

  useEffect(() => { api.current?.setParameters(parameters, led); }, [parameters, led]);

  useEffect(() => { api.current?.setFurniture(snapshot, layout); }, [snapshot, layout, parameters, led, ceremonyChairs]);

  useEffect(() => { api.current?.setCocktailFixtures(cocktailFixtures); }, [cocktailFixtures, parameters, led, onUnavailable]);

  useEffect(() => { api.current?.setView(preset); }, [preset, resetKey]);
  useEffect(() => { if (focusRequest) api.current?.focus(focusRequest.target, focusRequest.tour); else if (focusRequest === null) api.current?.stop(); }, [focusRequest, onUnavailable]);
  return <div className="venue-canvas" ref={host} onClick={event => event.stopPropagation()}>
    <div className={`venue-labels venue-labels--callouts${labels ? "" : " is-hidden"}`} aria-hidden="true">
      <svg className="venue-label-leaders" width="100%" height="100%">
        {venueLandmarks(parameters, led).map(item => <g key={item.id} ref={element => { if (element) leaderElements.current.set(item.id, element); else leaderElements.current.delete(item.id); }} style={{ visibility: "hidden" }}><line /><circle r="3" /></g>)}
      </svg>
      {venueLandmarks(parameters, led).map(item => <span key={item.id} ref={element => { if (element) labelElements.current.set(item.id, element); else labelElements.current.delete(item.id); }} className={`venue-map-label venue-map-label-${item.id}`}><i />{item.label}</span>)}
    </div>
    {moving && <button className="venue-skip" onClick={() => api.current?.skip()}>{focusRequest ? "Skip to my seat" : "Skip movement"}</button>}
  </div>;
}

export { VenuePlan } from "./VenuePlan";

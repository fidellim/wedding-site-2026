import { useId, type ReactNode } from "react";
import { polygonPoints, venueArchitecture } from "./venueArchitecture";
import type { VenueLayout } from "./layout";
import { ceremonyLayout } from "./ceremonyLayout";
import { ceremonyPalms, ceremonyStructure, LED_WIDTH, ledLayout, stageLayout, venueLandmarks, venueLayout, type LedLayout, type VenueParameters, normalizeParameters } from "./venueModel";

/** Always available, including on devices without WebGL. Uses the same parametric layout. */
export function VenuePlan({ parameters: input, led = "none", landmarks, children, receptionOnly = false, interactive = false, ceremonyChairs = 0, cocktailFixtures = false }: { parameters: VenueParameters; led?: LedLayout; landmarks?: VenueLayout["landmarks"]; children?: ReactNode; receptionOnly?: boolean; interactive?: boolean; ceremonyChairs?: number; cocktailFixtures?: boolean }) {
  const titleId = useId(), descriptionId = useId(), clipId = useId();
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
    <defs><clipPath id={clipId}><rect x={-p.lawnWidth / 2 - 2} y={-p.lawnLength / 2 - 2} width={p.lawnWidth + 4} height={p.lawnLength + 4} /></clipPath></defs>
    <g clipPath={receptionOnly ? `url(#${clipId})` : undefined}>
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
    </g>
  </svg>;
}

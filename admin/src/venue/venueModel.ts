/** Temporary model parameters, not measured venue facts. See docs/venue/VENUE_MASTER_SPEC.md. */
export const parameterDefinitions = {
  stageWidth: { label: "Stage width", value: 8, min: 4, max: 9, step: .5, unit: "m", group: "Stage & dance floor" },
  stageDepth: { label: "Stage depth", value: 3, min: 2, max: 5, step: .5, unit: "m", group: "Stage & dance floor" },
  stageHeight: { label: "Platform height", value: .3, min: .2, max: .4, step: .05, unit: "m", group: "Stage & dance floor" },
  backdropHeight: { label: "Backdrop above platform", value: 3, min: 2.4, max: 4, step: .1, unit: "m", group: "Stage & dance floor" },
  danceFloorSize: { label: "Dance floor side", value: 8, min: 4, max: 9, step: .5, unit: "m", group: "Stage & dance floor" },
  lawnWidth: { label: "Lawn width", value: 44, min: 24, max: 70, step: 1, unit: "m", group: "Lawn & waterfront" },
  lawnLength: { label: "Lawn depth", value: 16, min: 10, max: 36, step: 1, unit: "m", group: "Lawn & waterfront" },
  waterSetback: { label: "Sand strip to water", value: 10, min: 3, max: 20, step: .5, unit: "m", group: "Lawn & waterfront" },
  waterfrontEdgeHeight: { label: "Waterfront edging", value: .2, min: .05, max: .5, step: .05, unit: "m", group: "Lawn & waterfront" },
  terraceDepth: { label: "Minimum terrace depth", value: 20, min: 10, max: 22, step: .5, unit: "m", group: "Terrace & steps" },
  terraceHeight: { label: "Terrace elevation", value: 1.2, min: .4, max: 2, step: .1, unit: "m", group: "Terrace & steps" },
  stairWidth: { label: "Stair width", value: 10, min: 5, max: 16, step: .5, unit: "m", group: "Terrace & steps" },
  stairCount: { label: "Number of steps", value: 7, min: 4, max: 12, step: 1, unit: "", group: "Terrace & steps" },
  stairTread: { label: "Step depth", value: .48, min: .3, max: .7, step: .02, unit: "m", group: "Terrace & steps" },
  pavilionDiameter: { label: "Pavilion diameter", value: 9, min: 6, max: 12, step: .5, unit: "m", group: "Pavilion" },
  pavilionColumns: { label: "Pavilion posts", value: 12, min: 8, max: 16, step: 2, unit: "", group: "Pavilion" },
  pavilionColumnHeight: { label: "Roof eave height", value: 3.3, min: 2.5, max: 4.5, step: .1, unit: "m", group: "Pavilion" },
  pavilionRoofRise: { label: "Roof rise", value: 1.8, min: 1, max: 2.8, step: .1, unit: "m", group: "Pavilion" },
  pavilionFloorOffset: { label: "Floor above terrace", value: .12, min: 0, max: .4, step: .02, unit: "m", group: "Pavilion" },
  pavilionLawnGap: { label: "Pavilion setback on terrace", value: 2, min: 1, max: 5, step: .5, unit: "m", group: "Pavilion" },
  ceremonyStructureDiameter: { label: "Tiered structure diameter", value: 3, min: 2, max: 4, step: .25, unit: "m", group: "Ceremony structure" },
  ceremonyStructureHeight: { label: "Tiered structure height", value: .9, min: .5, max: 1.4, step: .1, unit: "m", group: "Ceremony structure" },
  plazaWidth: { label: "Maximum plaza width", value: 18, min: 12, max: 26, step: 1, unit: "m", group: "Arrival & plaza" },
  plazaLength: { label: "Plaza depth", value: 20, min: 14, max: 30, step: 1, unit: "m", group: "Arrival & plaza" },
  approachWidth: { label: "Approach path width", value: 3, min: 2, max: 5, step: .25, unit: "m", group: "Arrival & plaza" },
} as const;
export type ParameterKey = keyof typeof parameterDefinitions;
export type VenueParameters = Record<ParameterKey, number>;
export const parameterKeys = Object.keys(parameterDefinitions) as ParameterKey[];
export const defaultParameters = Object.fromEntries(parameterKeys.map(key => [key, parameterDefinitions[key].value])) as VenueParameters;
export const VENUE_STORAGE_KEY = "hf-venue-preview-v2";

export function normalizeParameters(value: unknown): VenueParameters {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(parameterKeys.map(key => {
    const definition = parameterDefinitions[key];
    const candidate = source[key];
    const number = typeof candidate === "number" && Number.isFinite(candidate) ? candidate : definition.value;
    const clamped = Math.max(definition.min, Math.min(definition.max, number));
    return [key, Number((definition.min + Math.round((clamped - definition.min) / definition.step) * definition.step).toFixed(3))];
  })) as VenueParameters;
}

export function venueLayout(p: VenueParameters) {
  const lawnBack = -p.lawnLength / 2;
  const terraceFront = lawnBack - p.stairCount * p.stairTread;
  const pavilionY = terraceFront - p.pavilionLawnGap - p.pavilionDiameter / 2;
  // Keep the pavilion on its terrace even while independently changing dimensions.
  const terraceDepth = Math.max(p.terraceDepth, p.pavilionLawnGap + p.pavilionDiameter + 2, p.plazaLength);
  const terraceBack = terraceFront - terraceDepth;
  const plazaWidth = Math.min(p.plazaWidth, p.lawnWidth * .48);
  const plazaX = p.lawnWidth / 2 - plazaWidth / 2;
  const plazaY = terraceFront - p.plazaLength / 2;
  const entranceY = terraceBack - 12;
  return { lawnBack, terraceFront, terraceBack, terraceDepth, plazaWidth, stairX: -p.lawnWidth * .035, pavilionX: -p.lawnWidth * .28,
    pavilionY, plazaX, plazaY, entranceY, waterY: p.lawnLength / 2 + p.waterSetback,
    span: Math.max(p.lawnWidth + 10, p.lawnLength / 2 + p.waterSetback - entranceY),
  };
}

/** Stage sits just inland of the sand, facing -plan Y toward the ceremony. */
export function stageLayout(p: VenueParameters) {
  const backY = p.lawnLength / 2 - .5;
  const frontY = backY - p.stageDepth;
  const centerX = 0;
  return { backY, frontY, centerX, centerY: (backY + frontY) / 2, stepDepth: .6,
    stepWidth: p.stageWidth * .5, danceX: centerX, danceY: frontY - .6 - p.danceFloorSize / 2 };
}

export type LedLayout = "none" | "center" | "side";
export const LED_WIDTH = 5;
export const LED_HEIGHT = 3;
/** Screen face is fixed at 5 × 3 m; surround and supports are additional. */
export function ledLayout(p: VenueParameters, mode: LedLayout) {
  const width = mode === "center" ? Math.max(8, p.stageWidth) : p.stageWidth;
  const screenX = mode === "side" ? width / 2 + .8 + (LED_WIDTH + .2) / 2 : 0;
  const stage = stageLayout(p);
  return { width, screenX, screenAngle: mode === "side" ? Math.PI / 6 : 0, screenForward: mode === "side" ? 1.8 : .68, height: mode === "center" ? Math.max(3.8, p.backdropHeight) : p.backdropHeight,
    fits: stage.danceY - p.danceFloorSize / 2 >= -p.lawnLength / 2 + .5
      && stage.centerX + width / 2 <= p.lawnWidth / 2 - .5
      && stage.centerX - (mode === "side" ? screenX + (LED_WIDTH + .2) / 2 * Math.cos(Math.PI / 6) + Math.sin(Math.PI / 6) : width / 2) >= -p.lawnWidth / 2 + .5 };

}

export type ViewPreset = "floral" | "stage" | "ceremony" | "overview" | "entrance" | "pavilion" | "waterfront" | "overhead";
export const viewPresets: { id: ViewPreset; label: string }[] = [
  { id: "stage", label: "Stage" }, { id: "floral", label: "Floral detail" },
  { id: "overview", label: "Overview" }, { id: "entrance", label: "Entrance" },
  { id: "ceremony", label: "Ceremony" },
  { id: "pavilion", label: "Pavilion" }, { id: "waterfront", label: "Waterfront" },
  { id: "overhead", label: "Overhead" },
];
export function cameraView(p: VenueParameters, preset: ViewPreset, aspect = 1.5, led: LedLayout = "none") {
  const l = venueLayout(p);
  const scale = Math.max(1, .95 / Math.max(.35, aspect));
  const span = l.span * scale;
  // Rendering coordinates: plan Y is reflected once by the venue roots.
  // Keep beach in front, pavilion left, and ceremony right, just like the 2D plan.
  const overview = { position: [span * .2, -span * .95, span * .95], target: [0, 10, 0] };
  const stage = stageLayout(p);
  const stageDistance = led === "none"
    ? Math.max(p.stageWidth * 1.1, 9) * Math.max(1, 1.2 / Math.max(.35, aspect))
    : Math.max(18, 27 / Math.max(.35, aspect));
  const design = ledLayout(p, led);
  const floralZ = p.stageHeight + design.height * .82;
  const views = {
    floral: { position: [stage.centerX - design.width * .43, -stage.backY + 3.2 * scale, floralZ + .65 * scale], target: [stage.centerX - design.width * .43, -stage.backY + .5, floralZ] },
    stage: { position: [stage.centerX - stageDistance * .12, -stage.frontY + stageDistance, p.stageHeight + stageDistance * .32], target: [stage.centerX, -stage.centerY, p.stageHeight + (led === "none" ? p.backdropHeight * .45 : 2.1)] },
    overview,
    ceremony: { position: [l.plazaX - 5 * scale, -l.plazaY + p.plazaLength * .9 * scale, p.terraceHeight + p.plazaLength * 1.05 * scale], target: [l.plazaX, -l.plazaY, p.terraceHeight + 1] },
    entrance: { position: [l.plazaX + 4 * scale, -l.entranceY - 20 * scale, 28 * scale], target: [l.plazaX, -l.entranceY - 4, 0] },
    pavilion: { position: [l.pavilionX + 13 * scale, -l.pavilionY - 19 * scale, 24 * scale], target: [l.pavilionX + 4, -l.pavilionY, p.terraceHeight + 2] },
    waterfront: { position: [-p.lawnWidth * .2, -l.waterY - 20 * scale, 22 * scale], target: [0, -l.waterY, 0] },
    overhead: { position: [0, 9.99, span * 1.65], target: [0, 10, 0] },
  };
  return views[preset];
}
export function venueLandmarks(p: VenueParameters, led: LedLayout = "none") {
  const l = venueLayout(p), structure = ceremonyStructure(p);
  return [
    { id: "ceremony-structure", label: "Tiered structure", position: [structure.x, structure.y, structure.z + structure.height + .35] },
    { id: "stage", label: "HF stage", position: [stageLayout(p).centerX, stageLayout(p).centerY, p.stageHeight + ledLayout(p, led).height + .5] },
    { id: "entrance", label: "Ceremony approach", position: [l.plazaX, l.entranceY + 4, p.terraceHeight + 1] },
    { id: "plaza", label: "Ceremony area", position: [l.plazaX, l.plazaY, p.terraceHeight + .6] },
    { id: "lawn", label: "Reception lawn", position: [6, 0, .6] },
    { id: "pavilion", label: "Pavilion · cocktail area", position: [l.pavilionX, l.pavilionY, p.terraceHeight + p.pavilionColumnHeight + p.pavilionRoofRise + 1] },
    { id: "sand", label: "Beach", position: [0, p.lawnLength / 2 + p.waterSetback / 2, .4] },
    { id: "water", label: "Waterfront", position: [0, l.waterY + 12, .3] },
  ];
}

/** Approximate water-facing ceremony backdrop; not surveyed tree positions. */
export function ceremonyPalms(p: VenueParameters) {
  const l = venueLayout(p);
  const left = Math.max(l.plazaX - l.plazaWidth / 2 + 1, l.stairX + p.stairWidth / 2 + 1);
  const right = p.lawnWidth / 2 - 1;
  return [0, .5, 1].map((fraction, index) => ({
    x: left + (right - left) * fraction,
    y: l.terraceFront - .8,
    z: p.terraceHeight,
    height: [7.2, 7.8, 7.4][index],
  }));
}


/** Visible in REF-04/05; purpose, dimensions and permanence remain unconfirmed. */
export function ceremonyStructure(p: VenueParameters) {
  const l = venueLayout(p), radius = p.ceremonyStructureDiameter / 2;
  // Video 00:58–01:02: left of the medallion facing water is +X on the plan.
  return { x: l.plazaX + l.plazaWidth / 2 - radius - 1.5, y: l.terraceFront - radius - 1.5, z: p.terraceHeight + .07,
    radius, height: p.ceremonyStructureHeight, tiers: 5 };
}

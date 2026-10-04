/** Preserve plan X-right/Y-down on screen in a Z-up 3D scene. Stored coordinates stay unchanged. */
export const planToSceneScale: [number, number, number] = [1, -1, 1];

export function toScenePosition(point: readonly number[]): [number, number, number] {
  return [point[0] * planToSceneScale[0], point[1] * planToSceneScale[1], point[2] * planToSceneScale[2]];
}

import type { FurnitureTarget } from "../venue/VenueInspection";
import type { VenueLayout } from "../venue/layout";

export type GuideTarget = FurnitureTarget | { eventFurniture: "couple" };

export function targetPlacement(layout: VenueLayout, target: GuideTarget) {
  return "eventFurniture" in target ? layout.eventFurniture?.[target.eventFurniture] : layout.tables[target.tableId];
}

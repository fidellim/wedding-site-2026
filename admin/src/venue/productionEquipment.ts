/** Representative vendor equipment, not a confirmed supplier inventory. Metres relative to the tabletop. */
export interface EquipmentPart {
  name: string;
  shape: "box" | "disc" | "headband" | "lens";
  x: number; y: number; z: number;
  width: number; depth: number; height: number;
  finish: "case" | "metal" | "screen" | "control";
}

export const equipmentDescriptions: Record<string, string> = {
  dj: "DJ controller with two jog wheels, laptop, headphones and wireless microphone",
  sde: "Same-day editing laptop, preview monitor, keyboard, SSD, card reader, camera and spare batteries",
};

export function productionEquipment(kind: string): EquipmentPart[] {
  const parts: EquipmentPart[] = [];
  const part = (name: string, x: number, y: number, z: number, width: number, depth: number, height: number,
    finish: EquipmentPart["finish"] = "case", shape: EquipmentPart["shape"] = "box") => {
    parts.push({ name, x, y, z, width, depth, height, finish, shape });
  };
  // Screens face the crew on the inland (-Y) side of the tables.
  const laptopX = kind === "dj" ? -.61 : -.54, laptopY = kind === "dj" ? .12 : -.03;
  const laptopZ = kind === "dj" ? .19 : 0;
  if (kind === "dj") {
    part("LAPTOP_STAND", laptopX, laptopY, .085, .05, .05, .17, "metal");
    part("STAND_FOOT", laptopX, laptopY, .015, .3, .2, .03, "metal");
  }
  part("LAPTOP_BASE", laptopX, laptopY, laptopZ + .015, .42, .27, .03, "metal");
  part("LAPTOP_KEYBOARD", laptopX, laptopY - .025, laptopZ + .032, .33, .13, .004);
  part("LAPTOP_LID", laptopX, laptopY + .12, laptopZ + .17, .42, .025, .3, "metal");
  part("LAPTOP_SCREEN", laptopX, laptopY + .104, laptopZ + .17, .37, .008, .245, "screen");
  if (kind === "dj") {
    part("DJ_CONTROLLER", .18, -.04, .045, 1.06, .42, .09);
    for (const x of [-.14, .5]) {
      part("JOG_WHEEL_RIM", x, -.04, .1, .25, .25, .025, "metal", "disc");
      part("JOG_WHEEL", x, -.04, .116, .2, .2, .012, "control", "disc");
      for (let i = 0; i < 4; i++) part("PERFORMANCE_PAD", x - .09 + i * .06, -.19, .096, .043, .035, .008, "control");
    }
    for (const x of [.1, .18, .26]) {
      part("CHANNEL_FADER", x, -.06, .096, .012, .15, .008, "metal");
      part("FADER_CAP", x, -.045, .105, .045, .025, .012, "control");
      part("EQ_KNOB", x, .09, .108, .03, .03, .025, "metal", "disc");
    }
    part("HEADPHONE_BAND", -.64, -.22, .035, .2, .2, .025, "case", "headband");
    for (const x of [-.74, -.54]) part("HEADPHONE_EARCUP", x, -.22, .035, .06, .09, .055);
    part("MICROPHONE_HANDLE", .77, .13, .025, .035, .22, .035, "metal");
    part("MICROPHONE_GRILLE", .77, .25, .033, .06, .07, .06);
  } else {
    part("MONITOR_FOOT", .1, .22, .015, .24, .16, .03, "metal");
    part("MONITOR_STAND", .1, .24, .12, .04, .04, .24, "metal");
    part("PREVIEW_MONITOR", .1, .24, .33, .54, .045, .33);
    part("PREVIEW_SCREEN", .1, .212, .33, .49, .008, .28, "screen");
    part("EDITING_KEYBOARD", .1, -.04, .018, .38, .14, .036, "metal");
    part("KEYBOARD_KEYS", .1, -.04, .038, .34, .11, .005);
    part("PORTABLE_SSD", .44, -.25, .022, .12, .08, .044, "metal");
    part("CARD_READER", .19, -.25, .018, .1, .065, .036);
    part("CAMERA_BODY", .65, .03, .09, .2, .12, .18);
    part("CAMERA_VIEWFINDER", .65, .025, .195, .08, .07, .045);
    part("CAMERA_LENS", .65, .16, .09, .11, .15, .11, "case", "lens");
    part("CAMERA_GLASS", .65, .239, .09, .09, .008, .09, "screen", "lens");
    for (const x of [.67, .77]) part("SPARE_BATTERY", x, -.23, .035, .065, .09, .07);
  }
  return parts;
}

import { MEASUREMENT_TEXT_FONT_FAMILY, UI_TEXT_FONT_FAMILY } from "@/lib/fonts";
import { getMeasurementTextScale } from "@/lib/editor/settings";
import {
  ROOM_LABEL_AREA_FONT_SIZE_PX,
  ROOM_LABEL_AREA_FONT_WEIGHT,
  ROOM_LABEL_NAME_FONT_SIZE_PX,
  ROOM_LABEL_NAME_FONT_WEIGHT,
} from "@/lib/editor/roomLabel";

function canLoadDocumentFonts(): boolean {
  return typeof document !== "undefined" && "fonts" in document;
}

function buildFontLoadDescriptor(fontFamily: string, fontSizePx: number, fontWeight: string): string {
  return `${fontWeight} ${fontSizePx}px ${fontFamily}`;
}

export async function preloadEditorCanvasFonts(): Promise<void> {
  if (!canLoadDocumentFonts()) return;

  // Pixi text renders through the canvas font API, so preloading targeted families
  // avoids a first-use fallback frame when measurement text is introduced later.
  await Promise.allSettled([
    document.fonts.load(
      buildFontLoadDescriptor(
        UI_TEXT_FONT_FAMILY,
        ROOM_LABEL_NAME_FONT_SIZE_PX,
        ROOM_LABEL_NAME_FONT_WEIGHT
      )
    ),
    document.fonts.load(
      buildFontLoadDescriptor(
        MEASUREMENT_TEXT_FONT_FAMILY,
        ROOM_LABEL_AREA_FONT_SIZE_PX,
        ROOM_LABEL_AREA_FONT_WEIGHT
      )
    ),
    document.fonts.load(
      buildFontLoadDescriptor(
        MEASUREMENT_TEXT_FONT_FAMILY,
        ROOM_LABEL_AREA_FONT_SIZE_PX * getMeasurementTextScale({ measurementFontSize: "large" }),
        ROOM_LABEL_AREA_FONT_WEIGHT
      )
    ),
  ]);
}

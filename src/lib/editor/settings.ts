export type EditorMeasurementDisplayMode = "interactive";
export type EditorDimensionsVisibility = "visible" | "hidden";
export type EditorMeasurementFontSize = "normal" | "large";
export type EditorWallMeasurementPosition = "inside" | "outside";
export const EDITOR_EXPORT_SIGNATURE_MAX_LENGTH = 40;

export type EditorSettings = {
  measurementDisplayMode: EditorMeasurementDisplayMode;
  dimensionsVisibility: EditorDimensionsVisibility;
  measurementFontSize: EditorMeasurementFontSize;
  wallMeasurementPosition: EditorWallMeasurementPosition;
  exportSignatureText: string;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  measurementDisplayMode: "interactive",
  dimensionsVisibility: "visible",
  measurementFontSize: "normal",
  wallMeasurementPosition: "inside",
  exportSignatureText: "",
};

export function cloneEditorSettings(settings: EditorSettings): EditorSettings {
  return {
    measurementDisplayMode: settings.measurementDisplayMode,
    dimensionsVisibility: settings.dimensionsVisibility,
    measurementFontSize: settings.measurementFontSize,
    wallMeasurementPosition: settings.wallMeasurementPosition,
    exportSignatureText: settings.exportSignatureText,
  };
}

export function areEditorSettingsEqual(a: EditorSettings, b: EditorSettings): boolean {
  return (
    a.measurementDisplayMode === b.measurementDisplayMode &&
    a.dimensionsVisibility === b.dimensionsVisibility &&
    a.measurementFontSize === b.measurementFontSize &&
    a.wallMeasurementPosition === b.wallMeasurementPosition &&
    a.exportSignatureText === b.exportSignatureText
  );
}

export function isEditorMeasurementDisplayMode(value: unknown): value is EditorMeasurementDisplayMode {
  return value === "interactive";
}

export function isEditorDimensionsVisibility(value: unknown): value is EditorDimensionsVisibility {
  return value === "visible" || value === "hidden";
}

export function isEditorMeasurementFontSize(value: unknown): value is EditorMeasurementFontSize {
  return value === "normal" || value === "large";
}

export function isEditorWallMeasurementPosition(
  value: unknown
): value is EditorWallMeasurementPosition {
  return value === "inside" || value === "outside";
}

export function shouldShowDimensions(
  settings: Pick<EditorSettings, "dimensionsVisibility">,
  invertVisibility = false
): boolean {
  const areDimensionsVisible = settings.dimensionsVisibility === "visible";
  return invertVisibility ? !areDimensionsVisible : areDimensionsVisible;
}

export function getMeasurementTextScale(
  settings: Pick<EditorSettings, "measurementFontSize">
): number {
  return settings.measurementFontSize === "large" ? 1.2 : 1;
}

export function normalizeEditorExportSignature(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEditorSettings(value: unknown): EditorSettings | null {
  if (typeof value !== "object" || value === null) return null;
  if (
    !("measurementDisplayMode" in value) ||
    !isEditorMeasurementDisplayMode(value.measurementDisplayMode)
  ) {
    return null;
  }

  return {
    measurementDisplayMode: value.measurementDisplayMode,
    dimensionsVisibility:
      "dimensionsVisibility" in value && isEditorDimensionsVisibility(value.dimensionsVisibility)
        ? value.dimensionsVisibility
        : DEFAULT_EDITOR_SETTINGS.dimensionsVisibility,
    measurementFontSize:
      "measurementFontSize" in value && isEditorMeasurementFontSize(value.measurementFontSize)
        ? value.measurementFontSize
        : DEFAULT_EDITOR_SETTINGS.measurementFontSize,
    wallMeasurementPosition:
      "wallMeasurementPosition" in value &&
      isEditorWallMeasurementPosition(value.wallMeasurementPosition)
        ? value.wallMeasurementPosition
        : DEFAULT_EDITOR_SETTINGS.wallMeasurementPosition,
    exportSignatureText:
      "exportSignatureText" in value && typeof value.exportSignatureText === "string"
        ? value.exportSignatureText.slice(0, EDITOR_EXPORT_SIGNATURE_MAX_LENGTH)
        : DEFAULT_EDITOR_SETTINGS.exportSignatureText,
  };
}

export function isEditorSettings(value: unknown): value is EditorSettings {
  return normalizeEditorSettings(value) !== null;
}

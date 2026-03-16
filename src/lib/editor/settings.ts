export type EditorMeasurementDisplayMode = "interactive";
export type EditorDimensionsVisibility = "visible" | "hidden";
export type EditorMeasurementFontSize = "normal" | "large";

export type EditorSettings = {
  measurementDisplayMode: EditorMeasurementDisplayMode;
  dimensionsVisibility: EditorDimensionsVisibility;
  measurementFontSize: EditorMeasurementFontSize;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  measurementDisplayMode: "interactive",
  dimensionsVisibility: "visible",
  measurementFontSize: "normal",
};

export function cloneEditorSettings(settings: EditorSettings): EditorSettings {
  return {
    measurementDisplayMode: settings.measurementDisplayMode,
    dimensionsVisibility: settings.dimensionsVisibility,
    measurementFontSize: settings.measurementFontSize,
  };
}

export function areEditorSettingsEqual(a: EditorSettings, b: EditorSettings): boolean {
  return (
    a.measurementDisplayMode === b.measurementDisplayMode &&
    a.dimensionsVisibility === b.dimensionsVisibility &&
    a.measurementFontSize === b.measurementFontSize
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
  };
}

export function isEditorSettings(value: unknown): value is EditorSettings {
  return normalizeEditorSettings(value) !== null;
}

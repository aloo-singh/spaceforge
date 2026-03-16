export type EditorMeasurementDisplayMode = "interactive";
export type EditorDimensionsVisibility = "visible" | "hidden";

export type EditorSettings = {
  measurementDisplayMode: EditorMeasurementDisplayMode;
  dimensionsVisibility: EditorDimensionsVisibility;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  measurementDisplayMode: "interactive",
  dimensionsVisibility: "visible",
};

export function cloneEditorSettings(settings: EditorSettings): EditorSettings {
  return {
    measurementDisplayMode: settings.measurementDisplayMode,
    dimensionsVisibility: settings.dimensionsVisibility,
  };
}

export function areEditorSettingsEqual(a: EditorSettings, b: EditorSettings): boolean {
  return (
    a.measurementDisplayMode === b.measurementDisplayMode &&
    a.dimensionsVisibility === b.dimensionsVisibility
  );
}

export function isEditorMeasurementDisplayMode(value: unknown): value is EditorMeasurementDisplayMode {
  return value === "interactive";
}

export function isEditorDimensionsVisibility(value: unknown): value is EditorDimensionsVisibility {
  return value === "visible" || value === "hidden";
}

export function shouldShowDimensions(settings: Pick<EditorSettings, "dimensionsVisibility">): boolean {
  return settings.dimensionsVisibility === "visible";
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
  };
}

export function isEditorSettings(value: unknown): value is EditorSettings {
  return normalizeEditorSettings(value) !== null;
}

export type EditorMeasurementDisplayMode = "interactive";

export type EditorSettings = {
  measurementDisplayMode: EditorMeasurementDisplayMode;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  measurementDisplayMode: "interactive",
};

export function cloneEditorSettings(settings: EditorSettings): EditorSettings {
  return {
    measurementDisplayMode: settings.measurementDisplayMode,
  };
}

export function areEditorSettingsEqual(a: EditorSettings, b: EditorSettings): boolean {
  return a.measurementDisplayMode === b.measurementDisplayMode;
}

export function isEditorMeasurementDisplayMode(value: unknown): value is EditorMeasurementDisplayMode {
  return value === "interactive";
}

export function isEditorSettings(value: unknown): value is EditorSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    "measurementDisplayMode" in value &&
    isEditorMeasurementDisplayMode(value.measurementDisplayMode)
  );
}

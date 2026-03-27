export type EditorExportThemePreference = "light" | "dark" | "system";
export type EditorExportLegendPosition = "bottom" | "right-side" | "none";
export type EditorExportScaleBarPosition = "bottom-left" | "none";

export type EditorExportPreferences = {
  showLegend: boolean;
  showScaleBar: boolean;
  showGrid: boolean;
  showDimensions: boolean;
  theme: EditorExportThemePreference;
  legendPosition: EditorExportLegendPosition;
  scaleBarPosition: EditorExportScaleBarPosition;
};

export const DEFAULT_EDITOR_EXPORT_PREFERENCES: EditorExportPreferences = {
  showLegend: false,
  showScaleBar: false,
  showGrid: true,
  showDimensions: true,
  theme: "system",
  legendPosition: "bottom",
  scaleBarPosition: "bottom-left",
};

export function cloneEditorExportPreferences(
  preferences: EditorExportPreferences
): EditorExportPreferences {
  return {
    showLegend: preferences.showLegend,
    showScaleBar: preferences.showScaleBar,
    showGrid: preferences.showGrid,
    showDimensions: preferences.showDimensions,
    theme: preferences.theme,
    legendPosition: preferences.legendPosition,
    scaleBarPosition: preferences.scaleBarPosition,
  };
}

export function areEditorExportPreferencesEqual(
  a: EditorExportPreferences,
  b: EditorExportPreferences
) {
  return (
    a.showLegend === b.showLegend &&
    a.showScaleBar === b.showScaleBar &&
    a.showGrid === b.showGrid &&
    a.showDimensions === b.showDimensions &&
    a.theme === b.theme &&
    a.legendPosition === b.legendPosition &&
    a.scaleBarPosition === b.scaleBarPosition
  );
}

export function normalizeEditorExportPreferences(value: unknown): EditorExportPreferences {
  if (typeof value !== "object" || value === null) {
    return cloneEditorExportPreferences(DEFAULT_EDITOR_EXPORT_PREFERENCES);
  }

  return {
    showLegend:
      "showLegend" in value && typeof value.showLegend === "boolean"
        ? value.showLegend
        : DEFAULT_EDITOR_EXPORT_PREFERENCES.showLegend,
    showScaleBar:
      "showScaleBar" in value && typeof value.showScaleBar === "boolean"
        ? value.showScaleBar
        : DEFAULT_EDITOR_EXPORT_PREFERENCES.showScaleBar,
    showGrid:
      "showGrid" in value && typeof value.showGrid === "boolean"
        ? value.showGrid
        : DEFAULT_EDITOR_EXPORT_PREFERENCES.showGrid,
    showDimensions:
      "showDimensions" in value && typeof value.showDimensions === "boolean"
        ? value.showDimensions
        : DEFAULT_EDITOR_EXPORT_PREFERENCES.showDimensions,
    theme:
      "theme" in value &&
      (value.theme === "light" || value.theme === "dark" || value.theme === "system")
        ? value.theme
        : DEFAULT_EDITOR_EXPORT_PREFERENCES.theme,
    legendPosition:
      "legendPosition" in value &&
      (value.legendPosition === "bottom" ||
        value.legendPosition === "right-side" ||
        value.legendPosition === "none")
        ? value.legendPosition
        : DEFAULT_EDITOR_EXPORT_PREFERENCES.legendPosition,
    scaleBarPosition:
      "scaleBarPosition" in value &&
      (value.scaleBarPosition === "bottom-left" || value.scaleBarPosition === "none")
        ? value.scaleBarPosition
        : DEFAULT_EDITOR_EXPORT_PREFERENCES.scaleBarPosition,
  };
}

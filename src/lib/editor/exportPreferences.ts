export type EditorExportThemePreference = "light" | "dark" | "system";
export type EditorExportLegendPosition = "bottom" | "right-side" | "none";
export type EditorExportScaleBarPosition = "bottom-left" | "none";
export type EditorExportResolution = "normal" | "hi-res";
export type EditorExportFormat = "png-normal" | "png-hi-res" | "svg" | "pdf";
export type EditorExportAssetMode = "all" | "stairs-only" | "none";
export type EditorExportViewMode = "top-down" | "extruded";

export type EditorExportPreferences = {
  showLegend: boolean;
  showScaleBar: boolean;
  showGrid: boolean;
  showDimensions: boolean;
  exportAssetMode: EditorExportAssetMode;
  theme: EditorExportThemePreference;
  legendPosition: EditorExportLegendPosition;
  scaleBarPosition: EditorExportScaleBarPosition;
  exportResolution: EditorExportResolution;
  exportFormat: EditorExportFormat;
  exportViewMode: EditorExportViewMode;
};

export const DEFAULT_EDITOR_EXPORT_PREFERENCES: EditorExportPreferences = {
  showLegend: false,
  showScaleBar: false,
  showGrid: true,
  showDimensions: true,
  exportAssetMode: "all",
  theme: "system",
  legendPosition: "bottom",
  scaleBarPosition: "bottom-left",
  exportResolution: "normal",
  exportFormat: "png-normal",
  exportViewMode: "top-down",
};

function normalizeEditorExportResolution(value: unknown): EditorExportResolution {
  return value === "hi-res" || value === "normal"
    ? value
    : DEFAULT_EDITOR_EXPORT_PREFERENCES.exportResolution;
}

function getExportFormatFromResolution(resolution: EditorExportResolution): EditorExportFormat {
  return resolution === "hi-res" ? "png-hi-res" : "png-normal";
}

function normalizeEditorExportFormat(
  value: unknown,
  fallbackResolution: EditorExportResolution
): EditorExportFormat {
  if (value === "png-normal" || value === "png-hi-res" || value === "svg" || value === "pdf") {
    return value;
  }

  if (value === "normal" || value === "hi-res") {
    return getExportFormatFromResolution(value);
  }

  return getExportFormatFromResolution(fallbackResolution);
}

function normalizeEditorExportAssetMode(value: unknown): EditorExportAssetMode {
  if (value === "all" || value === "stairs-only" || value === "none") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "all" : "none";
  }

  return DEFAULT_EDITOR_EXPORT_PREFERENCES.exportAssetMode;
}

function normalizeEditorExportViewMode(value: unknown): EditorExportViewMode {
  return value === "extruded" || value === "top-down"
    ? value
    : DEFAULT_EDITOR_EXPORT_PREFERENCES.exportViewMode;
}

export function cloneEditorExportPreferences(
  preferences: EditorExportPreferences
): EditorExportPreferences {
  return {
    showLegend: preferences.showLegend,
    showScaleBar: preferences.showScaleBar,
    showGrid: preferences.showGrid,
    showDimensions: preferences.showDimensions,
    exportAssetMode: preferences.exportAssetMode,
    theme: preferences.theme,
    legendPosition: preferences.legendPosition,
    scaleBarPosition: preferences.scaleBarPosition,
    exportResolution: preferences.exportResolution,
    exportFormat: preferences.exportFormat,
    exportViewMode: preferences.exportViewMode,
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
    a.exportAssetMode === b.exportAssetMode &&
    a.theme === b.theme &&
    a.legendPosition === b.legendPosition &&
    a.scaleBarPosition === b.scaleBarPosition &&
    a.exportResolution === b.exportResolution &&
    a.exportFormat === b.exportFormat &&
    a.exportViewMode === b.exportViewMode
  );
}

export function normalizeEditorExportPreferences(value: unknown): EditorExportPreferences {
  if (typeof value !== "object" || value === null) {
    return cloneEditorExportPreferences(DEFAULT_EDITOR_EXPORT_PREFERENCES);
  }

  const exportResolution =
    "exportResolution" in value
      ? normalizeEditorExportResolution(value.exportResolution)
      : DEFAULT_EDITOR_EXPORT_PREFERENCES.exportResolution;

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
    exportAssetMode:
      "exportAssetMode" in value
        ? normalizeEditorExportAssetMode(value.exportAssetMode)
        : "includeAssets" in value
          ? normalizeEditorExportAssetMode(value.includeAssets)
          : DEFAULT_EDITOR_EXPORT_PREFERENCES.exportAssetMode,
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
    exportResolution,
    exportFormat:
      "exportFormat" in value
        ? normalizeEditorExportFormat(value.exportFormat, exportResolution)
        : getExportFormatFromResolution(exportResolution),
    exportViewMode:
      "exportViewMode" in value
        ? normalizeEditorExportViewMode(value.exportViewMode)
        : DEFAULT_EDITOR_EXPORT_PREFERENCES.exportViewMode,
  };
}

export type EditorMeasurementDisplayMode = "interactive";
export type EditorDimensionsVisibility = "visible" | "hidden";
export type EditorMeasurementFontSize = "normal" | "large";
export type EditorWallMeasurementPosition = "inside" | "outside";
export type EditorSidebarDensity = "comfortable" | "compact";
export const EDITOR_EXPORT_SIGNATURE_MAX_LENGTH = 40;

export type EditorSettings = {
  measurementDisplayMode: EditorMeasurementDisplayMode;
  dimensionsVisibility: EditorDimensionsVisibility;
  measurementFontSize: EditorMeasurementFontSize;
  wallMeasurementPosition: EditorWallMeasurementPosition;
  showCanvasHud: boolean;
  showMiniMap: boolean;
  showGuidelines: boolean;
  snappingEnabled: boolean;
  showFloorFootprint: boolean;
  sidebarDensity: EditorSidebarDensity;
  exportSignatureText: string;
  multiSelectModeEnabled: boolean;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  measurementDisplayMode: "interactive",
  dimensionsVisibility: "visible",
  measurementFontSize: "normal",
  wallMeasurementPosition: "inside",
  showCanvasHud: true,
  showMiniMap: true,
  showGuidelines: true,
  snappingEnabled: true,
  showFloorFootprint: true,
  sidebarDensity: "comfortable",
  exportSignatureText: "",
  multiSelectModeEnabled: false,
};

export function cloneEditorSettings(settings: EditorSettings): EditorSettings {
  return {
    measurementDisplayMode: settings.measurementDisplayMode,
    dimensionsVisibility: settings.dimensionsVisibility,
    measurementFontSize: settings.measurementFontSize,
    wallMeasurementPosition: settings.wallMeasurementPosition,
    showCanvasHud: settings.showCanvasHud,
    showMiniMap: settings.showMiniMap,
    showGuidelines: settings.showGuidelines,
    snappingEnabled: settings.snappingEnabled,
    showFloorFootprint: settings.showFloorFootprint,
    sidebarDensity: settings.sidebarDensity,
    exportSignatureText: settings.exportSignatureText,
    multiSelectModeEnabled: settings.multiSelectModeEnabled,
  };
}

export function areEditorSettingsEqual(a: EditorSettings, b: EditorSettings): boolean {
  return (
    a.measurementDisplayMode === b.measurementDisplayMode &&
    a.dimensionsVisibility === b.dimensionsVisibility &&
    a.measurementFontSize === b.measurementFontSize &&
    a.wallMeasurementPosition === b.wallMeasurementPosition &&
    a.showCanvasHud === b.showCanvasHud &&
    a.showMiniMap === b.showMiniMap &&
    a.showGuidelines === b.showGuidelines &&
    a.snappingEnabled === b.snappingEnabled &&
    a.showFloorFootprint === b.showFloorFootprint &&
    a.sidebarDensity === b.sidebarDensity &&
    a.exportSignatureText === b.exportSignatureText &&
    a.multiSelectModeEnabled === b.multiSelectModeEnabled
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

export function isEditorSidebarDensity(value: unknown): value is EditorSidebarDensity {
  return value === "comfortable" || value === "compact";
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
    showCanvasHud:
      "showCanvasHud" in value && typeof value.showCanvasHud === "boolean"
        ? value.showCanvasHud
        : DEFAULT_EDITOR_SETTINGS.showCanvasHud,
    showMiniMap:
      "showMiniMap" in value && typeof value.showMiniMap === "boolean"
        ? value.showMiniMap
        : DEFAULT_EDITOR_SETTINGS.showMiniMap,
    showGuidelines:
      "showGuidelines" in value && typeof value.showGuidelines === "boolean"
        ? value.showGuidelines
        : DEFAULT_EDITOR_SETTINGS.showGuidelines,
    snappingEnabled:
      "snappingEnabled" in value && typeof value.snappingEnabled === "boolean"
        ? value.snappingEnabled
        : DEFAULT_EDITOR_SETTINGS.snappingEnabled,
    showFloorFootprint:
      "showFloorFootprint" in value && typeof value.showFloorFootprint === "boolean"
        ? value.showFloorFootprint
        : DEFAULT_EDITOR_SETTINGS.showFloorFootprint,
    sidebarDensity:
      "sidebarDensity" in value && isEditorSidebarDensity(value.sidebarDensity)
        ? value.sidebarDensity
        : DEFAULT_EDITOR_SETTINGS.sidebarDensity,
    exportSignatureText:
      "exportSignatureText" in value && typeof value.exportSignatureText === "string"
        ? value.exportSignatureText.slice(0, EDITOR_EXPORT_SIGNATURE_MAX_LENGTH)
        : DEFAULT_EDITOR_SETTINGS.exportSignatureText,
    multiSelectModeEnabled:
      "multiSelectModeEnabled" in value && typeof value.multiSelectModeEnabled === "boolean"
        ? value.multiSelectModeEnabled
        : DEFAULT_EDITOR_SETTINGS.multiSelectModeEnabled,
  };
}

export function isEditorSettings(value: unknown): value is EditorSettings {
  return normalizeEditorSettings(value) !== null;
}

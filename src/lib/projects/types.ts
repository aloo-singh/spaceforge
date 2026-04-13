import type { EditorDocumentState } from "@/lib/editor/history";
import {
  DEFAULT_CANVAS_ROTATION_DEGREES,
  normalizeCanvasRotationDegrees,
} from "@/lib/editor/canvasRotation";
import {
  DEFAULT_NORTH_BEARING_DEGREES,
  normalizeNorthBearingDegrees,
} from "@/lib/editor/north";
import { cloneDocumentState } from "@/lib/editor/persistedHistory";
import {
  PROJECT_EXPORT_DESCRIPTION_MAX_LENGTH,
  PROJECT_EXPORT_TITLE_MAX_LENGTH,
} from "@/lib/projects/exportConfig";

export type AppUser = {
  id: string;
  clientToken: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRecord = {
  id: string;
  userId: string;
  name: string;
  document: EditorDocumentState;
  thumbnailDataUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListItem = Omit<ProjectRecord, "document">;

export const MAX_PROJECT_THUMBNAIL_DATA_URL_LENGTH = 400_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPoint(value: unknown): value is { x: number; y: number } {
  if (!isObject(value)) return false;
  return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isOpeningType(value: unknown): value is "door" | "window" {
  return value === "door" || value === "window";
}

function isInteriorAssetType(value: unknown): value is "stairs" {
  return value === "stairs";
}

function isRoomOpening(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (!isOpeningType(value.type)) return false;

  const isLegacyRectWall =
    value.wall === "left" ||
    value.wall === "right" ||
    value.wall === "top" ||
    value.wall === "bottom";
  const isSegmentIndex = typeof value.wall === "number" && Number.isInteger(value.wall) && value.wall >= 0;
  if (!isLegacyRectWall && !isSegmentIndex) return false;

  if (value.openingSide !== undefined && value.openingSide !== "interior" && value.openingSide !== "exterior") {
    return false;
  }
  if (value.hingeSide !== undefined && value.hingeSide !== "start" && value.hingeSide !== "end") {
    return false;
  }

  return isFiniteNumber(value.offsetMm) && isFiniteNumber(value.widthMm) && value.widthMm > 0;
}

function isRoomInteriorAsset(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (!isInteriorAssetType(value.type)) return false;
  if (value.connectionId !== undefined && value.connectionId !== null && typeof value.connectionId !== "string") {
    return false;
  }
  if (value.name !== undefined && typeof value.name !== "string") return false;
  if (value.arrowEnabled !== undefined && typeof value.arrowEnabled !== "boolean") return false;
  if (
    value.arrowDirection !== undefined &&
    value.arrowDirection !== "forward" &&
    value.arrowDirection !== "reverse"
  ) {
    return false;
  }
  if (value.arrowLabel !== undefined && typeof value.arrowLabel !== "string") return false;

  return (
    isFiniteNumber(value.xMm) &&
    isFiniteNumber(value.yMm) &&
    isFiniteNumber(value.widthMm) &&
    value.widthMm > 0 &&
    isFiniteNumber(value.depthMm) &&
    value.depthMm > 0 &&
    (value.rotationDegrees === undefined || isFiniteNumber(value.rotationDegrees))
  );
}

function isRoom(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (value.floorId !== undefined && typeof value.floorId !== "string") return false;
  if (typeof value.name !== "string") return false;
  if (!Array.isArray(value.points) || value.points.length < 3) return false;
  if (!value.points.every(isPoint)) return false;
  if (value.openings !== undefined && (!Array.isArray(value.openings) || !value.openings.every(isRoomOpening))) {
    return false;
  }
  if (
    value.interiorAssets !== undefined &&
    (!Array.isArray(value.interiorAssets) || !value.interiorAssets.every(isRoomInteriorAsset))
  ) {
    return false;
  }

  return true;
}

export function isProjectDocument(value: unknown): value is EditorDocumentState {
  if (!isObject(value)) return false;
  if (value.floors !== undefined) {
    if (!Array.isArray(value.floors)) return false;
    if (
      !value.floors.every(
        (floor) =>
          isObject(floor) && typeof floor.id === "string" && typeof floor.name === "string"
      )
    ) {
      return false;
    }
  }
  if (value.activeFloorId !== undefined && value.activeFloorId !== null && typeof value.activeFloorId !== "string") {
    return false;
  }
  if (!Array.isArray(value.rooms)) return false;
  if (!value.rooms.every(isRoom)) return false;
  if (
    value.northBearingDegrees !== undefined &&
    (!isFiniteNumber(value.northBearingDegrees) || !Number.isFinite(value.northBearingDegrees))
  ) {
    return false;
  }
  if (
    value.canvasRotationDegrees !== undefined &&
    (!isFiniteNumber(value.canvasRotationDegrees) || !Number.isFinite(value.canvasRotationDegrees))
  ) {
    return false;
  }
  if (!("exportConfig" in value) || value.exportConfig === undefined) return true;
  if (!isObject(value.exportConfig)) return false;
  if (
    value.exportConfig.title !== undefined &&
    (typeof value.exportConfig.title !== "string" ||
      value.exportConfig.title.replace(/\r?\n/g, " ").length > PROJECT_EXPORT_TITLE_MAX_LENGTH)
  ) {
    return false;
  }
  if (
    value.exportConfig.description !== undefined &&
    (typeof value.exportConfig.description !== "string" ||
      value.exportConfig.description.replace(/\r\n/g, "\n").length > PROJECT_EXPORT_DESCRIPTION_MAX_LENGTH)
  ) {
    return false;
  }
  if (
    value.exportConfig.titlePosition !== undefined &&
    value.exportConfig.titlePosition !== "top" &&
    value.exportConfig.titlePosition !== "none"
  ) {
    return false;
  }
  if (
    value.exportConfig.descriptionPosition !== undefined &&
    value.exportConfig.descriptionPosition !== "below-title" &&
    value.exportConfig.descriptionPosition !== "none"
  ) {
    return false;
  }
  if (
    value.exportConfig.includeNorthIndicator !== undefined &&
    typeof value.exportConfig.includeNorthIndicator !== "boolean"
  ) {
    return false;
  }
  return true;
}

export function isProjectThumbnailDataUrl(value: unknown): value is string | null {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  if (value.length === 0 || value.length > MAX_PROJECT_THUMBNAIL_DATA_URL_LENGTH) {
    return false;
  }

  return /^data:image\/(png|webp|jpeg);base64,/u.test(value);
}

export function cloneProjectDocument(document: EditorDocumentState): EditorDocumentState {
  return cloneDocumentState({
    ...document,
    canvasRotationDegrees: normalizeCanvasRotationDegrees(
      document.canvasRotationDegrees ?? DEFAULT_CANVAS_ROTATION_DEGREES
    ),
    northBearingDegrees: normalizeNorthBearingDegrees(
      document.northBearingDegrees ?? DEFAULT_NORTH_BEARING_DEGREES
    ),
  });
}

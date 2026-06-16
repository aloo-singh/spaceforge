import type { Container, ICanvas, Renderer } from "pixi.js";
import { MEASUREMENT_TEXT_FONT_FAMILY } from "@/lib/fonts";
import {
  normalizeCanvasRotationDegrees,
  snapToCardinalRotationDegrees,
} from "@/lib/editor/canvasRotation";
import {
  DEFAULT_STAIR_ARROW_DIRECTION,
  DEFAULT_STAIR_ARROW_ENABLED,
  DEFAULT_STAIR_TREAD_SPACING_MM,
  getInteriorAssetDisplayName,
  getRoomInteriorAssetBounds,
  getStairRunLengthMm,
} from "@/lib/editor/interiorAssets";
import { normalizeNorthBearingDegrees } from "@/lib/editor/north";
import type {
  EditorExportAssetMode,
  EditorExportFormat,
  EditorExportResolution,
  EditorExportViewMode,
} from "@/lib/editor/exportPreferences";
import { getLayoutBoundsFromRooms } from "@/lib/editor/exportLayoutBounds";
import { formatWallDimension } from "@/lib/editor/measurements";
import { getResolvedRoomOpeningLayout } from "@/lib/editor/openings";
import { normalizeRoomHeightMm } from "@/lib/editor/roomHeight";
import { getPolygonLabelAnchor } from "@/lib/editor/roomGeometry";
import type { Floor, Point, Room, RoomInteriorAsset } from "@/lib/editor/types";
import type { UnitOrigin } from "@/lib/projects/region";

export type EditorExportScope = {
  type: "floor" | "room";
  id: string;
};

export type EditorExportRoomColorMode = "none" | "room-type" | "single";

export type EditorExportRoomColorOverride = {
  mode: EditorExportRoomColorMode;
  color?: string;
};

export type EditorExportScopeDocument = {
  floors: Floor[];
  activeFloorId: string | null;
  rooms: Room[];
};

export type PixiPngExportSource =
  | Renderer
  | {
      renderer: Renderer;
      stage?: Container;
    };

export type PixiPngExportOptions = {
  exportScope?: EditorExportScope;
  roomColors?: Record<string, string>;
  roomColorOverride?: EditorExportRoomColorOverride;
  backgroundColor?: string;
  paddingPx?: number;
  exportResolution?: EditorExportResolution;
  header?: {
    title?: string;
    description?: string;
    color: string;
    mutedColor: string;
  };
  legend?: {
    items: {
      name: string;
      area: string;
    }[];
    position?: "bottom" | "right-side";
    color: string;
    mutedColor: string;
    dividerColor: string;
  };
  scaleBar?: {
    widthPx: number;
    label: string;
    color: string;
    mutedColor: string;
  };
  northIndicator?: {
    bearingDegrees: number;
    color: string;
    mutedColor: string;
  };
  signature?: {
    lines: string[];
    color: string;
    alpha?: number;
  };
  grid?: {
    spacingPx: number;
    originXPx: number;
    originYPx: number;
    color: string;
    alpha?: number;
  };
};

const DEFAULT_EXPORT_BACKGROUND = "#ffffff";
const DEFAULT_EXPORT_PADDING_PX = 48;
const DEFAULT_EDGE_CROP_PX = 1;
export const EDITOR_EXPORT_ROOM_COLOR_FILL_ALPHA = 0.12;
const EXPORT_TEXT_FONT_FAMILY = "system-ui, sans-serif";
const STANDARD_EXPORT_WIDTH_PX = 1280;
const SVG_EXPORT_PADDING_PX = 64;
const SVG_ROOM_FILL = "#f8fafc";
const SVG_ROOM_STROKE = "#0f172a";
const SVG_MUTED_STROKE = "#64748b";
const SVG_SANS_FONT_FAMILY = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const SVG_MONO_FONT_FAMILY = "Courier, monospace";
const SVG_ROOM_LABEL_FILL = "#111827";
const SVG_ROOM_LABEL_PILL_FILL = "#ffffff";
const SVG_ROOM_LABEL_PILL_STROKE = "#bccce0";
const SVG_ROOM_LABEL_FONT_FAMILY = SVG_SANS_FONT_FAMILY;
const SVG_ROOM_LABEL_FONT_SIZE_PX = 14;
const SVG_ROOM_LABEL_FONT_WEIGHT = 500;
const SVG_ROOM_LABEL_MIN_WIDTH_PX = 44;
const SVG_ROOM_LABEL_PADDING_X_PX = 10;
const SVG_ROOM_LABEL_HEIGHT_PX = 26;
const SVG_ASSET_FILL = "#eef2f7";
const SVG_ASSET_DETAIL_FILL = "#dbe4ee";
const SVG_SCALE_BAR_HEIGHT_PX = 72;
const SVG_NORTH_INDICATOR_WIDTH_PX = 72;
const SVG_NORTH_INDICATOR_HEIGHT_PX = 96;
const SVG_NORTH_INDICATOR_GAP_PX = 24;
const SVG_HEADER_GAP_PX = 24;
const SVG_RIGHT_LEGEND_WIDTH_PX = 190;
const SVG_BOTTOM_LEGEND_GAP_PX = 16;
const SVG_SIGNATURE_BASELINE_INSET_PX = 16;
const PDF_EXPORT_FLOAT_PRECISION = 3;
const SVG_EXTRUDED_HEIGHT_X_OFFSET_SCALE = 0.045;
const SVG_EXTRUDED_HEIGHT_Y_OFFSET_SCALE = 0.18;
const SVG_EXTRUDED_WALL_FILL = "#cbd5e1";
const SVG_EXTRUDED_WALL_ALT_FILL = "#d8e0ea";
const SVG_EXTRUDED_FLOOR_FILL = "#f8fafc";
const SVG_EXTRUDED_TOP_STROKE = "#f8fafc";
const SVG_EXTRUDED_SHADOW_FILL = "#0f172a";

type ExportTextLine = {
  text: string;
  font: string;
  color: string;
  alpha?: number;
  gapAfterPx?: number;
};

type ExportTextBlock = {
  lines: ExportTextLine[];
  height: number;
  width: number;
};

type ExportScaleBarBlock = {
  widthPx: number;
  label: string;
  color: string;
  mutedColor: string;
  height: number;
};

type ExportNorthIndicatorBlock = {
  bearingDegrees: number;
  color: string;
  mutedColor: string;
  width: number;
  height: number;
};

type SvgLegendItem = {
  name: string;
  area: string;
};

type SvgRoomFill = {
  color: string;
  opacity?: number;
};

export type SvgExportOptions = {
  rooms: Room[];
  floors?: Floor[];
  activeFloorId?: string | null;
  exportScope?: EditorExportScope;
  title?: string;
  description?: string;
  exportAssetMode?: EditorExportAssetMode;
  northBearingDegrees?: number;
  legendItems?: SvgLegendItem[];
  legendPosition?: "bottom" | "right-side";
  roomColorOverride?: EditorExportRoomColorOverride;
  exportViewMode?: EditorExportViewMode;
  signatureText?: string;
  signatureLines?: string[];
  displayUnitOrigin?: UnitOrigin;
};

export type SvgPdfExportMetadata = {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
};

export function getEditorExportFileExtension(format: EditorExportFormat): "png" | "svg" | "pdf" {
  if (format === "svg") return "svg";
  if (format === "pdf") return "pdf";
  return "png";
}

export function buildEditorExportFilename({
  projectName,
  floorName,
  roomName,
  format,
}: {
  projectName?: string;
  floorName?: string;
  roomName?: string;
  format: EditorExportFormat;
}): string {
  const safeProjectName = sanitizeExportFilenamePart(projectName) || "Untitled project";
  const safeFloorName = sanitizeExportFilenamePart(floorName) || "Floor 1";
  const safeRoomName = sanitizeExportFilenamePart(roomName);
  const scopeSuffix = safeRoomName ? ` - ${safeRoomName}` : "";
  return `${safeProjectName} - ${safeFloorName}${scopeSuffix}.${getEditorExportFileExtension(format)}`;
}

export function getRoomsForEditorExportScope(
  document: EditorExportScopeDocument,
  exportScope: EditorExportScope | undefined
): Room[] {
  if (exportScope?.type === "room") {
    const room = document.rooms.find((candidate) => candidate.id === exportScope.id);
    return room ? [room] : getCurrentFloorExportRooms(document);
  }

  if (exportScope?.type === "floor") {
    return document.rooms.filter((room) => room.floorId === exportScope.id);
  }

  return getCurrentFloorExportRooms(document);
}

export function getRoomColorsForEditorExportRooms(
  rooms: Room[],
  roomColorOverride: EditorExportRoomColorOverride = { mode: "room-type" }
): Record<string, string> {
  if (roomColorOverride.mode === "none") {
    return {};
  }

  if (roomColorOverride.mode === "single") {
    if (!isValidExportRoomColor(roomColorOverride.color)) return {};
    const overrideColor = roomColorOverride.color;

    return rooms.reduce<Record<string, string>>((roomColors, room) => {
      roomColors[room.id] = overrideColor;
      return roomColors;
    }, {});
  }

  return rooms.reduce<Record<string, string>>((roomColors, room) => {
    if (isValidExportRoomColor(room.roomColor)) {
      roomColors[room.id] = room.roomColor;
    }

    return roomColors;
  }, {});
}

export function getEditorExportScopeFilenameParts(
  document: EditorExportScopeDocument,
  exportScope: EditorExportScope | undefined
): {
  floorName: string;
  roomName?: string;
} {
  if (exportScope?.type === "room") {
    const room = document.rooms.find((candidate) => candidate.id === exportScope.id);
    const floorName = getExportFloorName(document, room?.floorId);
    return {
      floorName,
      roomName: room?.name,
    };
  }

  return {
    floorName: getExportFloorName(
      document,
      exportScope?.type === "floor" ? exportScope.id : document.activeFloorId
    ),
  };
}

export function exportToSVG({
  rooms,
  floors = [],
  activeFloorId = null,
  exportScope,
  title,
  description,
  exportAssetMode = "all",
  northBearingDegrees,
  legendItems,
  legendPosition,
  roomColorOverride,
  exportViewMode = "top-down",
  signatureText,
  signatureLines,
  displayUnitOrigin,
}: SvgExportOptions): string {
  const exportRooms = exportScope
    ? getRoomsForEditorExportScope({ rooms, floors, activeFloorId }, exportScope)
    : rooms;

  if (exportViewMode === "extruded") {
    return exportToExtrudedSVG({
      rooms: exportRooms,
      title,
      description,
      northBearingDegrees,
      signatureText,
      signatureLines,
    });
  }

  const bounds = getLayoutBoundsFromRooms(exportRooms);
  const header = buildSvgHeader(title, description);
  const includeNorthIndicator =
    northBearingDegrees !== undefined && Number.isFinite(northBearingDegrees);
  const normalizedLegendItems = normalizeSvgLegendItems(legendItems);
  const effectiveLegendPosition =
    normalizedLegendItems.length > 0 &&
    (legendPosition === "bottom" || legendPosition === "right-side")
      ? legendPosition
      : undefined;
  const bottomLegendHeight =
    effectiveLegendPosition === "bottom" ? getSvgLegendHeight(normalizedLegendItems) : 0;
  const normalizedSignatureLines = normalizeSvgSignatureLines(signatureLines, signatureText);
  const signatureHeight = getSvgSignatureHeight(normalizedSignatureLines);
  const bottomLeftHeight =
    bottomLegendHeight > 0
      ? SVG_SCALE_BAR_HEIGHT_PX + SVG_BOTTOM_LEGEND_GAP_PX + bottomLegendHeight
      : SVG_SCALE_BAR_HEIGHT_PX;
  const bottomOverlayHeight = Math.max(bottomLeftHeight, signatureHeight);
  const topOverlayHeight = Math.max(
    header ? header.height : 0,
    includeNorthIndicator ? SVG_NORTH_INDICATOR_HEIGHT_PX : 0
  );
  const maxDoorSwingMm = getMaxSvgDoorSwingClearanceMm(exportRooms);
  const leftPaddingPx = SVG_EXPORT_PADDING_PX;
  const rightOverlayWidth = Math.max(
    includeNorthIndicator ? SVG_NORTH_INDICATOR_WIDTH_PX : 0,
    effectiveLegendPosition === "right-side" ? SVG_RIGHT_LEGEND_WIDTH_PX : 0
  );
  const rightPaddingPx =
    SVG_EXPORT_PADDING_PX +
    (rightOverlayWidth > 0 ? rightOverlayWidth + SVG_NORTH_INDICATOR_GAP_PX : 0);
  const topPaddingPx =
    SVG_EXPORT_PADDING_PX + (topOverlayHeight > 0 ? topOverlayHeight + SVG_HEADER_GAP_PX : 0);
  const bottomPaddingPx = SVG_EXPORT_PADDING_PX;
  const drawableWidth = STANDARD_EXPORT_WIDTH_PX - leftPaddingPx - rightPaddingPx;
  const layoutWidthMm = Math.max((bounds?.width ?? 1) + maxDoorSwingMm * 2, 1);
  const layoutHeightMm = Math.max((bounds?.height ?? 1) + maxDoorSwingMm * 2, 1);
  const scale = drawableWidth / layoutWidthMm;
  const exportWidth = STANDARD_EXPORT_WIDTH_PX;
  const exportHeight = Math.max(
    1,
    Math.ceil(layoutHeightMm * scale + topPaddingPx + bottomPaddingPx + bottomOverlayHeight)
  );
  const originX = (bounds?.minX ?? 0) - maxDoorSwingMm;
  const originY = (bounds?.minY ?? 0) - maxDoorSwingMm;
  const svgTitle = normalizeSvgText(title || "spaceforge export");
  const contentLeftPx = bounds ? leftPaddingPx + (bounds.minX - originX) * scale : leftPaddingPx;
  const contentRightPx = bounds
    ? leftPaddingPx + (bounds.maxX - originX) * scale
    : exportWidth - rightPaddingPx;

  const projectPoint = (point: Point): Point => ({
    x: leftPaddingPx + (point.x - originX) * scale,
    y: topPaddingPx + (point.y - originY) * scale,
  });

  const formatNumber = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");

  const pointToString = (point: Point) => {
    const projectedPoint = projectPoint(point);
    return `${formatNumber(projectedPoint.x)},${formatNumber(projectedPoint.y)}`;
  };

  const elements: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}" role="img" aria-labelledby="title">`,
    `<title id="title">${svgTitle}</title>`,
    `<rect width="100%" height="100%" fill="#ffffff" />`,
  ];
  const roomElements: string[] = [];
  const assetElements: string[] = [];
  const openingElements: string[] = [];
  const labelElements: string[] = [];

  for (const room of exportRooms) {
    if (room.points.length < 3) continue;

    const polygonPoints = room.points.map(pointToString).join(" ");
    const roomFill = getSvgRoomFill(room, roomColorOverride);
    const roomFillOpacityAttribute =
      roomFill.opacity === undefined ? "" : ` fill-opacity="${formatNumber(roomFill.opacity)}"`;
    roomElements.push(
      `<polygon points="${polygonPoints}" fill="${roomFill.color}"${roomFillOpacityAttribute} stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linejoin="round" />`
    );

    for (let index = 0; index < room.points.length; index += 1) {
      const start = projectPoint(room.points[index]);
      const end = projectPoint(room.points[(index + 1) % room.points.length]);
      roomElements.push(
        `<line x1="${formatNumber(start.x)}" y1="${formatNumber(start.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linecap="round" />`
      );
    }

    if (exportAssetMode !== "none") {
      for (const asset of room.interiorAssets) {
        if (exportAssetMode === "stairs-only" && asset.type !== "stairs") continue;
        const renderedAsset = buildSvgInteriorAssetElements(asset, projectPoint, formatNumber);
        assetElements.push(...renderedAsset.elements);
        labelElements.push(...renderedAsset.labelElements);
      }
    }

    for (const opening of room.openings) {
      const layout = getResolvedRoomOpeningLayout(room, opening);
      if (!layout) continue;

      const start = projectPoint(layout.start);
      const end = projectPoint(layout.end);
      const center = projectPoint(layout.center);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      const tangent = {
        x: length > 0 ? dx / length : 1,
        y: length > 0 ? dy / length : 0,
      };
      const interiorNormalTarget = projectPoint({
        x: layout.center.x + layout.interiorNormal.x * 100,
        y: layout.center.y + layout.interiorNormal.y * 100,
      });
      const interiorNormalLength =
        Math.hypot(interiorNormalTarget.x - center.x, interiorNormalTarget.y - center.y) || 1;
      const interiorNormal = {
        x: (interiorNormalTarget.x - center.x) / interiorNormalLength,
        y: (interiorNormalTarget.y - center.y) / interiorNormalLength,
      };
      const markerOffset = opening.type === "window" ? 4 : 10;

      openingElements.push(
        `<line x1="${formatNumber(start.x)}" y1="${formatNumber(start.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />`
      );

      if (opening.type === "window") {
        openingElements.push(
          `<line x1="${formatNumber(start.x + interiorNormal.x * markerOffset)}" y1="${formatNumber(start.y + interiorNormal.y * markerOffset)}" x2="${formatNumber(end.x + interiorNormal.x * markerOffset)}" y2="${formatNumber(end.y + interiorNormal.y * markerOffset)}" stroke="${SVG_MUTED_STROKE}" stroke-width="1.5" stroke-linecap="round" />`,
          `<line x1="${formatNumber(start.x - interiorNormal.x * markerOffset)}" y1="${formatNumber(start.y - interiorNormal.y * markerOffset)}" x2="${formatNumber(end.x - interiorNormal.x * markerOffset)}" y2="${formatNumber(end.y - interiorNormal.y * markerOffset)}" stroke="${SVG_MUTED_STROKE}" stroke-width="1.5" stroke-linecap="round" />`
        );
      } else {
        const hinge = opening.hingeSide === "end" ? end : start;
        const hingeTangent =
          opening.hingeSide === "end"
            ? { x: -tangent.x, y: -tangent.y }
            : tangent;
        const swingNormal =
          opening.openingSide === "exterior"
            ? { x: -interiorNormal.x, y: -interiorNormal.y }
            : interiorNormal;
        const radius = Math.max(length, 1);
        const closedEnd = {
          x: hinge.x + hingeTangent.x * radius,
          y: hinge.y + hingeTangent.y * radius,
        };
        const openLeafEnd = {
          x: hinge.x + swingNormal.x * radius,
          y: hinge.y + swingNormal.y * radius,
        };
        const sweepFlag = hingeTangent.x * swingNormal.y - hingeTangent.y * swingNormal.x > 0 ? 1 : 0;
        openingElements.push(
          `<line x1="${formatNumber(hinge.x)}" y1="${formatNumber(hinge.y)}" x2="${formatNumber(openLeafEnd.x)}" y2="${formatNumber(openLeafEnd.y)}" stroke="${SVG_MUTED_STROKE}" stroke-width="1.5" stroke-linecap="round" />`,
          `<path d="M ${formatNumber(closedEnd.x)} ${formatNumber(closedEnd.y)} A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 ${sweepFlag} ${formatNumber(openLeafEnd.x)} ${formatNumber(openLeafEnd.y)}" fill="none" stroke="${SVG_MUTED_STROKE}" stroke-width="1.25" stroke-linecap="round" />`
        );
      }
    }

    const labelAnchor = getPolygonLabelAnchor(room.points);
    if (labelAnchor) {
      const labelPoint = projectPoint(labelAnchor);
      labelElements.push(buildSvgRoomLabelElement(room.name || "Room", labelPoint, formatNumber));
    }
  }

  elements.push(...roomElements, ...assetElements, ...openingElements, ...labelElements);

  const bottomLeftStartY = exportHeight - SVG_EXPORT_PADDING_PX - bottomLeftHeight;
  const scaleBar = buildSvgScaleBar(
    scale,
    contentLeftPx,
    formatNumber,
    bottomLeftStartY,
    displayUnitOrigin
  );

  const northIndicator = buildSvgNorthIndicator(northBearingDegrees, contentRightPx, formatNumber);
  if (northIndicator) {
    elements.push(northIndicator);
  }

  if (header) {
    elements.push(buildSvgHeaderElements(header, contentLeftPx, formatNumber));
  }

  const rightLegend =
    effectiveLegendPosition === "right-side"
      ? buildSvgLegendElements({
          items: normalizedLegendItems,
          x: contentRightPx - SVG_RIGHT_LEGEND_WIDTH_PX,
          y: topPaddingPx,
          formatNumber,
        })
      : null;
  if (rightLegend) {
    elements.push(rightLegend);
  }

  const bottomLegend =
    effectiveLegendPosition === "bottom"
      ? buildSvgLegendElements({
          items: normalizedLegendItems,
          x: contentLeftPx,
          y: bottomLeftStartY + SVG_SCALE_BAR_HEIGHT_PX + SVG_BOTTOM_LEGEND_GAP_PX,
          formatNumber,
        })
      : null;
  if (scaleBar) {
    elements.push(scaleBar);
  }

  if (bottomLegend) {
    elements.push(bottomLegend);
  }

  elements.push(buildSvgSignatureElements(normalizedSignatureLines, contentRightPx, exportHeight, formatNumber));

  elements.push("</svg>");
  return elements.join("\n");
}

function exportToExtrudedSVG({
  rooms,
  title,
  description,
  northBearingDegrees,
  signatureText,
  signatureLines,
}: {
  rooms: Room[];
  title?: string;
  description?: string;
  northBearingDegrees?: number;
  signatureText?: string;
  signatureLines?: string[];
}): string {
  const projectedRooms = rooms
    .filter((room) => room.points.length >= 3)
    .map((room) => ({
      room,
      bottom: room.points.map((point) => projectExtrudedSvgPoint(point, 0)),
      top: room.points.map((point) =>
        projectExtrudedSvgPoint(point, normalizeRoomHeightMm(room.heightMm, room.unitOrigin))
      ),
    }));
  const allPoints = projectedRooms.flatMap((room) => [...room.bottom, ...room.top]);
  const header = buildSvgHeader(title, description);
  const includeNorthIndicator =
    northBearingDegrees !== undefined && Number.isFinite(northBearingDegrees);
  const normalizedSignatureLines = normalizeSvgSignatureLines(signatureLines, signatureText);
  const signatureHeight = getSvgSignatureHeight(normalizedSignatureLines);
  const topOverlayHeight = Math.max(
    header ? header.height : 0,
    includeNorthIndicator ? SVG_NORTH_INDICATOR_HEIGHT_PX : 0
  );
  const topPaddingPx =
    SVG_EXPORT_PADDING_PX + (topOverlayHeight > 0 ? topOverlayHeight + SVG_HEADER_GAP_PX : 0);
  const bottomPaddingPx =
    SVG_EXPORT_PADDING_PX + (signatureHeight > 0 ? signatureHeight + SVG_HEADER_GAP_PX : 0);
  const projectedBounds = getPointBounds(allPoints);
  const layoutWidth = Math.max(projectedBounds?.width ?? 1, 1);
  const layoutHeight = Math.max(projectedBounds?.height ?? 1, 1);
  const rightOverlayWidth = includeNorthIndicator ? SVG_NORTH_INDICATOR_WIDTH_PX : 0;
  const leftPaddingPx = SVG_EXPORT_PADDING_PX;
  const rightPaddingPx =
    SVG_EXPORT_PADDING_PX +
    (rightOverlayWidth > 0 ? rightOverlayWidth + SVG_NORTH_INDICATOR_GAP_PX : 0);
  const drawableWidth = STANDARD_EXPORT_WIDTH_PX - leftPaddingPx - rightPaddingPx;
  const scale = drawableWidth / layoutWidth;
  const exportWidth = STANDARD_EXPORT_WIDTH_PX;
  const exportHeight = Math.max(
    1,
    Math.ceil(layoutHeight * scale + topPaddingPx + bottomPaddingPx)
  );
  const originX = projectedBounds?.minX ?? 0;
  const originY = projectedBounds?.minY ?? 0;
  const contentLeftPx = leftPaddingPx;
  const contentRightPx = exportWidth - rightPaddingPx;
  const svgTitle = normalizeSvgText(title || "spaceforge 2.5D export");

  const formatNumber = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  const toCanvasPoint = (point: Point): Point => ({
    x: leftPaddingPx + (point.x - originX) * scale,
    y: topPaddingPx + (point.y - originY) * scale,
  });
  const pointList = (points: Point[]) =>
    points.map((point) => {
      const canvasPoint = toCanvasPoint(point);
      return `${formatNumber(canvasPoint.x)},${formatNumber(canvasPoint.y)}`;
    }).join(" ");

  const elements: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}" role="img" aria-labelledby="title">`,
    `<title id="title">${svgTitle}</title>`,
    `<rect width="100%" height="100%" fill="#ffffff" />`,
  ];

  const shadowPoints = projectedRooms.flatMap((room) => room.bottom).map(toCanvasPoint);
  const shadowBounds = getPointBounds(shadowPoints);
  if (shadowBounds) {
    elements.push(
      `<ellipse cx="${formatNumber(shadowBounds.minX + shadowBounds.width / 2)}" cy="${formatNumber(shadowBounds.maxY + 16)}" rx="${formatNumber(Math.max(24, shadowBounds.width * 0.46))}" ry="${formatNumber(Math.max(16, shadowBounds.height * 0.18))}" fill="${SVG_EXTRUDED_SHADOW_FILL}" opacity="0.08" />`
    );
  }

  for (const projectedRoom of projectedRooms) {
    elements.push(
      `<polygon points="${pointList(projectedRoom.bottom)}" fill="${SVG_EXTRUDED_FLOOR_FILL}" stroke="${SVG_MUTED_STROKE}" stroke-width="1.1" stroke-linejoin="round" opacity="0.9" />`
    );
  }

  const wallFaces = projectedRooms.flatMap(({ room, bottom, top }) =>
    room.points.map((_, index) => {
      const nextIndex = (index + 1) % room.points.length;
      const quad = [bottom[index], bottom[nextIndex], top[nextIndex], top[index]];
      const depth = quad.reduce((sum, point) => sum + point.y, 0) / quad.length;
      return { quad, depth, index };
    })
  ).sort((a, b) => a.depth - b.depth);

  for (const face of wallFaces) {
    elements.push(
      `<polygon points="${pointList(face.quad)}" fill="${face.index % 2 === 0 ? SVG_EXTRUDED_WALL_FILL : SVG_EXTRUDED_WALL_ALT_FILL}" stroke="${SVG_ROOM_STROKE}" stroke-width="1.4" stroke-linejoin="round" opacity="0.96" />`
    );
  }

  const topFaces = [...projectedRooms].sort((a, b) => {
    const aDepth = a.bottom.reduce((sum, point) => sum + point.y, 0) / a.bottom.length;
    const bDepth = b.bottom.reduce((sum, point) => sum + point.y, 0) / b.bottom.length;
    return aDepth - bDepth;
  });

  for (const projectedRoom of topFaces) {
    elements.push(
      `<polygon points="${pointList(projectedRoom.top)}" fill="none" stroke="${SVG_EXTRUDED_TOP_STROKE}" stroke-width="3.2" stroke-linejoin="round" />`,
      `<polygon points="${pointList(projectedRoom.top)}" fill="none" stroke="${SVG_ROOM_STROKE}" stroke-width="1.5" stroke-linejoin="round" opacity="0.72" />`
    );
  }

  if (header) {
    elements.push(buildSvgHeaderElements(header, contentLeftPx, formatNumber));
  }

  const northIndicator = buildSvgNorthIndicator(northBearingDegrees, contentRightPx, formatNumber);
  if (northIndicator) {
    elements.push(northIndicator);
  }

  elements.push(buildSvgSignatureElements(normalizedSignatureLines, contentRightPx, exportHeight, formatNumber));
  elements.push("</svg>");
  return elements.join("\n");
}

function projectExtrudedSvgPoint(point: Point, heightMm: number): Point {
  return {
    x: point.x + heightMm * SVG_EXTRUDED_HEIGHT_X_OFFSET_SCALE,
    y: point.y - heightMm * SVG_EXTRUDED_HEIGHT_Y_OFFSET_SCALE,
  };
}

function getPointBounds(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } | null {
  if (points.length === 0) return null;

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export async function exportSvgToPdfBlob(
  svg: string,
  metadata: SvgPdfExportMetadata = {}
): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
  ]);
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(svg, "image/svg+xml");
  const parserError = parsedDocument.querySelector("parsererror");
  if (parserError) {
    throw new Error("PDF export failed: generated SVG is invalid.");
  }

  const svgElement = parsedDocument.documentElement as unknown as SVGSVGElement;
  const pageSize = getSvgPageSize(svgElement);
  const pdf = new jsPDF({
    orientation: pageSize.width >= pageSize.height ? "landscape" : "portrait",
    unit: "pt",
    format: [pageSize.width, pageSize.height],
    compress: true,
    floatPrecision: PDF_EXPORT_FLOAT_PRECISION,
    putOnlyUsedFonts: true,
  });

  pdf.setProperties({
    title: metadata.title || "spaceforge export",
    author: metadata.author || "[s]paceforge",
    subject: metadata.subject || "Floor plan export",
    creator: metadata.creator || "spaceforge.app",
  });

  await svg2pdf(svgElement, pdf, {
    x: 0,
    y: 0,
    width: pageSize.width,
    height: pageSize.height,
  });

  return pdf.output("blob");
}

function getSvgPageSize(svgElement: SVGSVGElement): { width: number; height: number } {
  const width = parseSvgNumber(svgElement.getAttribute("width"));
  const height = parseSvgNumber(svgElement.getAttribute("height"));
  if (width && height) {
    return { width, height };
  }

  const viewBox = svgElement.getAttribute("viewBox")?.trim().split(/\s+/).map(Number);
  if (viewBox && viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    return {
      width: Math.max(1, viewBox[2]),
      height: Math.max(1, viewBox[3]),
    };
  }

  return {
    width: STANDARD_EXPORT_WIDTH_PX,
    height: STANDARD_EXPORT_WIDTH_PX,
  };
}

function parseSvgNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildSvgRoomLabelElement(
  label: string,
  center: Point,
  formatNumber: (value: number) => string
): string {
  const normalizedLabel = normalizeSvgText(label.trim() || "Room");
  const labelWidth = Math.max(
    SVG_ROOM_LABEL_MIN_WIDTH_PX,
    estimateSvgRoomLabelWidthPx(label) + SVG_ROOM_LABEL_PADDING_X_PX * 2
  );
  const labelHeight = SVG_ROOM_LABEL_HEIGHT_PX;
  const labelX = center.x - labelWidth / 2;
  const labelY = center.y - labelHeight / 2;
  const textY = center.y + SVG_ROOM_LABEL_FONT_SIZE_PX * 0.34;
  const radius = labelHeight / 2;

  return [
    `<g aria-label="${normalizedLabel}">`,
    `<rect x="${formatNumber(labelX)}" y="${formatNumber(labelY)}" width="${formatNumber(labelWidth)}" height="${formatNumber(labelHeight)}" rx="${formatNumber(radius)}" fill="${SVG_ROOM_LABEL_PILL_FILL}" stroke="${SVG_ROOM_LABEL_PILL_STROKE}" stroke-width="1.2" />`,
    `<text x="${formatNumber(center.x)}" y="${formatNumber(textY)}" text-anchor="middle" fill="${SVG_ROOM_LABEL_FILL}" font-family="${SVG_ROOM_LABEL_FONT_FAMILY}" font-size="${SVG_ROOM_LABEL_FONT_SIZE_PX}" font-weight="${SVG_ROOM_LABEL_FONT_WEIGHT}">${normalizedLabel}</text>`,
    `</g>`,
  ].join("\n");
}

function estimateSvgRoomLabelWidthPx(label: string): number {
  let width = 0;

  for (const character of label.trim() || "Room") {
    if (" il.,'|!".includes(character)) {
      width += 4.7;
      continue;
    }

    if ("MW@#%&".includes(character)) {
      width += 11;
      continue;
    }

    width += 8.6;
  }

  return width * (SVG_ROOM_LABEL_FONT_SIZE_PX / 16);
}

function sanitizeExportFilenamePart(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .slice(0, 80);
}

function isValidExportRoomColor(roomColor: string | undefined): roomColor is string {
  return typeof roomColor === "string" && /^#[0-9a-fA-F]{6}$/.test(roomColor);
}

function getSvgRoomFill(
  room: Room,
  roomColorOverride: EditorExportRoomColorOverride | undefined
): SvgRoomFill {
  if (roomColorOverride?.mode === "none") return { color: "none" };
  if (roomColorOverride?.mode === "single") {
    return isValidExportRoomColor(roomColorOverride.color)
      ? { color: roomColorOverride.color, opacity: EDITOR_EXPORT_ROOM_COLOR_FILL_ALPHA }
      : { color: SVG_ROOM_FILL };
  }

  return isValidExportRoomColor(room.roomColor)
    ? { color: room.roomColor, opacity: EDITOR_EXPORT_ROOM_COLOR_FILL_ALPHA }
    : { color: SVG_ROOM_FILL };
}

function getCurrentFloorExportRooms(document: EditorExportScopeDocument): Room[] {
  const activeFloorId = document.activeFloorId ?? document.floors[0]?.id ?? null;
  return document.rooms.filter((room) => room.floorId === activeFloorId);
}

function getExportFloorName(
  document: EditorExportScopeDocument,
  floorId: string | null | undefined
): string {
  return document.floors.find((floor) => floor.id === floorId)?.name ?? "Floor 1";
}

function buildSvgInteriorAssetElements(
  asset: RoomInteriorAsset,
  projectPoint: (point: Point) => Point,
  formatNumber: (value: number) => string
): { elements: string[]; labelElements: string[] } {
  const bounds = getRoomInteriorAssetBounds(asset);
  const topLeft = projectPoint({ x: bounds.left, y: bounds.top });
  const bottomRight = projectPoint({ x: bounds.right, y: bounds.bottom });
  const left = Math.min(topLeft.x, bottomRight.x);
  const right = Math.max(topLeft.x, bottomRight.x);
  const top = Math.min(topLeft.y, bottomRight.y);
  const bottom = Math.max(topLeft.y, bottomRight.y);
  const widthPx = Math.max(right - left, 1);
  const depthPx = Math.max(bottom - top, 1);
  const center = {
    x: left + widthPx / 2,
    y: top + depthPx / 2,
  };
  const halfWidthPx = widthPx / 2;
  const halfDepthPx = depthPx / 2;
  const rotation = snapToCardinalRotationDegrees(asset.rotationDegrees ?? 0);
  const label = normalizeSvgText(asset.name || getInteriorAssetDisplayName(asset.type));
  const elements: string[] = [`<g>`];
  const labelElements: string[] = [];

  const rect = (
    x: number,
    y: number,
    width: number,
    height: number,
    options?: { fill?: string; stroke?: string; strokeWidth?: number; rx?: number }
  ) =>
    `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="${formatNumber(options?.rx ?? 4)}" fill="${options?.fill ?? SVG_ASSET_FILL}" stroke="${options?.stroke ?? SVG_ROOM_STROKE}" stroke-width="${formatNumber(options?.strokeWidth ?? 1.5)}" />`;
  const line = (x1: number, y1: number, x2: number, y2: number, width = 1.25) =>
    `<line x1="${formatNumber(x1)}" y1="${formatNumber(y1)}" x2="${formatNumber(x2)}" y2="${formatNumber(y2)}" stroke="${SVG_MUTED_STROKE}" stroke-width="${formatNumber(width)}" stroke-linecap="round" />`;
  const polygon = (points: Point[], fill: string) =>
    `<polygon points="${points.map((point) => `${formatNumber(point.x)},${formatNumber(point.y)}`).join(" ")}" fill="${fill}" />`;

  if (asset.type === "dining-table" && asset.shape === "round") {
    elements.push(
      `<ellipse cx="${formatNumber(center.x)}" cy="${formatNumber(center.y)}" rx="${formatNumber(halfWidthPx)}" ry="${formatNumber(halfDepthPx)}" fill="${SVG_ASSET_FILL}" stroke="${SVG_ROOM_STROKE}" stroke-width="1.5" />`
    );
  } else {
    elements.push(rect(left, top, widthPx, depthPx));
  }

  const cornerTopLeft = { x: left, y: top };
  const cornerTopRight = { x: right, y: top };
  const cornerBottomRight = { x: right, y: bottom };
  const cornerBottomLeft = { x: left, y: bottom };
  const [frontC1, frontC2, backC1, backC2] =
    rotation === 0
      ? [cornerTopLeft, cornerTopRight, cornerBottomLeft, cornerBottomRight]
      : rotation === 90
        ? [cornerTopRight, cornerBottomRight, cornerTopLeft, cornerBottomLeft]
        : rotation === -180
          ? [cornerBottomLeft, cornerBottomRight, cornerTopLeft, cornerTopRight]
          : [cornerTopLeft, cornerBottomLeft, cornerTopRight, cornerBottomRight];
  const pointBetween = (start: Point, end: Point, amount: number): Point => ({
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  });
  const lineBetweenEdges = (edgeStart1: Point, edgeStart2: Point, edgeEnd1: Point, edgeEnd2: Point, amount: number) => {
    const start = pointBetween(edgeStart1, edgeStart2, amount);
    const end = pointBetween(edgeEnd1, edgeEnd2, amount);
    return line(start.x, start.y, end.x, end.y);
  };

  if (asset.type === "bed") {
    const headboardBackC1 = pointBetween(frontC1, backC1, 0.14);
    const headboardBackC2 = pointBetween(frontC2, backC2, 0.14);
    elements.push(
      polygon([frontC1, frontC2, headboardBackC2, headboardBackC1], SVG_ASSET_DETAIL_FILL)
    );
  }

  if (asset.type === "sofa") {
    const backRestC1 = pointBetween(frontC1, backC1, 0.3);
    const backRestC2 = pointBetween(frontC2, backC2, 0.3);
    elements.push(
      polygon([frontC1, frontC2, backRestC2, backRestC1], SVG_ASSET_DETAIL_FILL),
      lineBetweenEdges(backRestC1, backRestC2, backC1, backC2, 1 / 3),
      lineBetweenEdges(backRestC1, backRestC2, backC1, backC2, 2 / 3)
    );
  }

  if (asset.type === "wardrobe") {
    const depthVector = {
      x: backC1.x - frontC1.x,
      y: backC1.y - frontC1.y,
    };
    const depthLength = Math.hypot(depthVector.x, depthVector.y);
    const outward = depthLength > 0
      ? { x: -depthVector.x / depthLength, y: -depthVector.y / depthLength }
      : { x: 0, y: -1 };
    if (asset.doorType === "sliding") {
      const midFront = pointBetween(frontC1, frontC2, 0.5);
      const offsetA = Math.max(4, depthLength * 0.08);
      const offsetB = Math.max(5, depthLength * 0.1);
      elements.push(
        line(
          frontC1.x + outward.x * offsetA,
          frontC1.y + outward.y * offsetA,
          midFront.x + outward.x * offsetA,
          midFront.y + outward.y * offsetA
        ),
        line(
          midFront.x + outward.x * offsetB,
          midFront.y + outward.y * offsetB,
          frontC2.x + outward.x * offsetB,
          frontC2.y + outward.y * offsetB
        )
      );
    } else {
      const leafLength = Math.min(widthPx * 0.4, depthPx * 0.6);
      elements.push(
        line(frontC1.x, frontC1.y, frontC1.x + outward.x * leafLength, frontC1.y + outward.y * leafLength),
        line(frontC2.x, frontC2.y, frontC2.x + outward.x * leafLength, frontC2.y + outward.y * leafLength)
      );
    }
  }

  if (asset.type === "stairs") {
    const stairRunLengthMm = Math.max(getStairRunLengthMm(asset), 1);
    const isSidewaysStairRun = Math.abs(normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0)) === 90;
    const treadCount = Math.max(0, Math.floor(stairRunLengthMm / DEFAULT_STAIR_TREAD_SPACING_MM) - 1);
    for (let index = 1; index <= treadCount; index += 1) {
      const progress = (index * DEFAULT_STAIR_TREAD_SPACING_MM) / stairRunLengthMm;
      if (progress <= 0 || progress >= 1) continue;
      if (isSidewaysStairRun) {
        const x = left + widthPx * progress;
        elements.push(line(x, top, x, bottom, 1));
      } else {
        const y = top + depthPx * progress;
        elements.push(line(left, y, right, y, 1));
      }
    }

    if ((asset.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED) !== false) {
      const direction = asset.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION;
      const arrowDirection = direction === "reverse" ? -1 : 1;
      const runLengthPx = isSidewaysStairRun ? widthPx : depthPx;
      const arrowLength = Math.max(28, Math.min(runLengthPx * 0.58, runLengthPx - 22));
      const tailY = isSidewaysStairRun ? center.y : center.y + (arrowLength / 2) * arrowDirection;
      const headY = isSidewaysStairRun ? center.y : center.y - (arrowLength / 2) * arrowDirection;
      const tailX = isSidewaysStairRun ? center.x - (arrowLength / 2) * arrowDirection : center.x;
      const headX = isSidewaysStairRun ? center.x + (arrowLength / 2) * arrowDirection : center.x;
      const headSign = arrowDirection;
      elements.push(
        line(tailX, tailY, headX, headY, 1.4),
        isSidewaysStairRun
          ? line(headX, headY, headX - 9 * headSign, headY - 5, 1.4)
          : line(headX, headY, headX - 5, headY + 9 * headSign, 1.4),
        isSidewaysStairRun
          ? line(headX, headY, headX - 9 * headSign, headY + 5, 1.4)
          : line(headX, headY, headX + 5, headY + 9 * headSign, 1.4)
      );
      const arrowLabel = normalizeSvgText(asset.arrowLabel?.trim() || "");
      if (arrowLabel) {
        labelElements.push(
          `<text x="${formatNumber(isSidewaysStairRun ? tailX - 16 * headSign : center.x)}" y="${formatNumber(isSidewaysStairRun ? center.y : tailY + 14 * headSign)}" text-anchor="middle" dominant-baseline="middle" fill="${SVG_ROOM_STROKE}" font-family="${SVG_SANS_FONT_FAMILY}" font-size="11" font-weight="600">${arrowLabel}</text>`
        );
      }
    }
  }

  if (asset.type !== "stairs") {
    labelElements.push(
      `<text x="${formatNumber(center.x)}" y="${formatNumber(center.y)}" text-anchor="middle" dominant-baseline="middle" fill="${SVG_MUTED_STROKE}" font-family="${SVG_SANS_FONT_FAMILY}" font-size="11" font-weight="500">${label}</text>`
    );
  }

  elements.push("</g>");

  return { elements, labelElements };
}

function buildSvgScaleBar(
  scale: number,
  x: number,
  formatNumber: (value: number) => string,
  startY?: number,
  displayUnitOrigin?: UnitOrigin
): string | null {
  const niceLengthsMm = [100, 250, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000];
  const targetLengthMm = 180 / scale;
  let lengthMm = niceLengthsMm[0];
  for (const candidate of niceLengthsMm) {
    if (candidate <= targetLengthMm) {
      lengthMm = candidate;
    }
  }
  const widthPx = lengthMm * scale;
  const y = startY === undefined ? SVG_EXPORT_PADDING_PX + 14 : startY + 14;
  const label = formatWallDimension(lengthMm, displayUnitOrigin);

  return [
    `<g aria-label="Scale bar">`,
    `<line x1="${formatNumber(x)}" y1="${formatNumber(y)}" x2="${formatNumber(x + widthPx)}" y2="${formatNumber(y)}" stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linecap="round" />`,
    `<line x1="${formatNumber(x)}" y1="${formatNumber(y - 6)}" x2="${formatNumber(x)}" y2="${formatNumber(y + 6)}" stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linecap="round" />`,
    `<line x1="${formatNumber(x + widthPx)}" y1="${formatNumber(y - 6)}" x2="${formatNumber(x + widthPx)}" y2="${formatNumber(y + 6)}" stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linecap="round" />`,
    `<text x="${formatNumber(x)}" y="${formatNumber(y + 24)}" fill="${SVG_MUTED_STROKE}" font-family="${SVG_SANS_FONT_FAMILY}" font-size="12" font-weight="500">${label}</text>`,
    `</g>`,
  ].join("\n");
}

function normalizeSvgLegendItems(items: SvgLegendItem[] | undefined): SvgLegendItem[] {
  return (items ?? [])
    .map((item) => ({
      name: item.name.trim(),
      area: item.area.trim(),
    }))
    .filter((item) => item.name.length > 0 || item.area.length > 0);
}

function getSvgLegendHeight(items: SvgLegendItem[]): number {
  if (items.length === 0) return 0;

  return 20 + 10 + items.length * 42;
}

function buildSvgLegendElements({
  items,
  x,
  y,
  formatNumber,
}: {
  items: SvgLegendItem[];
  x: number;
  y: number;
  formatNumber: (value: number) => string;
}): string | null {
  if (items.length === 0) return null;

  const elements = [`<g aria-label="Legend">`];
  let lineY = y;
  elements.push(
    `<text x="${formatNumber(x)}" y="${formatNumber(lineY)}" fill="${SVG_ROOM_STROKE}" font-family="${SVG_SANS_FONT_FAMILY}" font-size="12" font-weight="700">Legend</text>`
  );
  lineY += 30;

  for (const item of items) {
    const name = normalizeSvgText(item.name || "Room");
    const area = normalizeSvgTextWithSuperscriptTwo(item.area);
    elements.push(
      `<text x="${formatNumber(x)}" y="${formatNumber(lineY)}" fill="${SVG_ROOM_STROKE}" font-family="${SVG_SANS_FONT_FAMILY}" font-size="14" font-weight="500">&#8226; ${name}</text>`
    );
    lineY += 18;
    if (area) {
      elements.push(
        `<text x="${formatNumber(x)}" y="${formatNumber(lineY)}" fill="${SVG_MUTED_STROKE}" opacity="0.94" font-family="${SVG_SANS_FONT_FAMILY}" font-size="12" font-weight="600">${area}</text>`
      );
    }
    lineY += 24;
  }

  elements.push(`</g>`);
  return elements.join("\n");
}

function normalizeSvgSignatureLines(
  signatureLines: string[] | undefined,
  signatureText: string | undefined
): string[] {
  const lines = signatureLines?.map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines && lines.length > 0) return lines;

  const normalizedSignature = signatureText?.trim() || "";
  return normalizedSignature
    ? [`Designed by ${normalizedSignature}`, "Designed with [s]paceforge", "spaceforge.app"]
    : ["Designed with [s]paceforge", "spaceforge.app"];
}

function getSvgSignatureHeight(signatureLines: string[]): number {
  return signatureLines.length * 18;
}

function buildSvgSignatureElements(
  signatureLines: string[],
  rightEdgePx: number,
  exportHeight: number,
  formatNumber: (value: number) => string
): string {
  const x = rightEdgePx;
  let y = exportHeight - SVG_SIGNATURE_BASELINE_INSET_PX;
  const elements = [`<g aria-label="Export signature" text-anchor="end">`];

  for (let index = signatureLines.length - 1; index >= 0; index -= 1) {
    const isBrandLine = index === signatureLines.length - 2 && signatureLines.length > 1;
    elements.push(
      `<text x="${formatNumber(x)}" y="${formatNumber(y)}" fill="${SVG_MUTED_STROKE}" opacity="0.7" font-family="${SVG_MONO_FONT_FAMILY}" font-size="${isBrandLine ? 12 : 11}" font-weight="${isBrandLine ? 600 : 500}">${normalizeSvgText(signatureLines[index])}</text>`
    );
    y -= isBrandLine ? 18 : 17;
  }

  elements.push(`</g>`);
  return elements.join("\n");
}

type SvgHeader = {
  title?: string;
  descriptionLines: string[];
  height: number;
};

function buildSvgHeader(title: string | undefined, description: string | undefined): SvgHeader | null {
  const normalizedTitle = title?.trim() || "";
  const descriptionLines = (description ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!normalizedTitle && descriptionLines.length === 0) return null;

  const titleHeight = normalizedTitle ? 36 : 0;
  const titleGap = normalizedTitle && descriptionLines.length > 0 ? 10 : 0;
  const descriptionHeight = descriptionLines.length * 21;

  return {
    title: normalizedTitle || undefined,
    descriptionLines,
    height: titleHeight + titleGap + descriptionHeight,
  };
}

function buildSvgHeaderElements(
  header: SvgHeader,
  x: number,
  formatNumber: (value: number) => string
): string {
  let y = SVG_EXPORT_PADDING_PX;
  const elements = [`<g aria-label="Export header">`];

  if (header.title) {
    elements.push(
      `<text x="${formatNumber(x)}" y="${formatNumber(y)}" fill="${SVG_ROOM_STROKE}" font-family="${SVG_SANS_FONT_FAMILY}" font-size="30" font-weight="700">${normalizeSvgText(header.title)}</text>`
    );
    y += 46;
  }

  for (const line of header.descriptionLines) {
    elements.push(
      `<text x="${formatNumber(x)}" y="${formatNumber(y)}" fill="${SVG_MUTED_STROKE}" font-family="${SVG_SANS_FONT_FAMILY}" font-size="16" font-weight="400">${normalizeSvgText(line)}</text>`
    );
    y += 21;
  }

  elements.push(`</g>`);
  return elements.join("\n");
}

function buildSvgNorthIndicator(
  bearingDegrees: number | undefined,
  rightEdgePx: number,
  formatNumber: (value: number) => string
): string | null {
  if (bearingDegrees === undefined || !Number.isFinite(bearingDegrees)) return null;

  const width = SVG_NORTH_INDICATOR_WIDTH_PX;
  const height = SVG_NORTH_INDICATOR_HEIGHT_PX;
  const x = rightEdgePx - width;
  const y = SVG_EXPORT_PADDING_PX;
  const centerX = x + width / 2;
  const labelY = y + 1;
  const shaftBottomY = y + height - 18;
  const shaftLengthPx = 52;
  const shaftTopY = shaftBottomY - shaftLengthPx;
  const shaftMidY = shaftTopY + shaftLengthPx / 2;
  const rotationCenterY = shaftMidY;
  const bearing = normalizeNorthBearingDegrees(bearingDegrees);

  return [
    `<g aria-label="North indicator">`,
    `<g transform="rotate(${formatNumber(bearing)} ${formatNumber(centerX)} ${formatNumber(rotationCenterY)})" stroke="${SVG_ROOM_STROKE}" fill="${SVG_ROOM_STROKE}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.94">`,
    `<line x1="${formatNumber(centerX)}" y1="${formatNumber(shaftBottomY)}" x2="${formatNumber(centerX)}" y2="${formatNumber(shaftTopY + 12)}" />`,
    `<line x1="${formatNumber(centerX - 10)}" y1="${formatNumber(shaftMidY)}" x2="${formatNumber(centerX + 10)}" y2="${formatNumber(shaftMidY)}" />`,
    `<polygon points="${formatNumber(centerX)},${formatNumber(shaftTopY)} ${formatNumber(centerX - 7)},${formatNumber(shaftTopY + 13)} ${formatNumber(centerX + 7)},${formatNumber(shaftTopY + 13)}" />`,
    `</g>`,
    `<text x="${formatNumber(centerX)}" y="${formatNumber(labelY)}" text-anchor="middle" fill="${SVG_ROOM_STROKE}" opacity="0.94" font-family="${SVG_SANS_FONT_FAMILY}" font-size="26" font-weight="700">N</text>`,
    `</g>`,
  ].join("\n");
}

function getMaxSvgDoorSwingClearanceMm(rooms: Room[]): number {
  let maxDoorWidthMm = 0;

  for (const room of rooms) {
    for (const opening of room.openings) {
      if (opening.type !== "door") continue;
      maxDoorWidthMm = Math.max(maxDoorWidthMm, opening.widthMm);
    }
  }

  return maxDoorWidthMm;
}

function normalizeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeSvgTextWithSuperscriptTwo(value: string): string {
  return normalizeSvgText(value).replace(/²/g, `<tspan baseline-shift="super" font-size="9">2</tspan>`);
}

function resolveRenderer(source: PixiPngExportSource): Renderer {
  if ("extract" in source) return source;
  return source.renderer;
}

function resolveTarget(source: PixiPngExportSource): Container | undefined {
  if ("extract" in source) return undefined;
  return source.stage;
}

function getNormalizedPadding(paddingPx: number | undefined): number {
  if (typeof paddingPx !== "number" || !Number.isFinite(paddingPx)) {
    return DEFAULT_EXPORT_PADDING_PX;
  }

  return Math.max(0, Math.round(paddingPx));
}

function composeExportCanvas(
  sourceCanvas: ICanvas,
  options: PixiPngExportOptions = {}
): HTMLCanvasElement {
  const paddingPx = getNormalizedPadding(options.paddingPx);
  const edgeCropPx =
    sourceCanvas.width > DEFAULT_EDGE_CROP_PX * 2 && sourceCanvas.height > DEFAULT_EDGE_CROP_PX * 2
      ? DEFAULT_EDGE_CROP_PX
      : 0;
  const sourceX = edgeCropPx;
  const sourceY = edgeCropPx;
  const sourceWidth = sourceCanvas.width - edgeCropPx * 2;
  const sourceHeight = sourceCanvas.height - edgeCropPx * 2;
  const baseExportWidth = Math.max(1, sourceWidth + paddingPx * 2);
  const measurementCanvas = document.createElement("canvas");
  const measurementContext = measurementCanvas.getContext("2d");
  if (!measurementContext) {
    throw new Error("Pixi PNG export failed: unable to acquire 2D export context.");
  }

  const footerGapPx = getSectionGap(paddingPx);
  const legendPosition = options.legend?.position === "right-side" ? "right-side" : "bottom";
  const northIndicatorBlock = buildNorthIndicatorBlock(options.northIndicator);
  const topRightReservedWidth = northIndicatorBlock ? northIndicatorBlock.width + footerGapPx : 0;
  const headerBlock = buildHeaderBlock(
    measurementContext,
    Math.max(220, sourceWidth - topRightReservedWidth),
    options.header
  );
  const sideLegendMaxWidth = Math.max(220, Math.min(320, Math.floor(sourceWidth * 0.32)));
  const legendBlock = buildLegendBlock(
    measurementContext,
    legendPosition === "right-side"
      ? sideLegendMaxWidth
      : Math.max(220, baseExportWidth - paddingPx * 2 - 168),
    options.legend
  );
  const scaleBarBlock = buildScaleBarBlock(options.scaleBar);
  const signatureBlock = buildSignatureBlock(measurementContext, options.signature, paddingPx);
  const rightLegendWidth = legendPosition === "right-side" ? legendBlock?.width ?? 0 : 0;
  const rightColumnGapPx = rightLegendWidth > 0 ? footerGapPx : 0;
  const exportWidth = Math.max(1, sourceWidth + paddingPx * 2 + rightColumnGapPx + rightLegendWidth);
  const bottomLeftBlockHeight =
    legendPosition === "bottom" ? getBottomLeftBlockHeight(scaleBarBlock, legendBlock) : scaleBarBlock?.height ?? 0;
  const topSectionContentHeight = Math.max(headerBlock?.height ?? 0, northIndicatorBlock?.height ?? 0);
  const topSectionHeight = topSectionContentHeight > 0 ? topSectionContentHeight + footerGapPx : 0;
  const bottomContentHeight = Math.max(bottomLeftBlockHeight, signatureBlock?.height ?? 0);
  const bottomSectionHeight = bottomContentHeight > 0 ? footerGapPx + bottomContentHeight : 0;
  const baseExportHeight = Math.max(
    1,
    sourceHeight + paddingPx * 2 + topSectionHeight + bottomSectionHeight
  );
  const rightLegendHeight =
    legendPosition === "right-side" ? paddingPx * 2 + topSectionHeight + (legendBlock?.height ?? 0) : 0;
  const rightLegendWithSignatureHeight =
    legendPosition === "right-side" && legendBlock && signatureBlock
      ? paddingPx * 2 + topSectionHeight + legendBlock.height + footerGapPx + signatureBlock.height
      : 0;
  const exportHeight = Math.max(baseExportHeight, rightLegendHeight, rightLegendWithSignatureHeight);
  const composedCanvas = document.createElement("canvas");
  composedCanvas.width = exportWidth;
  composedCanvas.height = exportHeight;

  const context = composedCanvas.getContext("2d");
  if (!context) {
    throw new Error("Pixi PNG export failed: unable to acquire 2D export context.");
  }

  context.imageSmoothingEnabled = false;
  context.fillStyle = options.backgroundColor ?? DEFAULT_EXPORT_BACKGROUND;
  context.fillRect(0, 0, exportWidth, exportHeight);
  drawExportGrid(context, exportWidth, exportHeight, options.grid, paddingPx - edgeCropPx + topSectionHeight);

  if (headerBlock) {
    drawLeftAlignedTextBlock(context, headerBlock, paddingPx, paddingPx);
  }

  if (northIndicatorBlock) {
    drawNorthIndicatorBlock(
      context,
      northIndicatorBlock,
      exportWidth - paddingPx - northIndicatorBlock.width,
      paddingPx
    );
  }

  context.drawImage(
    sourceCanvas as unknown as CanvasImageSource,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    paddingPx,
    paddingPx + topSectionHeight,
    sourceWidth,
    sourceHeight
  );

  const bottomLeftStartY = exportHeight - paddingPx - bottomLeftBlockHeight;
  if (scaleBarBlock) {
    drawScaleBarBlock(context, scaleBarBlock, paddingPx, bottomLeftStartY);
  }

  if (legendBlock && legendPosition === "bottom") {
    drawLeftAlignedTextBlock(
      context,
      legendBlock,
      paddingPx,
      bottomLeftStartY + (scaleBarBlock ? scaleBarBlock.height + getBottomLeftBlockGap() : 0)
    );
  }

  if (legendBlock && legendPosition === "right-side") {
    drawLeftAlignedTextBlock(
      context,
      legendBlock,
      paddingPx + sourceWidth + rightColumnGapPx,
      paddingPx + topSectionHeight
    );
  }

  drawExportSignature(context, exportWidth, exportHeight, signatureBlock, paddingPx);

  return composedCanvas;
}

export function renderPixiCanvasToCanvas(
  source: PixiPngExportSource,
  options: PixiPngExportOptions = {}
): HTMLCanvasElement {
  return composeExportCanvas(extractSourceCanvas(source), options);
}

function drawExportGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: PixiPngExportOptions["grid"],
  sourceOffsetPx: number
) {
  if (!grid) return;
  if (!Number.isFinite(grid.spacingPx) || grid.spacingPx < 4) return;

  const spacingPx = grid.spacingPx;
  const alpha = typeof grid.alpha === "number" ? Math.max(0, Math.min(1, grid.alpha)) : 0.1;
  const startX = sourceOffsetPx + grid.originXPx;
  const startY = sourceOffsetPx + grid.originYPx;
  const firstVertical = normalizeFirstGridLine(startX, spacingPx, 0);
  const firstHorizontal = normalizeFirstGridLine(startY, spacingPx, 0);

  context.save();
  context.strokeStyle = grid.color;
  context.globalAlpha = alpha;
  context.lineWidth = 1;
  context.beginPath();

  for (let x = firstVertical; x <= width; x += spacingPx) {
    const alignedX = Math.round(x) + 0.5;
    context.moveTo(alignedX, 0);
    context.lineTo(alignedX, height);
  }

  for (let y = firstHorizontal; y <= height; y += spacingPx) {
    const alignedY = Math.round(y) + 0.5;
    context.moveTo(0, alignedY);
    context.lineTo(width, alignedY);
  }

  context.stroke();
  context.restore();
}

function normalizeFirstGridLine(start: number, spacing: number, minValue: number): number {
  const normalized = ((start - minValue) % spacing + spacing) % spacing;
  return minValue + normalized;
}

function drawExportSignature(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  signatureBlock: ExportTextBlock | null,
  paddingPx: number
) {
  if (!signatureBlock) return;

  const horizontalInset = Math.max(12, Math.floor(paddingPx * 0.33));
  const baselineInset = Math.max(10, Math.floor(paddingPx * 0.24));
  const lineGapPx = 4;

  context.save();
  context.textAlign = "right";
  context.textBaseline = "alphabetic";

  let y = height - baselineInset;
  for (let index = signatureBlock.lines.length - 1; index >= 0; index -= 1) {
    const line = signatureBlock.lines[index];
    context.font = line.font;
    context.fillStyle = line.color;
    context.globalAlpha = line.alpha ?? 1;
    context.fillText(line.text, width - horizontalInset, y);
    y -= getFontSizePx(line.font) + (index > 0 ? lineGapPx : 0);
  }

  context.restore();
}

function buildHeaderBlock(
  context: CanvasRenderingContext2D,
  maxWidth: number,
  header: PixiPngExportOptions["header"]
): ExportTextBlock | null {
  if (!header) return null;

  const title = header.title?.trim() ?? "";
  const description = header.description?.trim() ?? "";
  if (!title && !description) return null;

  const lines: ExportTextLine[] = [];
  const titleFont = `700 30px ${EXPORT_TEXT_FONT_FAMILY}`;
  const descriptionFont = `400 16px ${EXPORT_TEXT_FONT_FAMILY}`;

  if (title) {
    for (const line of wrapText(context, title, titleFont, maxWidth)) {
      lines.push({
        text: line,
        font: titleFont,
        color: header.color,
        gapAfterPx: 2,
      });
    }
  }

  if (description) {
    if (lines.length > 0) {
      lines[lines.length - 1].gapAfterPx = 12;
    }

    const paragraphs = description
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    paragraphs.forEach((paragraph, paragraphIndex) => {
      for (const line of wrapText(context, paragraph, descriptionFont, maxWidth)) {
        lines.push({
          text: line,
          font: descriptionFont,
          color: header.mutedColor,
          alpha: 0.92,
        });
      }

      if (paragraphIndex < paragraphs.length - 1 && lines.length > 0) {
        lines[lines.length - 1].gapAfterPx = 8;
      }
    });
  }

  return lines.length > 0
    ? {
        lines,
        height: getTextBlockHeight(lines),
        width: getTextBlockWidth(context, lines),
      }
    : null;
}

function buildLegendBlock(
  context: CanvasRenderingContext2D,
  maxWidth: number,
  legend: PixiPngExportOptions["legend"]
): ExportTextBlock | null {
  if (!legend || legend.items.length === 0) return null;

  const lines: ExportTextLine[] = [
    {
      text: "Legend",
      font: `600 12px ${MEASUREMENT_TEXT_FONT_FAMILY}`,
      color: legend.color,
      gapAfterPx: 10,
    },
  ];
  const nameFont = `500 14px ${EXPORT_TEXT_FONT_FAMILY}`;
  const areaFont = `600 12px ${MEASUREMENT_TEXT_FONT_FAMILY}`;
  const nameWidth = Math.max(120, maxWidth - 12);

  legend.items.forEach((item, itemIndex) => {
    const wrappedName = wrapText(context, item.name, nameFont, nameWidth);
    wrappedName.forEach((line, lineIndex) => {
      lines.push({
        text: `${lineIndex === 0 ? "\u2022 " : "   "}${line}`,
        font: nameFont,
        color: legend.color,
        gapAfterPx: lineIndex === wrappedName.length - 1 ? 1 : 0,
      });
    });

    lines.push({
      text: item.area,
      font: areaFont,
      color: legend.mutedColor,
      alpha: 0.94,
      gapAfterPx: itemIndex < legend.items.length - 1 ? 10 : 0,
    });
  });

  return {
    lines,
    height: getTextBlockHeight(lines),
    width: getTextBlockWidth(context, lines),
  };
}

function buildScaleBarBlock(
  scaleBar: PixiPngExportOptions["scaleBar"]
): ExportScaleBarBlock | null {
  if (!scaleBar) return null;
  if (!Number.isFinite(scaleBar.widthPx) || scaleBar.widthPx <= 0) return null;

  return {
    widthPx: Math.max(1, Math.round(scaleBar.widthPx)),
    label: scaleBar.label.trim(),
    color: scaleBar.color,
    mutedColor: scaleBar.mutedColor,
    height: 31,
  };
}

function buildNorthIndicatorBlock(
  northIndicator: PixiPngExportOptions["northIndicator"]
): ExportNorthIndicatorBlock | null {
  if (!northIndicator) return null;
  if (!Number.isFinite(northIndicator.bearingDegrees)) return null;

  return {
    bearingDegrees: normalizeNorthBearingDegrees(northIndicator.bearingDegrees),
    color: northIndicator.color,
    mutedColor: northIndicator.mutedColor,
    width: 72,
    height: 96,
  };
}

function buildSignatureBlock(
  context: CanvasRenderingContext2D,
  signature: PixiPngExportOptions["signature"],
  paddingPx: number
): ExportTextBlock | null {
  if (!signature) return null;

  const lines = signature.lines.map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const alpha = typeof signature.alpha === "number" ? Math.max(0, Math.min(1, signature.alpha)) : 0.7;
  const primaryFontSizePx = Math.max(11, Math.min(14, Math.floor(paddingPx * 0.24)));
  const secondaryFontSizePx = Math.max(10, primaryFontSizePx - 1);
  const textLines = lines.map<ExportTextLine>((line, index) => {
    const isBrandLine = index === lines.length - 2 && lines.length > 1;
    const fontSizePx = isBrandLine ? primaryFontSizePx : secondaryFontSizePx;
    const fontWeight = isBrandLine ? 600 : 500;

    return {
      text: line,
      font: `${fontWeight} ${fontSizePx}px ${MEASUREMENT_TEXT_FONT_FAMILY}`,
      color: signature.color,
      alpha,
    };
  });

  return {
    lines: textLines,
    height: getTextBlockHeight(textLines, 4),
    width: getTextBlockWidth(context, textLines),
  };
}

function drawLeftAlignedTextBlock(
  context: CanvasRenderingContext2D,
  block: ExportTextBlock,
  x: number,
  y: number
) {
  context.save();
  context.textAlign = "left";
  context.textBaseline = "top";

  let cursorY = y;
  for (const line of block.lines) {
    context.font = line.font;
    context.fillStyle = line.color;
    context.globalAlpha = line.alpha ?? 1;
    context.fillText(line.text, x, cursorY);
    cursorY += getLineHeightPx(line.font) + (line.gapAfterPx ?? 0);
  }

  context.restore();
}

function drawScaleBarBlock(
  context: CanvasRenderingContext2D,
  block: ExportScaleBarBlock,
  x: number,
  y: number
) {
  const labelFont = `500 11px ${MEASUREMENT_TEXT_FONT_FAMILY}`;
  const lineTopY = y + 18.5;

  context.save();
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = labelFont;
  context.fillStyle = block.color;
  context.globalAlpha = 0.78;
  context.fillText(block.label, x, y);

  context.strokeStyle = block.color;
  context.globalAlpha = 0.72;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x + 0.5, lineTopY + 8);
  context.lineTo(x + 0.5, lineTopY);
  context.lineTo(x + block.widthPx - 0.5, lineTopY);
  context.lineTo(x + block.widthPx - 0.5, lineTopY + 8);
  context.stroke();
  context.restore();
}

function drawNorthIndicatorBlock(
  context: CanvasRenderingContext2D,
  block: ExportNorthIndicatorBlock,
  x: number,
  y: number
) {
  const centerX = x + block.width / 2;
  const labelY = y + 1;
  const shaftBottomY = y + block.height - 18;
  const shaftLengthPx = 52;
  const shaftTopY = shaftBottomY - shaftLengthPx;
  const shaftMidY = shaftTopY + shaftLengthPx / 2;
  const rotationCenterY = shaftTopY + shaftLengthPx / 2;
  const rotationRadians = (block.bearingDegrees * Math.PI) / 180;
  const labelFont = `700 26px ${MEASUREMENT_TEXT_FONT_FAMILY}`;

  context.save();
  context.translate(centerX, rotationCenterY);
  context.rotate(rotationRadians);
  context.translate(-centerX, -rotationCenterY);

  context.strokeStyle = block.color;
  context.fillStyle = block.color;
  context.lineWidth = 1.5;
  context.lineCap = "round";
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(centerX, shaftBottomY);
  context.lineTo(centerX, shaftTopY + 12);
  context.stroke();

  context.beginPath();
  context.moveTo(centerX - 10, shaftMidY);
  context.lineTo(centerX + 10, shaftMidY);
  context.stroke();

  context.beginPath();
  context.moveTo(centerX, shaftTopY);
  context.lineTo(centerX - 7, shaftTopY + 13);
  context.lineTo(centerX + 7, shaftTopY + 13);
  context.closePath();
  context.fill();

  context.restore();

  context.save();
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = labelFont;
  context.fillStyle = block.color;
  context.globalAlpha = 0.94;
  context.fillText("N", centerX, labelY);
  context.restore();
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number
): string[] {
  const normalizedText = text.trim();
  if (!normalizedText) return [];

  context.save();
  context.font = font;

  const words = normalizedText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidateLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidateLine).width <= maxWidth || !currentLine) {
      currentLine = candidateLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  context.restore();
  return lines;
}

function getTextBlockHeight(lines: ExportTextLine[], defaultGapPx = 0) {
  return lines.reduce((total, line) => {
    return total + getLineHeightPx(line.font) + (line.gapAfterPx ?? defaultGapPx);
  }, 0);
}

function getTextBlockWidth(context: CanvasRenderingContext2D, lines: ExportTextLine[]) {
  let width = 0;

  context.save();
  for (const line of lines) {
    context.font = line.font;
    width = Math.max(width, context.measureText(line.text).width);
  }
  context.restore();

  return Math.ceil(width);
}

function getLineHeightPx(font: string) {
  const fontSizePx = getFontSizePx(font);
  if (fontSizePx >= 20) return fontSizePx + 6;
  if (fontSizePx >= 13) return fontSizePx + 5;
  return fontSizePx + 4;
}

function getFontSizePx(font: string) {
  const match = font.match(/(\d+)px/);
  return match ? Number(match[1]) : 12;
}

function getSectionGap(paddingPx: number) {
  return Math.max(18, Math.floor(paddingPx * 0.42));
}

function getBottomLeftBlockGap() {
  return 16;
}

function getBottomLeftBlockHeight(
  scaleBarBlock: ExportScaleBarBlock | null,
  legendBlock: ExportTextBlock | null
) {
  if (scaleBarBlock && legendBlock) {
    return scaleBarBlock.height + getBottomLeftBlockGap() + legendBlock.height;
  }

  return scaleBarBlock?.height ?? legendBlock?.height ?? 0;
}

/**
 * Resizes a canvas to the standard export width (1280px) while preserving aspect ratio.
 * Height is calculated automatically based on the canvas's current aspect ratio.
 */
function resizeCanvasToStandardExportDimensions(sourceCanvas: ICanvas, exportResolution?: EditorExportResolution): HTMLCanvasElement {
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("Cannot resize canvas with invalid dimensions");
  }

  // Calculate export width based on resolution
  const baseWidth = STANDARD_EXPORT_WIDTH_PX;
  const exportWidth = exportResolution === "hi-res" ? baseWidth * 4 : baseWidth;
  
  // Calculate height to preserve aspect ratio
  const scale = exportWidth / sourceWidth;
  const exportHeight = Math.max(1, Math.round(sourceHeight * scale));

  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = exportWidth;
  resizedCanvas.height = exportHeight;

  const context = resizedCanvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get 2D context for export canvas resize");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(sourceCanvas as unknown as CanvasImageSource, 0, 0, exportWidth, exportHeight);

  return resizedCanvas;
}

function extractSourceCanvas(source: PixiPngExportSource): ICanvas {
  const renderer = resolveRenderer(source);
  const target = resolveTarget(source);

  return target
    ? renderer.extract.canvas({
        target,
      })
    : renderer.canvas;
}

async function canvasToPngBlob(canvas: ICanvas): Promise<Blob> {
  if (canvas.convertToBlob) {
    return canvas.convertToBlob({
      type: "image/png",
    });
  }

  const toBlob = canvas.toBlob;

  if (toBlob) {
    return new Promise<Blob>((resolve, reject) => {
      toBlob.call(canvas, (blob) => {
        if (!blob) {
          reject(new Error("Pixi PNG export failed: canvas produced an empty blob."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  }

  if (!canvas.toDataURL) {
    throw new Error("Pixi PNG export failed: canvas does not support blob or data URL export.");
  }

  const dataUrl = canvas.toDataURL("image/png");
  const response = await fetch(dataUrl);
  return response.blob();
}

async function renderSvgToCanvas(svg: string): Promise<HTMLCanvasElement> {
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(svg, "image/svg+xml");
  const parserError = parsedDocument.querySelector("parsererror");
  if (parserError) {
    throw new Error("SVG PNG export failed: generated SVG is invalid.");
  }

  const pageSize = getSvgPageSize(parsedDocument.documentElement as unknown as SVGSVGElement);
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = pageSize.width;
  canvas.height = pageSize.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("SVG PNG export failed: unable to acquire 2D export context.");
  }

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  image.decoding = "async";
  const imageLoad = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("SVG PNG export failed: unable to render SVG image."));
  });

  try {
    image.src = svgUrl;
    await imageLoad;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, pageSize.width, pageSize.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export async function exportSvgToPngDataUrl(
  svg: string,
  options: { exportResolution?: EditorExportResolution } = {}
): Promise<string> {
  const canvas = await renderSvgToCanvas(svg);
  const standardizedCanvas = resizeCanvasToStandardExportDimensions(canvas, options.exportResolution);
  return standardizedCanvas.toDataURL("image/png");
}

export async function exportSvgToPngBlob(
  svg: string,
  options: { exportResolution?: EditorExportResolution } = {}
): Promise<Blob> {
  const canvas = await renderSvgToCanvas(svg);
  const standardizedCanvas = resizeCanvasToStandardExportDimensions(canvas, options.exportResolution);
  return canvasToPngBlob(standardizedCanvas);
}

export async function exportPixiCanvasToPngDataUrl(
  source: PixiPngExportSource,
  options: PixiPngExportOptions = {}
): Promise<string> {
  const composedCanvas = renderPixiCanvasToCanvas(source, options);
  const standardizedCanvas = resizeCanvasToStandardExportDimensions(composedCanvas, options.exportResolution);
  const toDataUrl = standardizedCanvas.toDataURL;

  if (!toDataUrl) {
    throw new Error("Pixi PNG export failed: canvas does not support data URL export.");
  }

  return toDataUrl.call(standardizedCanvas, "image/png");
}

export async function exportPixiCanvasToPngBlob(
  source: PixiPngExportSource,
  options: PixiPngExportOptions = {}
): Promise<Blob> {
  const composedCanvas = renderPixiCanvasToCanvas(source, options);
  const standardizedCanvas = resizeCanvasToStandardExportDimensions(composedCanvas, options.exportResolution);
  return canvasToPngBlob(standardizedCanvas);
}

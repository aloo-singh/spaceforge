import type { Container, ICanvas, Renderer } from "pixi.js";
import { MEASUREMENT_TEXT_FONT_FAMILY } from "@/lib/fonts";
import { normalizeCanvasRotationDegrees } from "@/lib/editor/canvasRotation";
import {
  DEFAULT_STAIR_ARROW_DIRECTION,
  DEFAULT_STAIR_ARROW_ENABLED,
  DEFAULT_STAIR_TREAD_SPACING_MM,
  getInteriorAssetDisplayName,
  getStairRunLengthMm,
} from "@/lib/editor/interiorAssets";
import { normalizeNorthBearingDegrees } from "@/lib/editor/north";
import type {
  EditorExportAssetMode,
  EditorExportFormat,
  EditorExportResolution,
} from "@/lib/editor/exportPreferences";
import { getLayoutBoundsFromRooms } from "@/lib/editor/exportLayoutBounds";
import { getResolvedRoomOpeningLayout } from "@/lib/editor/openings";
import { getPolygonLabelAnchor } from "@/lib/editor/roomGeometry";
import type { Point, Room, RoomInteriorAsset } from "@/lib/editor/types";

export type PixiPngExportSource =
  | Renderer
  | {
      renderer: Renderer;
      stage?: Container;
    };

export type PixiPngExportOptions = {
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
const EXPORT_TEXT_FONT_FAMILY = "system-ui, sans-serif";
const STANDARD_EXPORT_WIDTH_PX = 1280;
const SVG_EXPORT_PADDING_PX = 64;
const SVG_ROOM_FILL = "#f8fafc";
const SVG_ROOM_STROKE = "#0f172a";
const SVG_MUTED_STROKE = "#64748b";
const SVG_ASSET_FILL = "#eef2f7";
const SVG_ASSET_DETAIL_FILL = "#dbe4ee";
const SVG_SCALE_BAR_HEIGHT_PX = 72;
const PDF_EXPORT_FLOAT_PRECISION = 3;

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

export type SvgExportOptions = {
  rooms: Room[];
  title?: string;
  exportAssetMode?: EditorExportAssetMode;
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
  format,
}: {
  projectName?: string;
  floorName?: string;
  format: EditorExportFormat;
}): string {
  const safeProjectName = sanitizeExportFilenamePart(projectName) || "Untitled project";
  const safeFloorName = sanitizeExportFilenamePart(floorName) || "Floor 1";
  return `${safeProjectName} - ${safeFloorName}.${getEditorExportFileExtension(format)}`;
}

export function exportToSVG({ rooms, title, exportAssetMode = "all" }: SvgExportOptions): string {
  const bounds = getLayoutBoundsFromRooms(rooms);
  const drawableWidth = STANDARD_EXPORT_WIDTH_PX - SVG_EXPORT_PADDING_PX * 2;
  const layoutWidthMm = Math.max(bounds?.width ?? 1, 1);
  const layoutHeightMm = Math.max(bounds?.height ?? 1, 1);
  const scale = drawableWidth / layoutWidthMm;
  const exportWidth = STANDARD_EXPORT_WIDTH_PX;
  const exportHeight = Math.max(
    1,
    Math.ceil(layoutHeightMm * scale + SVG_EXPORT_PADDING_PX * 2 + SVG_SCALE_BAR_HEIGHT_PX)
  );
  const originX = bounds?.minX ?? 0;
  const originY = bounds?.minY ?? 0;
  const svgTitle = normalizeSvgText(title || "spaceforge export");

  const projectPoint = (point: Point): Point => ({
    x: SVG_EXPORT_PADDING_PX + (point.x - originX) * scale,
    y: SVG_EXPORT_PADDING_PX + (point.y - originY) * scale,
  });

  const formatNumber = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");

  const pointToString = (point: Point) => {
    const projectedPoint = projectPoint(point);
    return `${formatNumber(projectedPoint.x)},${formatNumber(projectedPoint.y)}`;
  };

  const elements: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}" role="img" aria-labelledby="title">`,
    `<title id="title">${svgTitle}</title>`,
    `<rect width="100%" height="100%" fill="#ffffff" />`,
  ];

  for (const room of rooms) {
    if (room.points.length < 3) continue;

    const polygonPoints = room.points.map(pointToString).join(" ");
    elements.push(
      `<polygon points="${polygonPoints}" fill="${SVG_ROOM_FILL}" stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linejoin="round" />`
    );

    for (let index = 0; index < room.points.length; index += 1) {
      const start = projectPoint(room.points[index]);
      const end = projectPoint(room.points[(index + 1) % room.points.length]);
      elements.push(
        `<line x1="${formatNumber(start.x)}" y1="${formatNumber(start.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linecap="round" />`
      );
    }

    for (const opening of room.openings) {
      const layout = getResolvedRoomOpeningLayout(room, opening);
      if (!layout) continue;

      const start = projectPoint(layout.start);
      const end = projectPoint(layout.end);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      const normalX = length > 0 ? -dy / length : 0;
      const normalY = length > 0 ? dx / length : 0;
      const markerOffset = opening.type === "window" ? 4 : 10;

      elements.push(
        `<line x1="${formatNumber(start.x)}" y1="${formatNumber(start.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />`
      );

      if (opening.type === "window") {
        elements.push(
          `<line x1="${formatNumber(start.x + normalX * markerOffset)}" y1="${formatNumber(start.y + normalY * markerOffset)}" x2="${formatNumber(end.x + normalX * markerOffset)}" y2="${formatNumber(end.y + normalY * markerOffset)}" stroke="${SVG_MUTED_STROKE}" stroke-width="1.5" stroke-linecap="round" />`,
          `<line x1="${formatNumber(start.x - normalX * markerOffset)}" y1="${formatNumber(start.y - normalY * markerOffset)}" x2="${formatNumber(end.x - normalX * markerOffset)}" y2="${formatNumber(end.y - normalY * markerOffset)}" stroke="${SVG_MUTED_STROKE}" stroke-width="1.5" stroke-linecap="round" />`
        );
      } else {
        const hinge = opening.hingeSide === "end" ? end : start;
        const openEnd = opening.hingeSide === "end" ? start : end;
        const radius = Math.min(length, 42);
        const swingEnd = {
          x: hinge.x + normalX * radius,
          y: hinge.y + normalY * radius,
        };
        elements.push(
          `<line x1="${formatNumber(hinge.x)}" y1="${formatNumber(hinge.y)}" x2="${formatNumber(swingEnd.x)}" y2="${formatNumber(swingEnd.y)}" stroke="${SVG_MUTED_STROKE}" stroke-width="1.5" stroke-linecap="round" />`,
          `<path d="M ${formatNumber(swingEnd.x)} ${formatNumber(swingEnd.y)} A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(openEnd.x)} ${formatNumber(openEnd.y)}" fill="none" stroke="${SVG_MUTED_STROKE}" stroke-width="1.25" stroke-linecap="round" />`
        );
      }
    }

    const labelAnchor = getPolygonLabelAnchor(room.points);
    if (labelAnchor) {
      const labelPoint = projectPoint(labelAnchor);
      elements.push(
        `<text x="${formatNumber(labelPoint.x)}" y="${formatNumber(labelPoint.y)}" text-anchor="middle" dominant-baseline="middle" fill="${SVG_ROOM_STROKE}" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600">${normalizeSvgText(room.name || "Room")}</text>`
      );
    }

    if (exportAssetMode !== "none") {
      for (const asset of room.interiorAssets) {
        if (exportAssetMode === "stairs-only" && asset.type !== "stairs") continue;
        elements.push(...buildSvgInteriorAssetElements(asset, projectPoint, scale, formatNumber));
      }
    }
  }

  const scaleBar = buildSvgScaleBar(scale, exportHeight, formatNumber);
  if (scaleBar) {
    elements.push(scaleBar);
  }

  elements.push("</svg>");
  return elements.join("\n");
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
  const document = parser.parseFromString(svg, "image/svg+xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error("PDF export failed: generated SVG is invalid.");
  }

  const svgElement = document.documentElement as unknown as SVGSVGElement;
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

function sanitizeExportFilenamePart(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .slice(0, 80);
}

function buildSvgInteriorAssetElements(
  asset: RoomInteriorAsset,
  projectPoint: (point: Point) => Point,
  scale: number,
  formatNumber: (value: number) => string
): string[] {
  const center = projectPoint({ x: asset.xMm, y: asset.yMm });
  const widthPx = Math.max(asset.widthMm * scale, 1);
  const depthPx = Math.max(asset.depthMm * scale, 1);
  const halfWidthPx = widthPx / 2;
  const halfDepthPx = depthPx / 2;
  const rotation = normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0);
  const label = normalizeSvgText(asset.name || getInteriorAssetDisplayName(asset.type));
  const elements: string[] = [
    `<g transform="translate(${formatNumber(center.x)} ${formatNumber(center.y)}) rotate(${formatNumber(rotation)})">`,
  ];

  const rect = (options?: { fill?: string; stroke?: string; strokeWidth?: number }) =>
    `<rect x="${formatNumber(-halfWidthPx)}" y="${formatNumber(-halfDepthPx)}" width="${formatNumber(widthPx)}" height="${formatNumber(depthPx)}" rx="4" fill="${options?.fill ?? SVG_ASSET_FILL}" stroke="${options?.stroke ?? SVG_ROOM_STROKE}" stroke-width="${formatNumber(options?.strokeWidth ?? 1.5)}" />`;
  const line = (x1: number, y1: number, x2: number, y2: number, width = 1.25) =>
    `<line x1="${formatNumber(x1)}" y1="${formatNumber(y1)}" x2="${formatNumber(x2)}" y2="${formatNumber(y2)}" stroke="${SVG_MUTED_STROKE}" stroke-width="${formatNumber(width)}" stroke-linecap="round" />`;

  if (asset.type === "dining-table" && asset.shape === "round") {
    elements.push(
      `<ellipse cx="0" cy="0" rx="${formatNumber(halfWidthPx)}" ry="${formatNumber(halfDepthPx)}" fill="${SVG_ASSET_FILL}" stroke="${SVG_ROOM_STROKE}" stroke-width="1.5" />`,
      line(-halfWidthPx * 0.58, 0, halfWidthPx * 0.58, 0),
      line(0, -halfDepthPx * 0.58, 0, halfDepthPx * 0.58)
    );
  } else {
    elements.push(rect());
  }

  if (asset.type === "bed") {
    const headboardHeight = depthPx * 0.14;
    elements.push(
      `<rect x="${formatNumber(-halfWidthPx)}" y="${formatNumber(-halfDepthPx)}" width="${formatNumber(widthPx)}" height="${formatNumber(headboardHeight)}" rx="3" fill="${SVG_ASSET_DETAIL_FILL}" />`,
      line(-halfWidthPx * 0.5, -halfDepthPx + headboardHeight, -halfWidthPx * 0.5, halfDepthPx),
      line(halfWidthPx * 0.5, -halfDepthPx + headboardHeight, halfWidthPx * 0.5, halfDepthPx)
    );
  }

  if (asset.type === "sofa") {
    const backRestDepth = depthPx * 0.3;
    elements.push(
      `<rect x="${formatNumber(-halfWidthPx)}" y="${formatNumber(-halfDepthPx)}" width="${formatNumber(widthPx)}" height="${formatNumber(backRestDepth)}" rx="3" fill="${SVG_ASSET_DETAIL_FILL}" />`,
      line(-halfWidthPx / 3, -halfDepthPx + backRestDepth, -halfWidthPx / 3, halfDepthPx),
      line(halfWidthPx / 3, -halfDepthPx + backRestDepth, halfWidthPx / 3, halfDepthPx)
    );
  }

  if (asset.type === "wardrobe") {
    if (asset.doorType === "sliding") {
      elements.push(
        line(-halfWidthPx, -halfDepthPx - 5, 0, -halfDepthPx - 5),
        line(0, -halfDepthPx - 8, halfWidthPx, -halfDepthPx - 8)
      );
    } else {
      const leafLength = Math.min(widthPx * 0.4, depthPx * 0.6);
      elements.push(
        line(-halfWidthPx, -halfDepthPx, -halfWidthPx, -halfDepthPx - leafLength),
        line(halfWidthPx, -halfDepthPx, halfWidthPx, -halfDepthPx - leafLength)
      );
    }
  }

  if (asset.type === "dining-table" && asset.shape !== "round") {
    elements.push(
      line(-halfWidthPx * 0.62, 0, halfWidthPx * 0.62, 0),
      line(0, -halfDepthPx * 0.62, 0, halfDepthPx * 0.62)
    );
  }

  if (asset.type === "stairs") {
    const stairRunLengthMm = Math.max(getStairRunLengthMm(asset), 1);
    const isSidewaysStairRun = Math.abs(normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0)) === 90;
    const treadCount = Math.max(0, Math.floor(stairRunLengthMm / DEFAULT_STAIR_TREAD_SPACING_MM) - 1);
    for (let index = 1; index <= treadCount; index += 1) {
      const progress = (index * DEFAULT_STAIR_TREAD_SPACING_MM) / stairRunLengthMm;
      if (progress <= 0 || progress >= 1) continue;
      if (isSidewaysStairRun) {
        const x = -halfWidthPx + widthPx * progress;
        elements.push(line(x, -halfDepthPx, x, halfDepthPx, 1));
      } else {
        const y = -halfDepthPx + depthPx * progress;
        elements.push(line(-halfWidthPx, y, halfWidthPx, y, 1));
      }
    }

    if ((asset.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED) !== false) {
      const direction = asset.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION;
      const arrowDirection = direction === "reverse" ? -1 : 1;
      const runLengthPx = isSidewaysStairRun ? widthPx : depthPx;
      const arrowLength = Math.max(28, Math.min(runLengthPx * 0.58, runLengthPx - 22));
      const tailY = isSidewaysStairRun ? 0 : (arrowLength / 2) * arrowDirection;
      const headY = isSidewaysStairRun ? 0 : (-arrowLength / 2) * arrowDirection;
      const tailX = isSidewaysStairRun ? (-arrowLength / 2) * arrowDirection : 0;
      const headX = isSidewaysStairRun ? (arrowLength / 2) * arrowDirection : 0;
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
        elements.push(
          `<text x="${formatNumber(isSidewaysStairRun ? headX + 16 * headSign : 0)}" y="${formatNumber(isSidewaysStairRun ? 0 : headY - 14 * headSign)}" text-anchor="middle" dominant-baseline="middle" fill="${SVG_ROOM_STROKE}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="11" font-weight="600">${arrowLabel}</text>`
        );
      }
    }
  }

  elements.push("</g>");

  if (asset.type !== "stairs") {
    elements.push(
      `<text x="${formatNumber(center.x)}" y="${formatNumber(center.y + halfDepthPx + 16)}" text-anchor="middle" fill="${SVG_MUTED_STROKE}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="11" font-weight="500">${label}</text>`
    );
  }

  return elements;
}

function buildSvgScaleBar(
  scale: number,
  exportHeight: number,
  formatNumber: (value: number) => string
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
  const x = SVG_EXPORT_PADDING_PX;
  const y = exportHeight - SVG_EXPORT_PADDING_PX + 14;
  const label = lengthMm >= 1_000 ? `${formatNumber(lengthMm / 1_000)} m` : `${lengthMm} mm`;

  return [
    `<g aria-label="Scale bar">`,
    `<line x1="${formatNumber(x)}" y1="${formatNumber(y)}" x2="${formatNumber(x + widthPx)}" y2="${formatNumber(y)}" stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linecap="round" />`,
    `<line x1="${formatNumber(x)}" y1="${formatNumber(y - 6)}" x2="${formatNumber(x)}" y2="${formatNumber(y + 6)}" stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linecap="round" />`,
    `<line x1="${formatNumber(x + widthPx)}" y1="${formatNumber(y - 6)}" x2="${formatNumber(x + widthPx)}" y2="${formatNumber(y + 6)}" stroke="${SVG_ROOM_STROKE}" stroke-width="2" stroke-linecap="round" />`,
    `<text x="${formatNumber(x)}" y="${formatNumber(y + 24)}" fill="${SVG_MUTED_STROKE}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="12" font-weight="500">${label}</text>`,
    `</g>`,
  ].join("\n");
}

function normalizeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

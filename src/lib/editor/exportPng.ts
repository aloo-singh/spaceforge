import type { Container, ICanvas, Renderer } from "pixi.js";
import { MEASUREMENT_TEXT_FONT_FAMILY } from "@/lib/fonts";
import { normalizeNorthBearingDegrees } from "@/lib/editor/north";

export type PixiPngExportSource =
  | Renderer
  | {
      renderer: Renderer;
      stage?: Container;
    };

export type PixiPngExportOptions = {
  backgroundColor?: string;
  paddingPx?: number;
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
  const toDataUrl = composedCanvas.toDataURL;

  if (!toDataUrl) {
    throw new Error("Pixi PNG export failed: canvas does not support data URL export.");
  }

  return toDataUrl.call(composedCanvas, "image/png");
}

export async function exportPixiCanvasToPngBlob(
  source: PixiPngExportSource,
  options: PixiPngExportOptions = {}
): Promise<Blob> {
  const composedCanvas = renderPixiCanvasToCanvas(source, options);
  return canvasToPngBlob(composedCanvas);
}

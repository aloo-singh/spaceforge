import type { Container, ICanvas, Renderer } from "pixi.js";
import { MEASUREMENT_TEXT_FONT_FAMILY } from "@/lib/fonts";

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
    color: string;
    mutedColor: string;
    dividerColor: string;
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
  const exportWidth = Math.max(1, sourceWidth + paddingPx * 2);
  const measurementCanvas = document.createElement("canvas");
  const measurementContext = measurementCanvas.getContext("2d");
  if (!measurementContext) {
    throw new Error("Pixi PNG export failed: unable to acquire 2D export context.");
  }

  const footerGapPx = getSectionGap(paddingPx);
  const headerBlock = buildHeaderBlock(measurementContext, sourceWidth, options.header);
  const legendBlock = buildLegendBlock(
    measurementContext,
    Math.max(220, exportWidth - paddingPx * 2 - 168),
    options.legend
  );
  const signatureBlock = buildSignatureBlock(options.signature, paddingPx);
  const topSectionHeight = headerBlock ? headerBlock.height + footerGapPx : 0;
  const bottomContentHeight = Math.max(legendBlock?.height ?? 0, signatureBlock?.height ?? 0);
  const bottomSectionHeight = bottomContentHeight > 0 ? footerGapPx + bottomContentHeight : 0;
  const exportHeight = Math.max(
    1,
    sourceHeight + paddingPx * 2 + topSectionHeight + bottomSectionHeight
  );
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

  if (legendBlock) {
    drawLeftAlignedTextBlock(
      context,
      legendBlock,
      paddingPx,
      exportHeight - paddingPx - legendBlock.height
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
  const titleFont = `600 22px ${EXPORT_TEXT_FONT_FAMILY}`;
  const descriptionFont = `400 13px ${EXPORT_TEXT_FONT_FAMILY}`;

  if (title) {
    for (const line of wrapText(context, title, titleFont, maxWidth)) {
      lines.push({
        text: line,
        font: titleFont,
        color: header.color,
      });
    }
  }

  if (description) {
    if (lines.length > 0) {
      lines[lines.length - 1].gapAfterPx = 10;
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
        lines[lines.length - 1].gapAfterPx = 6;
      }
    });
  }

  return lines.length > 0
    ? {
        lines,
        height: getTextBlockHeight(lines),
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
      gapAfterPx: 8,
    },
  ];
  const nameFont = `500 13px ${EXPORT_TEXT_FONT_FAMILY}`;
  const areaFont = `500 12px ${MEASUREMENT_TEXT_FONT_FAMILY}`;
  const nameWidth = Math.max(120, maxWidth - 8);

  legend.items.forEach((item, itemIndex) => {
    const wrappedName = wrapText(context, item.name, nameFont, nameWidth);
    wrappedName.forEach((line, lineIndex) => {
      lines.push({
        text: `${lineIndex === 0 ? "\u2022 " : "  "}${line}`,
        font: nameFont,
        color: legend.color,
      });
    });

    lines.push({
      text: item.area,
      font: areaFont,
      color: legend.mutedColor,
      alpha: 0.94,
      gapAfterPx: itemIndex < legend.items.length - 1 ? 6 : 0,
    });
  });

  return {
    lines,
    height: getTextBlockHeight(lines),
  };
}

function buildSignatureBlock(
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

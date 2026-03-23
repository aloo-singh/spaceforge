import type { Container, ICanvas, Renderer } from "pixi.js";

export type PixiPngExportSource =
  | Renderer
  | {
      renderer: Renderer;
      stage?: Container;
    };

export type PixiPngExportOptions = {
  backgroundColor?: string;
  paddingPx?: number;
  signature?: {
    text: string;
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
  const exportHeight = Math.max(1, sourceHeight + paddingPx * 2);
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
  drawExportGrid(context, exportWidth, exportHeight, options.grid, paddingPx - edgeCropPx);
  context.drawImage(
    sourceCanvas as unknown as CanvasImageSource,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    paddingPx,
    paddingPx,
    sourceWidth,
    sourceHeight
  );
  drawExportSignature(context, exportWidth, exportHeight, options.signature, paddingPx);

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
  signature: PixiPngExportOptions["signature"],
  paddingPx: number
) {
  if (!signature) return;
  const trimmedText = signature.text.trim();
  if (!trimmedText) return;

  const label = `Designed by ${trimmedText}`;
  const alpha = typeof signature.alpha === "number" ? Math.max(0, Math.min(1, signature.alpha)) : 0.7;
  const horizontalInset = Math.max(12, Math.floor(paddingPx * 0.33));
  const baselineInset = Math.max(10, Math.floor(paddingPx * 0.28));
  const fontSizePx = Math.max(11, Math.min(14, Math.floor(paddingPx * 0.28)));

  context.save();
  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  context.font = `500 ${fontSizePx}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  context.fillStyle = signature.color;
  context.globalAlpha = alpha;
  context.fillText(label, width - horizontalInset, height - baselineInset);
  context.restore();
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

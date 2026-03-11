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
};

const DEFAULT_EXPORT_BACKGROUND = "#ffffff";
const DEFAULT_EXPORT_PADDING_PX = 48;

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
  const exportWidth = Math.max(1, sourceCanvas.width + paddingPx * 2);
  const exportHeight = Math.max(1, sourceCanvas.height + paddingPx * 2);
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
  context.drawImage(sourceCanvas as unknown as CanvasImageSource, paddingPx, paddingPx);

  return composedCanvas;
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
  const composedCanvas = composeExportCanvas(extractSourceCanvas(source), options);
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
  const composedCanvas = composeExportCanvas(extractSourceCanvas(source), options);
  return canvasToPngBlob(composedCanvas);
}

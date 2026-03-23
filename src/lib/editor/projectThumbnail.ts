import {
  renderPixiCanvasToCanvas,
  type PixiPngExportOptions,
  type PixiPngExportSource,
} from "@/lib/editor/exportPng";

const DEFAULT_THUMBNAIL_WIDTH_PX = 640;
const DEFAULT_THUMBNAIL_HEIGHT_PX = 400;
const DEFAULT_THUMBNAIL_QUALITY = 0.82;

function getThumbnailDimension(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.round(value));
}

export async function exportPixiCanvasToThumbnailDataUrl(
  source: PixiPngExportSource,
  options: PixiPngExportOptions & {
    widthPx?: number;
    heightPx?: number;
    quality?: number;
  } = {}
) {
  const sourceCanvas = renderPixiCanvasToCanvas(source, options);
  const widthPx = getThumbnailDimension(options.widthPx, DEFAULT_THUMBNAIL_WIDTH_PX);
  const heightPx = getThumbnailDimension(options.heightPx, DEFAULT_THUMBNAIL_HEIGHT_PX);
  const thumbnailCanvas = document.createElement("canvas");
  thumbnailCanvas.width = widthPx;
  thumbnailCanvas.height = heightPx;

  const context = thumbnailCanvas.getContext("2d");
  if (!context) {
    throw new Error("Project thumbnail export failed: unable to acquire 2D export context.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = options.backgroundColor ?? "#ffffff";
  context.fillRect(0, 0, widthPx, heightPx);

  const scale = Math.min(widthPx / sourceCanvas.width, heightPx / sourceCanvas.height);
  const drawWidth = Math.max(1, Math.round(sourceCanvas.width * scale));
  const drawHeight = Math.max(1, Math.round(sourceCanvas.height * scale));
  const offsetX = Math.round((widthPx - drawWidth) / 2);
  const offsetY = Math.round((heightPx - drawHeight) / 2);

  context.drawImage(sourceCanvas, offsetX, offsetY, drawWidth, drawHeight);

  const quality =
    typeof options.quality === "number"
      ? Math.max(0.1, Math.min(1, options.quality))
      : DEFAULT_THUMBNAIL_QUALITY;
  const webpDataUrl = thumbnailCanvas.toDataURL("image/webp", quality);
  if (webpDataUrl.startsWith("data:image/webp")) {
    return webpDataUrl;
  }

  return thumbnailCanvas.toDataURL("image/png");
}

import type { Container, ICanvas, Renderer } from "pixi.js";

export type PixiPngExportSource =
  | Renderer
  | {
      renderer: Renderer;
      stage?: Container;
    };

function resolveRenderer(source: PixiPngExportSource): Renderer {
  if ("extract" in source) return source;
  return source.renderer;
}

function resolveTarget(source: PixiPngExportSource): Container | undefined {
  if ("extract" in source) return undefined;
  return source.stage;
}

async function canvasToPngBlob(canvas: ICanvas): Promise<Blob> {
  if (canvas.convertToBlob) {
    return canvas.convertToBlob({
      type: "image/png",
    });
  }

  if (canvas.toBlob) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
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

export async function exportPixiCanvasToPngDataUrl(source: PixiPngExportSource): Promise<string> {
  const renderer = resolveRenderer(source);
  const target = resolveTarget(source);

  if (target) {
    return renderer.extract.base64({
      target,
      format: "png",
    });
  }

  return renderer.extract.base64({
    format: "png",
  });
}

export async function exportPixiCanvasToPngBlob(source: PixiPngExportSource): Promise<Blob> {
  const renderer = resolveRenderer(source);
  const target = resolveTarget(source);
  const canvas = target
    ? renderer.extract.canvas({
        target,
      })
    : renderer.extract.canvas({});

  return canvasToPngBlob(canvas);
}

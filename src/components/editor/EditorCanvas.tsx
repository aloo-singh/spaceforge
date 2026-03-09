"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import { Application, Graphics } from "pixi.js";
import { screenToWorld } from "@/lib/editor/camera";
import { GRID_MINOR_SIZE_MM, GRID_SIZE_MM } from "@/lib/editor/constants";
import { attachPanZoomInput } from "@/lib/editor/input/panZoomInput";
import { getEditorCanvasTheme, resolveEditorThemeMode, type EditorCanvasTheme } from "@/lib/editor/theme";
import type { CameraState, ViewportSize } from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";

export default function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const instructionsId = "editor-canvas-controls";
  const { resolvedTheme } = useTheme();
  const editorTheme = useMemo(
    () => getEditorCanvasTheme(resolveEditorThemeMode(resolvedTheme)),
    [resolvedTheme]
  );
  const editorThemeRef = useRef(editorTheme);

  useEffect(() => {
    editorThemeRef.current = editorTheme;
  }, [editorTheme]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const resizeTarget: HTMLElement = host;

    let destroyed = false;
    let initialized = false;

    const app = new Application();

    async function init() {
      await app.init({
        resizeTo: resizeTarget,
        background: editorThemeRef.current.canvasBackground,
        antialias: true,
      });
      initialized = true;

      if (destroyed || !containerRef.current) {
        app.destroy(true, { children: true });
        return;
      }

      appRef.current = app;
      containerRef.current.appendChild(app.canvas);
      app.canvas.style.touchAction = "none";

      const grid = new Graphics();
      gridRef.current = grid;
      app.stage.addChild(grid);

      const syncViewport = () => {
        useEditorStore.getState().setViewport(app.screen.width, app.screen.height);
      };

      syncViewport();
      drawGrid(
        grid,
        useEditorStore.getState().camera,
        useEditorStore.getState().viewport,
        editorThemeRef.current
      );

      const handleResize = () => {
        syncViewport();
      };

      app.renderer.on("resize", handleResize);

      const unsubscribe = useEditorStore.subscribe((state) => {
        drawGrid(grid, state.camera, state.viewport, editorThemeRef.current);
      });
      const detachPanZoomInput = attachPanZoomInput(app.canvas, useEditorStore);

      return () => {
        detachPanZoomInput();
        unsubscribe();
        app.renderer.off("resize", handleResize);
        appRef.current = null;
        gridRef.current = null;
      };
    }

    let teardown: (() => void) | undefined;
    init().then((cleanup) => {
      teardown = cleanup;
    });

    return () => {
      destroyed = true;
      teardown?.();
      if (initialized) {
        app.destroy(true, { children: true });
      }
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    const grid = gridRef.current;
    if (!app || !grid) return;

    app.renderer.background.color = editorTheme.canvasBackground;
    const state = useEditorStore.getState();
    drawGrid(grid, state.camera, state.viewport, editorTheme);
  }, [editorTheme]);

  return (
    <section
      aria-label="SpaceForge floor plan editor canvas"
      aria-describedby={instructionsId}
      role="region"
      className="h-full w-full"
    >
      <p id={instructionsId} className="sr-only">
        Editor controls: hold Space and drag to pan, middle mouse drag also pans, and mouse wheel
        zooms.
      </p>
      <div
        ref={containerRef}
        tabIndex={-1}
        className="h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
    </section>
  );
}

function drawGrid(
  graphics: Graphics,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const { width, height } = viewport;
  graphics.clear();

  if (width <= 0 || height <= 0) return;

  const topLeftWorld = screenToWorld({ x: 0, y: 0 }, camera, viewport);
  const bottomRightWorld = screenToWorld({ x: width, y: height }, camera, viewport);

  const minX = Math.min(topLeftWorld.x, bottomRightWorld.x);
  const maxX = Math.max(topLeftWorld.x, bottomRightWorld.x);
  const minY = Math.min(topLeftWorld.y, bottomRightWorld.y);
  const maxY = Math.max(topLeftWorld.y, bottomRightWorld.y);

  if (GRID_MINOR_SIZE_MM * camera.pixelsPerMm >= 8) {
    drawGridLines(graphics, camera, viewport, minX, maxX, minY, maxY, GRID_MINOR_SIZE_MM, {
      width: 1,
      color: theme.gridMinor,
      alpha: 1,
    });
  }

  drawGridLines(graphics, camera, viewport, minX, maxX, minY, maxY, GRID_SIZE_MM, {
    width: 1,
    color: theme.gridMajor,
    alpha: 1,
  });

  const originX = (0 - camera.xMm) * camera.pixelsPerMm + width / 2;
  const originY = (0 - camera.yMm) * camera.pixelsPerMm + height / 2;
  graphics.setStrokeStyle({ width: 1.5, color: theme.originAxis, alpha: 1 });
  graphics.moveTo(originX, 0);
  graphics.lineTo(originX, height);
  graphics.moveTo(0, originY);
  graphics.lineTo(width, originY);
  graphics.stroke();
}

function drawGridLines(
  graphics: Graphics,
  camera: CameraState,
  viewport: ViewportSize,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  stepMm: number,
  stroke: { width: number; color: number; alpha: number }
) {
  const firstX = Math.floor(minX / stepMm) * stepMm;
  const firstY = Math.floor(minY / stepMm) * stepMm;
  const { width, height } = viewport;

  graphics.setStrokeStyle(stroke);

  for (let xMm = firstX; xMm <= maxX; xMm += stepMm) {
    const x = (xMm - camera.xMm) * camera.pixelsPerMm + width / 2;
    graphics.moveTo(x, 0);
    graphics.lineTo(x, height);
  }

  for (let yMm = firstY; yMm <= maxY; yMm += stepMm) {
    const y = (yMm - camera.yMm) * camera.pixelsPerMm + height / 2;
    graphics.moveTo(0, y);
    graphics.lineTo(width, y);
  }

  graphics.stroke();
}

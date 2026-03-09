"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import { Application, Graphics } from "pixi.js";
import { screenToWorld, worldToScreen } from "@/lib/editor/camera";
import { GRID_MINOR_SIZE_MM, GRID_SIZE_MM } from "@/lib/editor/constants";
import { getOrthogonalSnappedPoint, snapPointToGrid } from "@/lib/editor/geometry";
import { attachPanZoomInput } from "@/lib/editor/input/panZoomInput";
import { attachRoomDrawInput } from "@/lib/editor/input/roomDrawInput";
import { getEditorCanvasTheme, resolveEditorThemeMode, type EditorCanvasTheme } from "@/lib/editor/theme";
import type { CameraState, Point, Room, ViewportSize } from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";

export default function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const roomRef = useRef<Graphics | null>(null);
  const draftRef = useRef<Graphics | null>(null);
  const cursorWorldRef = useRef<Point | null>(null);
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
      const rooms = new Graphics();
      const draft = new Graphics();
      gridRef.current = grid;
      roomRef.current = rooms;
      draftRef.current = draft;
      app.stage.addChild(grid);
      app.stage.addChild(rooms);
      app.stage.addChild(draft);

      const syncViewport = () => {
        useEditorStore.getState().setViewport(app.screen.width, app.screen.height);
      };

      syncViewport();
      drawScene(
        grid,
        rooms,
        draft,
        useEditorStore.getState(),
        cursorWorldRef.current,
        editorThemeRef.current
      );

      const handleResize = () => {
        syncViewport();
      };

      app.renderer.on("resize", handleResize);

      const unsubscribe = useEditorStore.subscribe((state) => {
        drawScene(grid, rooms, draft, state, cursorWorldRef.current, editorThemeRef.current);
      });
      const detachPanZoomInput = attachPanZoomInput(app.canvas, useEditorStore);
      const detachRoomDrawInput = attachRoomDrawInput(app.canvas, useEditorStore, {
        onCursorWorldChange: (cursorWorld) => {
          cursorWorldRef.current = cursorWorld;
        },
        requestRender: () => {
          drawScene(
            grid,
            rooms,
            draft,
            useEditorStore.getState(),
            cursorWorldRef.current,
            editorThemeRef.current
          );
        },
      });

      return () => {
        detachPanZoomInput();
        detachRoomDrawInput();
        unsubscribe();
        app.renderer.off("resize", handleResize);
        appRef.current = null;
        gridRef.current = null;
        roomRef.current = null;
        draftRef.current = null;
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
    const rooms = roomRef.current;
    const draft = draftRef.current;
    if (!app || !grid || !rooms || !draft) return;

    app.renderer.background.color = editorTheme.canvasBackground;
    const state = useEditorStore.getState();
    drawScene(grid, rooms, draft, state, cursorWorldRef.current, editorTheme);
  }, [editorTheme]);

  return (
    <section
      aria-label="SpaceForge floor plan editor canvas"
      aria-describedby={instructionsId}
      role="region"
      className="h-full w-full"
    >
      <p id={instructionsId} className="sr-only">
        Editor controls: left click places room corners snapped to the 500 millimetre grid. Hold
        Space and drag to pan, middle mouse drag also pans, mouse wheel zooms, and Escape cancels
        the current room draft. Right click also cancels the current room draft.
      </p>
      <div
        ref={containerRef}
        tabIndex={-1}
        className="h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
    </section>
  );
}

type EditorSnapshot = ReturnType<typeof useEditorStore.getState>;

function drawScene(
  gridGraphics: Graphics,
  roomGraphics: Graphics,
  draftGraphics: Graphics,
  state: EditorSnapshot,
  cursorWorld: Point | null,
  theme: EditorCanvasTheme
) {
  drawGrid(gridGraphics, state.camera, state.viewport, theme);
  drawRooms(roomGraphics, state.document.rooms, state.camera, state.viewport, theme);
  drawDraft(draftGraphics, state.roomDraft.points, cursorWorld, state.camera, state.viewport, theme);
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

function drawRooms(
  graphics: Graphics,
  rooms: Room[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  graphics.clear();

  for (const room of rooms) {
    if (room.points.length < 3) continue;
    const screenPoints = room.points.map((point) => worldToScreen(point, camera, viewport));

    graphics.setFillStyle({ color: theme.roomFill, alpha: 0.12 });
    graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i += 1) {
      graphics.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    graphics.closePath();
    graphics.fill();

    graphics.setStrokeStyle({ width: 2, color: theme.roomOutline, alpha: 0.9 });
    graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i += 1) {
      graphics.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    graphics.closePath();
    graphics.stroke();
  }
}

function drawDraft(
  graphics: Graphics,
  draftPoints: Point[],
  cursorWorld: Point | null,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  graphics.clear();
  if (draftPoints.length > 0) {
    const screenDraftPoints = draftPoints.map((point) => worldToScreen(point, camera, viewport));

    graphics.setStrokeStyle({ width: 2, color: theme.draftWall, alpha: 1 });
    graphics.moveTo(screenDraftPoints[0].x, screenDraftPoints[0].y);
    for (let i = 1; i < screenDraftPoints.length; i += 1) {
      graphics.lineTo(screenDraftPoints[i].x, screenDraftPoints[i].y);
    }
    graphics.stroke();

    graphics.setFillStyle({ color: theme.interactiveAccent, alpha: 1 });
    for (const point of screenDraftPoints) {
      graphics.rect(point.x - 3, point.y - 3, 6, 6);
      graphics.fill();
    }

    if (!cursorWorld) return;

    const previewWorld = getOrthogonalSnappedPoint(
      draftPoints[draftPoints.length - 1],
      cursorWorld,
      GRID_SIZE_MM
    );
    const previewScreen = worldToScreen(previewWorld, camera, viewport);
    const lastScreenPoint = screenDraftPoints[screenDraftPoints.length - 1];
    const isZeroPreview =
      previewScreen.x === lastScreenPoint.x && previewScreen.y === lastScreenPoint.y;

    if (!isZeroPreview) {
      graphics.setStrokeStyle({ width: 2, color: theme.interactiveAccent, alpha: 0.55 });
      graphics.moveTo(lastScreenPoint.x, lastScreenPoint.y);
      graphics.lineTo(previewScreen.x, previewScreen.y);
      graphics.stroke();
    }

    drawSnapMarker(graphics, previewScreen, theme, "active");
    return;
  }

  if (!cursorWorld) return;

  const firstPointPreviewWorld = snapPointToGrid(cursorWorld, GRID_SIZE_MM);
  const firstPointPreviewScreen = worldToScreen(firstPointPreviewWorld, camera, viewport);
  drawSnapMarker(graphics, firstPointPreviewScreen, theme, "idle");
}

function drawSnapMarker(
  graphics: Graphics,
  point: Point,
  theme: EditorCanvasTheme,
  mode: "idle" | "active"
) {
  const radius = mode === "active" ? 6 : 5;
  const dotRadius = mode === "active" ? 2 : 1.75;
  const fillAlpha = mode === "active" ? 0.18 : 0.12;
  const strokeAlpha = mode === "active" ? 0.95 : 0.75;

  graphics.setFillStyle({ color: theme.interactiveAccent, alpha: fillAlpha });
  graphics.circle(point.x, point.y, radius);
  graphics.fill();

  graphics.setStrokeStyle({ width: 1.5, color: theme.interactiveAccent, alpha: strokeAlpha });
  graphics.circle(point.x, point.y, radius);
  graphics.stroke();

  graphics.setFillStyle({ color: theme.interactiveAccent, alpha: 0.9 });
  graphics.circle(point.x, point.y, dotRadius);
  graphics.fill();
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

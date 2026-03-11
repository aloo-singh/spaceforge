"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Application, Container, Graphics, Text } from "pixi.js";
import { screenToWorld, worldToScreen } from "@/lib/editor/camera";
import { GRID_MINOR_SIZE_MM, GRID_SIZE_MM } from "@/lib/editor/constants";
import { getOrthogonalSnappedPoint, snapPointToGrid } from "@/lib/editor/geometry";
import {
  getRoomLabelLayout,
  ROOM_LABEL_FONT_FAMILY,
  ROOM_LABEL_FONT_SIZE_PX,
  ROOM_LABEL_FONT_WEIGHT,
} from "@/lib/editor/roomLabel";
import { attachPanZoomInput } from "@/lib/editor/input/panZoomInput";
import { attachRoomResizeInput } from "@/lib/editor/input/roomResizeInput";
import { attachRoomDrawInput } from "@/lib/editor/input/roomDrawInput";
import { attachHistoryHotkeys } from "@/lib/editor/input/historyHotkeys";
import { exportPixiCanvasToPngBlob } from "@/lib/editor/exportPng";
import { getEditorCanvasTheme, resolveEditorThemeMode, type EditorCanvasTheme } from "@/lib/editor/theme";
import {
  getAxisAlignedRoomBounds,
  getCornerHandleLayouts,
  getWallHandleLayouts,
  type RectCorner,
  type RectWall,
} from "@/lib/editor/rectRoomResize";
import type { CameraState, Point, Room, ViewportSize } from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";
import { SelectedRoomNamePanel } from "@/components/editor/SelectedRoomNamePanel";
import { HistoryControls } from "@/components/editor/HistoryControls";

export default function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const roomRef = useRef<Graphics | null>(null);
  const roomLabelRef = useRef<Container | null>(null);
  const draftRef = useRef<Graphics | null>(null);
  const cursorWorldRef = useRef<Point | null>(null);
  const hoveredRoomLabelIdRef = useRef<string | null>(null);
  const roomResizeUiRef = useRef<{
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeRoomId: string | null;
  }>({
    hoveredWall: null,
    hoveredCorner: null,
    hoveredRoomId: null,
    activeWall: null,
    activeCorner: null,
    activeRoomId: null,
  });
  const instructionsId = "editor-canvas-controls";
  const { resolvedTheme } = useTheme();
  const editorThemeMode = useMemo(() => resolveEditorThemeMode(resolvedTheme), [resolvedTheme]);
  const editorTheme = useMemo(
    () => getEditorCanvasTheme(editorThemeMode),
    [editorThemeMode]
  );
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isCanvasReadyForExport, setIsCanvasReadyForExport] = useState(false);
  const editorThemeRef = useRef(editorTheme);

  const exportCurrentCanvasAsPng = useCallback(async () => {
    const app = appRef.current;
    if (!app || isExportingPng) return;

    setIsExportingPng(true);

    try {
      const blob = await exportPixiCanvasToPngBlob({
        renderer: app.renderer,
        stage: app.stage,
      }, {
        backgroundColor: editorThemeMode === "light" ? "#ffffff" : "#000000",
        paddingPx: 48,
      });
      const downloadUrl = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `spaceforge-editor-${timestamp}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    } catch (error) {
      console.error("PNG export failed.", error);
    } finally {
      setIsExportingPng(false);
    }
  }, [editorThemeMode, isExportingPng]);

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
      const targetResolution =
        typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      await app.init({
        resizeTo: resizeTarget,
        background: editorThemeRef.current.canvasBackground,
        antialias: true,
        autoDensity: true,
        resolution: targetResolution,
        roundPixels: true,
      });
      initialized = true;

      if (destroyed || !containerRef.current) {
        app.destroy(true, { children: true });
        return;
      }

      appRef.current = app;
      setIsCanvasReadyForExport(true);
      containerRef.current.appendChild(app.canvas);
      app.canvas.style.touchAction = "none";

      const grid = new Graphics();
      const rooms = new Graphics();
      const roomLabels = new Container();
      const draft = new Graphics();
      gridRef.current = grid;
      roomRef.current = rooms;
      roomLabelRef.current = roomLabels;
      draftRef.current = draft;
      app.stage.addChild(grid);
      app.stage.addChild(rooms);
      app.stage.addChild(roomLabels);
      app.stage.addChild(draft);

      const syncViewport = () => {
        useEditorStore.getState().setViewport(app.screen.width, app.screen.height);
      };

      syncViewport();
      drawScene(
        grid,
        rooms,
        roomLabels,
        draft,
        useEditorStore.getState(),
        cursorWorldRef.current,
        hoveredRoomLabelIdRef.current,
        roomResizeUiRef.current,
        editorThemeRef.current
      );

      const handleResize = () => {
        syncViewport();
      };

      app.renderer.on("resize", handleResize);

      const unsubscribe = useEditorStore.subscribe((state) => {
        drawScene(
          grid,
          rooms,
          roomLabels,
          draft,
          state,
          cursorWorldRef.current,
          hoveredRoomLabelIdRef.current,
          roomResizeUiRef.current,
          editorThemeRef.current
        );
      });
      const detachPanZoomInput = attachPanZoomInput(app.canvas, useEditorStore);
      const detachRoomResizeInput = attachRoomResizeInput(app.canvas, useEditorStore, {
        onHandleStateChange: (handleState) => {
          roomResizeUiRef.current = handleState;
        },
        requestRender: () => {
          drawScene(
            grid,
            rooms,
            roomLabels,
            draft,
            useEditorStore.getState(),
            cursorWorldRef.current,
            hoveredRoomLabelIdRef.current,
            roomResizeUiRef.current,
            editorThemeRef.current
          );
        },
      });
      const detachRoomDrawInput = attachRoomDrawInput(app.canvas, useEditorStore, {
        onCursorWorldChange: (cursorWorld) => {
          cursorWorldRef.current = cursorWorld;
        },
        onHoveredRoomLabelChange: (roomId) => {
          hoveredRoomLabelIdRef.current = roomId;
        },
        requestRender: () => {
          drawScene(
            grid,
            rooms,
            roomLabels,
            draft,
            useEditorStore.getState(),
            cursorWorldRef.current,
            hoveredRoomLabelIdRef.current,
            roomResizeUiRef.current,
            editorThemeRef.current
          );
        },
      });
      const detachHistoryHotkeys = attachHistoryHotkeys(useEditorStore);

      return () => {
        detachPanZoomInput();
        detachRoomResizeInput();
        detachRoomDrawInput();
        detachHistoryHotkeys();
        unsubscribe();
        app.renderer.off("resize", handleResize);
        appRef.current = null;
        setIsCanvasReadyForExport(false);
        gridRef.current = null;
        roomRef.current = null;
        roomLabelRef.current = null;
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
    const roomLabels = roomLabelRef.current;
    const draft = draftRef.current;
    if (!app || !grid || !rooms || !roomLabels || !draft) return;

    app.renderer.background.color = editorTheme.canvasBackground;
    const state = useEditorStore.getState();
    drawScene(
      grid,
      rooms,
      roomLabels,
      draft,
      state,
      cursorWorldRef.current,
      hoveredRoomLabelIdRef.current,
      roomResizeUiRef.current,
      editorTheme
    );
  }, [editorTheme]);

  return (
    <section
      aria-label="SpaceForge floor plan editor canvas"
      aria-describedby={instructionsId}
      role="region"
      className="relative h-full w-full"
    >
      <p id={instructionsId} className="sr-only">
        Editor controls: left click places room corners while drafting. Click a room name label to
        select that room. When a room is selected, clicking outside clears selection first, then a
        following click can start drawing. Hold Space and drag to pan, middle mouse drag also pans,
        mouse wheel zooms, and Escape cancels the current room draft or clears selection. Right
        click also cancels the current room draft. Undo is Cmd or Ctrl plus Z, and redo is
        Shift+Cmd+Z or Ctrl+Y.
      </p>
      <div
        ref={containerRef}
        tabIndex={-1}
        className="h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <HistoryControls
        onExportPng={exportCurrentCanvasAsPng}
        isExportingPng={isExportingPng}
        exportDisabled={!isCanvasReadyForExport}
      />
      <SelectedRoomNamePanel />
    </section>
  );
}

type EditorSnapshot = ReturnType<typeof useEditorStore.getState>;

function drawScene(
  gridGraphics: Graphics,
  roomGraphics: Graphics,
  roomLabelContainer: Container,
  draftGraphics: Graphics,
  state: EditorSnapshot,
  cursorWorld: Point | null,
  hoveredRoomLabelId: string | null,
  roomResizeUi: {
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeRoomId: string | null;
  },
  theme: EditorCanvasTheme
) {
  drawGrid(gridGraphics, state.camera, state.viewport, theme);
  drawRooms(
    roomGraphics,
    state.document.rooms,
    state.selectedRoomId,
    roomResizeUi,
    state.roomDraft.points.length > 0,
    state.camera,
    state.viewport,
    theme
  );
  drawRoomLabels(
    roomLabelContainer,
    state.document.rooms,
    state.selectedRoomId,
    hoveredRoomLabelId,
    state.camera,
    state.viewport,
    theme
  );
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
  selectedRoomId: string | null,
  roomResizeUi: {
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeRoomId: string | null;
  },
  isDraftingRoom: boolean,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  graphics.clear();

  for (const room of rooms) {
    if (room.points.length < 3) continue;
    const isSelected = room.id === selectedRoomId;
    const screenPoints = room.points.map((point) => worldToScreen(point, camera, viewport));

    graphics.setFillStyle({
      color: theme.roomFill,
      alpha: isSelected ? 0.2 : 0.12,
    });
    graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i += 1) {
      graphics.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    graphics.closePath();
    graphics.fill();

    graphics.setStrokeStyle({
      width: isSelected ? 2.5 : 2,
      color: isSelected ? theme.roomSelectionOutline : theme.roomOutline,
      alpha: isSelected ? 1 : 0.9,
    });
    graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i += 1) {
      graphics.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    graphics.closePath();
    graphics.stroke();

    if (!isSelected || isDraftingRoom) continue;
    const bounds = getAxisAlignedRoomBounds(room);
    if (!bounds) continue;
    const handles = getWallHandleLayouts(bounds, camera, viewport);
    const cornerHandles = getCornerHandleLayouts(bounds, camera, viewport);

    for (const handle of handles) {
      const isHovered =
        roomResizeUi.hoveredRoomId === room.id && roomResizeUi.hoveredWall === handle.wall;
      const isActive =
        roomResizeUi.activeRoomId === room.id && roomResizeUi.activeWall === handle.wall;
      const fillAlpha = isActive ? 0.46 : isHovered ? 0.34 : 0.2;
      const strokeAlpha = isActive ? 1 : isHovered ? 0.96 : 0.82;
      const strokeWidth = isActive ? 2.2 : isHovered ? 1.8 : 1.45;
      const radius = Math.min(handle.width, handle.height) / 2;
      const haloPadding = isActive ? 3 : isHovered ? 2 : 0;
      const haloAlpha = isActive ? 0.2 : isHovered ? 0.12 : 0;
      const handleStrokeColor = theme.roomOutline;

      if (haloPadding > 0) {
        graphics.setFillStyle({ color: theme.interactiveAccent, alpha: haloAlpha });
        graphics.roundRect(
          handle.left - haloPadding,
          handle.top - haloPadding,
          handle.width + haloPadding * 2,
          handle.height + haloPadding * 2,
          radius + haloPadding
        );
        graphics.fill();
      }

      graphics.setFillStyle({ color: theme.interactiveAccent, alpha: fillAlpha });
      graphics.roundRect(handle.left, handle.top, handle.width, handle.height, radius);
      graphics.fill();

      graphics.setStrokeStyle({
        width: strokeWidth,
        color: handleStrokeColor,
        alpha: strokeAlpha,
      });
      graphics.roundRect(handle.left, handle.top, handle.width, handle.height, radius);
      graphics.stroke();
    }

    for (const handle of cornerHandles) {
      const isHovered =
        roomResizeUi.hoveredRoomId === room.id && roomResizeUi.hoveredCorner === handle.corner;
      const isActive =
        roomResizeUi.activeRoomId === room.id && roomResizeUi.activeCorner === handle.corner;
      const size = isActive ? handle.size + 2 : isHovered ? handle.size + 1 : handle.size;
      const half = size / 2;
      const haloPadding = isActive ? 3 : isHovered ? 2 : 0;
      const fillAlpha = isActive ? 0.54 : isHovered ? 0.42 : 0.3;
      const strokeAlpha = isActive ? 1 : isHovered ? 0.98 : 0.9;
      const strokeWidth = isActive ? 2.1 : isHovered ? 1.8 : 1.5;

      if (haloPadding > 0) {
        graphics.setFillStyle({ color: theme.interactiveAccent, alpha: isActive ? 0.22 : 0.14 });
        graphics.rect(
          handle.center.x - half - haloPadding,
          handle.center.y - half - haloPadding,
          size + haloPadding * 2,
          size + haloPadding * 2
        );
        graphics.fill();
      }

      graphics.setFillStyle({ color: theme.interactiveAccent, alpha: fillAlpha });
      graphics.rect(handle.center.x - half, handle.center.y - half, size, size);
      graphics.fill();

      graphics.setStrokeStyle({
        width: strokeWidth,
        color: theme.roomOutline,
        alpha: strokeAlpha,
      });
      graphics.rect(handle.center.x - half, handle.center.y - half, size, size);
      graphics.stroke();
    }
  }
}

function drawRoomLabels(
  labelContainer: Container,
  rooms: Room[],
  selectedRoomId: string | null,
  hoveredRoomLabelId: string | null,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const staleLabels = labelContainer.removeChildren();
  staleLabels.forEach((label) => label.destroy());

  for (const room of rooms) {
    const layout = getRoomLabelLayout(room, camera, viewport);
    if (!layout) continue;
    const textResolution = getTextResolution();
    const left = snapToPixel(layout.left, textResolution);
    const top = snapToPixel(layout.top, textResolution);
    const width = snapToPixel(layout.width, textResolution);
    const height = snapToPixel(layout.height, textResolution);
    const centerX = snapToPixel(layout.center.x, textResolution);
    const centerY = snapToPixel(layout.center.y, textResolution);

    const isSelected = selectedRoomId === room.id;
    const isHovered = hoveredRoomLabelId === room.id;
    const fillColor = isSelected
      ? theme.roomLabelPillSelectedFill
      : isHovered
        ? theme.roomLabelPillHoverFill
        : theme.roomLabelPillFill;
    const strokeColor = isSelected
      ? theme.roomLabelPillSelectedStroke
      : isHovered
        ? theme.roomLabelPillHoverStroke
        : theme.roomLabelPillStroke;
    const strokeWidth = isSelected ? 1.6 : 1.2;

    const pill = new Graphics();
    pill.setFillStyle({ color: fillColor, alpha: 0.92 });
    pill.roundRect(left, top, width, height, layout.borderRadius);
    pill.fill();
    pill.setStrokeStyle({ width: strokeWidth, color: strokeColor, alpha: 0.95 });
    pill.roundRect(left, top, width, height, layout.borderRadius);
    pill.stroke();
    labelContainer.addChild(pill);

    const text = new Text({
      text: layout.text,
      resolution: textResolution,
      style: {
        fontFamily: ROOM_LABEL_FONT_FAMILY,
        fontSize: ROOM_LABEL_FONT_SIZE_PX,
        fontWeight: ROOM_LABEL_FONT_WEIGHT,
        fill: theme.roomLabelFill,
        stroke: {
          color: theme.roomLabelStroke,
          width: 2,
          join: "round",
        },
      },
    });
    text.roundPixels = true;
    text.anchor.set(0.5);
    text.position.set(centerX, centerY);
    text.alpha = layout.isPlaceholder ? 0.72 : isHovered || isSelected ? 0.98 : 0.92;
    labelContainer.addChild(text);
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

function getTextResolution(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

function snapToPixel(value: number, resolution: number): number {
  return Math.round(value * resolution) / resolution;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { getAutoFitExportFraming } from "@/lib/editor/exportAutoFitFraming";
import { getLayoutBoundsFromDocument } from "@/lib/editor/exportLayoutBounds";
import { exportPixiCanvasToPngBlob } from "@/lib/editor/exportPng";
import { getEditorCanvasTheme, resolveEditorThemeMode, type EditorCanvasTheme } from "@/lib/editor/theme";
import {
  type ActiveEditorOnboardingHint,
  getActiveEditorOnboardingHint,
  loadCompletedEditorHintIds,
  loadDismissedEditorHintIds,
  saveCompletedEditorHintIds,
  saveDismissedEditorHintIds,
  type EditorOnboardingHintId,
} from "@/lib/editor/onboardingHints";
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
import { OnboardingHintCard } from "@/components/editor/OnboardingHintCard";

const EMPTY_ROOM_RESIZE_UI = {
  hoveredWall: null,
  hoveredCorner: null,
  hoveredRoomId: null,
  activeWall: null,
  activeCorner: null,
  activeRoomId: null,
} as const;
const HINT_TRANSITION_MS = 200;
const HINT_HANDOFF_DELAY_MS = 150;

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
  }>({ ...EMPTY_ROOM_RESIZE_UI });
  const roomMoveGhostRef = useRef<{ roomId: string; points: Point[] } | null>(null);
  const instructionsId = "editor-canvas-controls";
  const { resolvedTheme } = useTheme();
  const editorThemeMode = useMemo(() => resolveEditorThemeMode(resolvedTheme), [resolvedTheme]);
  const editorTheme = useMemo(
    () => getEditorCanvasTheme(editorThemeMode),
    [editorThemeMode]
  );
  const hasHydratedClient = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const roomCount = useEditorStore((state) => state.document.rooms.length);
  const hasRooms = hasHydratedClient && roomCount > 0;
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isCanvasReadyForExport, setIsCanvasReadyForExport] = useState(false);
  const [isMacPlatform, setIsMacPlatform] = useState(false);
  const [hasHydratedHints, setHasHydratedHints] = useState(false);
  const [displayedHint, setDisplayedHint] = useState<ActiveEditorOnboardingHint | null>(null);
  const [hintMotionState, setHintMotionState] = useState<"entering" | "visible" | "exiting">("visible");
  const [dismissedHintIds, setDismissedHintIds] = useState<EditorOnboardingHintId[]>([]);
  const [completedHintIds, setCompletedHintIds] = useState<EditorOnboardingHintId[]>([]);
  const hintTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintHandoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTransitionCycleRef = useRef(0);
  const latestEligibleHintRef = useRef<ActiveEditorOnboardingHint | null>(null);
  const editorThemeRef = useRef(editorTheme);
  const activeHintIdRef = useRef<EditorOnboardingHintId | null>(null);
  const activeHint = useMemo(() => {
    if (!hasHydratedHints) return null;

    return getActiveEditorOnboardingHint({
      roomCount,
      isMacPlatform,
      dismissedHintIds: new Set(dismissedHintIds),
      completedHintIds: new Set(completedHintIds),
    });
  }, [completedHintIds, dismissedHintIds, hasHydratedHints, isMacPlatform, roomCount]);

  useEffect(() => {
    latestEligibleHintRef.current = activeHint;
  }, [activeHint]);

  useEffect(() => {
    return () => {
      if (hintTransitionTimeoutRef.current) {
        clearTimeout(hintTransitionTimeoutRef.current);
      }
      if (hintHandoffTimeoutRef.current) {
        clearTimeout(hintHandoffTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const clearTimers = () => {
      if (hintTransitionTimeoutRef.current) {
        clearTimeout(hintTransitionTimeoutRef.current);
        hintTransitionTimeoutRef.current = null;
      }
      if (hintHandoffTimeoutRef.current) {
        clearTimeout(hintHandoffTimeoutRef.current);
        hintHandoffTimeoutRef.current = null;
      }
    };

    const startEnter = (hint: ActiveEditorOnboardingHint) => {
      setDisplayedHint(hint);
      setHintMotionState("entering");
      requestAnimationFrame(() => {
        setHintMotionState("visible");
      });
    };

    if (!displayedHint) {
      if (hintHandoffTimeoutRef.current) return;
      if (activeHint) {
        clearTimers();
        startEnter(activeHint);
      }
      return;
    }

    if (activeHint && activeHint.id === displayedHint.id) {
      if (activeHint.message !== displayedHint.message) {
        setDisplayedHint(activeHint);
      }
      return;
    }

    clearTimers();
    const transitionCycle = hintTransitionCycleRef.current + 1;
    hintTransitionCycleRef.current = transitionCycle;
    setHintMotionState("exiting");

    hintTransitionTimeoutRef.current = setTimeout(() => {
      if (hintTransitionCycleRef.current !== transitionCycle) return;

      setDisplayedHint(null);
      hintTransitionTimeoutRef.current = null;
      hintHandoffTimeoutRef.current = setTimeout(() => {
        if (hintTransitionCycleRef.current !== transitionCycle) return;
        hintHandoffTimeoutRef.current = null;
        const nextHint = latestEligibleHintRef.current;
        if (nextHint) {
          startEnter(nextHint);
        }
      }, HINT_HANDOFF_DELAY_MS);
    }, HINT_TRANSITION_MS);
  }, [activeHint, displayedHint]);

  const dismissHint = useCallback((hintId: EditorOnboardingHintId) => {
    setDismissedHintIds((previous) => {
      if (previous.includes(hintId)) return previous;
      const next = [...previous, hintId];
      saveDismissedEditorHintIds(next);
      return next;
    });
  }, []);

  const completeHint = useCallback((hintId: EditorOnboardingHintId) => {
    setCompletedHintIds((previous) => {
      if (previous.includes(hintId)) return previous;
      const next = [...previous, hintId];
      saveCompletedEditorHintIds(next);
      return next;
    });
  }, []);

  const exportCurrentCanvasAsPng = useCallback(async (signatureText?: string) => {
    const app = appRef.current;
    if (!app || isExportingPng) return;
    const state = useEditorStore.getState();
    const hasSignature = Boolean(signatureText?.trim());
    const layoutBounds = getLayoutBoundsFromDocument(state.document);
    const exportFraming = getAutoFitExportFraming({
      layoutBounds,
      viewport: state.viewport,
      fallbackCamera: state.camera,
      innerPaddingPx: hasSignature ? 88 : 72,
    });
    const exportCamera = exportFraming.camera;
    const exportViewport = exportFraming.viewport;
    const minorGridSpacingPx = GRID_MINOR_SIZE_MM * exportCamera.pixelsPerMm;
    const majorGridSpacingPx = GRID_SIZE_MM * exportCamera.pixelsPerMm;
    const exportGridSpacingPx = minorGridSpacingPx >= 8 ? minorGridSpacingPx : majorGridSpacingPx;
    const exportGridOriginXPx =
      (0 - exportCamera.xMm) * exportCamera.pixelsPerMm + exportViewport.width / 2;
    const exportGridOriginYPx =
      (0 - exportCamera.yMm) * exportCamera.pixelsPerMm + exportViewport.height / 2;

    setIsExportingPng(true);
    const exportStage = new Container();
    const exportRoomGraphics = new Graphics();
    const exportRoomLabels = new Container();
    const exportDraftGraphics = new Graphics();
    exportStage.addChild(exportRoomGraphics);
    exportStage.addChild(exportRoomLabels);
    exportStage.addChild(exportDraftGraphics);

    drawRooms(
      exportRoomGraphics,
      state.document.rooms,
      null,
      EMPTY_ROOM_RESIZE_UI,
      state.roomDraft.points.length > 0,
      exportCamera,
      exportViewport,
      null,
      editorThemeRef.current
    );
    drawRoomLabels(
      exportRoomLabels,
      state.document.rooms,
      null,
      null,
      exportCamera,
      exportViewport,
      editorThemeRef.current
    );
    drawDraft(
      exportDraftGraphics,
      state.roomDraft.points,
      cursorWorldRef.current,
      exportCamera,
      exportViewport,
      editorThemeRef.current
    );

    try {
      const blob = await exportPixiCanvasToPngBlob({
        renderer: app.renderer,
        stage: exportStage,
      }, {
        backgroundColor: editorThemeMode === "light" ? "#ffffff" : "#000000",
        paddingPx: 48,
        grid: {
          spacingPx: exportGridSpacingPx,
          originXPx: exportGridOriginXPx,
          originYPx: exportGridOriginYPx,
          color: editorThemeMode === "light" ? "#0f172a" : "#f8fafc",
          alpha: editorThemeMode === "light" ? 0.08 : 0.1,
        },
        signature: signatureText
          ? {
              text: signatureText,
              color: editorThemeMode === "light" ? "#0f172a" : "#f8fafc",
              alpha: editorThemeMode === "light" ? 0.72 : 0.7,
            }
          : undefined,
      });
      const downloadUrl = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `spaceforge-editor-${timestamp}.png`;
      link.click();
      if (activeHintIdRef.current === "export-as-png") {
        completeHint("export-as-png");
      }
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    } catch (error) {
      console.error("PNG export failed.", error);
    } finally {
      exportStage.destroy({ children: true });
      setIsExportingPng(false);
    }
  }, [completeHint, editorThemeMode, isExportingPng]);

  useEffect(() => {
    editorThemeRef.current = editorTheme;
  }, [editorTheme]);

  useEffect(() => {
    activeHintIdRef.current = displayedHint?.id ?? null;
  }, [displayedHint]);

  useEffect(() => {
    setIsMacPlatform(detectMacPlatform());
    setDismissedHintIds(loadDismissedEditorHintIds());
    setCompletedHintIds(loadCompletedEditorHintIds());
    setHasHydratedHints(true);
  }, []);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      if (activeHintIdRef.current !== "empty-canvas-draw") return;
      const didCreateFirstRoom =
        previousState.document.rooms.length === 0 && state.document.rooms.length > 0;
      if (!didCreateFirstRoom) return;
      completeHint("empty-canvas-draw");
    });

    return unsubscribe;
  }, [completeHint]);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      if (activeHintIdRef.current !== "undo-last-action") return;
      const didPerformUndo = state.history.future.length > previousState.history.future.length;
      if (!didPerformUndo) return;
      completeHint("undo-last-action");
    });

    return unsubscribe;
  }, [completeHint]);

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
        roomMoveGhostRef.current,
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
          roomMoveGhostRef.current,
          editorThemeRef.current
        );
      });
      const detachPanZoomInput = attachPanZoomInput(app.canvas, useEditorStore, {
        onPan: () => {
          if (activeHintIdRef.current !== "pan-canvas") return;
          completeHint("pan-canvas");
        },
      });
      const detachRoomResizeInput = attachRoomResizeInput(app.canvas, useEditorStore, {
        onHandleStateChange: (handleState) => {
          roomResizeUiRef.current = handleState;
        },
        onRoomResizeCommitted: () => {
          if (activeHintIdRef.current !== "resize-room-by-dragging-edges") return;
          completeHint("resize-room-by-dragging-edges");
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
            roomMoveGhostRef.current,
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
        onRoomMoveGhostChange: (ghost) => {
          roomMoveGhostRef.current = ghost;
        },
        onRoomLabelSelected: () => {
          if (activeHintIdRef.current !== "select-room-by-name") return;
          completeHint("select-room-by-name");
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
            roomMoveGhostRef.current,
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
        roomMoveGhostRef.current = null;
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
  }, [completeHint]);

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
      roomMoveGhostRef.current,
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
      {displayedHint ? (
        <aside
          className={`pointer-events-none absolute top-4 left-1/2 z-20 w-full max-w-xs -translate-x-1/2 px-3 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
            hintMotionState === "visible"
              ? "translate-y-0 opacity-100"
              : hintMotionState === "entering"
                ? "translate-y-2 opacity-0"
                : "-translate-y-1.5 opacity-0"
          }`}
          style={{ transitionDuration: `${HINT_TRANSITION_MS}ms` }}
        >
          <OnboardingHintCard
            message={displayedHint.message}
            invertedTheme={editorThemeMode === "light" ? "dark" : "light"}
            onDismiss={() => dismissHint(displayedHint.id)}
          />
        </aside>
      ) : null}
      <HistoryControls
        onExportPng={exportCurrentCanvasAsPng}
        isExportingPng={isExportingPng}
        exportDisabled={!isCanvasReadyForExport || !hasRooms}
        exportDisabledReason={!hasRooms ? "Draw a room before exporting." : undefined}
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
  roomMoveGhost: { roomId: string; points: Point[] } | null,
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
    roomMoveGhost,
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
  roomMoveGhost: { roomId: string; points: Point[] } | null,
  theme: EditorCanvasTheme
) {
  graphics.clear();

  if (roomMoveGhost && roomMoveGhost.points.length >= 3) {
    drawRoomShape(
      graphics,
      roomMoveGhost.points,
      camera,
      viewport,
      theme.interactiveAccent,
      0.075,
      1.75,
      0.48
    );
  }

  for (const room of rooms) {
    if (room.points.length < 3) continue;
    const isSelected = room.id === selectedRoomId;
    drawRoomShape(
      graphics,
      room.points,
      camera,
      viewport,
      isSelected ? theme.roomSelectionOutline : theme.roomOutline,
      isSelected ? 0.2 : 0.12,
      isSelected ? 2.5 : 2,
      isSelected ? 1 : 0.9
    );

    if (!isSelected || isDraftingRoom) continue;
    const bounds = getAxisAlignedRoomBounds(room);
    if (!bounds) continue;
    const hoveredWall =
      roomResizeUi.hoveredRoomId === room.id ? roomResizeUi.hoveredWall : null;
    if (hoveredWall) {
      drawHoveredWallHighlight(graphics, bounds, hoveredWall, camera, viewport, theme);
    }
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

function drawRoomShape(
  graphics: Graphics,
  points: Point[],
  camera: CameraState,
  viewport: ViewportSize,
  strokeColor: number,
  fillAlpha: number,
  strokeWidth: number,
  strokeAlpha: number
) {
  const screenPoints = points.map((point) => worldToScreen(point, camera, viewport));

  graphics.setFillStyle({
    color: strokeColor,
    alpha: fillAlpha,
  });
  graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i += 1) {
    graphics.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  graphics.closePath();
  graphics.fill();

  graphics.setStrokeStyle({
    width: strokeWidth,
    color: strokeColor,
    alpha: strokeAlpha,
  });
  graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i += 1) {
    graphics.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  graphics.closePath();
  graphics.stroke();
}

function drawHoveredWallHighlight(
  graphics: Graphics,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  wall: RectWall,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const topLeft = worldToScreen({ x: bounds.minX, y: bounds.minY }, camera, viewport);
  const topRight = worldToScreen({ x: bounds.maxX, y: bounds.minY }, camera, viewport);
  const bottomRight = worldToScreen({ x: bounds.maxX, y: bounds.maxY }, camera, viewport);
  const bottomLeft = worldToScreen({ x: bounds.minX, y: bounds.maxY }, camera, viewport);

  let from = topLeft;
  let to = topRight;
  if (wall === "right") {
    from = topRight;
    to = bottomRight;
  } else if (wall === "bottom") {
    from = bottomLeft;
    to = bottomRight;
  } else if (wall === "left") {
    from = topLeft;
    to = bottomLeft;
  }

  graphics.setStrokeStyle({
    width: 3,
    color: theme.interactiveAccent,
    alpha: 0.58,
  });
  graphics.moveTo(from.x, from.y);
  graphics.lineTo(to.x, to.y);
  graphics.stroke();
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

function detectMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const userAgentDataPlatform =
    typeof navigatorWithUserAgentData.userAgentData?.platform === "string"
      ? navigatorWithUserAgentData.userAgentData.platform
      : "";
  if (/mac/i.test(userAgentDataPlatform)) return true;

  return /mac/i.test(navigator.platform);
}

function getTextResolution(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

function snapToPixel(value: number, resolution: number): number {
  return Math.round(value * resolution) / resolution;
}

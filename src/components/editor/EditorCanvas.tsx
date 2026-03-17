"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Application, Container, Graphics, Text } from "pixi.js";
import { screenToWorld, worldToScreen } from "@/lib/editor/camera";
import { GRID_MINOR_SIZE_MM, GRID_SIZE_MM } from "@/lib/editor/constants";
import {
  getOrthogonalSnappedPoint,
  getRectangleClosingPoint,
  snapPointToGrid,
} from "@/lib/editor/geometry";
import { preloadEditorCanvasFonts } from "@/lib/editor/canvasTextFonts";
import { getRoomDeclutterState } from "@/lib/editor/roomDeclutter";
import {
  getRoomLabelLayout,
  ROOM_LABEL_AREA_FONT_FAMILY,
  ROOM_LABEL_AREA_FONT_SIZE_PX,
  ROOM_LABEL_AREA_FONT_WEIGHT,
  ROOM_LABEL_NAME_FONT_FAMILY,
  ROOM_LABEL_NAME_FONT_SIZE_PX,
  ROOM_LABEL_NAME_FONT_WEIGHT,
} from "@/lib/editor/roomLabel";
import { attachPanZoomInput } from "@/lib/editor/input/panZoomInput";
import { attachRoomResizeInput } from "@/lib/editor/input/roomResizeInput";
import { attachRoomDrawInput } from "@/lib/editor/input/roomDrawInput";
import { attachDeleteRoomHotkeys } from "@/lib/editor/input/deleteRoomHotkeys";
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
import {
  formatMetricWallDimension,
  getRectResizeMeasurements,
  getCornerResizeMeasurements,
  getWallResizeMeasurementMillimetres,
} from "@/lib/editor/measurements";
import {
  getMeasurementTextScale,
  shouldShowDimensions,
  type EditorSettings,
} from "@/lib/editor/settings";
import {
  easeOutCubic,
  TRANSFORM_SETTLE_PREVIEW_FADE_MS,
  TRANSFORM_SETTLE_ROOM_ANIMATION_MS,
  TRANSFORM_SETTLE_TOTAL_MS,
  type TransformFeedback,
} from "@/lib/editor/transformFeedback";
import type {
  CameraState,
  Point,
  Room,
  RoomWallSelection,
  ScreenPoint,
  ViewportSize,
} from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";
import { SelectedRoomNamePanel } from "@/components/editor/SelectedRoomNamePanel";
import { HistoryControls } from "@/components/editor/HistoryControls";
import { OnboardingHintCard } from "@/components/editor/OnboardingHintCard";
import { MEASUREMENT_TEXT_FONT_FAMILY } from "@/lib/fonts";
import {
  track,
  trackAppOpened,
  trackFirstAction,
  trackFirstSuccess,
  trackOncePerSession,
} from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { EditorCommand } from "@/lib/editor/history";

const EMPTY_ROOM_RESIZE_UI = {
  hoveredWall: null,
  hoveredCorner: null,
  hoveredRoomId: null,
  activeWall: null,
  activeCorner: null,
  activeRoomId: null,
} as const;
const EMPTY_HOVERED_SELECTABLE_WALL = null as {
  roomId: string;
  wall: RectWall;
} | null;
const HINT_TRANSITION_MS = 200;
const HINT_HANDOFF_DELAY_MS = 150;
const RESIZE_DIMENSION_FONT_FAMILY = MEASUREMENT_TEXT_FONT_FAMILY;
const RESIZE_DIMENSION_FONT_SIZE_PX = 12;
const RESIZE_DIMENSION_FONT_WEIGHT = "500";
const RESIZE_DIMENSION_LETTER_SPACING_PX = 0.2;
const RESIZE_DIMENSION_PADDING_X_PX = 8;
const RESIZE_DIMENSION_PADDING_Y_PX = 4;
const RESIZE_DIMENSION_RADIUS_PX = 8;
const RESIZE_DIMENSION_EDGE_OFFSET_PX = 18;
const RESIZE_DIMENSION_VIEWPORT_MARGIN_PX = 10;
const RESIZE_DIMENSION_LABEL_GAP_PX = 12;
const RESIZE_DIMENSION_MIN_SHORT_WALL_PX = 96;
const RESIZE_DIMENSION_MIN_VISIBLE_WALL_PX = 20;
const RESIZE_DIMENSION_SHORT_WALL_EXTRA_OFFSET_PX = 8;
const RESIZE_DIMENSION_CORNER_SEPARATION_PX = 10;
const RESIZE_DIMENSION_ACTIVE_FILL_ALPHA = 1;
const RESIZE_DIMENSION_ACTIVE_STROKE_ALPHA = 0.62;
const RESIZE_DIMENSION_ACTIVE_TEXT_ALPHA = 1;
const TOTAL_ONBOARDING_STEPS = 6;

function isDefaultRoomName(name: string) {
  return /^Room \d+$/.test(name);
}

function getLatestHistoryCommand(commandHistory: { past: EditorCommand[] }) {
  return commandHistory.past[commandHistory.past.length - 1] ?? null;
}

function getScaledMeasurementPx(
  value: number,
  settings: Pick<EditorSettings, "measurementFontSize">
): number {
  return value * getMeasurementTextScale(settings);
}

export default function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const roomRef = useRef<Graphics | null>(null);
  const wallOverlayRef = useRef<Graphics | null>(null);
  const roomLabelRef = useRef<Container | null>(null);
  const draftRef = useRef<Graphics | null>(null);
  const dimensionOverlayRef = useRef<Container | null>(null);
  const cursorWorldRef = useRef<Point | null>(null);
  const hoveredRoomLabelIdRef = useRef<string | null>(null);
  const hoveredSelectableWallRef = useRef<{
    roomId: string;
    wall: RectWall;
  } | null>(EMPTY_HOVERED_SELECTABLE_WALL);
  const roomResizeUiRef = useRef<{
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeRoomId: string | null;
  }>({ ...EMPTY_ROOM_RESIZE_UI });
  const transformFeedbackRef = useRef<TransformFeedback | null>(null);
  const transformAnimationFrameRef = useRef<number | null>(null);
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

  const drawCurrentScene = useCallback(() => {
    const grid = gridRef.current;
    const rooms = roomRef.current;
    const wallOverlay = wallOverlayRef.current;
    const roomLabels = roomLabelRef.current;
    const draft = draftRef.current;
    const dimensionOverlay = dimensionOverlayRef.current;
    if (!grid || !rooms || !wallOverlay || !roomLabels || !draft || !dimensionOverlay) return;

    drawScene(
      grid,
      rooms,
      wallOverlay,
      roomLabels,
      draft,
      dimensionOverlay,
      useEditorStore.getState(),
      cursorWorldRef.current,
      hoveredRoomLabelIdRef.current,
      hoveredSelectableWallRef.current,
      roomResizeUiRef.current,
      transformFeedbackRef.current,
      editorThemeRef.current
    );
  }, []);

  const stopTransformAnimation = useCallback(() => {
    if (transformAnimationFrameRef.current === null) return;
    cancelAnimationFrame(transformAnimationFrameRef.current);
    transformAnimationFrameRef.current = null;
  }, []);

  const startTransformAnimation = useCallback(() => {
    if (transformAnimationFrameRef.current !== null) return;

    const step = () => {
      const feedback = transformFeedbackRef.current;
      if (!feedback || feedback.phase !== "settling") {
        transformAnimationFrameRef.current = null;
        return;
      }

      drawCurrentScene();

      if (performance.now() - feedback.phaseStartedAtMs >= TRANSFORM_SETTLE_TOTAL_MS) {
        transformAnimationFrameRef.current = null;
        return;
      }

      transformAnimationFrameRef.current = requestAnimationFrame(step);
    };

    transformAnimationFrameRef.current = requestAnimationFrame(step);
  }, [drawCurrentScene]);

  const setTransformFeedback = useCallback(
    (feedback: TransformFeedback | null) => {
      transformFeedbackRef.current = feedback;
      if (feedback?.phase === "settling") {
        startTransformAnimation();
      } else {
        stopTransformAnimation();
      }
    },
    [startTransformAnimation, stopTransformAnimation]
  );

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
      trackOncePerSession(ANALYTICS_EVENTS.onboardingStarted);
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
      if (next.length === TOTAL_ONBOARDING_STEPS) {
        trackOncePerSession(ANALYTICS_EVENTS.onboardingCompleted, {
          stepsCompleted: next.length,
        });
      }
      return next;
    });
  }, []);

  const exportCurrentCanvasAsPng = useCallback(async (signatureText?: string) => {
    const app = appRef.current;
    if (!app || isExportingPng) return;

    track(ANALYTICS_EVENTS.exportStarted, {
      exportType: "png",
    });
    trackFirstAction(ANALYTICS_EVENTS.exportStarted);

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
    const exportWallOverlayGraphics = new Graphics();
    const exportRoomLabels = new Container();
    const exportDraftGraphics = new Graphics();
    exportStage.addChild(exportRoomGraphics);
    exportStage.addChild(exportWallOverlayGraphics);
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
    drawWallInteractionOverlay(
      exportWallOverlayGraphics,
      state.document.rooms,
      null,
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
      state.settings,
      null,
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
      track(ANALYTICS_EVENTS.exportCompleted, {
        exportType: "png",
      });
      trackFirstSuccess(ANALYTICS_EVENTS.exportCompleted);
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
    let cancelled = false;

    void preloadEditorCanvasFonts().then(() => {
      if (!cancelled) {
        drawCurrentScene();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [drawCurrentScene]);

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
    trackAppOpened();
  }, []);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      const didCreateRoom = state.document.rooms.length === previousState.document.rooms.length + 1;
      if (!didCreateRoom) return;

      track(ANALYTICS_EVENTS.roomCreated, {
        inputMethod: "draw",
      });
      trackFirstAction(ANALYTICS_EVENTS.roomCreated);
      trackFirstSuccess(ANALYTICS_EVENTS.roomCreated);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      if (state.history.past.length <= previousState.history.past.length) return;

      const latestCommand = getLatestHistoryCommand(state.history);
      if (!latestCommand || latestCommand.type !== "rename-room") return;

      track(ANALYTICS_EVENTS.roomRenamed, {
        renamedFromDefault: isDefaultRoomName(latestCommand.previousName),
      });
    });

    return unsubscribe;
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
    return attachHistoryHotkeys(useEditorStore);
  }, []);

  useEffect(() => {
    return attachDeleteRoomHotkeys(useEditorStore);
  }, []);

  useEffect(() => {
    const syncDimensionsOverride = (isActive: boolean) => {
      useEditorStore.getState().setDimensionsVisibilityOverrideActive(isActive);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      syncDimensionsOverride(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      syncDimensionsOverride(event.altKey);
    };

    const clearDimensionsOverride = () => {
      syncDimensionsOverride(false);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearDimensionsOverride();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearDimensionsOverride);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearDimensionsOverride);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearDimensionsOverride();
    };
  }, []);

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
      const wallOverlay = new Graphics();
      const roomLabels = new Container();
      const draft = new Graphics();
      const dimensionOverlay = new Container();
      gridRef.current = grid;
      roomRef.current = rooms;
      wallOverlayRef.current = wallOverlay;
      roomLabelRef.current = roomLabels;
      draftRef.current = draft;
      dimensionOverlayRef.current = dimensionOverlay;
      app.stage.addChild(grid);
      app.stage.addChild(rooms);
      app.stage.addChild(wallOverlay);
      app.stage.addChild(roomLabels);
      app.stage.addChild(draft);
      app.stage.addChild(dimensionOverlay);

      const syncViewport = () => {
        useEditorStore.getState().setViewport(app.screen.width, app.screen.height);
      };

      syncViewport();
      drawCurrentScene();

      const handleResize = () => {
        syncViewport();
      };

      app.renderer.on("resize", handleResize);

      const unsubscribe = useEditorStore.subscribe(() => {
        drawCurrentScene();
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
        onTransformFeedbackChange: (feedback) => {
          setTransformFeedback(feedback);
        },
        onRoomResizeCommitted: () => {
          if (activeHintIdRef.current !== "resize-room-by-dragging-edges") return;
          completeHint("resize-room-by-dragging-edges");
        },
        requestRender: () => {
          drawCurrentScene();
        },
      });
      const detachRoomDrawInput = attachRoomDrawInput(app.canvas, useEditorStore, {
        onCursorWorldChange: (cursorWorld) => {
          cursorWorldRef.current = cursorWorld;
        },
        onHoveredRoomLabelChange: (roomId) => {
          hoveredRoomLabelIdRef.current = roomId;
        },
        onHoveredSelectableWallChange: (wallSelection) => {
          hoveredSelectableWallRef.current = wallSelection;
        },
        onTransformFeedbackChange: (feedback) => {
          setTransformFeedback(feedback);
        },
        onRoomLabelSelected: () => {
          if (activeHintIdRef.current !== "select-room-by-name") return;
          completeHint("select-room-by-name");
        },
        requestRender: () => {
          drawCurrentScene();
        },
      });

      return () => {
        detachPanZoomInput();
        detachRoomResizeInput();
        detachRoomDrawInput();
        unsubscribe();
        app.renderer.off("resize", handleResize);
        appRef.current = null;
        setIsCanvasReadyForExport(false);
        gridRef.current = null;
        roomRef.current = null;
        wallOverlayRef.current = null;
        roomLabelRef.current = null;
        draftRef.current = null;
        dimensionOverlayRef.current = null;
        setTransformFeedback(null);
        stopTransformAnimation();
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
  }, [completeHint, drawCurrentScene, setTransformFeedback, stopTransformAnimation]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    app.renderer.background.color = editorTheme.canvasBackground;
    drawCurrentScene();
  }, [drawCurrentScene, editorTheme]);

  return (
    <section
      aria-label="SpaceForge floor plan editor canvas"
      aria-describedby={instructionsId}
      role="region"
      className="relative h-full w-full"
    >
      <p id={instructionsId} className="sr-only">
        Editor controls: left click places room corners while drafting. Click a room name label or
        room body to select that room. When a room is selected, click near one of that room&apos;s
        wall edges to select that wall. Clicking outside a selected room clears selection first,
        then a following click can start drawing. Hold Space and drag to pan, middle mouse drag
        also pans, mouse wheel zooms, and Escape cancels the current room draft or clears
        selection. Right click also cancels the current room draft. Undo is Cmd or Ctrl plus Z,
        and redo is Shift+Cmd+Z or Ctrl+Y.
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
  wallOverlayGraphics: Graphics,
  roomLabelContainer: Container,
  draftGraphics: Graphics,
  dimensionOverlayContainer: Container,
  state: EditorSnapshot,
  cursorWorld: Point | null,
  hoveredRoomLabelId: string | null,
  hoveredSelectableWall: {
    roomId: string;
    wall: RectWall;
  } | null,
  roomResizeUi: {
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeRoomId: string | null;
  },
  transformFeedback: TransformFeedback | null,
  theme: EditorCanvasTheme
) {
  drawGrid(gridGraphics, state.camera, state.viewport, theme);
  const showDimensions = shouldShowDimensions(
    state.settings,
    state.isDimensionsVisibilityOverrideActive
  );
  const renderedRooms = getRenderedRoomsForTransform(state.document.rooms, transformFeedback);
  const renderedLabelRooms = getRenderedRoomsForLabelTransform(
    state.document.rooms,
    transformFeedback
  );
  drawRooms(
    roomGraphics,
    renderedRooms,
    state.selectedRoomId,
    roomResizeUi,
    state.roomDraft.points.length > 0,
    state.camera,
    state.viewport,
    transformFeedback,
    theme
  );
  drawWallInteractionOverlay(
    wallOverlayGraphics,
    renderedRooms,
    state.selectedWall,
    hoveredSelectableWall,
    roomResizeUi,
    state.roomDraft.points.length > 0,
    state.camera,
    state.viewport,
    transformFeedback,
    theme
  );
  drawRoomLabels(
    roomLabelContainer,
    renderedLabelRooms,
    state.selectedRoomId,
    hoveredRoomLabelId,
    state.camera,
    state.viewport,
    state.settings,
    transformFeedback,
    theme
  );
  clearContainerChildren(dimensionOverlayContainer);
  if (showDimensions) {
    drawActiveResizeDimensions(
      dimensionOverlayContainer,
      renderedLabelRooms,
      roomResizeUi,
      state.camera,
      state.viewport,
      state.settings,
      theme
    );
    drawDraftDimensions(
      dimensionOverlayContainer,
      state.roomDraft.points,
      cursorWorld,
      state.camera,
      state.viewport,
      state.settings,
      theme
    );
  }
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
  transformFeedback: TransformFeedback | null,
  theme: EditorCanvasTheme
) {
  graphics.clear();
  const transformSettlingProgress =
    transformFeedback?.phase === "settling"
      ? getTransformSettlingProgress(transformFeedback, performance.now())
      : null;
  const destinationPreviewPoints =
    transformFeedback?.phase === "settling"
      ? transformFeedback.settleTarget?.points ?? transformFeedback.previewPoints
      : transformFeedback?.previewPoints ?? null;
  const shouldShowDestinationPreview =
    !!transformFeedback &&
    !!destinationPreviewPoints &&
    destinationPreviewPoints.length >= 3 &&
    (!arePointListsEqual(destinationPreviewPoints, transformFeedback.originalPoints) ||
      transformFeedback.phase === "settling");
  const destinationPreviewAlpha =
    transformFeedback?.phase === "settling"
      ? 1 - easeOutCubic(transformSettlingProgress?.previewFadeProgress ?? 1)
      : transformFeedback
        ? 1
        : 0;

  if (shouldShowDestinationPreview && destinationPreviewAlpha > 0.02) {
    drawTransformDestinationPreview(
      graphics,
      destinationPreviewPoints!,
      camera,
      viewport,
      theme,
      destinationPreviewAlpha
    );
  }

  for (const room of rooms) {
    if (room.points.length < 3) continue;
    const isSelected = room.id === selectedRoomId;
    const isActiveTransformRoom = transformFeedback?.roomId === room.id;
    const isTransformActive = isActiveTransformRoom && transformFeedback?.phase === "active";
    const isTransformSettling = isActiveTransformRoom && transformFeedback?.phase === "settling";
    const selectedFillAlpha = isTransformActive
      ? 0.1
      : isTransformSettling
        ? 0.1 + 0.1 * getTransformRoomEase(transformFeedback)
        : 0.2;
    const selectedStrokeAlpha = isTransformActive
      ? 0.82
      : isTransformSettling
        ? 0.82 + 0.18 * getTransformRoomEase(transformFeedback)
        : 1;
    const selectedStrokeWidth = isTransformActive
      ? 2.2
      : isTransformSettling
        ? 2.2 + 0.3 * getTransformRoomEase(transformFeedback)
        : 2.5;

    drawRoomShape(
      graphics,
      room.points,
      camera,
      viewport,
      isSelected ? theme.roomSelectionOutline : theme.roomOutline,
      isSelected ? selectedFillAlpha : 0.12,
      isSelected ? selectedStrokeWidth : 2,
      isSelected ? selectedStrokeAlpha : 0.9
    );

    if (!isSelected || isDraftingRoom || isActiveTransformRoom) continue;
    const bounds = getAxisAlignedRoomBounds(room);
    if (!bounds) continue;
    const declutter = getRoomDeclutterState(room, camera, viewport);
    if (!declutter.showSelectionControls) continue;
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

function drawWallInteractionOverlay(
  graphics: Graphics,
  rooms: Room[],
  selectedWall: RoomWallSelection | null,
  hoveredSelectableWall: {
    roomId: string;
    wall: RectWall;
  } | null,
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
  transformFeedback: TransformFeedback | null,
  theme: EditorCanvasTheme
) {
  graphics.clear();
  if (isDraftingRoom) return;

  let hoveredBounds: ReturnType<typeof getAxisAlignedRoomBounds> = null;
  let hoveredWall: RectWall | null = null;

  if (hoveredSelectableWall) {
    const hoveredRoom = rooms.find((room) => room.id === hoveredSelectableWall.roomId);
    if (hoveredRoom && transformFeedback?.roomId !== hoveredRoom.id) {
      hoveredBounds = getAxisAlignedRoomBounds(hoveredRoom);
      hoveredWall = hoveredSelectableWall.wall;
    }
  } else if (roomResizeUi.hoveredRoomId && roomResizeUi.hoveredWall) {
    const hoveredRoom = rooms.find((room) => room.id === roomResizeUi.hoveredRoomId);
    if (hoveredRoom && transformFeedback?.roomId !== hoveredRoom.id) {
      hoveredBounds = getAxisAlignedRoomBounds(hoveredRoom);
      hoveredWall = roomResizeUi.hoveredWall;
    }
  }

  const isSelectedWallAlsoHovered =
    hoveredWall !== null &&
    selectedWall?.roomId === (hoveredSelectableWall?.roomId ?? roomResizeUi.hoveredRoomId) &&
    selectedWall.wall === hoveredWall;

  if (hoveredBounds && hoveredWall && !isSelectedWallAlsoHovered) {
    drawHoveredWallHighlight(graphics, hoveredBounds, hoveredWall, camera, viewport, theme);
  }

  if (!selectedWall) return;
  const selectedRoom = rooms.find((room) => room.id === selectedWall.roomId);
  if (!selectedRoom) return;
  if (transformFeedback?.roomId === selectedRoom.id) return;

  const selectedBounds = getAxisAlignedRoomBounds(selectedRoom);
  if (!selectedBounds) return;

  drawSelectedWallHighlight(graphics, selectedBounds, selectedWall.wall, camera, viewport, theme);
}

function getRenderedRoomsForTransform(rooms: Room[], transformFeedback: TransformFeedback | null): Room[] {
  if (!transformFeedback) return rooms;

  const transformedPoints = getRenderedTransformRoomPoints(transformFeedback);
  if (!transformedPoints) return rooms;

  return rooms.map((room) =>
    room.id === transformFeedback.roomId
      ? {
          ...room,
          points: transformedPoints,
        }
      : room
  );
}

function getRenderedRoomsForLabelTransform(
  rooms: Room[],
  transformFeedback: TransformFeedback | null
): Room[] {
  if (!transformFeedback) return rooms;

  const transformedPoints =
    transformFeedback.mode === "resize" && transformFeedback.phase === "active"
      ? transformFeedback.previewPoints
      : getRenderedTransformRoomPoints(transformFeedback);
  if (!transformedPoints) return rooms;

  return rooms.map((room) =>
    room.id === transformFeedback.roomId
      ? {
          ...room,
          points: transformedPoints,
        }
      : room
  );
}

function getRenderedTransformRoomPoints(transformFeedback: TransformFeedback): Point[] | null {
  if (transformFeedback.phase === "active") {
    return transformFeedback.originalPoints;
  }

  if (transformFeedback.phase === "settling" && transformFeedback.settleTarget?.points) {
    return interpolatePointLists(
      transformFeedback.originalPoints,
      transformFeedback.settleTarget.points,
      getTransformRoomEase(transformFeedback)
    );
  }

  return transformFeedback.previewPoints;
}

function getTransformRoomEase(transformFeedback: TransformFeedback) {
  if (transformFeedback.phase !== "settling") return 1;
  return easeOutCubic(
    getTransformSettlingProgress(transformFeedback, performance.now()).roomProgress
  );
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

function drawTransformDestinationPreview(
  graphics: Graphics,
  points: Point[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme,
  alpha: number
) {
  const screenPoints = points.map((point) => worldToScreen(point, camera, viewport));

  graphics.setFillStyle({
    color: theme.interactiveAccent,
    alpha: 0.055 * alpha,
  });
  graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let index = 1; index < screenPoints.length; index += 1) {
    graphics.lineTo(screenPoints[index].x, screenPoints[index].y);
  }
  graphics.closePath();
  graphics.fill();

  graphics.setStrokeStyle({
    width: 11,
    color: theme.interactiveAccent,
    alpha: 0.12 * alpha,
  });
  graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let index = 1; index < screenPoints.length; index += 1) {
    graphics.lineTo(screenPoints[index].x, screenPoints[index].y);
  }
  graphics.closePath();
  graphics.stroke();

  graphics.setStrokeStyle({
    width: 5.5,
    color: theme.interactiveAccent,
    alpha: 0.2 * alpha,
  });
  graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let index = 1; index < screenPoints.length; index += 1) {
    graphics.lineTo(screenPoints[index].x, screenPoints[index].y);
  }
  graphics.closePath();
  graphics.stroke();

  graphics.setStrokeStyle({
    width: 1.9,
    color: theme.interactiveAccent,
    alpha: 0.82 * alpha,
  });
  graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let index = 1; index < screenPoints.length; index += 1) {
    graphics.lineTo(screenPoints[index].x, screenPoints[index].y);
  }
  graphics.closePath();
  graphics.stroke();
}

function getTransformSettlingProgress(transformFeedback: TransformFeedback, nowMs: number) {
  const elapsed = Math.max(0, nowMs - transformFeedback.phaseStartedAtMs);

  return {
    roomProgress: Math.min(1, elapsed / TRANSFORM_SETTLE_ROOM_ANIMATION_MS),
    previewFadeProgress:
      elapsed <= TRANSFORM_SETTLE_ROOM_ANIMATION_MS
        ? 0
        : Math.min(
            1,
            (elapsed - TRANSFORM_SETTLE_ROOM_ANIMATION_MS) / TRANSFORM_SETTLE_PREVIEW_FADE_MS
          ),
  };
}

function interpolatePointLists(from: Point[], to: Point[], t: number): Point[] {
  if (from.length !== to.length) {
    return to.map((point) => ({ ...point }));
  }

  return to.map((targetPoint, index) => {
    const sourcePoint = from[index];
    return {
      x: sourcePoint.x + (targetPoint.x - sourcePoint.x) * t,
      y: sourcePoint.y + (targetPoint.y - sourcePoint.y) * t,
    };
  });
}

function arePointListsEqual(a: Point[], b: Point[]) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index].x !== b[index].x || a[index].y !== b[index].y) return false;
  }
  return true;
}

function drawHoveredWallHighlight(
  graphics: Graphics,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  wall: RectWall,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const { from, to } = getWallScreenSegment(bounds, wall, camera, viewport);

  graphics.setStrokeStyle({
    width: 2,
    color: theme.wallSelectionAccent,
    alpha: 0.55,
  });
  graphics.moveTo(from.x, from.y);
  graphics.lineTo(to.x, to.y);
  graphics.stroke();
}

function drawSelectedWallHighlight(
  graphics: Graphics,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  wall: RectWall,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const { from, to } = getWallScreenSegment(bounds, wall, camera, viewport);

  graphics.setStrokeStyle({
    width: 5,
    color: theme.canvasBackground,
    alpha: 0.96,
  });
  graphics.moveTo(from.x, from.y);
  graphics.lineTo(to.x, to.y);
  graphics.stroke();

  graphics.setStrokeStyle({
    width: 3,
    color: theme.wallSelectionAccent,
    alpha: 1,
  });
  graphics.moveTo(from.x, from.y);
  graphics.lineTo(to.x, to.y);
  graphics.stroke();
}

function getWallScreenSegment(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  wall: RectWall,
  camera: CameraState,
  viewport: ViewportSize
) {
  const topLeft = worldToScreen({ x: bounds.minX, y: bounds.minY }, camera, viewport);
  const topRight = worldToScreen({ x: bounds.maxX, y: bounds.minY }, camera, viewport);
  const bottomRight = worldToScreen({ x: bounds.maxX, y: bounds.maxY }, camera, viewport);
  const bottomLeft = worldToScreen({ x: bounds.minX, y: bounds.maxY }, camera, viewport);

  switch (wall) {
    case "top":
      return { from: topLeft, to: topRight };
    case "right":
      return { from: topRight, to: bottomRight };
    case "bottom":
      return { from: bottomLeft, to: bottomRight };
    case "left":
      return { from: topLeft, to: bottomLeft };
  }
}

function drawRoomLabels(
  labelContainer: Container,
  rooms: Room[],
  selectedRoomId: string | null,
  hoveredRoomLabelId: string | null,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">,
  transformFeedback: TransformFeedback | null,
  theme: EditorCanvasTheme
) {
  clearContainerChildren(labelContainer);
  const measurementTextScale = getMeasurementTextScale(settings);
  const areaFontSizePx = getScaledMeasurementPx(ROOM_LABEL_AREA_FONT_SIZE_PX, settings);

  for (const room of rooms) {
    const layout = getRoomLabelLayout(room, camera, viewport, settings);
    if (!layout) continue;
    const textResolution = getTextResolution();
    const left = snapToPixel(layout.left, textResolution);
    const top = snapToPixel(layout.top, textResolution);
    const width = snapToPixel(layout.width, textResolution);
    const height = snapToPixel(layout.height, textResolution);
    const centerX = snapToPixel(layout.center.x, textResolution);
    const nameCenterY = snapToPixel(layout.nameCenterY, textResolution);
    const areaCenterY =
      layout.areaCenterY === null ? null : snapToPixel(layout.areaCenterY, textResolution);

    const isSelected = selectedRoomId === room.id;
    const isHovered = hoveredRoomLabelId === room.id;
    const isActiveResizeRoom =
      transformFeedback?.roomId === room.id &&
      transformFeedback.mode === "resize" &&
      transformFeedback.phase === "active";
    const isSettlingResizeRoom =
      transformFeedback?.roomId === room.id &&
      transformFeedback.mode === "resize" &&
      transformFeedback.phase === "settling";
    const resizeMotionEase = isSettlingResizeRoom ? getTransformRoomEase(transformFeedback) : 1;
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

    const nameText = new Text({
      text: layout.nameText,
      resolution: textResolution,
      style: {
        fontFamily: ROOM_LABEL_NAME_FONT_FAMILY,
        fontSize: ROOM_LABEL_NAME_FONT_SIZE_PX,
        fontWeight: ROOM_LABEL_NAME_FONT_WEIGHT,
        fill: theme.roomLabelFill,
        stroke: {
          color: theme.roomLabelStroke,
          width: 2,
          join: "round",
        },
      },
    });
    nameText.roundPixels = true;
    nameText.anchor.set(0.5);
    nameText.position.set(centerX, nameCenterY);
    nameText.alpha = layout.isPlaceholderName ? 0.72 : isHovered || isSelected ? 0.98 : 0.92;
    labelContainer.addChild(nameText);

    if (layout.areaText && areaCenterY !== null) {
      const areaText = new Text({
        text: layout.areaText,
        resolution: textResolution,
        style: {
          fontFamily: ROOM_LABEL_AREA_FONT_FAMILY,
          fontSize: areaFontSizePx,
          fontWeight: ROOM_LABEL_AREA_FONT_WEIGHT,
          fill: theme.roomLabelFill,
          stroke: {
            color: theme.roomLabelStroke,
            width: 1.75 * measurementTextScale,
            join: "round",
          },
          letterSpacing: 0.15 * measurementTextScale,
        },
      });
      areaText.roundPixels = true;
      areaText.anchor.set(0.5);
      areaText.position.set(centerX, areaCenterY);
      areaText.alpha = isActiveResizeRoom
        ? 0.94
        : isSettlingResizeRoom
          ? 0.78 + 0.16 * resizeMotionEase
          : isHovered || isSelected
            ? 0.84
            : 0.78;
      areaText.scale.set(
        isActiveResizeRoom ? 1.02 : isSettlingResizeRoom ? 1 + 0.02 * resizeMotionEase : 1
      );
      labelContainer.addChild(areaText);
    }
  }
}

type ResizeDimensionLabelSpec = {
  text: string;
  wall: RectWall;
  axis: "horizontal" | "vertical";
  center: ScreenPoint;
  outwardDirection: ScreenPoint;
  tangentDirection: ScreenPoint;
  wallLengthPx: number;
};

type ResizeDimensionLabelLayout = {
  text: string;
  center: ScreenPoint;
  outwardDirection: ScreenPoint;
  tangentDirection: ScreenPoint;
  width: number;
  height: number;
};

function drawActiveResizeDimensions(
  labelContainer: Container,
  rooms: Room[],
  roomResizeUi: {
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeRoomId: string | null;
  },
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme
) {
  if (!roomResizeUi.activeRoomId) return;
  if (!roomResizeUi.activeWall && !roomResizeUi.activeCorner) return;

  const activeRoom = rooms.find((room) => room.id === roomResizeUi.activeRoomId);
  if (!activeRoom) return;

  const bounds = getAxisAlignedRoomBounds(activeRoom);
  if (!bounds) return;

  const roomLabelLayout = getRoomLabelLayout(activeRoom, camera, viewport, settings);
  const labelSpecs = getResizeDimensionLabelSpecs(
    activeRoom,
    bounds,
    roomResizeUi.activeWall,
    roomResizeUi.activeCorner,
    camera,
    viewport,
    settings
  );
  const labelLayouts = getResolvedResizeDimensionLabelLayouts(
    labelSpecs,
    roomLabelLayout,
    viewport,
    settings
  );
  drawDimensionLabels(labelContainer, labelLayouts, settings, theme);
}

function drawDraftDimensions(
  labelContainer: Container,
  draftPoints: Point[],
  cursorWorld: Point | null,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme
) {
  const firstSegmentLabelSpec = getDraftFirstSegmentDimensionLabelSpec(
    draftPoints,
    cursorWorld,
    camera,
    viewport
  );
  if (firstSegmentLabelSpec) {
    const labelLayouts = getResolvedResizeDimensionLabelLayouts(
      [firstSegmentLabelSpec],
      null,
      viewport,
      settings
    );
    drawDimensionLabels(labelContainer, labelLayouts, settings, theme);
    return;
  }

  const draftPreviewRoom = getDraftPreviewRoom(draftPoints, cursorWorld);
  if (!draftPreviewRoom) return;

  const bounds = getAxisAlignedRoomBounds(draftPreviewRoom);
  if (!bounds) return;

  const measurements = getRectResizeMeasurements(draftPreviewRoom);
  if (!measurements) return;
  const draftDimensionWalls = getDraftDimensionWalls(draftPoints, draftPreviewRoom);

  const labelLayouts = getResolvedResizeDimensionLabelLayouts(
    [
      createDimensionLabelSpecForWallMeasurement(
        draftDimensionWalls.horizontalWall,
        measurements.widthMillimetres,
        bounds,
        camera,
        viewport,
        settings
      ),
      createDimensionLabelSpecForWallMeasurement(
        draftDimensionWalls.verticalWall,
        measurements.heightMillimetres,
        bounds,
        camera,
        viewport,
        settings
      ),
    ],
    null,
    viewport,
    settings
  );

  drawDimensionLabels(labelContainer, labelLayouts, settings, theme);
}

function drawDimensionLabels(
  labelContainer: Container,
  labelLayouts: ResizeDimensionLabelLayout[],
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme
) {
  const measurementTextScale = getMeasurementTextScale(settings);
  const dimensionFontSizePx = getScaledMeasurementPx(RESIZE_DIMENSION_FONT_SIZE_PX, settings);
  const dimensionRadiusPx = getScaledMeasurementPx(RESIZE_DIMENSION_RADIUS_PX, settings);

  for (const labelLayout of labelLayouts) {
    const textResolution = getTextResolution();
    const text = new Text({
      text: labelLayout.text,
      resolution: textResolution,
      style: {
        fontFamily: RESIZE_DIMENSION_FONT_FAMILY,
        fontSize: dimensionFontSizePx,
        fontWeight: RESIZE_DIMENSION_FONT_WEIGHT,
        fill: theme.roomLabelFill,
        stroke: {
          color: theme.roomLabelStroke,
          width: 1.75 * measurementTextScale,
          join: "round",
        },
        letterSpacing: RESIZE_DIMENSION_LETTER_SPACING_PX * measurementTextScale,
      },
    });

    const pill = new Graphics();
    const left = snapToPixel(labelLayout.center.x - labelLayout.width / 2, textResolution);
    const top = snapToPixel(labelLayout.center.y - labelLayout.height / 2, textResolution);
    const width = snapToPixel(labelLayout.width, textResolution);
    const height = snapToPixel(labelLayout.height, textResolution);
    pill.setFillStyle({ color: theme.roomLabelPillFill, alpha: RESIZE_DIMENSION_ACTIVE_FILL_ALPHA });
    pill.roundRect(left, top, width, height, dimensionRadiusPx);
    pill.fill();
    pill.setStrokeStyle({
      width: 1.1 * measurementTextScale,
      color: theme.roomLabelPillSelectedStroke,
      alpha: RESIZE_DIMENSION_ACTIVE_STROKE_ALPHA,
    });
    pill.roundRect(left, top, width, height, dimensionRadiusPx);
    pill.stroke();
    labelContainer.addChild(pill);

    text.roundPixels = true;
    text.anchor.set(0.5);
    text.position.set(
      snapToPixel(labelLayout.center.x, textResolution),
      snapToPixel(labelLayout.center.y, textResolution)
    );
    text.alpha = RESIZE_DIMENSION_ACTIVE_TEXT_ALPHA;
    labelContainer.addChild(text);
  }
}

function getResizeDimensionLabelSpecs(
  room: Room,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  activeWall: RectWall | null,
  activeCorner: RectCorner | null,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">
): ResizeDimensionLabelSpec[] {
  if (activeWall) {
    const measurement = getWallResizeMeasurementMillimetres(room, activeWall);
    if (measurement === null) return [];

    return [
      createDimensionLabelSpecForWallMeasurement(
        activeWall,
        measurement,
        bounds,
        camera,
        viewport,
        settings
      ),
    ];
  }

  if (activeCorner) {
    const measurements = getCornerResizeMeasurements(room, activeCorner);
    if (!measurements) return [];

    const { horizontalWall, verticalWall } = getResizeWallsForCorner(activeCorner);

    return [
      createDimensionLabelSpecForWallMeasurement(
        horizontalWall,
        measurements.widthMillimetres,
        bounds,
        camera,
        viewport,
        settings
      ),
      createDimensionLabelSpecForWallMeasurement(
        verticalWall,
        measurements.heightMillimetres,
        bounds,
        camera,
        viewport,
        settings
      ),
    ];
  }

  return [];
}

function getResizeWallsForCorner(corner: RectCorner): {
  horizontalWall: Extract<RectWall, "top" | "bottom">;
  verticalWall: Extract<RectWall, "left" | "right">;
} {
  switch (corner) {
    case "top-left":
      return { horizontalWall: "top", verticalWall: "left" };
    case "top-right":
      return { horizontalWall: "top", verticalWall: "right" };
    case "bottom-right":
      return { horizontalWall: "bottom", verticalWall: "right" };
    case "bottom-left":
      return { horizontalWall: "bottom", verticalWall: "left" };
  }
}

function createDimensionLabelSpecForWallMeasurement(
  wall: RectWall,
  lengthMillimetres: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">
): ResizeDimensionLabelSpec {
  return {
    text: formatMetricWallDimension(lengthMillimetres),
    wall,
    axis: wall === "top" || wall === "bottom" ? "horizontal" : "vertical",
    ...getResizeDimensionAnchorForWall(bounds, wall, camera, viewport, settings),
  };
}

function getResizeDimensionAnchorForWall(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  wall: RectWall,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">
): Pick<
  ResizeDimensionLabelSpec,
  "center" | "outwardDirection" | "tangentDirection" | "wallLengthPx"
> {
  const topLeft = worldToScreen({ x: bounds.minX, y: bounds.minY }, camera, viewport);
  const topRight = worldToScreen({ x: bounds.maxX, y: bounds.minY }, camera, viewport);
  const bottomRight = worldToScreen({ x: bounds.maxX, y: bounds.maxY }, camera, viewport);
  const bottomLeft = worldToScreen({ x: bounds.minX, y: bounds.maxY }, camera, viewport);
  const horizontalWallLengthPx = Math.abs(topRight.x - topLeft.x);
  const verticalWallLengthPx = Math.abs(bottomLeft.y - topLeft.y);

  const getEdgeOffsetPx = (wallLengthPx: number) =>
    wallLengthPx < RESIZE_DIMENSION_MIN_SHORT_WALL_PX
      ? getScaledMeasurementPx(
          RESIZE_DIMENSION_EDGE_OFFSET_PX + RESIZE_DIMENSION_SHORT_WALL_EXTRA_OFFSET_PX,
          settings
        )
      : getScaledMeasurementPx(RESIZE_DIMENSION_EDGE_OFFSET_PX, settings);

  switch (wall) {
    case "top":
      return {
        center: {
          x: (topLeft.x + topRight.x) / 2,
          y: topLeft.y - getEdgeOffsetPx(horizontalWallLengthPx),
        },
        outwardDirection: { x: 0, y: -1 },
        tangentDirection: { x: 1, y: 0 },
        wallLengthPx: horizontalWallLengthPx,
      };
    case "right":
      return {
        center: {
          x: topRight.x + getEdgeOffsetPx(verticalWallLengthPx),
          y: (topRight.y + bottomRight.y) / 2,
        },
        outwardDirection: { x: 1, y: 0 },
        tangentDirection: { x: 0, y: 1 },
        wallLengthPx: verticalWallLengthPx,
      };
    case "bottom":
      return {
        center: {
          x: (bottomLeft.x + bottomRight.x) / 2,
          y: bottomLeft.y + getEdgeOffsetPx(horizontalWallLengthPx),
        },
        outwardDirection: { x: 0, y: 1 },
        tangentDirection: { x: 1, y: 0 },
        wallLengthPx: horizontalWallLengthPx,
      };
    case "left":
      return {
        center: {
          x: topLeft.x - getEdgeOffsetPx(verticalWallLengthPx),
          y: (topLeft.y + bottomLeft.y) / 2,
        },
        outwardDirection: { x: -1, y: 0 },
        tangentDirection: { x: 0, y: 1 },
        wallLengthPx: verticalWallLengthPx,
      };
  }
}

function getResolvedResizeDimensionLabelLayouts(
  labelSpecs: ResizeDimensionLabelSpec[],
  roomLabelLayout: ReturnType<typeof getRoomLabelLayout>,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">
): ResizeDimensionLabelLayout[] {
  const textResolution = getTextResolution();
  const measurementTextScale = getMeasurementTextScale(settings);
  const dimensionFontSizePx = getScaledMeasurementPx(RESIZE_DIMENSION_FONT_SIZE_PX, settings);
  const dimensionPaddingXPx = getScaledMeasurementPx(RESIZE_DIMENSION_PADDING_X_PX, settings);
  const dimensionPaddingYPx = getScaledMeasurementPx(RESIZE_DIMENSION_PADDING_Y_PX, settings);
  const labelGapPx = getScaledMeasurementPx(RESIZE_DIMENSION_LABEL_GAP_PX, settings);
  const cornerSeparationPx = getScaledMeasurementPx(RESIZE_DIMENSION_CORNER_SEPARATION_PX, settings);
  const labelLayouts = labelSpecs.map<ResizeDimensionLabelLayout>((labelSpec) => {
    const measurementText = new Text({
      text: labelSpec.text,
      resolution: textResolution,
      style: {
        fontFamily: RESIZE_DIMENSION_FONT_FAMILY,
        fontSize: dimensionFontSizePx,
        fontWeight: RESIZE_DIMENSION_FONT_WEIGHT,
        letterSpacing: RESIZE_DIMENSION_LETTER_SPACING_PX * measurementTextScale,
      },
    });
    const width = measurementText.width + dimensionPaddingXPx * 2;
    const height = measurementText.height + dimensionPaddingYPx * 2;
    measurementText.destroy();

    return {
      text: labelSpec.text,
      center: clampResizeDimensionLabelCenter(labelSpec.center, width, height, viewport),
      outwardDirection: labelSpec.outwardDirection,
      tangentDirection: labelSpec.tangentDirection,
      width,
      height,
    };
  }).filter((_, index) => labelSpecs[index].wallLengthPx >= RESIZE_DIMENSION_MIN_VISIBLE_WALL_PX);

  if (roomLabelLayout) {
    for (let index = 0; index < labelLayouts.length; index += 1) {
      labelLayouts[index] = nudgeResizeDimensionLabelAwayFromRect(
        labelLayouts[index],
        roomLabelLayout,
        viewport,
        roomLabelLayout.height + labelGapPx
      );
    }
  }

  for (let index = 0; index < labelLayouts.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < labelLayouts.length; otherIndex += 1) {
      if (!rectsOverlap(getCenteredRectFromLayout(labelLayouts[index]), getCenteredRectFromLayout(labelLayouts[otherIndex]))) {
        continue;
      }

      labelLayouts[index] = nudgeResizeDimensionLabel(
        labelLayouts[index],
        {
          x: -labelLayouts[index].tangentDirection.x,
          y: -labelLayouts[index].tangentDirection.y,
        },
        viewport,
        cornerSeparationPx
      );
      labelLayouts[otherIndex] = nudgeResizeDimensionLabel(
        labelLayouts[otherIndex],
        labelLayouts[otherIndex].tangentDirection,
        viewport,
        cornerSeparationPx
      );
    }
  }

  return labelLayouts;
}

function nudgeResizeDimensionLabelAwayFromRect(
  labelLayout: ResizeDimensionLabelLayout,
  rect: { left: number; right: number; top: number; bottom: number },
  viewport: ViewportSize,
  distancePx: number
): ResizeDimensionLabelLayout {
  if (!rectsOverlap(getCenteredRectFromLayout(labelLayout), rect)) {
    return labelLayout;
  }

  return nudgeResizeDimensionLabel(
    labelLayout,
    labelLayout.outwardDirection,
    viewport,
    distancePx
  );
}

function nudgeResizeDimensionLabel(
  labelLayout: ResizeDimensionLabelLayout,
  direction: ScreenPoint,
  viewport: ViewportSize,
  distancePx: number
): ResizeDimensionLabelLayout {
  return {
    ...labelLayout,
    center: clampResizeDimensionLabelCenter(
      {
        x: labelLayout.center.x + direction.x * distancePx,
        y: labelLayout.center.y + direction.y * distancePx,
      },
      labelLayout.width,
      labelLayout.height,
      viewport
    ),
  };
}

function getDraftPreviewRoom(draftPoints: Point[], cursorWorld: Point | null): Room | null {
  if (!cursorWorld) return null;
  if (draftPoints.length < 2) return null;

  if (draftPoints.length === 2) {
    const previewThirdPoint = getOrthogonalSnappedPoint(
      draftPoints[draftPoints.length - 1],
      cursorWorld,
      GRID_SIZE_MM
    );
    const previewPoints = [...draftPoints, previewThirdPoint];
    const closingPoint = getRectangleClosingPoint(previewPoints);
    if (!closingPoint) return null;

    return {
      id: "__draft-preview__",
      name: "",
      points: [...previewPoints, closingPoint],
    };
  }

  if (draftPoints.length === 3) {
    const closingPoint = getRectangleClosingPoint(draftPoints);
    if (!closingPoint) return null;

    return {
      id: "__draft-preview__",
      name: "",
      points: [...draftPoints, closingPoint],
    };
  }

  return null;
}

function getDraftDimensionWalls(
  draftPoints: Point[],
  draftPreviewRoom: Room
): {
  horizontalWall: Extract<RectWall, "top" | "bottom">;
  verticalWall: Extract<RectWall, "left" | "right">;
} {
  const [firstPoint, secondPoint, thirdPoint = draftPreviewRoom.points[2]] = draftPreviewRoom.points;

  if (firstPoint.y === secondPoint.y) {
    return {
      horizontalWall: thirdPoint.y > firstPoint.y ? "top" : "bottom",
      verticalWall: secondPoint.x > firstPoint.x ? "right" : "left",
    };
  }

  return {
    horizontalWall: secondPoint.y > firstPoint.y ? "bottom" : "top",
    verticalWall: thirdPoint.x > firstPoint.x ? "left" : "right",
  };
}

function clearContainerChildren(container: Container) {
  const staleChildren = container.removeChildren();
  staleChildren.forEach((child) => child.destroy());
}

function getDraftFirstSegmentDimensionLabelSpec(
  draftPoints: Point[],
  cursorWorld: Point | null,
  camera: CameraState,
  viewport: ViewportSize
): ResizeDimensionLabelSpec | null {
  if (!cursorWorld || draftPoints.length !== 1) return null;

  const anchorPoint = draftPoints[0];
  const previewPoint = getOrthogonalSnappedPoint(anchorPoint, cursorWorld, GRID_SIZE_MM);
  if (anchorPoint.x === previewPoint.x && anchorPoint.y === previewPoint.y) return null;

  const startScreen = worldToScreen(anchorPoint, camera, viewport);
  const endScreen = worldToScreen(previewPoint, camera, viewport);
  const isHorizontal = startScreen.y === endScreen.y;
  const wall: RectWall =
    isHorizontal
      ? startScreen.x <= endScreen.x
        ? "bottom"
        : "top"
      : startScreen.y <= endScreen.y
        ? "right"
        : "left";

  return {
    text: formatMetricWallDimension(getRectSegmentLengthMillimetres(anchorPoint, previewPoint)),
    wall,
    axis: isHorizontal ? "horizontal" : "vertical",
    center: {
      x: (startScreen.x + endScreen.x) / 2,
      y: (startScreen.y + endScreen.y) / 2,
    },
    outwardDirection: isHorizontal
      ? { x: 0, y: wall === "bottom" ? 1 : -1 }
      : { x: wall === "right" ? 1 : -1, y: 0 },
    tangentDirection: isHorizontal ? { x: 1, y: 0 } : { x: 0, y: 1 },
    wallLengthPx: isHorizontal ? Math.abs(endScreen.x - startScreen.x) : Math.abs(endScreen.y - startScreen.y),
  };
}

function getRectSegmentLengthMillimetres(start: Point, end: Point) {
  return Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
}

function clampResizeDimensionLabelCenter(
  center: ScreenPoint,
  width: number,
  height: number,
  viewport: ViewportSize
): ScreenPoint {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return {
    x: Math.min(
      viewport.width - RESIZE_DIMENSION_VIEWPORT_MARGIN_PX - halfWidth,
      Math.max(RESIZE_DIMENSION_VIEWPORT_MARGIN_PX + halfWidth, center.x)
    ),
    y: Math.min(
      viewport.height - RESIZE_DIMENSION_VIEWPORT_MARGIN_PX - halfHeight,
      Math.max(RESIZE_DIMENSION_VIEWPORT_MARGIN_PX + halfHeight, center.y)
    ),
  };
}

function getCenteredRect(center: ScreenPoint, width: number, height: number) {
  return {
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: center.y - height / 2,
    bottom: center.y + height / 2,
  };
}

function getCenteredRectFromLayout(labelLayout: ResizeDimensionLabelLayout) {
  return getCenteredRect(labelLayout.center, labelLayout.width, labelLayout.height);
}

function rectsOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number }
) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Application, Container, Graphics, Text } from "pixi.js";
import { screenToWorld, worldToScreen } from "@/lib/editor/camera";
import { GRID_MINOR_SIZE_MM, GRID_SIZE_MM, INITIAL_PIXELS_PER_MM } from "@/lib/editor/constants";
import {
  getOrthogonalSnappedPoint,
  pointsEqual,
  projectOrthogonalPoint,
  snapPointToGrid,
} from "@/lib/editor/geometry";
import { preloadEditorCanvasFonts } from "@/lib/editor/canvasTextFonts";
import { getConstrainedVertexHandleLayouts } from "@/lib/editor/constrainedVertexAdjustments";
import {
  DEFAULT_STAIR_TREAD_SPACING_MM,
  getInteriorAssetBoundsAsRectBounds,
  getRoomInteriorAssetBounds,
} from "@/lib/editor/interiorAssets";
import { getOrthogonalWallHandleLayouts } from "@/lib/editor/orthogonalWallResize";
import { getResolvedRoomOpeningLayout } from "@/lib/editor/openings";
import { getRoomWallMeasurement, getRoomWallSegment } from "@/lib/editor/openings";
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
import { isEditableTarget } from "@/lib/editor/input/editableTarget";
import { attachHistoryHotkeys } from "@/lib/editor/input/historyHotkeys";
import { getAutoFitExportFraming } from "@/lib/editor/exportAutoFitFraming";
import { getLayoutBoundsFromDocument } from "@/lib/editor/exportLayoutBounds";
import { exportPixiCanvasToPngBlob, exportPixiCanvasToPngDataUrl } from "@/lib/editor/exportPng";
import { exportPixiCanvasToThumbnailDataUrl } from "@/lib/editor/projectThumbnail";
import {
  isAxisAlignedRectangle,
  isOrthogonalPointPath,
  isPointInPolygon,
  isSimplePolygon,
} from "@/lib/editor/roomGeometry";
import { getEditorCanvasTheme, resolveEditorThemeMode, type EditorCanvasTheme } from "@/lib/editor/theme";
import {
  type ActiveEditorOnboardingHint,
  getActiveEditorOnboardingHint,
  loadCompletedEditorHintIds,
  loadDismissedEditorHintIds,
  saveCompletedEditorHintIds,
  saveDismissedEditorHintIds,
  type EditorOnboardingHintId,
  TOTAL_EDITOR_ONBOARDING_STEPS,
} from "@/lib/editor/onboardingHints";
import {
  getAxisAlignedRoomBounds,
  getCornerHandleLayouts,
  getWallHandleLayouts,
  type RectCorner,
  type RectWall,
} from "@/lib/editor/rectRoomResize";
import {
  formatMetricRoomAreaForRoom,
  formatMetricWallDimension,
  getEdgeLengthMillimetres,
  getRoomEdgeMeasurements,
  getRectResizeMeasurements,
  getCornerResizeMeasurements,
  getWallResizeMeasurementMillimetres,
} from "@/lib/editor/measurements";
import {
  getActiveSnapStepMm,
  getMagneticSnapGuidesForSettings,
  getPredictiveSnapGuides,
  getScaleOverlayState,
  getSnappedPointFromGuides,
  type SnapGuides,
} from "@/lib/editor/snapping";
import {
  getMeasurementTextScale,
  normalizeEditorExportSignature,
  shouldShowDimensions,
  type EditorSettings,
} from "@/lib/editor/settings";
import { detectMacPlatform } from "@/lib/platform";
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
  RoomInteriorAssetSelection,
  RoomOpeningSelection,
  RoomWall,
  RoomWallSelection,
  ScreenPoint,
  ViewportSize,
} from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";
import { type ExportPngRequest } from "@/components/editor/ExportPngDialog";
import { SelectedRoomNamePanel } from "@/components/editor/SelectedRoomNamePanel";
import { HistoryControls } from "@/components/editor/HistoryControls";
import { OnboardingHintCard } from "@/components/editor/OnboardingHintCard";
import { EditorInspectorEmptyState } from "@/components/editor/EditorInspectorEmptyState";
import { MEASUREMENT_TEXT_FONT_FAMILY } from "@/lib/fonts";
import {
  track,
  trackAppOpened,
  trackEditorLoaded,
  trackFirstAction,
  trackFirstSuccess,
  trackOncePerSession,
} from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { EditorCommand } from "@/lib/editor/history";

const EMPTY_ROOM_RESIZE_UI = {
  hoveredWall: null,
  hoveredCorner: null,
  hoveredVertexIndex: null,
  hoveredWallSegmentIndex: null,
  hoveredRoomId: null,
  activeWall: null,
  activeCorner: null,
  activeVertexIndex: null,
  activeWallSegmentIndex: null,
  activeRoomId: null,
} as const;
const EMPTY_HOVERED_SELECTABLE_WALL = null as {
  roomId: string;
  wall: RoomWall;
} | null;
const PROJECT_NAME_HINT_ANCHOR_SELECTOR = "[data-editor-project-name-anchor]";
const HINT_TRANSITION_MS = 200;
const HINT_HANDOFF_DELAY_MS = 150;
const HINT_VIEWPORT_MARGIN_PX = 12;
const ANCHORED_HINT_MAX_WIDTH_PX = 352;
const ANCHORED_HINT_OFFSET_PX = 10;
const ANCHORED_HINT_ARROW_SIZE_PX = 12;
const PROJECT_RENAME_HINT_PAUSE_MS = 1200;
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
const RESIZE_DIMENSION_INSIDE_EDGE_PADDING_PX = 6;
const RESIZE_DIMENSION_NON_RECT_EDGE_EXTRA_PADDING_PX = 12;
const RESIZE_DIMENSION_HANDLE_CLEARANCE_PX = 10;
const RESIZE_DIMENSION_ACTIVE_FILL_ALPHA = 1;
const RESIZE_DIMENSION_ACTIVE_STROKE_ALPHA = 0.62;
const RESIZE_DIMENSION_ACTIVE_TEXT_ALPHA = 1;
const OPENING_CUTOUT_WORLD_MM = 64;
const OPENING_SYMBOL_WORLD_MM = 18;
const DOOR_LEAF_LENGTH_SCALE = 0.72;
const DOOR_LEAF_DEPTH_SCALE = 0.72;
const WINDOW_LINE_INSET_WORLD_MM = 44;
const WINDOW_LINE_SEPARATION_WORLD_MM = 32;
const OPENING_SELECTION_HALO_WORLD_MM = 120;
const OPENING_SELECTION_STROKE_WORLD_MM = 28;
const OPENING_WIDTH_HANDLE_SIZE_PX = 8;
const OPENING_WIDTH_HANDLE_HALO_SIZE_PX = 12;
const OPENING_WIDTH_HANDLE_STROKE_PX = 1.5;
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

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeExportSingleLineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeExportMultilineText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type EditorCanvasProps = {
  hasResolvedProject?: boolean;
  projectRenameCompletionCount?: number;
  onDisplayedHintChange?: (hintId: EditorOnboardingHintId | null) => void;
  onThumbnailGeneratorChange?: (generateThumbnailDataUrl: (() => Promise<string | null>) | null) => void;
  topBarLeadingContent?: ReactNode;
  leftSidebarContent?: ReactNode;
};

export default function EditorCanvas({
  hasResolvedProject = false,
  projectRenameCompletionCount = 0,
  onDisplayedHintChange,
  onThumbnailGeneratorChange,
  topBarLeadingContent,
  leftSidebarContent,
}: EditorCanvasProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const roomRef = useRef<Graphics | null>(null);
  const openingRef = useRef<Graphics | null>(null);
  const wallOverlayRef = useRef<Graphics | null>(null);
  const roomLabelRef = useRef<Container | null>(null);
  const draftRef = useRef<Graphics | null>(null);
  const dimensionOverlayRef = useRef<Container | null>(null);
  const cursorWorldRef = useRef<Point | null>(null);
  const hoveredRoomLabelIdRef = useRef<string | null>(null);
  const hoveredSelectableWallRef = useRef<{
    roomId: string;
    wall: RoomWall;
  } | null>(EMPTY_HOVERED_SELECTABLE_WALL);
  const roomResizeUiRef = useRef<{
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredVertexIndex: number | null;
    hoveredWallSegmentIndex: number | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeVertexIndex: number | null;
    activeWallSegmentIndex: number | null;
    activeRoomId: string | null;
  }>({ ...EMPTY_ROOM_RESIZE_UI });
  const transformFeedbackRef = useRef<TransformFeedback | null>(null);
  const snapGuidesRef = useRef<SnapGuides | null>(null);
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
  const roomDraftPointCount = useEditorStore((state) => state.roomDraft.points.length);
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const camera = useEditorStore((state) => state.camera);
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
  const hintAutoCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintPauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousRenameCompletionCountRef = useRef(projectRenameCompletionCount);
  const hintTransitionCycleRef = useRef(0);
  const latestEligibleHintRef = useRef<ActiveEditorOnboardingHint | null>(null);
  const editorThemeRef = useRef(editorTheme);
  const activeHintIdRef = useRef<EditorOnboardingHintId | null>(null);
  const [hintPauseUntilMs, setHintPauseUntilMs] = useState(0);
  const [anchoredProjectNameHintPosition, setAnchoredProjectNameHintPosition] = useState<{
    top: number;
    left: number;
    width: number;
    arrowLeft: number;
  } | null>(null);
  const isHintFlowPaused = hintPauseUntilMs > Date.now();
  const activeHint = useMemo(() => {
    if (!hasHydratedHints || isHintFlowPaused) return null;

    return getActiveEditorOnboardingHint({
      roomCount,
      roomDraftPointCount,
      hasResolvedProject,
      isMacPlatform,
      dismissedHintIds: new Set(dismissedHintIds),
      completedHintIds: new Set(completedHintIds),
    });
  }, [
    completedHintIds,
    dismissedHintIds,
    hasHydratedHints,
    hasResolvedProject,
    isHintFlowPaused,
    isMacPlatform,
    roomCount,
    roomDraftPointCount,
  ]);

  const drawCurrentScene = useCallback(() => {
    const grid = gridRef.current;
    const rooms = roomRef.current;
    const openings = openingRef.current;
    const wallOverlay = wallOverlayRef.current;
    const roomLabels = roomLabelRef.current;
    const draft = draftRef.current;
    const dimensionOverlay = dimensionOverlayRef.current;
    if (!grid || !rooms || !openings || !wallOverlay || !roomLabels || !draft || !dimensionOverlay) return;

    drawScene(
      grid,
      rooms,
      openings,
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
      snapGuidesRef.current,
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
      if (hintAutoCompleteTimeoutRef.current) {
        clearTimeout(hintAutoCompleteTimeoutRef.current);
      }
      if (hintPauseTimeoutRef.current) {
        clearTimeout(hintPauseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isHintFlowPaused) {
      if (hintPauseTimeoutRef.current) {
        clearTimeout(hintPauseTimeoutRef.current);
        hintPauseTimeoutRef.current = null;
      }
      return;
    }

    hintPauseTimeoutRef.current = setTimeout(() => {
      setHintPauseUntilMs(0);
      hintPauseTimeoutRef.current = null;
    }, Math.max(0, hintPauseUntilMs - Date.now()));

    return () => {
      if (hintPauseTimeoutRef.current) {
        clearTimeout(hintPauseTimeoutRef.current);
        hintPauseTimeoutRef.current = null;
      }
    };
  }, [hintPauseUntilMs, isHintFlowPaused]);

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
      if (hintAutoCompleteTimeoutRef.current) {
        clearTimeout(hintAutoCompleteTimeoutRef.current);
        hintAutoCompleteTimeoutRef.current = null;
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
      if (next.length === TOTAL_EDITOR_ONBOARDING_STEPS) {
        trackOncePerSession(ANALYTICS_EVENTS.onboardingCompleted, {
          stepsCompleted: next.length,
        });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (projectRenameCompletionCount <= previousRenameCompletionCountRef.current) {
      previousRenameCompletionCountRef.current = projectRenameCompletionCount;
      return;
    }

    previousRenameCompletionCountRef.current = projectRenameCompletionCount;
    completeHint("project-name");
    setHintPauseUntilMs(Date.now() + PROJECT_RENAME_HINT_PAUSE_MS);
  }, [completeHint, projectRenameCompletionCount]);

  useEffect(() => {
    if (!displayedHint?.autoCompleteAfterMs) return;

    hintAutoCompleteTimeoutRef.current = setTimeout(() => {
      completeHint(displayedHint.id);
      hintAutoCompleteTimeoutRef.current = null;
    }, displayedHint.autoCompleteAfterMs);

    return () => {
      if (hintAutoCompleteTimeoutRef.current) {
        clearTimeout(hintAutoCompleteTimeoutRef.current);
        hintAutoCompleteTimeoutRef.current = null;
      }
    };
  }, [completeHint, displayedHint]);

  const updateAnchoredProjectNameHintPosition = useCallback(() => {
    const section = sectionRef.current;
    const anchor = document.querySelector<HTMLElement>(PROJECT_NAME_HINT_ANCHOR_SELECTOR);
    if (!section || !anchor) {
      setAnchoredProjectNameHintPosition(null);
      return;
    }

    const sectionRect = section.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const availableWidth = Math.max(0, sectionRect.width - HINT_VIEWPORT_MARGIN_PX * 2);
    const width = Math.min(ANCHORED_HINT_MAX_WIDTH_PX, availableWidth);
    if (width <= 0) {
      setAnchoredProjectNameHintPosition(null);
      return;
    }

    const unclampedLeft = anchorRect.left - sectionRect.left - 6;
    const left = clampValue(
      unclampedLeft,
      HINT_VIEWPORT_MARGIN_PX,
      Math.max(HINT_VIEWPORT_MARGIN_PX, sectionRect.width - width - HINT_VIEWPORT_MARGIN_PX)
    );
    const anchorCenterX = anchorRect.left - sectionRect.left + anchorRect.width / 2;
    const arrowLeft = clampValue(
      anchorCenterX - left - ANCHORED_HINT_ARROW_SIZE_PX / 2,
      18,
      width - 18
    );

    setAnchoredProjectNameHintPosition({
      top: anchorRect.bottom - sectionRect.top + ANCHORED_HINT_OFFSET_PX,
      left,
      width,
      arrowLeft,
    });
  }, []);

  useEffect(() => {
    if (displayedHint?.id !== "project-name") {
      setAnchoredProjectNameHintPosition(null);
      return;
    }

    updateAnchoredProjectNameHintPosition();

    const section = sectionRef.current;
    const anchor = document.querySelector<HTMLElement>(PROJECT_NAME_HINT_ANCHOR_SELECTOR);
    if (!section || !anchor) return;

    const resizeObserver = new ResizeObserver(() => {
      updateAnchoredProjectNameHintPosition();
    });
    resizeObserver.observe(section);
    resizeObserver.observe(anchor);

    window.addEventListener("resize", updateAnchoredProjectNameHintPosition);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateAnchoredProjectNameHintPosition);
    };
  }, [displayedHint?.id, updateAnchoredProjectNameHintPosition]);

  const createCanvasExportSnapshot = useCallback(
    ({
      includeSignature,
      innerPaddingPx,
      paddingPx,
      showDimensions,
      showGrid,
      showScaleBar,
      legendPosition,
      signatureText,
      titleText,
      descriptionText,
      legendItems,
      themeMode,
    }: {
      includeSignature: boolean;
      innerPaddingPx: number;
      paddingPx: number;
      showDimensions: boolean;
      showGrid: boolean;
      showScaleBar: boolean;
      legendPosition?: "bottom" | "right-side";
      signatureText?: string;
      titleText?: string;
      descriptionText?: string;
      legendItems?: { name: string; area: string }[];
      themeMode: "light" | "dark";
    }) => {
      const app = appRef.current;
      if (!app) return null;

      const state = useEditorStore.getState();
      const exportTheme = getEditorCanvasTheme(themeMode);
      const layoutBounds = getLayoutBoundsFromDocument(state.document);
      const exportFraming = getAutoFitExportFraming({
        layoutBounds,
        viewport: state.viewport,
        fallbackCamera: state.camera,
        innerPaddingPx,
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
      const exportScaleOverlay = getScaleOverlayState(exportCamera);
      const exportStage = new Container();
      const exportRoomGraphics = new Graphics();
      const exportOpeningGraphics = new Graphics();
      const exportWallOverlayGraphics = new Graphics();
      const exportRoomLabels = new Container();
      const exportDraftGraphics = new Graphics();
      exportStage.addChild(exportRoomGraphics);
      exportStage.addChild(exportOpeningGraphics);
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
        exportTheme
      );
      drawOpenings(
        exportOpeningGraphics,
        state.document.rooms,
        null,
        null,
        exportCamera,
        exportViewport,
        exportTheme
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
        exportTheme
      );
      drawRoomLabels(
        exportRoomLabels,
        state.document.rooms,
        null,
        null,
        exportCamera,
        exportViewport,
        state.settings,
        showDimensions,
        null,
        exportTheme
      );
      drawDraft(
        exportDraftGraphics,
        state.roomDraft.points,
        null,
        exportCamera,
        exportViewport,
        getActiveSnapStepMm(exportCamera),
        getActiveSnapStepMm(exportCamera),
        null,
        exportTheme
      );

      return {
        renderer: app.renderer,
        stage: exportStage,
        options: {
          backgroundColor: themeMode === "light" ? "#ffffff" : "#000000",
          paddingPx,
          header:
            titleText || descriptionText
              ? {
                  title: titleText,
                  description: descriptionText,
                  color: themeMode === "light" ? "#0f172a" : "#f8fafc",
                  mutedColor: themeMode === "light" ? "#475569" : "#cbd5e1",
                }
              : undefined,
          legend:
            legendItems && legendItems.length > 0
              ? {
                  items: legendItems,
                  position: legendPosition,
                  color: themeMode === "light" ? "#0f172a" : "#f8fafc",
                  mutedColor: themeMode === "light" ? "#475569" : "#cbd5e1",
                  dividerColor: themeMode === "light" ? "#cbd5e1" : "#334155",
                }
              : undefined,
          grid: showGrid
            ? {
                spacingPx: exportGridSpacingPx,
                originXPx: exportGridOriginXPx,
                originYPx: exportGridOriginYPx,
                color: themeMode === "light" ? "#0f172a" : "#f8fafc",
                alpha: themeMode === "light" ? 0.08 : 0.1,
              }
            : undefined,
          scaleBar: showScaleBar
            ? {
                widthPx: exportScaleOverlay.widthPx,
                label: exportScaleOverlay.label,
                color: themeMode === "light" ? "#0f172a" : "#f8fafc",
                mutedColor: themeMode === "light" ? "#475569" : "#cbd5e1",
              }
            : undefined,
          signature: includeSignature
            ? {
                lines: signatureText
                  ? [`Designed by ${signatureText}`, "Designed with [s]paceforge", "spaceforge.app"]
                  : ["Designed with [s]paceforge", "spaceforge.app"],
                color: themeMode === "light" ? "#0f172a" : "#f8fafc",
                alpha: themeMode === "light" ? 0.72 : 0.7,
              }
            : undefined,
        },
        destroy: () => {
          exportStage.destroy({ children: true });
        },
      };
    },
    []
  );

  const createPngExportSnapshotFromRequest = useCallback((request: ExportPngRequest) => {
    const exportSignatureText = normalizeEditorExportSignature(
      request.designedBy || useEditorStore.getState().settings.exportSignatureText
    );
    const exportTitle =
      request.titlePosition === "top" ? normalizeExportSingleLineText(request.title) : "";
    const exportDescription =
      request.descriptionPosition === "below-title"
        ? normalizeExportMultilineText(request.description)
        : "";
    const effectiveLegendPosition = request.showLegend ? request.legendPosition : "none";
    const effectiveScaleBarPosition = request.showScaleBar ? request.scaleBarPosition : "none";
    const exportLegendItems =
      effectiveLegendPosition !== "none"
        ? useEditorStore.getState().document.rooms.map((room, index) => ({
            name: normalizeExportSingleLineText(room.name) || `Room ${index + 1}`,
            area: formatMetricRoomAreaForRoom(room),
          }))
        : undefined;
    const shouldShowScaleBar = effectiveScaleBarPosition === "bottom-left";
    const resolvedThemeMode = request.theme === "system" ? editorThemeMode : request.theme;
    const hasBottomLegend = effectiveLegendPosition === "bottom" && (exportLegendItems?.length ?? 0) > 0;
    const hasRightLegend =
      effectiveLegendPosition === "right-side" && (exportLegendItems?.length ?? 0) > 0;
    const hasBottomLeftContent = shouldShowScaleBar || hasBottomLegend;
    const exportInnerPaddingPx = exportSignatureText || hasBottomLeftContent ? 108 : 92;

    return createCanvasExportSnapshot({
      includeSignature: true,
      innerPaddingPx: exportInnerPaddingPx,
      paddingPx: 48,
      showDimensions: request.showDimensions,
      showGrid: request.showGrid,
      showScaleBar: shouldShowScaleBar,
      legendPosition: hasRightLegend ? "right-side" : hasBottomLegend ? "bottom" : undefined,
      titleText: exportTitle || undefined,
      descriptionText: exportDescription || undefined,
      legendItems: exportLegendItems,
      signatureText: exportSignatureText || undefined,
      themeMode: resolvedThemeMode,
    });
  }, [createCanvasExportSnapshot, editorThemeMode]);

  const exportCurrentCanvasAsPng = useCallback(async (request: ExportPngRequest) => {
    if (isExportingPng) return;

    track(ANALYTICS_EVENTS.exportStarted, {
      exportType: "png",
    });
    trackFirstAction(ANALYTICS_EVENTS.exportStarted);

    const exportSnapshot = createPngExportSnapshotFromRequest(request);
    if (!exportSnapshot) {
      return;
    }

    setIsExportingPng(true);

    try {
      const blob = await exportPixiCanvasToPngBlob({
        renderer: exportSnapshot.renderer,
        stage: exportSnapshot.stage,
      }, exportSnapshot.options);
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
      exportSnapshot.destroy();
      setIsExportingPng(false);
    }
  }, [completeHint, createPngExportSnapshotFromRequest, isExportingPng]);

  const generateExportPreviewDataUrl = useCallback(async (request: ExportPngRequest) => {
    const exportSnapshot = createPngExportSnapshotFromRequest(request);
    if (!exportSnapshot) {
      return null;
    }

    try {
      return await exportPixiCanvasToPngDataUrl({
        renderer: exportSnapshot.renderer,
        stage: exportSnapshot.stage,
      }, exportSnapshot.options);
    } finally {
      exportSnapshot.destroy();
    }
  }, [createPngExportSnapshotFromRequest]);

  const generateThumbnailDataUrl = useCallback(async () => {
    const exportSnapshot = createCanvasExportSnapshot({
      includeSignature: false,
      innerPaddingPx: 56,
      paddingPx: 24,
      showDimensions: false,
      showGrid: false,
      showScaleBar: false,
      themeMode: editorThemeMode,
    });
    if (!exportSnapshot) {
      return null;
    }

    try {
      return await exportPixiCanvasToThumbnailDataUrl({
        renderer: exportSnapshot.renderer,
        stage: exportSnapshot.stage,
      }, exportSnapshot.options);
    } finally {
      exportSnapshot.destroy();
    }
  }, [createCanvasExportSnapshot, editorThemeMode]);

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
    onDisplayedHintChange?.(displayedHint?.id ?? null);
  }, [displayedHint, onDisplayedHintChange]);

  useEffect(() => {
    onThumbnailGeneratorChange?.(generateThumbnailDataUrl);

    return () => {
      onThumbnailGeneratorChange?.(null);
    };
  }, [generateThumbnailDataUrl, onThumbnailGeneratorChange]);

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
      const didStartFirstDraft =
        previousState.roomDraft.points.length === 0 && state.roomDraft.points.length > 0;
      if (!didStartFirstDraft) return;
      completeHint("empty-canvas-draw");
    });

    return unsubscribe;
  }, [completeHint]);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      if (activeHintIdRef.current !== "close-shape-to-make-room") return;
      const didCreateFirstRoom =
        previousState.document.rooms.length === 0 && state.document.rooms.length > 0;
      if (!didCreateFirstRoom) return;
      completeHint("close-shape-to-make-room");
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
      syncDimensionsOverride(event.getModifierState("Alt"));

      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const store = useEditorStore.getState();

      if (event.key === "g" || event.key === "G") {
        store.updateSettings({ showGuidelines: !store.settings.showGuidelines });
        return;
      }

      if (event.key === "s" || event.key === "S") {
        store.updateSettings({ snappingEnabled: !store.settings.snappingEnabled });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      syncDimensionsOverride(event.getModifierState("Alt"));
    };

    const onPointerEvent = (event: PointerEvent) => {
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
    window.addEventListener("pointerdown", onPointerEvent, true);
    window.addEventListener("pointermove", onPointerEvent, true);
    window.addEventListener("pointerup", onPointerEvent, true);
    window.addEventListener("blur", clearDimensionsOverride);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerEvent, true);
      window.removeEventListener("pointermove", onPointerEvent, true);
      window.removeEventListener("pointerup", onPointerEvent, true);
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
      const openings = new Graphics();
      const wallOverlay = new Graphics();
      const roomLabels = new Container();
      const draft = new Graphics();
      const dimensionOverlay = new Container();
      gridRef.current = grid;
      roomRef.current = rooms;
      openingRef.current = openings;
      wallOverlayRef.current = wallOverlay;
      roomLabelRef.current = roomLabels;
      draftRef.current = draft;
      dimensionOverlayRef.current = dimensionOverlay;
      app.stage.addChild(grid);
      app.stage.addChild(rooms);
      app.stage.addChild(openings);
      app.stage.addChild(wallOverlay);
      app.stage.addChild(roomLabels);
      app.stage.addChild(draft);
      app.stage.addChild(dimensionOverlay);

      const syncViewport = () => {
        useEditorStore.getState().setViewport(app.screen.width, app.screen.height);
      };

      syncViewport();
      drawCurrentScene();
      trackEditorLoaded();

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
        onCursorWorldChange: (cursorWorld) => {
          cursorWorldRef.current = cursorWorld;
        },
        onHandleStateChange: (handleState) => {
          roomResizeUiRef.current = handleState;
        },
        onTransformFeedbackChange: (feedback) => {
          setTransformFeedback(feedback);
        },
        onSnapGuidesChange: (guides) => {
          snapGuidesRef.current = guides;
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
        onSnapGuidesChange: (guides) => {
          snapGuidesRef.current = guides;
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
        openingRef.current = null;
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

  const overlayCamera = useMemo(
    () =>
      hasHydratedClient
        ? camera
        : {
            pixelsPerMm: INITIAL_PIXELS_PER_MM,
          },
    [camera, hasHydratedClient]
  );
  const scaleOverlay = useMemo(() => getScaleOverlayState(overlayCamera), [overlayCamera]);
  const activeSnapStepMm = useMemo(() => getActiveSnapStepMm(overlayCamera), [overlayCamera]);
  const snappingEnabled = useEditorStore((state) => state.settings.snappingEnabled);

  return (
    <section
      ref={sectionRef}
      aria-label="SpaceForge floor plan editor canvas"
      aria-describedby={instructionsId}
      role="region"
      className="relative grid h-full w-full grid-rows-[auto_minmax(0,1fr)]"
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
      <div className="border-b border-border/70 bg-background/95 px-3 py-3 backdrop-blur-sm sm:px-4 [@media(max-height:540px)_and_(orientation:landscape)]:px-3 [@media(max-height:540px)_and_(orientation:landscape)]:py-2">
        <HistoryControls
          leadingContent={topBarLeadingContent}
          onExportPng={exportCurrentCanvasAsPng}
          onPreviewExportPng={generateExportPreviewDataUrl}
          isExportingPng={isExportingPng}
          exportDisabled={!isCanvasReadyForExport || !hasRooms}
          exportDisabledReason={!hasRooms ? "Draw a room before exporting." : undefined}
        />
      </div>
      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[18rem_minmax(0,1fr)_20rem] lg:grid-rows-1 [@media(max-height:540px)_and_(orientation:landscape)]:grid-cols-[15rem_minmax(0,1fr)_15rem] [@media(max-height:540px)_and_(orientation:landscape)]:grid-rows-1 [@media(max-height:540px)_and_(orientation:landscape)]:gap-2.5 [@media(max-height:540px)_and_(orientation:landscape)]:p-2.5">
        {leftSidebarContent ? (
          <aside
            className="hidden min-h-0 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm dark:border-border/70 dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] lg:flex [@media(max-height:540px)_and_(orientation:landscape)]:flex"
            aria-label="Project sidebar"
          >
            {leftSidebarContent}
          </aside>
        ) : null}
        <div className="relative min-h-0 overflow-hidden rounded-xl border border-white/10 bg-neutral-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div
            ref={containerRef}
            tabIndex={-1}
            className="h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-white/10 bg-neutral-950/78 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:bottom-4 sm:left-4">
            <div
              className="text-[11px] font-medium tracking-[0.04em] text-white/72"
              style={{ fontFamily: MEASUREMENT_TEXT_FONT_FAMILY }}
            >
              {scaleOverlay.label}
            </div>
            <div
              className="mt-1 h-2 border-x border-t border-white/70"
              style={{ width: `${scaleOverlay.widthPx}px` }}
            />
            <div
              className="mt-1 text-[11px] text-white/52"
              style={{ fontFamily: MEASUREMENT_TEXT_FONT_FAMILY }}
            >
              {snappingEnabled
                ? `Grid ${formatMetricWallDimension(activeSnapStepMm)} · Magnet On`
                : `Grid ${formatMetricWallDimension(activeSnapStepMm)}`}
            </div>
          </div>
          {displayedHint && displayedHint.id !== "project-name" ? (
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
        </div>
        <aside className="hidden min-h-0 overflow-hidden lg:block [@media(max-height:540px)_and_(orientation:landscape)]:block" aria-label="Editor inspector">
          {selectedRoomId ? (
            <SelectedRoomNamePanel className="h-full" />
          ) : (
            <EditorInspectorEmptyState className="h-full" />
          )}
        </aside>
        {selectedRoomId ? (
          <aside className="lg:hidden [@media(max-height:540px)_and_(orientation:landscape)]:hidden" aria-label="Editor inspector">
            <SelectedRoomNamePanel />
          </aside>
        ) : (
          <aside className="lg:hidden [@media(max-height:540px)_and_(orientation:landscape)]:hidden" aria-label="Editor inspector">
            <EditorInspectorEmptyState />
          </aside>
        )}
      </div>
      {displayedHint?.id === "project-name" && anchoredProjectNameHintPosition ? (
        <aside
          className={`pointer-events-none absolute z-30 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
            hintMotionState === "visible"
              ? "translate-y-0 opacity-100"
              : hintMotionState === "entering"
                ? "translate-y-2 opacity-0"
                : "-translate-y-1.5 opacity-0"
          }`}
          style={{
            top: anchoredProjectNameHintPosition.top,
            left: anchoredProjectNameHintPosition.left,
            width: anchoredProjectNameHintPosition.width,
            transitionDuration: `${HINT_TRANSITION_MS}ms`,
          }}
        >
          <div className="relative pt-3">
            <div
              aria-hidden="true"
              className="absolute top-[3px] size-3 rotate-45 border border-slate-700/90 bg-slate-900/94 shadow-black/40"
              style={{ left: anchoredProjectNameHintPosition.arrowLeft }}
            />
            <OnboardingHintCard
              message={displayedHint.message}
              invertedTheme={editorThemeMode === "light" ? "dark" : "light"}
              onDismiss={() => dismissHint(displayedHint.id)}
              className="relative"
            />
          </div>
        </aside>
      ) : null}
    </section>
  );
}

type EditorSnapshot = ReturnType<typeof useEditorStore.getState>;

function drawScene(
  gridGraphics: Graphics,
  roomGraphics: Graphics,
  openingGraphics: Graphics,
  wallOverlayGraphics: Graphics,
  roomLabelContainer: Container,
  draftGraphics: Graphics,
  dimensionOverlayContainer: Container,
  state: EditorSnapshot,
  cursorWorld: Point | null,
  hoveredRoomLabelId: string | null,
  hoveredSelectableWall: {
    roomId: string;
    wall: RoomWall;
  } | null,
  roomResizeUi: {
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredVertexIndex: number | null;
    hoveredWallSegmentIndex: number | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeVertexIndex: number | null;
    activeWallSegmentIndex: number | null;
    activeRoomId: string | null;
  },
  transformFeedback: TransformFeedback | null,
  snapGuides: SnapGuides | null,
  theme: EditorCanvasTheme
) {
  const cursorSnapStepMm = getActiveSnapStepMm(state.camera);
  const activeSnapStepMm = getActiveSnapStepMm(state.camera);
  const predictiveGuides = cursorWorld
    ? getPredictiveSnapGuides(state.document.rooms, cursorWorld, state.camera)
    : null;
  const magneticGuides = cursorWorld
    ? getMagneticSnapGuidesForSettings(
        state.document.rooms,
        cursorWorld,
        state.camera,
        state.settings
      )
    : null;
  const draftCursorWorld =
    cursorWorld
      ? getSnappedPointFromGuides(cursorWorld, activeSnapStepMm, magneticGuides)
      : cursorWorld;
  const visibleGuides = state.settings.showGuidelines ? snapGuides ?? predictiveGuides : null;
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
  drawOpenings(
    openingGraphics,
    renderedRooms,
    state.selectedOpening,
    state.selectedInteriorAsset,
    state.camera,
    state.viewport,
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
    showDimensions,
    transformFeedback,
    theme
  );
  clearContainerChildren(dimensionOverlayContainer);
  if (showDimensions) {
    drawSelectedRoomDimensions(
      dimensionOverlayContainer,
      renderedLabelRooms,
      state.selectedRoomId,
      state.selectedWall,
      roomResizeUi,
      state.camera,
      state.viewport,
      state.settings,
      theme
    );
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
      draftCursorWorld,
      state.camera,
      state.viewport,
      activeSnapStepMm,
      state.settings,
      theme
    );
  }
  drawDraft(
    draftGraphics,
    state.roomDraft.points,
    draftCursorWorld,
    state.camera,
    state.viewport,
    cursorSnapStepMm,
    activeSnapStepMm,
    visibleGuides,
    theme
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

function drawRooms(
  graphics: Graphics,
  rooms: Room[],
  selectedRoomId: string | null,
  roomResizeUi: {
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredVertexIndex: number | null;
    hoveredWallSegmentIndex: number | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeVertexIndex: number | null;
    activeWallSegmentIndex: number | null;
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
    const declutter = getRoomDeclutterState(room, camera, viewport);
    if (!declutter.showSelectionControls) continue;
    const vertexHandles = getConstrainedVertexHandleLayouts(room, camera, viewport);
    const wallSegmentHandles =
      vertexHandles.length > 0 ? getOrthogonalWallHandleLayouts(room, camera, viewport) : [];

    if (vertexHandles.length > 0) {
      for (const handle of wallSegmentHandles) {
        const isHovered =
          roomResizeUi.hoveredRoomId === room.id &&
          roomResizeUi.hoveredWallSegmentIndex === handle.wallIndex;
        const isActive =
          roomResizeUi.activeRoomId === room.id &&
          roomResizeUi.activeWallSegmentIndex === handle.wallIndex;
        const fillAlpha = isActive ? 0.46 : isHovered ? 0.34 : 0.2;
        const strokeAlpha = isActive ? 1 : isHovered ? 0.96 : 0.82;
        const strokeWidth = isActive ? 2.2 : isHovered ? 1.8 : 1.45;
        const radius = Math.min(handle.width, handle.height) / 2;
        const haloPadding = isActive ? 3 : isHovered ? 2 : 0;
        const haloAlpha = isActive ? 0.2 : isHovered ? 0.12 : 0;

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
          color: theme.roomOutline,
          alpha: strokeAlpha,
        });
        graphics.roundRect(handle.left, handle.top, handle.width, handle.height, radius);
        graphics.stroke();
      }

      for (const handle of vertexHandles) {
        const isHovered =
          roomResizeUi.hoveredRoomId === room.id &&
          roomResizeUi.hoveredVertexIndex === handle.vertexIndex;
        const isActive =
          roomResizeUi.activeRoomId === room.id &&
          roomResizeUi.activeVertexIndex === handle.vertexIndex;
        const size = isActive ? handle.size + 2 : isHovered ? handle.size + 1 : handle.size;
        const radius = size / 2;
        const haloPadding = isActive ? 3 : isHovered ? 2 : 0;

        if (haloPadding > 0) {
          graphics.setFillStyle({ color: theme.interactiveAccent, alpha: isActive ? 0.22 : 0.14 });
          graphics.circle(handle.center.x, handle.center.y, radius + haloPadding);
          graphics.fill();
        }

        graphics.setFillStyle({
          color: theme.interactiveAccent,
          alpha: isActive ? 0.5 : isHovered ? 0.38 : 0.28,
        });
        graphics.circle(handle.center.x, handle.center.y, radius);
        graphics.fill();

        graphics.setStrokeStyle({
          width: isActive ? 2 : isHovered ? 1.8 : 1.6,
          color: theme.roomOutline,
          alpha: isActive ? 1 : isHovered ? 0.97 : 0.92,
        });
        graphics.circle(handle.center.x, handle.center.y, radius);
        graphics.stroke();
      }
    }

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

function drawOpenings(
  graphics: Graphics,
  rooms: Room[],
  selectedOpening: RoomOpeningSelection | null,
  selectedInteriorAsset: RoomInteriorAssetSelection | null,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  graphics.clear();

  for (const room of rooms) {
    if (room.points.length < 3) continue;
    drawRoomOpenings(graphics, room, selectedOpening, camera, viewport, theme);
    drawRoomInteriorAssets(graphics, room, selectedInteriorAsset, camera, viewport, theme);
  }
}

function drawWallInteractionOverlay(
  graphics: Graphics,
  rooms: Room[],
  selectedWall: RoomWallSelection | null,
  hoveredSelectableWall: {
    roomId: string;
    wall: RoomWall;
  } | null,
  roomResizeUi: {
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredVertexIndex: number | null;
    hoveredWallSegmentIndex: number | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeVertexIndex: number | null;
    activeWallSegmentIndex: number | null;
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

  let hoveredRoom: Room | null = null;
  let hoveredWall: RoomWall | null = null;
  let hoveredRoomId: string | null = null;

  if (hoveredSelectableWall) {
    hoveredRoom = rooms.find((room) => room.id === hoveredSelectableWall.roomId) ?? null;
    if (hoveredRoom && transformFeedback?.roomId !== hoveredRoom.id) {
      hoveredWall = hoveredSelectableWall.wall;
      hoveredRoomId = hoveredSelectableWall.roomId;
    } else {
      hoveredRoom = null;
    }
  } else if (roomResizeUi.hoveredRoomId && roomResizeUi.hoveredWall) {
    hoveredRoom = rooms.find((room) => room.id === roomResizeUi.hoveredRoomId) ?? null;
    if (hoveredRoom && transformFeedback?.roomId !== hoveredRoom.id) {
      hoveredWall = roomResizeUi.hoveredWall;
      hoveredRoomId = roomResizeUi.hoveredRoomId;
    } else {
      hoveredRoom = null;
    }
  }

  const isSelectedWallAlsoHovered =
    hoveredWall !== null &&
    selectedWall?.roomId === hoveredRoomId &&
    selectedWall.wall === hoveredWall;

  if (hoveredRoom && hoveredWall !== null && !isSelectedWallAlsoHovered) {
    drawHoveredWallHighlight(graphics, hoveredRoom, hoveredWall, camera, viewport, theme);
  }

  if (!selectedWall) return;
  const selectedRoom = rooms.find((room) => room.id === selectedWall.roomId);
  if (!selectedRoom) return;
  if (transformFeedback?.roomId === selectedRoom.id) return;
  drawSelectedWallHighlight(graphics, selectedRoom, selectedWall.wall, camera, viewport, theme);
}

function getRenderedRoomsForTransform(rooms: Room[], transformFeedback: TransformFeedback | null): Room[] {
  if (!transformFeedback) return rooms;

  const transformedPoints = getRenderedTransformRoomPoints(transformFeedback);
  if (!transformedPoints) return rooms;
  const delta = getPointListTranslationDelta(transformFeedback.originalPoints, transformedPoints);

  return rooms.map((room) =>
    room.id === transformFeedback.roomId
      ? {
          ...room,
          points: transformedPoints,
          interiorAssets: room.interiorAssets.map((asset) => ({
            ...asset,
            xMm: asset.xMm + delta.x,
            yMm: asset.yMm + delta.y,
          })),
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
  const delta = getPointListTranslationDelta(transformFeedback.originalPoints, transformedPoints);

  return rooms.map((room) =>
    room.id === transformFeedback.roomId
      ? {
          ...room,
          points: transformedPoints,
          interiorAssets:
            transformFeedback.mode === "move"
              ? room.interiorAssets.map((asset) => ({
                  ...asset,
                  xMm: asset.xMm + delta.x,
                  yMm: asset.yMm + delta.y,
                }))
              : room.interiorAssets,
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

function getPointListTranslationDelta(previousPoints: Point[], nextPoints: Point[]): Point {
  if (previousPoints.length === 0 || nextPoints.length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: nextPoints[0].x - previousPoints[0].x,
    y: nextPoints[0].y - previousPoints[0].y,
  };
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

function drawRoomOpenings(
  graphics: Graphics,
  room: Room,
  selectedOpening: RoomOpeningSelection | null,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  for (const opening of room.openings) {
    const layout = getResolvedRoomOpeningLayout(room, opening);
    if (!layout) continue;

    const start = worldToScreen(layout.start, camera, viewport);
    const end = worldToScreen(layout.end, camera, viewport);
    const center = worldToScreen(layout.center, camera, viewport);
    const tangent = layout.axis === "horizontal" ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const interiorNormal = {
      x: layout.interiorNormal.x,
      y: layout.interiorNormal.y,
    };
    const openingWidthPx = Math.hypot(end.x - start.x, end.y - start.y);
    const isSelected =
      selectedOpening?.roomId === room.id && selectedOpening.openingId === opening.id;
    const cutoutStrokePx = Math.max(camera.pixelsPerMm * OPENING_CUTOUT_WORLD_MM, 2.25);
    const symbolStrokePx = Math.max(camera.pixelsPerMm * OPENING_SYMBOL_WORLD_MM, 1.2);
    const selectionStrokePx = Math.max(camera.pixelsPerMm * OPENING_SELECTION_STROKE_WORLD_MM, 2);
    const selectionHaloStrokePx = Math.max(
      camera.pixelsPerMm * OPENING_SELECTION_HALO_WORLD_MM,
      selectionStrokePx + 2
    );
    const selectionColor = theme.wallSelectionAccent;

    if (isSelected) {
      graphics.setStrokeStyle({
        width: selectionHaloStrokePx,
        color: selectionColor,
        alpha: 0.18,
        cap: "round",
      });
      graphics.moveTo(start.x, start.y);
      graphics.lineTo(end.x, end.y);
      graphics.stroke();
    }

    graphics.setStrokeStyle({
      width: cutoutStrokePx,
      color: theme.canvasBackground,
      alpha: 1,
      cap: "round",
    });
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
    graphics.stroke();

    if (isSelected) {
      graphics.setStrokeStyle({
        width: selectionStrokePx,
        color: selectionColor,
        alpha: 0.96,
        cap: "round",
      });
      graphics.moveTo(start.x, start.y);
      graphics.lineTo(end.x, end.y);
      graphics.stroke();
    }

    if (opening.type === "door") {
      const leafLengthPx = openingWidthPx * DOOR_LEAF_LENGTH_SCALE;
      const leafDepthPx = openingWidthPx * DOOR_LEAF_DEPTH_SCALE;
      const hingePoint = opening.hingeSide === "end" ? end : start;
      const hingeTangent =
        opening.hingeSide === "end"
          ? { x: -tangent.x, y: -tangent.y }
          : tangent;
      const swingNormal =
        opening.openingSide === "exterior"
          ? { x: -interiorNormal.x, y: -interiorNormal.y }
          : interiorNormal;

      graphics.setStrokeStyle({
        width: isSelected ? selectionStrokePx : symbolStrokePx,
        color: isSelected ? selectionColor : theme.roomOutline,
        alpha: isSelected ? 1 : 0.96,
        cap: "round",
      });
      graphics.moveTo(hingePoint.x, hingePoint.y);
      graphics.lineTo(
        hingePoint.x + hingeTangent.x * leafLengthPx + swingNormal.x * leafDepthPx,
        hingePoint.y + hingeTangent.y * leafLengthPx + swingNormal.y * leafDepthPx
      );
      graphics.stroke();
    } else {
      const windowLineInsetPx = Math.max(camera.pixelsPerMm * WINDOW_LINE_INSET_WORLD_MM, 1.5);
      const windowLineSeparationPx = Math.max(
        camera.pixelsPerMm * WINDOW_LINE_SEPARATION_WORLD_MM,
        2
      );
      const lineLengthPx = Math.max(openingWidthPx - windowLineInsetPx * 2, 0);
      if (lineLengthPx > 0) {
        for (const offset of [-windowLineSeparationPx / 2, windowLineSeparationPx / 2]) {
          graphics.setStrokeStyle({
            width: isSelected ? selectionStrokePx : symbolStrokePx,
            color: isSelected ? selectionColor : theme.roomOutline,
            alpha: isSelected ? 1 : 0.92,
            cap: "round",
          });
          graphics.moveTo(
            center.x - tangent.x * (lineLengthPx / 2) + interiorNormal.x * offset,
            center.y - tangent.y * (lineLengthPx / 2) + interiorNormal.y * offset
          );
          graphics.lineTo(
            center.x + tangent.x * (lineLengthPx / 2) + interiorNormal.x * offset,
            center.y + tangent.y * (lineLengthPx / 2) + interiorNormal.y * offset
          );
          graphics.stroke();
        }
      }
    }

    if (!isSelected) continue;

    drawOpeningWidthHandle(graphics, start, selectionColor, theme);
    drawOpeningWidthHandle(graphics, end, selectionColor, theme);
  }
}

function drawRoomInteriorAssets(
  graphics: Graphics,
  room: Room,
  selectedInteriorAsset: RoomInteriorAssetSelection | null,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  for (const asset of room.interiorAssets) {
    const bounds = getRoomInteriorAssetBounds(asset);
    const topLeft = worldToScreen({ x: bounds.left, y: bounds.top }, camera, viewport);
    const bottomRight = worldToScreen({ x: bounds.right, y: bounds.bottom }, camera, viewport);
    const left = Math.min(topLeft.x, bottomRight.x);
    const top = Math.min(topLeft.y, bottomRight.y);
    const width = Math.abs(bottomRight.x - topLeft.x);
    const height = Math.abs(bottomRight.y - topLeft.y);
    const isSelected =
      selectedInteriorAsset?.roomId === room.id &&
      selectedInteriorAsset.assetId === asset.id;
    const selectionStrokePx = Math.max(camera.pixelsPerMm * OPENING_SELECTION_STROKE_WORLD_MM, 2);
    const selectionHaloStrokePx = Math.max(
      camera.pixelsPerMm * OPENING_SELECTION_HALO_WORLD_MM,
      selectionStrokePx + 2
    );

    if (isSelected) {
      graphics.setStrokeStyle({
        width: selectionHaloStrokePx,
        color: theme.wallSelectionAccent,
        alpha: 0.18,
      });
      graphics.rect(left, top, width, height);
      graphics.stroke();
    }

    graphics.setFillStyle({
      color: theme.roomOutline,
      alpha: isSelected ? 0.12 : 0.08,
    });
    graphics.rect(left, top, width, height);
    graphics.fill();

    graphics.setStrokeStyle({
      width: isSelected ? selectionStrokePx : Math.max(camera.pixelsPerMm * 14, 1.4),
      color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
      alpha: isSelected ? 0.96 : 0.9,
    });
    graphics.rect(left, top, width, height);
    graphics.stroke();

    const treadSpacingPx = Math.max(camera.pixelsPerMm * DEFAULT_STAIR_TREAD_SPACING_MM, 8);
    for (let y = top + treadSpacingPx; y < top + height - 1; y += treadSpacingPx) {
      graphics.setStrokeStyle({
        width: Math.max(camera.pixelsPerMm * 10, 1.1),
        color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
        alpha: isSelected ? 0.88 : 0.72,
        cap: "round",
      });
      graphics.moveTo(left + 4, y);
      graphics.lineTo(left + width - 4, y);
      graphics.stroke();
    }

    if (!isSelected) continue;

    const rectBounds = getInteriorAssetBoundsAsRectBounds(asset);
    const wallHandles = getWallHandleLayouts(rectBounds, camera, viewport);
    const cornerHandles = getCornerHandleLayouts(rectBounds, camera, viewport);

    for (const handle of wallHandles) {
      const radius = Math.min(handle.width, handle.height) / 2;
      graphics.setFillStyle({ color: theme.interactiveAccent, alpha: 0.3 });
      graphics.roundRect(handle.left, handle.top, handle.width, handle.height, radius);
      graphics.fill();

      graphics.setStrokeStyle({
        width: 1.5,
        color: theme.roomOutline,
        alpha: 0.9,
      });
      graphics.roundRect(handle.left, handle.top, handle.width, handle.height, radius);
      graphics.stroke();
    }

    for (const handle of cornerHandles) {
      const half = handle.size / 2;
      graphics.setFillStyle({ color: theme.interactiveAccent, alpha: 0.38 });
      graphics.rect(handle.center.x - half, handle.center.y - half, handle.size, handle.size);
      graphics.fill();

      graphics.setStrokeStyle({
        width: 1.5,
        color: theme.roomOutline,
        alpha: 0.92,
      });
      graphics.rect(handle.center.x - half, handle.center.y - half, handle.size, handle.size);
      graphics.stroke();
    }
  }
}

function drawOpeningWidthHandle(
  graphics: Graphics,
  point: ScreenPoint,
  color: number,
  theme: EditorCanvasTheme
) {
  const outerHalf = OPENING_WIDTH_HANDLE_HALO_SIZE_PX / 2;
  const innerHalf = OPENING_WIDTH_HANDLE_SIZE_PX / 2;

  graphics.setFillStyle({ color: theme.canvasBackground, alpha: 0.98 });
  graphics.roundRect(
    point.x - outerHalf,
    point.y - outerHalf,
    OPENING_WIDTH_HANDLE_HALO_SIZE_PX,
    OPENING_WIDTH_HANDLE_HALO_SIZE_PX,
    3
  );
  graphics.fill();

  graphics.setFillStyle({ color, alpha: 0.96 });
  graphics.roundRect(
    point.x - innerHalf,
    point.y - innerHalf,
    OPENING_WIDTH_HANDLE_SIZE_PX,
    OPENING_WIDTH_HANDLE_SIZE_PX,
    2
  );
  graphics.fill();

  graphics.setStrokeStyle({
    width: OPENING_WIDTH_HANDLE_STROKE_PX,
    color: theme.canvasBackground,
    alpha: 0.9,
  });
  graphics.roundRect(
    point.x - innerHalf,
    point.y - innerHalf,
    OPENING_WIDTH_HANDLE_SIZE_PX,
    OPENING_WIDTH_HANDLE_SIZE_PX,
    2
  );
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
  room: Room,
  wall: RoomWall,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const screenSegment = getRoomWallScreenSegment(room, wall, camera, viewport);
  if (!screenSegment) return;
  const { from, to } = screenSegment;

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
  room: Room,
  wall: RoomWall,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const screenSegment = getRoomWallScreenSegment(room, wall, camera, viewport);
  if (!screenSegment) return;
  const { from, to } = screenSegment;

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

function getRoomWallScreenSegment(
  room: Room,
  wall: RoomWall,
  camera: CameraState,
  viewport: ViewportSize
) {
  const segment = getRoomWallSegment(room, wall);
  if (!segment) return null;

  return {
    from: worldToScreen(segment.start, camera, viewport),
    to: worldToScreen(segment.end, camera, viewport),
  };
}

function drawRoomLabels(
  labelContainer: Container,
  rooms: Room[],
  selectedRoomId: string | null,
  hoveredRoomLabelId: string | null,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">,
  showDimensions: boolean,
  transformFeedback: TransformFeedback | null,
  theme: EditorCanvasTheme
) {
  clearContainerChildren(labelContainer);
  const measurementTextScale = getMeasurementTextScale(settings);
  const areaFontSizePx = getScaledMeasurementPx(ROOM_LABEL_AREA_FONT_SIZE_PX, settings);

  for (const room of rooms) {
    const layout = getRoomLabelLayout(room, camera, viewport, settings, {
      showArea: showDimensions,
    });
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
  normalPlacement: "center" | "inside" | "outside";
  normalOffsetBiasPx: number;
};

type ResizeDimensionLabelLayout = {
  text: string;
  center: ScreenPoint;
  outwardDirection: ScreenPoint;
  tangentDirection: ScreenPoint;
  avoidanceDirection: ScreenPoint;
  width: number;
  height: number;
};

type OverlayAvoidRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function drawActiveResizeDimensions(
  labelContainer: Container,
  rooms: Room[],
  roomResizeUi: {
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredVertexIndex: number | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeVertexIndex: number | null;
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

  const roomLabelLayout = getRoomLabelLayout(activeRoom, camera, viewport, settings, {
    showArea: true,
  });
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
    [],
    settings
  );
  drawDimensionLabels(labelContainer, labelLayouts, settings, theme);
}

function drawSelectedRoomDimensions(
  labelContainer: Container,
  rooms: Room[],
  selectedRoomId: string | null,
  selectedWall: RoomWallSelection | null,
  roomResizeUi: {
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeVertexIndex: number | null;
    activeWallSegmentIndex: number | null;
    activeRoomId: string | null;
  },
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize" | "wallMeasurementPosition">,
  theme: EditorCanvasTheme
) {
  if (roomResizeUi.activeRoomId || roomResizeUi.activeWall || roomResizeUi.activeCorner) return;

  const targetRoomId = selectedWall?.roomId ?? selectedRoomId;
  if (!targetRoomId) return;

  const selectedRoom = rooms.find((room) => room.id === targetRoomId);
  if (!selectedRoom) return;

  const roomLabelLayout = getRoomLabelLayout(selectedRoom, camera, viewport, settings, {
    showArea: true,
  });
  const labelLayouts = getResolvedResizeDimensionLabelLayouts(
    getSelectedRoomDimensionLabelSpecs(selectedRoom, selectedWall, camera, viewport, settings),
    roomLabelLayout,
    viewport,
    getSelectedRoomDimensionAvoidRects(selectedRoom, camera, viewport),
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
  activeSnapStepMm: number | null,
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme
) {
  const activeSegmentLabelSpec = getDraftActiveSegmentDimensionLabelSpec(
    draftPoints,
    cursorWorld,
    camera,
    viewport,
    activeSnapStepMm
  );
  if (activeSegmentLabelSpec) {
    const labelLayouts = getResolvedResizeDimensionLabelLayouts(
      [activeSegmentLabelSpec],
      null,
      viewport,
      [],
      settings
    );
    drawDimensionLabels(labelContainer, labelLayouts, settings, theme);
    return;
  }

  const draftPreviewRoom = getDraftPreviewRoom(draftPoints, cursorWorld, activeSnapStepMm);
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
    [],
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
    normalPlacement: "center",
    normalOffsetBiasPx: 0,
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

  return {
    center: {
      x: (topLeft.x + bottomRight.x) / 2,
      y: (topLeft.y + bottomRight.y) / 2,
    },
    outwardDirection: { x: 0, y: -1 },
    tangentDirection: { x: 1, y: 0 },
    wallLengthPx: 0,
  };
}

function getSelectedRoomDimensionLabelSpecs(
  room: Room,
  selectedWall: RoomWallSelection | null,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "wallMeasurementPosition">
): ResizeDimensionLabelSpec[] {
  if (selectedWall) {
    const wallMeasurement = getRoomWallMeasurement(room, selectedWall.wall);
    if (!wallMeasurement) return [];

    const labelSpec = createDimensionLabelSpecForEdgeMeasurement(
      room,
      wallMeasurement,
      camera,
      viewport,
      settings
    );
    return labelSpec ? [labelSpec] : [];
  }

  return getRoomEdgeMeasurements(room).flatMap((edge) => {
    const labelSpec = createDimensionLabelSpecForEdgeMeasurement(
      room,
      edge,
      camera,
      viewport,
      settings
    );
    return labelSpec ? [labelSpec] : [];
  });
}

function createDimensionLabelSpecForEdgeMeasurement(
  room: Room,
  edge: { start: Point; end: Point; lengthMillimetres: number },
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "wallMeasurementPosition">
): ResizeDimensionLabelSpec | null {
  const midpoint = {
    x: (edge.start.x + edge.end.x) / 2,
    y: (edge.start.y + edge.end.y) / 2,
  };
  const outwardOffsetWorld = getOrthogonalEdgeOutwardOffsetWorld(room.points, edge.start, edge.end);
  if (!outwardOffsetWorld) return null;

  const startScreen = worldToScreen(edge.start, camera, viewport);
  const endScreen = worldToScreen(edge.end, camera, viewport);
  const midpointScreen = worldToScreen(midpoint, camera, viewport);
  const outwardScreen = worldToScreen(
    {
      x: midpoint.x + outwardOffsetWorld.x,
      y: midpoint.y + outwardOffsetWorld.y,
    },
    camera,
    viewport
  );
  const tangentVector = {
    x: endScreen.x - startScreen.x,
    y: endScreen.y - startScreen.y,
  };
  const outwardVector = {
    x: outwardScreen.x - midpointScreen.x,
    y: outwardScreen.y - midpointScreen.y,
  };
  const isNonRectangularRoom = !isAxisAlignedRectangle(room.points);

  return {
    text: formatMetricWallDimension(edge.lengthMillimetres),
    wall: edge.start.y === edge.end.y ? "top" : "left",
    axis: edge.start.y === edge.end.y ? "horizontal" : "vertical",
    center: midpointScreen,
    outwardDirection: normalizeAxisAlignedScreenDirection(outwardVector),
    tangentDirection: normalizeAxisAlignedScreenDirection(tangentVector),
    wallLengthPx: Math.abs(endScreen.x - startScreen.x) + Math.abs(endScreen.y - startScreen.y),
    normalPlacement: settings.wallMeasurementPosition,
    normalOffsetBiasPx: isNonRectangularRoom ? RESIZE_DIMENSION_NON_RECT_EDGE_EXTRA_PADDING_PX : 0,
  };
}

function getOrthogonalEdgeOutwardOffsetWorld(
  polygonPoints: Point[],
  start: Point,
  end: Point
): Point | null {
  if (start.x === end.x) {
    const midpoint = { x: start.x, y: (start.y + end.y) / 2 };
    const negativeProbe = { x: midpoint.x - 1, y: midpoint.y };
    const positiveProbe = { x: midpoint.x + 1, y: midpoint.y };

    if (isPointInPolygon(negativeProbe, polygonPoints) && !isPointInPolygon(positiveProbe, polygonPoints)) {
      return { x: 1, y: 0 };
    }
    if (isPointInPolygon(positiveProbe, polygonPoints) && !isPointInPolygon(negativeProbe, polygonPoints)) {
      return { x: -1, y: 0 };
    }
    return null;
  }

  if (start.y === end.y) {
    const midpoint = { x: (start.x + end.x) / 2, y: start.y };
    const negativeProbe = { x: midpoint.x, y: midpoint.y - 1 };
    const positiveProbe = { x: midpoint.x, y: midpoint.y + 1 };

    if (isPointInPolygon(negativeProbe, polygonPoints) && !isPointInPolygon(positiveProbe, polygonPoints)) {
      return { x: 0, y: 1 };
    }
    if (isPointInPolygon(positiveProbe, polygonPoints) && !isPointInPolygon(negativeProbe, polygonPoints)) {
      return { x: 0, y: -1 };
    }
  }

  return null;
}

function normalizeAxisAlignedScreenDirection(vector: ScreenPoint): ScreenPoint {
  if (Math.abs(vector.x) >= Math.abs(vector.y)) {
    return { x: vector.x >= 0 ? 1 : -1, y: 0 };
  }

  return { x: 0, y: vector.y >= 0 ? 1 : -1 };
}

function getResolvedResizeDimensionLabelLayouts(
  labelSpecs: ResizeDimensionLabelSpec[],
  roomLabelLayout: ReturnType<typeof getRoomLabelLayout>,
  viewport: ViewportSize,
  avoidRects: OverlayAvoidRect[],
  settings: Pick<EditorSettings, "measurementFontSize">
): ResizeDimensionLabelLayout[] {
  const textResolution = getTextResolution();
  const measurementTextScale = getMeasurementTextScale(settings);
  const dimensionFontSizePx = getScaledMeasurementPx(RESIZE_DIMENSION_FONT_SIZE_PX, settings);
  const dimensionPaddingXPx = getScaledMeasurementPx(RESIZE_DIMENSION_PADDING_X_PX, settings);
  const dimensionPaddingYPx = getScaledMeasurementPx(RESIZE_DIMENSION_PADDING_Y_PX, settings);
  const labelGapPx = getScaledMeasurementPx(RESIZE_DIMENSION_LABEL_GAP_PX, settings);
  const cornerSeparationPx = getScaledMeasurementPx(RESIZE_DIMENSION_CORNER_SEPARATION_PX, settings);
  const insideEdgePaddingPx = getScaledMeasurementPx(
    RESIZE_DIMENSION_INSIDE_EDGE_PADDING_PX,
    settings
  );
  const handleClearancePx = getScaledMeasurementPx(
    RESIZE_DIMENSION_HANDLE_CLEARANCE_PX,
    settings
  );
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
    const normalOffsetPx =
      labelSpec.normalPlacement === "center"
        ? 0
        : height / 2 +
          insideEdgePaddingPx +
          getScaledMeasurementPx(labelSpec.normalOffsetBiasPx, settings);
    const avoidanceDirection =
      labelSpec.normalPlacement === "inside"
        ? {
            x: -labelSpec.outwardDirection.x,
            y: -labelSpec.outwardDirection.y,
          }
        : labelSpec.outwardDirection;
    const placementDirection =
      labelSpec.normalPlacement === "inside"
        ? {
            x: -labelSpec.outwardDirection.x,
            y: -labelSpec.outwardDirection.y,
          }
        : labelSpec.outwardDirection;
    const shiftedCenter = {
      x: labelSpec.center.x + placementDirection.x * normalOffsetPx,
      y: labelSpec.center.y + placementDirection.y * normalOffsetPx,
    };

    return {
      text: labelSpec.text,
      center: clampResizeDimensionLabelCenter(shiftedCenter, width, height, viewport),
      outwardDirection: labelSpec.outwardDirection,
      tangentDirection: labelSpec.tangentDirection,
      avoidanceDirection,
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

  if (avoidRects.length > 0) {
    for (let index = 0; index < labelLayouts.length; index += 1) {
      labelLayouts[index] = nudgeResizeDimensionLabelAwayFromAvoidRects(
        labelLayouts[index],
        avoidRects,
        viewport,
        handleClearancePx
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
  rect: OverlayAvoidRect,
  viewport: ViewportSize,
  distancePx: number
): ResizeDimensionLabelLayout {
  if (!rectsOverlap(getCenteredRectFromLayout(labelLayout), rect)) {
    return labelLayout;
  }

  return nudgeResizeDimensionLabel(
    labelLayout,
    labelLayout.avoidanceDirection,
    viewport,
    distancePx
  );
}

function nudgeResizeDimensionLabelAwayFromAvoidRects(
  labelLayout: ResizeDimensionLabelLayout,
  avoidRects: OverlayAvoidRect[],
  viewport: ViewportSize,
  distancePx: number
): ResizeDimensionLabelLayout {
  let resolvedLayout = labelLayout;

  for (let pass = 0; pass < 4; pass += 1) {
    const overlappingRect = avoidRects.find((rect) =>
      rectsOverlap(getCenteredRectFromLayout(resolvedLayout), rect)
    );
    if (!overlappingRect) {
      break;
    }

    resolvedLayout = nudgeResizeDimensionLabel(
      resolvedLayout,
      resolvedLayout.avoidanceDirection,
      viewport,
      distancePx
    );
  }

  return resolvedLayout;
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

function getDraftPreviewPoint(
  anchorPoint: Point,
  cursorWorld: Point,
  activeSnapStepMm: number | null
): Point {
  return activeSnapStepMm
    ? getOrthogonalSnappedPoint(anchorPoint, cursorWorld, activeSnapStepMm)
    : projectOrthogonalPoint(anchorPoint, cursorWorld);
}

function getDraftPreviewRoom(
  draftPoints: Point[],
  cursorWorld: Point | null,
  activeSnapStepMm: number | null
): Room | null {
  if (!cursorWorld) return null;
  if (draftPoints.length < 4) return null;

  const previewPoint = getDraftPreviewPoint(
    draftPoints[draftPoints.length - 1],
    cursorWorld,
    activeSnapStepMm
  );
  if (!pointsEqual(previewPoint, draftPoints[0])) return null;
  if (!isOrthogonalPointPath(draftPoints, { closed: true }) || !isSimplePolygon(draftPoints)) {
    return null;
  }

  return {
    id: "__draft-preview__",
    name: "",
    points: draftPoints,
    openings: [],
    interiorAssets: [],
  };
}

function getSelectedRoomDimensionAvoidRects(
  room: Room,
  camera: CameraState,
  viewport: ViewportSize
): OverlayAvoidRect[] {
  const declutter = getRoomDeclutterState(room, camera, viewport);
  if (!declutter.showSelectionControls) return [];

  const handlePaddingPx = RESIZE_DIMENSION_HANDLE_CLEARANCE_PX / 2;
  const vertexHandles = getConstrainedVertexHandleLayouts(room, camera, viewport);

  if (vertexHandles.length > 0) {
    const wallHandleRects = getOrthogonalWallHandleLayouts(room, camera, viewport).map((handle) => ({
      left: handle.left - handlePaddingPx,
      right: handle.left + handle.width + handlePaddingPx,
      top: handle.top - handlePaddingPx,
      bottom: handle.top + handle.height + handlePaddingPx,
    }));
    const vertexHandleRects = vertexHandles.map((handle) => {
      const halfSize = handle.size / 2 + handlePaddingPx;

      return {
        left: handle.center.x - halfSize,
        right: handle.center.x + halfSize,
        top: handle.center.y - halfSize,
        bottom: handle.center.y + halfSize,
      };
    });

    return [...wallHandleRects, ...vertexHandleRects];
  }

  const bounds = getAxisAlignedRoomBounds(room);
  if (!bounds) return [];

  const wallHandles = getWallHandleLayouts(bounds, camera, viewport).map((handle) => ({
    left: handle.left - handlePaddingPx,
    right: handle.left + handle.width + handlePaddingPx,
    top: handle.top - handlePaddingPx,
    bottom: handle.top + handle.height + handlePaddingPx,
  }));
  const cornerHandles = getCornerHandleLayouts(bounds, camera, viewport).map((handle) => {
    const halfSize = handle.size / 2 + handlePaddingPx;

    return {
      left: handle.center.x - halfSize,
      right: handle.center.x + halfSize,
      top: handle.center.y - halfSize,
      bottom: handle.center.y + halfSize,
    };
  });

  return [...wallHandles, ...cornerHandles];
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

function getDraftActiveSegmentDimensionLabelSpec(
  draftPoints: Point[],
  cursorWorld: Point | null,
  camera: CameraState,
  viewport: ViewportSize,
  activeSnapStepMm: number | null
): ResizeDimensionLabelSpec | null {
  if (!cursorWorld || draftPoints.length === 0) return null;

  const anchorPoint = draftPoints[draftPoints.length - 1];
  const previewPoint = getDraftPreviewPoint(anchorPoint, cursorWorld, activeSnapStepMm);
  if (anchorPoint.x === previewPoint.x && anchorPoint.y === previewPoint.y) return null;
  if (draftPoints.length >= 4 && pointsEqual(previewPoint, draftPoints[0])) return null;

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
    text: formatMetricWallDimension(getEdgeLengthMillimetres(anchorPoint, previewPoint)),
    wall,
    axis: isHorizontal ? "horizontal" : "vertical",
    normalPlacement: "center",
    normalOffsetBiasPx: 0,
    center: {
      x: (startScreen.x + endScreen.x) / 2,
      y: (startScreen.y + endScreen.y) / 2,
    },
    outwardDirection: isHorizontal
      ? { x: 0, y: wall === "bottom" ? 1 : -1 }
      : { x: wall === "right" ? 1 : -1, y: 0 },
    tangentDirection: isHorizontal ? { x: 1, y: 0 } : { x: 0, y: 1 },
    wallLengthPx: isHorizontal
      ? Math.abs(endScreen.x - startScreen.x)
      : Math.abs(endScreen.y - startScreen.y),
  };
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

function drawSnapGuides(
  graphics: Graphics,
  guides: SnapGuides,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const screenPoint = worldToScreen(guides.point, camera, viewport);
  if (guides.showVertical) {
    drawDashedGuideLine(
      graphics,
      { x: screenPoint.x, y: 0 },
      { x: screenPoint.x, y: viewport.height },
      theme.guidelineAccent
    );
  }

  if (guides.showHorizontal) {
    drawDashedGuideLine(
      graphics,
      { x: 0, y: screenPoint.y },
      { x: viewport.width, y: screenPoint.y },
      theme.guidelineAccent
    );
  }
}

function drawDraft(
  graphics: Graphics,
  draftPoints: Point[],
  cursorWorld: Point | null,
  camera: CameraState,
  viewport: ViewportSize,
  cursorSnapStepMm: number,
  activeSnapStepMm: number | null,
  snapGuides: SnapGuides | null,
  theme: EditorCanvasTheme
) {
  graphics.clear();
  const cursorHudWorld = cursorWorld ? snapPointToGrid(cursorWorld, cursorSnapStepMm) : null;

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

    if (!cursorWorld || !cursorHudWorld) return;

    const previewWorld = getDraftPreviewPoint(
      draftPoints[draftPoints.length - 1],
      cursorWorld,
      activeSnapStepMm
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

    drawCursorCrosshairGuides(
      graphics,
      worldToScreen(cursorHudWorld, camera, viewport),
      viewport,
      theme,
      "active"
    );
    if (snapGuides) {
      drawSnapGuides(
        graphics,
        snapGuides,
        camera,
        viewport,
        theme
      );
    }
    drawCursorHud(graphics, worldToScreen(cursorHudWorld, camera, viewport), theme, "active");
    return;
  }

  if (!cursorWorld || !cursorHudWorld) return;

  drawCursorCrosshairGuides(
    graphics,
    worldToScreen(cursorHudWorld, camera, viewport),
    viewport,
    theme,
    "idle"
  );
  if (snapGuides) {
    drawSnapGuides(graphics, snapGuides, camera, viewport, theme);
  }
  drawCursorHud(graphics, worldToScreen(cursorHudWorld, camera, viewport), theme, "idle");
}

function drawCursorCrosshairGuides(
  graphics: Graphics,
  point: Point,
  viewport: ViewportSize,
  theme: EditorCanvasTheme,
  mode: "idle" | "active"
) {
  graphics.setStrokeStyle({
    width: mode === "active" ? 1.1 : 1,
    color: theme.interactiveAccent,
    alpha: mode === "active" ? 0.3 : 0.22,
  });
  graphics.moveTo(point.x, 0);
  graphics.lineTo(point.x, viewport.height);
  graphics.moveTo(0, point.y);
  graphics.lineTo(viewport.width, point.y);
  graphics.stroke();
}

function drawCursorHud(
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

function drawDashedGuideLine(
  graphics: Graphics,
  start: Point,
  end: Point,
  color: number
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return;

  const dashLength = 8;
  const gapLength = 6;
  const stepX = dx / length;
  const stepY = dy / length;

  graphics.setStrokeStyle({ width: 1.25, color, alpha: 0.44 });
  for (let distance = 0; distance < length; distance += dashLength + gapLength) {
    const dashStart = distance;
    const dashEnd = Math.min(distance + dashLength, length);
    graphics.moveTo(start.x + stepX * dashStart, start.y + stepY * dashStart);
    graphics.lineTo(start.x + stepX * dashEnd, start.y + stepY * dashEnd);
  }
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

function getTextResolution(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

function snapToPixel(value: number, resolution: number): number {
  return Math.round(value * resolution) / resolution;
}

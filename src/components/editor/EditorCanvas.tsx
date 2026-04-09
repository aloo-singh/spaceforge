"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
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
import {
  getConstrainedVertexHandleLayouts,
  hitTestConstrainedVertexHandle,
  isNonRectangularOrthogonalRoom,
} from "@/lib/editor/constrainedVertexAdjustments";
import {
  DEFAULT_STAIR_ARROW_DIRECTION,
  DEFAULT_STAIR_ARROW_ENABLED,
  DEFAULT_STAIR_TREAD_SPACING_MM,
  findInteriorAssetAtScreenPoint,
  getStairRunLengthMm,
  getInteriorAssetBoundsAsRectBounds,
  getRoomInteriorAssetBounds,
} from "@/lib/editor/interiorAssets";
import {
  getOrthogonalWallHandleLayouts,
  hitTestOrthogonalWallHandle,
} from "@/lib/editor/orthogonalWallResize";
import {
  findOpeningAtScreenPoint,
  findSelectedOpeningWidthHandleAtScreenPoint,
  getResolvedRoomOpeningLayout,
  getRoomWallMeasurement,
  getRoomWallSegment,
} from "@/lib/editor/openings";
import { getRoomDeclutterState } from "@/lib/editor/roomDeclutter";
import {
  findRoomLabelAtScreenPoint,
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
import { getLayoutBoundsFromDocument, getLayoutBoundsFromRooms } from "@/lib/editor/exportLayoutBounds";
import { exportPixiCanvasToPngBlob, exportPixiCanvasToPngDataUrl } from "@/lib/editor/exportPng";
import { exportPixiCanvasToThumbnailDataUrl } from "@/lib/editor/projectThumbnail";
import { getCameraFitTargetForBounds } from "@/lib/editor/cameraFit";
import {
  findRoomAtPoint,
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
  hitTestCornerHandle,
  hitTestWallHandle,
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
  DEFAULT_EDITOR_SETTINGS,
  getMeasurementTextScale,
  normalizeEditorExportSignature,
  shouldShowDimensions,
  type EditorSettings,
} from "@/lib/editor/settings";
import {
  getKeyboardShortcutFeedbackMessage,
  matchEditorKeyboardShortcut,
  showKeyboardShortcutFeedbackToast,
} from "@/lib/editor/keyboardMap";
import {
  formatCanvasRotationDegrees,
  formatCanvasRotationShortcutLabel,
  normalizeCanvasRotationDegrees,
} from "@/lib/editor/canvasRotation";
import {
  formatNorthBearingDegrees,
  getNorthBearingDegreesFromScreenDelta,
  normalizeNorthBearingDegrees,
  snapNorthBearingDegrees,
} from "@/lib/editor/north";
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
import { SelectedNorthInspector } from "@/components/editor/SelectedNorthInspector";
import { HistoryControls } from "@/components/editor/HistoryControls";
import { OnboardingHintCard } from "@/components/editor/OnboardingHintCard";
import { EditorInspectorEmptyState } from "@/components/editor/EditorInspectorEmptyState";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  tooltipContentClassName,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
const NORTH_INDICATOR_SURFACE_FADE_DELAY_MS = 320;
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
const STAIR_DIRECTION_LABEL_MIN_FONT_SIZE_PX = 10;
const STAIR_DIRECTION_LABEL_MAX_FONT_SIZE_PX = 18;
const STAIR_DIRECTION_LABEL_WORLD_MM = 60;
const STAIR_DIRECTION_ARROW_LENGTH_RATIO = 0.56;
const STAIR_DIRECTION_ARROW_MIN_LENGTH_MM = 900;
const STAIR_DIRECTION_ARROW_HEAD_WORLD_MM = 140;
const STAIR_DIRECTION_LABEL_OFFSET_WORLD_MM = 140;
const STAIR_ROTATION_ANIMATION_MS = 180;
const CANVAS_ROTATION_ENABLED = false;
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

type StairRotationAnimation = {
  roomId: string;
  assetId: string;
  startWidthMm: number;
  startDepthMm: number;
  startRotationDegrees: number;
  endRotationDegrees: number;
  startedAtMs: number;
};

function getShortestRotationDeltaDegrees(fromDegrees: number, toDegrees: number) {
  const normalizedDelta = normalizeCanvasRotationDegrees(toDegrees - fromDegrees);
  if (normalizedDelta > 180) return normalizedDelta - 360;
  if (normalizedDelta <= -180) return normalizedDelta + 360;
  return normalizedDelta;
}

function getInterpolatedRotationDegrees(
  startRotationDegrees: number,
  endRotationDegrees: number,
  progress: number
) {
  return normalizeCanvasRotationDegrees(
    startRotationDegrees +
      getShortestRotationDeltaDegrees(startRotationDegrees, endRotationDegrees) * progress
  );
}

function getRotatedAssetScreenCorners(
  asset: Pick<Room["interiorAssets"][number], "xMm" | "yMm" | "widthMm" | "depthMm" | "rotationDegrees">,
  camera: CameraState,
  viewport: ViewportSize
) {
  const halfWidth = asset.widthMm / 2;
  const halfDepth = asset.depthMm / 2;
  const rotationRadians = (normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);
  const rotatePoint = (x: number, y: number) =>
    worldToScreen(
      {
        x: asset.xMm + x * cos - y * sin,
        y: asset.yMm + x * sin + y * cos,
      },
      camera,
      viewport
    );

  return [
    rotatePoint(-halfWidth, -halfDepth),
    rotatePoint(halfWidth, -halfDepth),
    rotatePoint(halfWidth, halfDepth),
    rotatePoint(-halfWidth, halfDepth),
  ] as const;
}

function getDisplayedInteriorAssetForAnimation(
  asset: Room["interiorAssets"][number],
  animation: StairRotationAnimation | undefined,
  renderedAtMs: number
) {
  if (!animation) return asset;

  const progress = clampValue((renderedAtMs - animation.startedAtMs) / STAIR_ROTATION_ANIMATION_MS, 0, 1);
  const easedProgress = easeOutCubic(progress);
  const shortSideMm = Math.min(asset.widthMm, asset.depthMm);
  const longSideMm = Math.max(asset.widthMm, asset.depthMm);

  return {
    ...asset,
    widthMm: shortSideMm,
    depthMm: longSideMm,
    rotationDegrees: getInterpolatedRotationDegrees(
      animation.startRotationDegrees,
      animation.endRotationDegrees,
      easedProgress
    ),
  };
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

function CanvasHudCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/86 px-3 py-2 text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-sm dark:shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
      {children}
    </div>
  );
}

const MINI_MAP_WIDTH_PX = 172;
const MINI_MAP_HEIGHT_PX = 128;
const MINI_MAP_INSET_PX = 10;
const MINI_MAP_WORLD_PADDING_RATIO = 0.08;
const MINI_MAP_WORLD_PADDING_MIN_MM = 320;
const CANVAS_HUD_HIDE_TRANSITION_MS = 220;

function CanvasMiniMap({
  rooms,
  camera,
  viewport,
  themeMode,
  onPanToWorldPoint,
  onInteractionActiveChange,
}: {
  rooms: Room[];
  camera: CameraState;
  viewport: ViewportSize;
  themeMode: "light" | "dark";
  onPanToWorldPoint: (point: Point) => void;
  onInteractionActiveChange: (isActive: boolean) => void;
}) {
  const dragPointerIdRef = useRef<number | null>(null);
  const layoutBounds = useMemo(() => getLayoutBoundsFromRooms(rooms), [rooms]);
  const miniMapState = useMemo(() => {
    if (!layoutBounds) return null;

    const fitViewportBounds = getMiniMapFitViewportWorldBounds(layoutBounds, camera, viewport);
    const framingMinX = Math.min(layoutBounds.minX, fitViewportBounds.minX);
    const framingMinY = Math.min(layoutBounds.minY, fitViewportBounds.minY);
    const framingMaxX = Math.max(layoutBounds.maxX, fitViewportBounds.maxX);
    const framingMaxY = Math.max(layoutBounds.maxY, fitViewportBounds.maxY);
    const framingWidthMm = Math.max(framingMaxX - framingMinX, 1);
    const framingHeightMm = Math.max(framingMaxY - framingMinY, 1);
    const dominantDimensionMm = Math.max(framingWidthMm, framingHeightMm, 1);
    const worldPaddingMm = Math.max(
      MINI_MAP_WORLD_PADDING_MIN_MM,
      dominantDimensionMm * MINI_MAP_WORLD_PADDING_RATIO
    );
    const worldMinX = framingMinX - worldPaddingMm;
    const worldMinY = framingMinY - worldPaddingMm;
    const worldWidth = Math.max(framingWidthMm + worldPaddingMm * 2, 1);
    const worldHeight = Math.max(framingHeightMm + worldPaddingMm * 2, 1);
    const drawableWidthPx = MINI_MAP_WIDTH_PX - MINI_MAP_INSET_PX * 2;
    const drawableHeightPx = MINI_MAP_HEIGHT_PX - MINI_MAP_INSET_PX * 2;
    const scale = Math.min(drawableWidthPx / worldWidth, drawableHeightPx / worldHeight);
    const offsetX = (MINI_MAP_WIDTH_PX - worldWidth * scale) / 2;
    const offsetY = (MINI_MAP_HEIGHT_PX - worldHeight * scale) / 2;
    const mapPoint = (point: Point) => ({
      x: offsetX + (point.x - worldMinX) * scale,
      y: offsetY + (point.y - worldMinY) * scale,
    });
    const mapScreenPointToWorld = (screenPoint: ScreenPoint) => ({
      x: worldMinX + (screenPoint.x - offsetX) / scale,
      y: worldMinY + (screenPoint.y - offsetY) / scale,
    });
    const viewportBounds = getMiniMapViewportWorldBounds(camera, viewport);
    const viewportTopLeft = mapPoint({ x: viewportBounds.minX, y: viewportBounds.minY });
    const viewportBottomRight = mapPoint({ x: viewportBounds.maxX, y: viewportBounds.maxY });

    return {
      screenToWorld: mapScreenPointToWorld,
      roomPaths: rooms
        .filter((room) => room.points.length > 1)
        .map((room) => ({
          id: room.id,
          path: buildMiniMapRoomPath(room.points, mapPoint),
        })),
      viewportRect: {
        x: viewportTopLeft.x,
        y: viewportTopLeft.y,
        width: viewportBottomRight.x - viewportTopLeft.x,
        height: viewportBottomRight.y - viewportTopLeft.y,
      },
    };
  }, [camera, layoutBounds, rooms, viewport]);

  if (!miniMapState) return null;

  const updateCameraFromPointer = (
    event: ReactPointerEvent<HTMLDivElement> | PointerEvent,
    element: HTMLDivElement
  ) => {
    const rect = element.getBoundingClientRect();
    const localPoint = {
      x: ((event.clientX - rect.left) / rect.width) * MINI_MAP_WIDTH_PX,
      y: ((event.clientY - rect.top) / rect.height) * MINI_MAP_HEIGHT_PX,
    };
    onPanToWorldPoint(miniMapState.screenToWorld(localPoint));
  };

  const roomFill = themeMode === "light" ? "rgba(82, 82, 91, 0.24)" : "rgba(212, 212, 216, 0.14)";
  const roomStroke = themeMode === "light" ? "rgba(63, 63, 70, 0.66)" : "rgba(228, 228, 231, 0.42)";
  const frameStroke = themeMode === "light" ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 255, 255, 0.98)";

  return (
    <CanvasHudCard>
      <div
        className="pointer-events-auto cursor-pointer touch-none overflow-hidden rounded-[10px] border border-black/8 bg-zinc-200/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.32)] dark:border-white/8 dark:bg-zinc-900/55 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        onPointerDown={(event) => {
          const element = event.currentTarget;
          dragPointerIdRef.current = event.pointerId;
          element.setPointerCapture(event.pointerId);
          onInteractionActiveChange(true);
          updateCameraFromPointer(event, element);
        }}
        onPointerMove={(event) => {
          if (dragPointerIdRef.current !== event.pointerId) return;
          updateCameraFromPointer(event, event.currentTarget);
        }}
        onPointerUp={(event) => {
          if (dragPointerIdRef.current !== event.pointerId) return;
          dragPointerIdRef.current = null;
          onInteractionActiveChange(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          if (dragPointerIdRef.current !== event.pointerId) return;
          dragPointerIdRef.current = null;
          onInteractionActiveChange(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <svg
          width={MINI_MAP_WIDTH_PX}
          height={MINI_MAP_HEIGHT_PX}
          viewBox={`0 0 ${MINI_MAP_WIDTH_PX} ${MINI_MAP_HEIGHT_PX}`}
          aria-hidden="true"
          className="block"
        >
          {miniMapState.roomPaths.map((room) => (
            <path
              key={room.id}
              d={room.path}
              fill={roomFill}
              stroke={roomStroke}
              strokeWidth={1.25}
              strokeLinejoin="round"
            />
          ))}
          <rect
            x={miniMapState.viewportRect.x}
            y={miniMapState.viewportRect.y}
            width={miniMapState.viewportRect.width}
            height={miniMapState.viewportRect.height}
            rx={8}
            fill="none"
            stroke={frameStroke}
            strokeWidth={1.5}
          />
        </svg>
      </div>
    </CanvasHudCard>
  );
}

function buildMiniMapRoomPath(points: Point[], mapPoint: (point: Point) => ScreenPoint) {
  if (points.length === 0) return "";

  return points
    .map((point, index) => {
      const mappedPoint = mapPoint(point);
      return `${index === 0 ? "M" : "L"} ${mappedPoint.x} ${mappedPoint.y}`;
    })
    .join(" ")
    .concat(" Z");
}

function getMiniMapViewportWorldBounds(camera: CameraState, viewport: ViewportSize) {
  if (Math.abs(normalizeCanvasRotationDegrees(camera.rotationDegrees)) <= 0.01) {
    const halfWidthMm = viewport.width / camera.pixelsPerMm / 2;
    const halfHeightMm = viewport.height / camera.pixelsPerMm / 2;

    return {
      minX: camera.xMm - halfWidthMm,
      maxX: camera.xMm + halfWidthMm,
      minY: camera.yMm - halfHeightMm,
      maxY: camera.yMm + halfHeightMm,
    };
  }

  return getViewportWorldBounds(camera, viewport);
}

function getMiniMapFitViewportWorldBounds(
  layoutBounds: NonNullable<ReturnType<typeof getLayoutBoundsFromRooms>>,
  camera: CameraState,
  viewport: ViewportSize
) {
  const fitCamera = getCameraFitTargetForBounds({
    layoutBounds,
    viewport,
    emptyLayoutCamera: {
      ...camera,
      xMm: layoutBounds.centerX,
      yMm: layoutBounds.centerY,
    },
  }).camera;

  return getMiniMapViewportWorldBounds(fitCamera, viewport);
}

type NorthDragTooltipState = {
  left: number;
  top: number;
  bearingDegrees: number;
};

type CanvasRotationTooltipState = {
  left: number;
  top: number;
  rotationDegrees: number;
};

type NorthIndicatorSurfaceState = "hidden" | "visible";

type ActiveNorthDrag = {
  pointerId: number;
  indicatorCenter: ScreenPoint;
  startingBearingDegrees: number;
  currentBearingDegrees: number;
  startPointer: ScreenPoint;
  didDrag: boolean;
};

function CanvasRotationIndicatorControl({
  rotationDegrees,
  northBearingDegrees,
  surfaceState,
  onReset,
}: {
  rotationDegrees: number;
  northBearingDegrees: number;
  surfaceState: NorthIndicatorSurfaceState;
  onReset: () => void;
}) {
  const normalizedRotationDegrees = normalizeCanvasRotationDegrees(rotationDegrees);
  const showSurface = surfaceState === "visible";

  const northMarkerDegrees = normalizeNorthBearingDegrees(northBearingDegrees + normalizedRotationDegrees);

  return (
    <ImmediateTooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onReset}
            aria-label={`Reset canvas rotation (${formatCanvasRotationDegrees(normalizedRotationDegrees)})`}
            className={`group relative flex h-14 w-14 touch-none items-center justify-center rounded-full border border-border/70 bg-background/90 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm transition-[transform,opacity] ease-out hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:shadow-[0_8px_24px_rgba(0,0,0,0.26)] ${
              showSurface ? "pointer-events-auto" : "pointer-events-none"
            } ${
              showSurface ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDuration: showSurface ? "150ms" : "500ms" }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-[7px] rounded-full border-[2.5px] border-black shadow-[0_0_0_1px_rgba(255,255,255,0.82)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.58)]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-[10px] transition-transform duration-75 ease-out"
              style={{ transform: `rotate(${normalizedRotationDegrees}deg)` }}
            >
              <div className="absolute left-1/2 top-0 h-3.5 w-[2.5px] -translate-x-1/2 rounded-full bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.72)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.4)]" />
            </div>
            <div
              aria-hidden="true"
              className="absolute inset-[10px] transition-transform duration-75 ease-out"
              style={{ transform: `rotate(${northMarkerDegrees}deg)` }}
            >
              <div className="absolute left-1/2 top-[-1px] h-0 w-0 -translate-x-1/2 border-x-[6px] border-b-[9px] border-x-transparent border-b-red-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.28)]" />
            </div>
            <div
              className="relative text-[10px] font-semibold tracking-[0.06em] text-foreground/82"
              style={{ fontFamily: MEASUREMENT_TEXT_FONT_FAMILY }}
            >
              {formatCanvasRotationDegrees(normalizedRotationDegrees)}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          {formatCanvasRotationDegrees(normalizedRotationDegrees)}. {formatCanvasRotationShortcutLabel()}. Click to reset.
        </TooltipContent>
      </Tooltip>
    </ImmediateTooltipProvider>
  );
}

function NorthIndicatorControl({
  bearingDegrees,
  viewRotationDegrees,
  surfaceState,
  isDragging,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  bearingDegrees: number;
  viewRotationDegrees: number;
  surfaceState: NorthIndicatorSurfaceState;
  isDragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const initialVisibleBearingDegrees = normalizeNorthBearingDegrees(bearingDegrees + viewRotationDegrees);
  const [displayBearingDegrees, setDisplayBearingDegrees] = useState(initialVisibleBearingDegrees);
  const previousBearingRef = useRef(initialVisibleBearingDegrees);

  const visibleBearingDegrees = normalizeNorthBearingDegrees(bearingDegrees + viewRotationDegrees);

  useEffect(() => {
    const previousBearingDegrees = previousBearingRef.current;
    const delta = ((visibleBearingDegrees - previousBearingDegrees + 540) % 360) - 180;
    const nextDisplayBearingDegrees = previousBearingDegrees + delta;
    previousBearingRef.current = nextDisplayBearingDegrees;
    setDisplayBearingDegrees(nextDisplayBearingDegrees);
  }, [visibleBearingDegrees]);

  const showSurface = surfaceState === "visible";

  return (
    <ImmediateTooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`North indicator ${formatNorthBearingDegrees(visibleBearingDegrees)}`}
            onPointerDown={onPointerDown}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            className="pointer-events-auto group relative flex h-14 w-14 touch-none items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div
              aria-hidden="true"
              className={`absolute inset-0 rounded-md border border-border/70 bg-background/86 shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-sm transition-opacity duration-150 ease-out dark:shadow-[0_8px_24px_rgba(0,0,0,0.24)] ${
                showSurface ? "opacity-100" : "opacity-0"
              }`}
              style={{ transitionDuration: showSurface ? "150ms" : "500ms" }}
            />
            <div
              aria-hidden="true"
              className={`absolute inset-0 transition-opacity duration-150 ease-out ${
                showSurface ? "opacity-100" : "opacity-0"
              }`}
              style={{ transitionDuration: showSurface ? "150ms" : "500ms" }}
            >
              {Array.from({ length: 16 }).map((_, index) => {
                const angle = index * 22.5;
                const isMajorTick = angle % 90 === 0;
                return (
                  <div
                    key={angle}
                    className="absolute left-1/2 top-1/2 origin-bottom -translate-x-1/2"
                    style={{
                      transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                      height: "21px",
                    }}
                  >
                    <div
                      className={`mx-auto rounded-full ${
                        isMajorTick
                          ? "h-2 w-px bg-black/90 dark:bg-white/90"
                          : "h-1.5 w-px bg-black/55 dark:bg-white/50"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div
              aria-hidden="true"
              className={`absolute inset-0 transition-transform ease-out ${isDragging ? "duration-75" : "duration-200"}`}
              style={{ transform: `rotate(${displayBearingDegrees}deg)` }}
            >
              <div className="absolute top-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[6px] border-b-[9px] border-x-transparent border-b-red-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]" />
            </div>
            <div
              className="relative text-xs font-semibold tracking-[0.2em] text-foreground/86"
              style={{ fontFamily: MEASUREMENT_TEXT_FONT_FAMILY }}
            >
              N
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          {formatNorthBearingDegrees(visibleBearingDegrees)}. Drag to rotate north.
        </TooltipContent>
      </Tooltip>
    </ImmediateTooltipProvider>
  );
}
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
  const stairRotationAnimationsRef = useRef<Map<string, StairRotationAnimation>>(new Map());
  const stairRotationAnimationFrameRef = useRef<number | null>(null);
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
  const rooms = useEditorStore((state) => state.document.rooms);
  const roomDraftPointCount = useEditorStore((state) => state.roomDraft.points.length);
  const canvasRotationDegrees = useEditorStore((state) => state.document.canvasRotationDegrees);
  const northBearingDegrees = useEditorStore((state) => state.document.northBearingDegrees);
  const selectedNorthIndicator = useEditorStore((state) => state.selectedNorthIndicator);
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const selectNorthIndicator = useEditorStore((state) => state.selectNorthIndicator);
  const updateCanvasRotationDegrees = useEditorStore((state) => state.updateCanvasRotationDegrees);
  const resetCanvasRotation = useEditorStore((state) => state.resetCanvasRotation);
  const previewNorthBearingDegrees = useEditorStore((state) => state.previewNorthBearingDegrees);
  const commitNorthBearingDegrees = useEditorStore((state) => state.commitNorthBearingDegrees);
  const setCanvasInteractionActive = useEditorStore((state) => state.setCanvasInteractionActive);
  const camera = useEditorStore((state) => state.camera);
  const viewport = useEditorStore((state) => state.viewport);
  const setCameraCenterMm = useEditorStore((state) => state.setCameraCenterMm);
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
  const activeNorthDragRef = useRef<ActiveNorthDrag | null>(null);
  const canvasRotationIndicatorSlotRef = useRef<HTMLDivElement | null>(null);
  const [northDragTooltip, setNorthDragTooltip] = useState<NorthDragTooltipState | null>(null);
  const [canvasRotationTooltip, setCanvasRotationTooltip] =
    useState<CanvasRotationTooltipState | null>(null);
  const [isNorthIndicatorHovered, setIsNorthIndicatorHovered] = useState(false);
  const [northIndicatorSurfaceState, setNorthIndicatorSurfaceState] =
    useState<NorthIndicatorSurfaceState>("hidden");
  const [canvasRotationIndicatorSurfaceState, setCanvasRotationIndicatorSurfaceState] =
    useState<NorthIndicatorSurfaceState>(
      Math.abs(normalizeCanvasRotationDegrees(canvasRotationDegrees)) > 0.01 ? "visible" : "hidden"
    );
  const northIndicatorFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRotationIndicatorFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (
      grid.destroyed ||
      rooms.destroyed ||
      openings.destroyed ||
      wallOverlay.destroyed ||
      roomLabels.destroyed ||
      draft.destroyed ||
      dimensionOverlay.destroyed
    ) {
      return;
    }

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
      stairRotationAnimationsRef.current,
      snapGuidesRef.current,
      editorThemeRef.current,
      Boolean(activeNorthDragRef.current?.didDrag)
    );
  }, []);

  const stopTransformAnimation = useCallback(() => {
    if (transformAnimationFrameRef.current === null) return;
    cancelAnimationFrame(transformAnimationFrameRef.current);
    transformAnimationFrameRef.current = null;
  }, []);

  const stopStairRotationAnimation = useCallback(() => {
    if (stairRotationAnimationFrameRef.current === null) return;
    cancelAnimationFrame(stairRotationAnimationFrameRef.current);
    stairRotationAnimationFrameRef.current = null;
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

  const startStairRotationAnimation = useCallback(() => {
    if (stairRotationAnimationFrameRef.current !== null) return;

    const step = () => {
      const animations = stairRotationAnimationsRef.current;
      if (animations.size === 0) {
        stairRotationAnimationFrameRef.current = null;
        return;
      }

      const now = performance.now();
      for (const [key, animation] of animations) {
        if (now - animation.startedAtMs >= STAIR_ROTATION_ANIMATION_MS) {
          animations.delete(key);
        }
      }

      drawCurrentScene();

      if (animations.size === 0) {
        stairRotationAnimationFrameRef.current = null;
        return;
      }

      stairRotationAnimationFrameRef.current = requestAnimationFrame(step);
    };

    stairRotationAnimationFrameRef.current = requestAnimationFrame(step);
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
    drawCurrentScene();
  }, [drawCurrentScene, northDragTooltip]);

  useEffect(() => {
    return () => {
      stopStairRotationAnimation();
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
  }, [stopStairRotationAnimation]);

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
      includeNorthIndicator,
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
      includeNorthIndicator?: boolean;
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
        exportTheme,
        { includeStairDirectionVisuals: false }
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
        exportTheme,
        { includeStairDirectionLabels: false }
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
        exportTheme,
        false
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
          northIndicator: includeNorthIndicator
            ? {
                bearingDegrees: state.document.northBearingDegrees,
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
      includeNorthIndicator: request.includeNorthIndicator,
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
      includeNorthIndicator: false,
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
      const shortcut = matchEditorKeyboardShortcut(event, [
        "toggle-guidelines",
        "toggle-canvas-hud",
        "toggle-snapping",
      ]);
      if (!shortcut) return;

      if (shortcut.id === "toggle-guidelines") {
        const nextShowGuidelines = !store.settings.showGuidelines;
        store.updateSettings({ showGuidelines: nextShowGuidelines });
        if (store.keyboardShortcutFeedbackEnabled) {
          const message = getKeyboardShortcutFeedbackMessage(shortcut.id, {
            isEnabled: nextShowGuidelines,
          });
          if (message) {
            showKeyboardShortcutFeedbackToast(message);
          }
        }
        return;
      }

      if (shortcut.id === "toggle-canvas-hud") {
        const nextShowCanvasHud = !store.settings.showCanvasHud;
        store.updateSettings({ showCanvasHud: nextShowCanvasHud });
        if (store.keyboardShortcutFeedbackEnabled) {
          const message = getKeyboardShortcutFeedbackMessage(shortcut.id, {
            isEnabled: nextShowCanvasHud,
          });
          if (message) {
            showKeyboardShortcutFeedbackToast(message);
          }
        }
        return;
      }

      if (shortcut.id === "toggle-snapping") {
        const nextSnappingEnabled = !store.settings.snappingEnabled;
        store.updateSettings({ snappingEnabled: nextSnappingEnabled });
        if (store.keyboardShortcutFeedbackEnabled) {
          const message = getKeyboardShortcutFeedbackMessage(shortcut.id, {
            isEnabled: nextSnappingEnabled,
          });
          if (message) {
            showKeyboardShortcutFeedbackToast(message);
          }
        }
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

    const listenerOptions: AddEventListenerOptions = { capture: true };

    window.addEventListener("keydown", onKeyDown, listenerOptions);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerEvent, true);
    window.addEventListener("pointermove", onPointerEvent, true);
    window.addEventListener("pointerup", onPointerEvent, true);
    window.addEventListener("blur", clearDimensionsOverride);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown, listenerOptions);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerEvent, true);
      window.removeEventListener("pointermove", onPointerEvent, true);
      window.removeEventListener("pointerup", onPointerEvent, true);
      window.removeEventListener("blur", clearDimensionsOverride);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearDimensionsOverride();
    };
  }, []);

  const updateNorthDragFromPointer = useCallback(
    (pointer: ScreenPoint, shouldSnap: boolean) => {
      const dragSession = activeNorthDragRef.current;
      const containerElement = containerRef.current;
      if (!dragSession || !containerElement) return;

      const rawBearingDegrees = getNorthBearingDegreesFromScreenDelta({
        x: pointer.x - dragSession.indicatorCenter.x,
        y: pointer.y - dragSession.indicatorCenter.y,
      });
      const adjustedBearingDegrees = normalizeNorthBearingDegrees(
        rawBearingDegrees - camera.rotationDegrees
      );
      const nextBearingDegrees = shouldSnap
        ? snapNorthBearingDegrees(adjustedBearingDegrees)
        : adjustedBearingDegrees;

      dragSession.currentBearingDegrees = nextBearingDegrees;
      previewNorthBearingDegrees(nextBearingDegrees);

      const containerBounds = containerElement.getBoundingClientRect();
      const tooltipWidthPx = 72;
      const tooltipHeightPx = 28;
      const tooltipOffsetPx = 14;
      setNorthDragTooltip({
        left: clampValue(
          pointer.x - containerBounds.left + tooltipOffsetPx,
          8,
          Math.max(containerBounds.width - tooltipWidthPx - 8, 8)
        ),
        top: clampValue(
          pointer.y - containerBounds.top - tooltipHeightPx - tooltipOffsetPx,
          8,
          Math.max(containerBounds.height - tooltipHeightPx - 8, 8)
        ),
        bearingDegrees: nextBearingDegrees,
      });
    },
    [camera.rotationDegrees, previewNorthBearingDegrees]
  );

  useEffect(() => {
    const shouldShowNorthSurface = isNorthIndicatorHovered || northDragTooltip !== null;

    if (northIndicatorFadeTimeoutRef.current !== null) {
      clearTimeout(northIndicatorFadeTimeoutRef.current);
      northIndicatorFadeTimeoutRef.current = null;
    }

    if (shouldShowNorthSurface) {
      setNorthIndicatorSurfaceState("visible");
      return;
    }

    northIndicatorFadeTimeoutRef.current = setTimeout(() => {
      setNorthIndicatorSurfaceState("hidden");
      northIndicatorFadeTimeoutRef.current = null;
    }, NORTH_INDICATOR_SURFACE_FADE_DELAY_MS);

    return () => {
      if (northIndicatorFadeTimeoutRef.current !== null) {
        clearTimeout(northIndicatorFadeTimeoutRef.current);
        northIndicatorFadeTimeoutRef.current = null;
      }
    };
  }, [isNorthIndicatorHovered, northDragTooltip]);

  useEffect(() => {
    if (
      CANVAS_ROTATION_ENABLED ||
      Math.abs(normalizeCanvasRotationDegrees(canvasRotationDegrees)) <= 0.01
    ) {
      return;
    }

    updateCanvasRotationDegrees(0);
  }, [canvasRotationDegrees, updateCanvasRotationDegrees]);

  useEffect(() => {
    const shouldShowCanvasRotationSurface =
      Math.abs(normalizeCanvasRotationDegrees(canvasRotationDegrees)) > 0.01;

    if (canvasRotationIndicatorFadeTimeoutRef.current !== null) {
      clearTimeout(canvasRotationIndicatorFadeTimeoutRef.current);
      canvasRotationIndicatorFadeTimeoutRef.current = null;
    }

    if (shouldShowCanvasRotationSurface) {
      setCanvasRotationIndicatorSurfaceState("visible");
      return;
    }

    canvasRotationIndicatorFadeTimeoutRef.current = setTimeout(() => {
      setCanvasRotationIndicatorSurfaceState("hidden");
      canvasRotationIndicatorFadeTimeoutRef.current = null;
    }, NORTH_INDICATOR_SURFACE_FADE_DELAY_MS);

    return () => {
      if (canvasRotationIndicatorFadeTimeoutRef.current !== null) {
        clearTimeout(canvasRotationIndicatorFadeTimeoutRef.current);
        canvasRotationIndicatorFadeTimeoutRef.current = null;
      }
    };
  }, [canvasRotationDegrees]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragSession = activeNorthDragRef.current;
      if (!dragSession || event.pointerId !== dragSession.pointerId) return;

      const nextPointer = { x: event.clientX, y: event.clientY };
      if (!dragSession.didDrag) {
        const deltaX = nextPointer.x - dragSession.startPointer.x;
        const deltaY = nextPointer.y - dragSession.startPointer.y;
        if (deltaX * deltaX + deltaY * deltaY < 16) return;

        dragSession.didDrag = true;
        setCanvasInteractionActive(true);
      }

      updateNorthDragFromPointer(nextPointer, event.shiftKey);
    };

    const finishNorthDrag = (pointerId: number | null) => {
      const dragSession = activeNorthDragRef.current;
      if (!dragSession) return;
      if (pointerId !== null && pointerId !== dragSession.pointerId) return;

      activeNorthDragRef.current = null;
      setNorthDragTooltip(null);
      setCanvasInteractionActive(false);
      selectNorthIndicator();

      if (!dragSession.didDrag) {
        previewNorthBearingDegrees(dragSession.startingBearingDegrees);
        return;
      }

      commitNorthBearingDegrees(
        dragSession.startingBearingDegrees,
        dragSession.currentBearingDegrees
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      finishNorthDrag(event.pointerId);
    };

    const handleWindowBlur = () => {
      finishNorthDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [
    commitNorthBearingDegrees,
    previewNorthBearingDegrees,
    selectNorthIndicator,
    setCanvasInteractionActive,
    updateNorthDragFromPointer,
  ]);

  const handleNorthIndicatorPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;

      const indicatorBounds = event.currentTarget.getBoundingClientRect();
      activeNorthDragRef.current = {
        pointerId: event.pointerId,
        indicatorCenter: {
          x: indicatorBounds.left + indicatorBounds.width / 2,
          y: indicatorBounds.top + indicatorBounds.height / 2,
        },
        startingBearingDegrees: northBearingDegrees,
        currentBearingDegrees: northBearingDegrees,
        startPointer: { x: event.clientX, y: event.clientY },
        didDrag: false,
      };
      event.preventDefault();
      event.stopPropagation();
    },
    [northBearingDegrees]
  );

  const updateCanvasRotationTooltip = useCallback((degrees: number, pointer: ScreenPoint | null) => {
    void pointer;
    const containerElement = containerRef.current;
    const indicatorSlotElement = canvasRotationIndicatorSlotRef.current;
    if (!containerElement || !indicatorSlotElement) {
      setCanvasRotationTooltip((current) =>
        current && Math.abs(current.rotationDegrees - degrees) < 0.001
          ? current
          : current
            ? { ...current, rotationDegrees: degrees }
            : null
      );
      return;
    }

    const containerBounds = containerElement.getBoundingClientRect();
    const indicatorBounds = indicatorSlotElement.getBoundingClientRect();
    const tooltipWidthPx = 116;
    const tooltipHeightPx = 28;
    const tooltipOffsetPx = 8;
    setCanvasRotationTooltip({
      left: clampValue(
        indicatorBounds.left - containerBounds.left,
        8,
        Math.max(containerBounds.width - tooltipWidthPx - 8, 8)
      ),
      top: clampValue(
        indicatorBounds.top - containerBounds.top - tooltipHeightPx - tooltipOffsetPx,
        8,
        Math.max(containerBounds.height - tooltipHeightPx - 8, 8)
      ),
      rotationDegrees: degrees,
    });
  }, []);

  const canStartCanvasRotation = useCallback((screenPoint: ScreenPoint) => {
    if (!CANVAS_ROTATION_ENABLED) {
      return false;
    }

    const state = useEditorStore.getState();
    if (state.roomDraft.points.length > 0) return false;
    if (hoveredRoomLabelIdRef.current) return false;
    if (hoveredSelectableWallRef.current) return false;
    if (
      roomResizeUiRef.current.hoveredWall ||
      roomResizeUiRef.current.hoveredCorner ||
      roomResizeUiRef.current.hoveredVertexIndex !== null ||
      roomResizeUiRef.current.hoveredWallSegmentIndex !== null
    ) {
      return false;
    }

    if (
      findRoomLabelAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport) ||
      findSelectedOpeningWidthHandleAtScreenPoint(
        state.document.rooms,
        state.selectedOpening,
        screenPoint,
        state.camera,
        state.viewport
      ) ||
      findOpeningAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport) ||
      findInteriorAssetAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
    ) {
      return false;
    }

    if (state.selectedInteriorAsset) {
      const room =
        state.document.rooms.find((candidate) => candidate.id === state.selectedInteriorAsset?.roomId) ?? null;
      const asset =
        room?.interiorAssets.find((candidate) => candidate.id === state.selectedInteriorAsset?.assetId) ?? null;
      if (asset) {
        const bounds = getInteriorAssetBoundsAsRectBounds(asset);
        if (
          hitTestCornerHandle(getCornerHandleLayouts(bounds, state.camera, state.viewport), screenPoint) ||
          hitTestWallHandle(getWallHandleLayouts(bounds, state.camera, state.viewport), screenPoint)
        ) {
          return false;
        }
      }
    }

    if (state.selectedRoomId) {
      const selectedRoom =
        state.document.rooms.find((candidate) => candidate.id === state.selectedRoomId) ?? null;
      if (selectedRoom) {
        const bounds = getAxisAlignedRoomBounds(selectedRoom);
        if (bounds) {
          if (
            hitTestCornerHandle(getCornerHandleLayouts(bounds, state.camera, state.viewport), screenPoint) ||
            hitTestWallHandle(getWallHandleLayouts(bounds, state.camera, state.viewport), screenPoint)
          ) {
            return false;
          }
        }

        if (isNonRectangularOrthogonalRoom(selectedRoom)) {
          if (
            hitTestConstrainedVertexHandle(
              getConstrainedVertexHandleLayouts(selectedRoom, state.camera, state.viewport),
              screenPoint
            ) !== null ||
            hitTestOrthogonalWallHandle(
              getOrthogonalWallHandleLayouts(selectedRoom, state.camera, state.viewport),
              screenPoint
            ) !== null
          ) {
            return false;
          }
        }
      }
    }

    const worldPoint = screenToWorld(screenPoint, state.camera, state.viewport);
    return !findRoomAtPoint(state.document.rooms, worldPoint);
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

      const unsubscribe = useEditorStore.subscribe((state, previousState) => {
        let shouldAnimateStairRotation = false;
        const previousAssets = new Map<
          string,
          {
            roomId: string;
            asset: Room["interiorAssets"][number];
          }
        >();

        for (const room of previousState.document.rooms) {
          for (const asset of room.interiorAssets) {
            previousAssets.set(asset.id, { roomId: room.id, asset });
          }
        }

        const nextAssetIds = new Set<string>();
        for (const room of state.document.rooms) {
          for (const asset of room.interiorAssets) {
            nextAssetIds.add(asset.id);
            const previousAssetState = previousAssets.get(asset.id);
            if (!previousAssetState) continue;

            const previousRotationDegrees = normalizeCanvasRotationDegrees(
              previousAssetState.asset.rotationDegrees ?? 0
            );
            const nextRotationDegrees = normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0);
            if (previousRotationDegrees === nextRotationDegrees) continue;

            stairRotationAnimationsRef.current.set(asset.id, {
              roomId: room.id,
              assetId: asset.id,
              startWidthMm: previousAssetState.asset.widthMm,
              startDepthMm: previousAssetState.asset.depthMm,
              startRotationDegrees: previousRotationDegrees,
              endRotationDegrees: nextRotationDegrees,
              startedAtMs: performance.now(),
            });
            shouldAnimateStairRotation = true;
          }
        }

        for (const assetId of stairRotationAnimationsRef.current.keys()) {
          if (!nextAssetIds.has(assetId)) {
            stairRotationAnimationsRef.current.delete(assetId);
          }
        }

        if (shouldAnimateStairRotation) {
          startStairRotationAnimation();
        }

        drawCurrentScene();
      });
      const detachPanZoomInput = attachPanZoomInput(app.canvas, useEditorStore, {
        onPan: () => {
          if (activeHintIdRef.current !== "pan-canvas") return;
          completeHint("pan-canvas");
        },
        canStartRotation: canStartCanvasRotation,
        onRotationPreview: (degrees, pointer) => {
          updateCanvasRotationTooltip(degrees, pointer);
        },
        onRotationEnd: () => {
          setCanvasRotationTooltip(null);
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
        stopStairRotationAnimation();
      };
    }

    let teardown: (() => void) | undefined;
    init().then((cleanup) => {
      teardown = cleanup;
    });

    return () => {
      destroyed = true;
      teardown?.();
      stopStairRotationAnimation();
      if (initialized) {
        app.destroy(true, { children: true });
      }
    };
  }, [
    canStartCanvasRotation,
    completeHint,
    drawCurrentScene,
    startStairRotationAnimation,
    setTransformFeedback,
    stopStairRotationAnimation,
    stopTransformAnimation,
    updateCanvasRotationTooltip,
  ]);

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
            rotationDegrees: 0,
          },
    [camera, hasHydratedClient]
  );
  const scaleOverlay = useMemo(() => getScaleOverlayState(overlayCamera), [overlayCamera]);
  const activeSnapStepMm = useMemo(() => getActiveSnapStepMm(overlayCamera), [overlayCamera]);
  const snappingEnabled = useEditorStore((state) => state.settings.snappingEnabled);
  const hydratedSnappingEnabled = hasHydratedClient
    ? snappingEnabled
    : DEFAULT_EDITOR_SETTINGS.snappingEnabled;
  const showCanvasHud = useEditorStore((state) => state.settings.showCanvasHud);
  const showMiniMap = useEditorStore((state) => state.settings.showMiniMap);
  const [isCanvasHudPresent, setIsCanvasHudPresent] = useState(showCanvasHud);
  const canvasHudHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldShowMiniMap = showCanvasHud && showMiniMap && hasRooms;
  const [isMiniMapPresent, setIsMiniMapPresent] = useState(shouldShowMiniMap);
  const miniMapHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inspectorContent = selectedNorthIndicator ? (
    <SelectedNorthInspector className="h-full" />
  ) : selectedRoomId ? (
    <SelectedRoomNamePanel className="h-full" />
  ) : (
    <EditorInspectorEmptyState className="h-full" />
  );
  const compactInspectorContent = selectedNorthIndicator ? (
    <SelectedNorthInspector />
  ) : selectedRoomId ? (
    <SelectedRoomNamePanel />
  ) : (
    <EditorInspectorEmptyState />
  );

  useEffect(() => {
    if (canvasHudHideTimeoutRef.current) {
      clearTimeout(canvasHudHideTimeoutRef.current);
      canvasHudHideTimeoutRef.current = null;
    }

    if (showCanvasHud) {
      setIsCanvasHudPresent(true);
      return;
    }

    if (!isCanvasHudPresent) return;

    canvasHudHideTimeoutRef.current = setTimeout(() => {
      setIsCanvasHudPresent(false);
      canvasHudHideTimeoutRef.current = null;
    }, CANVAS_HUD_HIDE_TRANSITION_MS);

    return () => {
      if (!canvasHudHideTimeoutRef.current) return;
      clearTimeout(canvasHudHideTimeoutRef.current);
      canvasHudHideTimeoutRef.current = null;
    };
  }, [isCanvasHudPresent, showCanvasHud]);

  useEffect(() => {
    if (miniMapHideTimeoutRef.current) {
      clearTimeout(miniMapHideTimeoutRef.current);
      miniMapHideTimeoutRef.current = null;
    }

    if (shouldShowMiniMap) {
      setIsMiniMapPresent(true);
      return;
    }

    if (!isMiniMapPresent) return;

    miniMapHideTimeoutRef.current = setTimeout(() => {
      setIsMiniMapPresent(false);
      miniMapHideTimeoutRef.current = null;
    }, CANVAS_HUD_HIDE_TRANSITION_MS);

    return () => {
      if (!miniMapHideTimeoutRef.current) return;
      clearTimeout(miniMapHideTimeoutRef.current);
      miniMapHideTimeoutRef.current = null;
    };
  }, [isMiniMapPresent, shouldShowMiniMap]);

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
          {isCanvasHudPresent ? (
            <div
              className={cn(
                "pointer-events-none absolute bottom-3 left-3 z-10 flex items-end gap-2 transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:bottom-4 sm:left-4",
                showCanvasHud
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-1 scale-[0.985] opacity-0"
              )}
            >
              <CanvasHudCard>
                <div
                  className="text-[11px] font-medium tracking-[0.04em] text-foreground/72"
                  style={{ fontFamily: MEASUREMENT_TEXT_FONT_FAMILY }}
                >
                  {scaleOverlay.label}
                </div>
                <div
                  className="mt-1 h-2 border-x border-t border-foreground/70"
                  style={{ width: `${scaleOverlay.widthPx}px` }}
                />
                <div
                  className="mt-1 text-[11px] text-muted-foreground"
                  style={{ fontFamily: MEASUREMENT_TEXT_FONT_FAMILY }}
                >
                  {hydratedSnappingEnabled
                    ? `Grid ${formatMetricWallDimension(activeSnapStepMm)} · Magnet On`
                    : `Grid ${formatMetricWallDimension(activeSnapStepMm)}`}
                </div>
              </CanvasHudCard>
              <NorthIndicatorControl
                bearingDegrees={northBearingDegrees}
                viewRotationDegrees={canvasRotationDegrees}
                surfaceState={northIndicatorSurfaceState}
                isDragging={northDragTooltip !== null}
                onPointerDown={handleNorthIndicatorPointerDown}
                onPointerEnter={() => setIsNorthIndicatorHovered(true)}
                onPointerLeave={() => setIsNorthIndicatorHovered(false)}
              />
              {CANVAS_ROTATION_ENABLED ? (
                <div ref={canvasRotationIndicatorSlotRef} className="relative h-14 w-14 shrink-0">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CanvasRotationIndicatorControl
                      rotationDegrees={canvasRotationDegrees}
                      northBearingDegrees={northBearingDegrees}
                      surfaceState={canvasRotationIndicatorSurfaceState}
                      onReset={resetCanvasRotation}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {isMiniMapPresent ? (
            <div
              className={cn(
                "pointer-events-none absolute bottom-4 right-4 z-10 transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] [@media(max-height:540px)_and_(orientation:landscape)]:bottom-3 [@media(max-height:540px)_and_(orientation:landscape)]:right-3",
                shouldShowMiniMap
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-1 scale-[0.985] opacity-0"
              )}
            >
              <CanvasMiniMap
                rooms={rooms}
                camera={camera}
                viewport={viewport}
                themeMode={editorThemeMode}
                onPanToWorldPoint={(point) => setCameraCenterMm(point.x, point.y)}
                onInteractionActiveChange={setCanvasInteractionActive}
              />
            </div>
          ) : null}
          {northDragTooltip ? (
            <div
              className="pointer-events-none absolute z-20 rounded-md border border-border/70 bg-background/94 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-[0_6px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:shadow-[0_6px_20px_rgba(0,0,0,0.24)]"
              style={{
                left: `${northDragTooltip.left}px`,
                top: `${northDragTooltip.top}px`,
                fontFamily: MEASUREMENT_TEXT_FONT_FAMILY,
              }}
            >
              {formatNorthBearingDegrees(northDragTooltip.bearingDegrees)}
            </div>
          ) : null}
          {CANVAS_ROTATION_ENABLED && canvasRotationTooltip ? (
            <div
              className={cn("pointer-events-none absolute", tooltipContentClassName)}
              style={{
                left: `${canvasRotationTooltip.left}px`,
                top: `${canvasRotationTooltip.top}px`,
                fontFamily: MEASUREMENT_TEXT_FONT_FAMILY,
              }}
            >
              {formatCanvasRotationDegrees(canvasRotationTooltip.rotationDegrees)} · Shift 15°
            </div>
          ) : null}
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
          {inspectorContent}
        </aside>
        <aside className="lg:hidden [@media(max-height:540px)_and_(orientation:landscape)]:hidden" aria-label="Editor inspector">
          {compactInspectorContent}
        </aside>
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
  stairRotationAnimations: Map<string, StairRotationAnimation>,
  snapGuides: SnapGuides | null,
  theme: EditorCanvasTheme,
  hideCursorHud: boolean
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
  const renderedLabelRooms = getRenderedRoomsForLabelTransform(state.document.rooms, transformFeedback);
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
    theme,
    { includeStairDirectionVisuals: true, stairRotationAnimations }
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
    theme,
    { includeStairDirectionLabels: true, stairRotationAnimations }
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
    theme,
    hideCursorHud
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

  const gridBoundsPaddingMm = GRID_SIZE_MM;
  const { minX, maxX, minY, maxY } = getViewportWorldBounds(camera, viewport, gridBoundsPaddingMm);

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

  const verticalOriginStart = worldToScreen({ x: 0, y: minY }, camera, viewport);
  const verticalOriginEnd = worldToScreen({ x: 0, y: maxY }, camera, viewport);
  const horizontalOriginStart = worldToScreen({ x: minX, y: 0 }, camera, viewport);
  const horizontalOriginEnd = worldToScreen({ x: maxX, y: 0 }, camera, viewport);
  graphics.setStrokeStyle({ width: 1.5, color: theme.originAxis, alpha: 1 });
  graphics.moveTo(verticalOriginStart.x, verticalOriginStart.y);
  graphics.lineTo(verticalOriginEnd.x, verticalOriginEnd.y);
  graphics.moveTo(horizontalOriginStart.x, horizontalOriginStart.y);
  graphics.lineTo(horizontalOriginEnd.x, horizontalOriginEnd.y);
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
        const segment = getRoomWallSegment(room, handle.wallIndex);
        if (!segment) continue;
        const isHovered =
          roomResizeUi.hoveredRoomId === room.id &&
          roomResizeUi.hoveredWallSegmentIndex === handle.wallIndex;
        const isActive =
          roomResizeUi.activeRoomId === room.id &&
          roomResizeUi.activeWallSegmentIndex === handle.wallIndex;
        const fillAlpha = isActive ? 0.46 : isHovered ? 0.34 : 0.2;
        const strokeAlpha = isActive ? 1 : isHovered ? 0.96 : 0.82;
        const strokeWidth = isActive ? 2.2 : isHovered ? 1.8 : 1.45;
        const start = worldToScreen(segment.originalStart, camera, viewport);
        const end = worldToScreen(segment.originalEnd, camera, viewport);

        drawCapsuleHandle(graphics, {
          center: {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
          },
          tangent: {
            x: end.x - start.x,
            y: end.y - start.y,
          },
          length: Math.max(handle.width, handle.height),
          thickness: Math.min(handle.width, handle.height),
          fillColor: theme.interactiveAccent,
          fillAlpha,
          strokeColor: theme.roomOutline,
          strokeAlpha,
          strokeWidth,
          haloPadding: isActive ? 3 : isHovered ? 2 : 0,
          haloAlpha: isActive ? 0.2 : isHovered ? 0.12 : 0,
        });
      }

      for (const handle of vertexHandles) {
        const isHovered =
          roomResizeUi.hoveredRoomId === room.id &&
          roomResizeUi.hoveredVertexIndex === handle.vertexIndex;
        const isActive =
          roomResizeUi.activeRoomId === room.id &&
          roomResizeUi.activeVertexIndex === handle.vertexIndex;
        const size = isActive ? handle.size + 2 : isHovered ? handle.size + 1 : handle.size;
        drawRotatedSquareHandle(graphics, {
          center: handle.center,
          size,
          rotationDegrees: camera.rotationDegrees,
          fillColor: theme.interactiveAccent,
          fillAlpha: isActive ? 0.5 : isHovered ? 0.38 : 0.28,
          strokeColor: theme.roomOutline,
          strokeAlpha: isActive ? 1 : isHovered ? 0.97 : 0.92,
          strokeWidth: isActive ? 2 : isHovered ? 1.8 : 1.6,
          haloPadding: isActive ? 3 : isHovered ? 2 : 0,
          haloAlpha: isActive ? 0.22 : isHovered ? 0.14 : 0,
        });
      }
    }

    const bounds = getAxisAlignedRoomBounds(room);
    if (!bounds) continue;
    const handles = getWallHandleLayouts(bounds, camera, viewport);
    const cornerHandles = getCornerHandleLayouts(bounds, camera, viewport);
    const topLeft = worldToScreen({ x: bounds.minX, y: bounds.minY }, camera, viewport);
    const topRight = worldToScreen({ x: bounds.maxX, y: bounds.minY }, camera, viewport);
    const bottomRight = worldToScreen({ x: bounds.maxX, y: bounds.maxY }, camera, viewport);
    const bottomLeft = worldToScreen({ x: bounds.minX, y: bounds.maxY }, camera, viewport);

    for (const handle of handles) {
      const isHovered =
        roomResizeUi.hoveredRoomId === room.id && roomResizeUi.hoveredWall === handle.wall;
      const isActive =
        roomResizeUi.activeRoomId === room.id && roomResizeUi.activeWall === handle.wall;
      const fillAlpha = isActive ? 0.46 : isHovered ? 0.34 : 0.2;
      const strokeAlpha = isActive ? 1 : isHovered ? 0.96 : 0.82;
      const strokeWidth = isActive ? 2.2 : isHovered ? 1.8 : 1.45;
      const [start, end] =
        handle.wall === "top"
          ? [topLeft, topRight]
          : handle.wall === "right"
            ? [topRight, bottomRight]
            : handle.wall === "bottom"
              ? [bottomLeft, bottomRight]
              : [topLeft, bottomLeft];

      drawCapsuleHandle(graphics, {
        center: {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
        },
        tangent: {
          x: end.x - start.x,
          y: end.y - start.y,
        },
        length: Math.max(handle.width, handle.height),
        thickness: Math.min(handle.width, handle.height),
        fillColor: theme.interactiveAccent,
        fillAlpha,
        strokeColor: theme.roomOutline,
        strokeAlpha,
        strokeWidth,
        haloPadding: isActive ? 3 : isHovered ? 2 : 0,
        haloAlpha: isActive ? 0.2 : isHovered ? 0.12 : 0,
      });
    }

    for (const handle of cornerHandles) {
      const isHovered =
        roomResizeUi.hoveredRoomId === room.id && roomResizeUi.hoveredCorner === handle.corner;
      const isActive =
        roomResizeUi.activeRoomId === room.id && roomResizeUi.activeCorner === handle.corner;
      const size = isActive ? handle.size + 2 : isHovered ? handle.size + 1 : handle.size;
      const fillAlpha = isActive ? 0.54 : isHovered ? 0.42 : 0.3;
      const strokeAlpha = isActive ? 1 : isHovered ? 0.98 : 0.9;
      const strokeWidth = isActive ? 2.1 : isHovered ? 1.8 : 1.5;

      drawRotatedSquareHandle(graphics, {
        center: handle.center,
        size,
        rotationDegrees: camera.rotationDegrees,
        fillColor: theme.interactiveAccent,
        fillAlpha,
        strokeColor: theme.roomOutline,
        strokeAlpha,
        strokeWidth,
        haloPadding: isActive ? 3 : isHovered ? 2 : 0,
        haloAlpha: isActive ? 0.22 : isHovered ? 0.14 : 0,
      });
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
  theme: EditorCanvasTheme,
  options?: {
    includeStairDirectionVisuals?: boolean;
    stairRotationAnimations?: Map<string, StairRotationAnimation>;
  }
) {
  graphics.clear();

  for (const room of rooms) {
    if (room.points.length < 3) continue;
    drawRoomOpenings(graphics, room, selectedOpening, camera, viewport, theme);
    drawRoomInteriorAssets(graphics, room, selectedInteriorAsset, camera, viewport, theme, options);
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
    const tangentLength = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const tangent = {
      x: (end.x - start.x) / tangentLength,
      y: (end.y - start.y) / tangentLength,
    };
    const interiorNormalTarget = worldToScreen(
      {
        x: layout.center.x + layout.interiorNormal.x * 100,
        y: layout.center.y + layout.interiorNormal.y * 100,
      },
      camera,
      viewport
    );
    const interiorNormalLength =
      Math.hypot(interiorNormalTarget.x - center.x, interiorNormalTarget.y - center.y) || 1;
    const interiorNormal = {
      x: (interiorNormalTarget.x - center.x) / interiorNormalLength,
      y: (interiorNormalTarget.y - center.y) / interiorNormalLength,
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
  theme: EditorCanvasTheme,
  options?: {
    includeStairDirectionVisuals?: boolean;
    stairRotationAnimations?: Map<string, StairRotationAnimation>;
  }
) {
  const renderedAtMs = performance.now();
  for (const asset of room.interiorAssets) {
    const animation = options?.stairRotationAnimations?.get(asset.id);
    const displayedAsset = getDisplayedInteriorAssetForAnimation(asset, animation, renderedAtMs);
    const isAnimatingRotation = Boolean(animation && animation.roomId === room.id);
    const bounds = getRoomInteriorAssetBounds(asset);
    const [topLeft, topRight, bottomRight, bottomLeft] = isAnimatingRotation
      ? getRotatedAssetScreenCorners(displayedAsset, camera, viewport)
      : [
          worldToScreen({ x: bounds.left, y: bounds.top }, camera, viewport),
          worldToScreen({ x: bounds.right, y: bounds.top }, camera, viewport),
          worldToScreen({ x: bounds.right, y: bounds.bottom }, camera, viewport),
          worldToScreen({ x: bounds.left, y: bounds.bottom }, camera, viewport),
        ];
    const corners = [topLeft, topRight, bottomRight, bottomLeft];
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
      graphics.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i += 1) {
        graphics.lineTo(corners[i].x, corners[i].y);
      }
      graphics.closePath();
      graphics.stroke();
    }

    graphics.setFillStyle({
      color: theme.roomOutline,
      alpha: isSelected ? 0.12 : 0.08,
    });
    graphics.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i += 1) {
      graphics.lineTo(corners[i].x, corners[i].y);
    }
    graphics.closePath();
    graphics.fill();

    graphics.setStrokeStyle({
      width: isSelected ? selectionStrokePx : Math.max(camera.pixelsPerMm * 14, 1.4),
      color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
      alpha: isSelected ? 0.96 : 0.9,
    });
    graphics.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i += 1) {
      graphics.lineTo(corners[i].x, corners[i].y);
    }
    graphics.closePath();
    graphics.stroke();

    const isQuarterTurnSideways =
      Math.abs(normalizeCanvasRotationDegrees(displayedAsset.rotationDegrees ?? 0)) === 90;
    const treadRunLengthMm = Math.max(getStairRunLengthMm(displayedAsset), 1);
    const treadCount = Math.max(
      0,
      Math.floor(treadRunLengthMm / DEFAULT_STAIR_TREAD_SPACING_MM) - 1
    );
    for (let index = 1; index <= treadCount; index += 1) {
      const progress = (index * DEFAULT_STAIR_TREAD_SPACING_MM) / treadRunLengthMm;
      if (progress <= 0 || progress >= 1) continue;
      const startEdgeEnd = isQuarterTurnSideways ? topRight : bottomLeft;
      const endEdgeStart = isQuarterTurnSideways ? bottomLeft : topRight;
      const start = {
        x: topLeft.x + (startEdgeEnd.x - topLeft.x) * progress,
        y: topLeft.y + (startEdgeEnd.y - topLeft.y) * progress,
      };
      const end = {
        x: endEdgeStart.x + (bottomRight.x - endEdgeStart.x) * progress,
        y: endEdgeStart.y + (bottomRight.y - endEdgeStart.y) * progress,
      };
      graphics.setStrokeStyle({
        width: Math.max(camera.pixelsPerMm * 10, 1.1),
        color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
        alpha: isSelected ? 0.88 : 0.72,
        cap: "round",
      });
      graphics.moveTo(start.x, start.y);
      graphics.lineTo(end.x, end.y);
      graphics.stroke();
    }

    if (options?.includeStairDirectionVisuals !== false) {
      drawStairDirectionArrow(graphics, displayedAsset, camera, viewport, theme, isSelected);
    }

    if (!isSelected) continue;

    const rectBounds = getInteriorAssetBoundsAsRectBounds(displayedAsset);
    const wallHandles = getWallHandleLayouts(rectBounds, camera, viewport);
    const cornerHandles = getCornerHandleLayouts(rectBounds, camera, viewport);

    for (const handle of wallHandles) {
      const [start, end] =
        handle.wall === "top"
          ? [topLeft, topRight]
          : handle.wall === "right"
            ? [topRight, bottomRight]
            : handle.wall === "bottom"
              ? [bottomLeft, bottomRight]
              : [topLeft, bottomLeft];

      drawCapsuleHandle(graphics, {
        center: {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
        },
        tangent: {
          x: end.x - start.x,
          y: end.y - start.y,
        },
        length: Math.max(handle.width, handle.height),
        thickness: Math.min(handle.width, handle.height),
        fillColor: theme.interactiveAccent,
        fillAlpha: 0.3,
        strokeColor: theme.roomOutline,
        strokeAlpha: 0.9,
        strokeWidth: 1.5,
        haloPadding: 0,
        haloAlpha: 0,
      });
    }

    for (const handle of cornerHandles) {
      const center =
        handle.corner === "top-left"
          ? topLeft
          : handle.corner === "top-right"
            ? topRight
            : handle.corner === "bottom-right"
              ? bottomRight
              : bottomLeft;
      drawRotatedSquareHandle(graphics, {
        center,
        size: handle.size,
        rotationDegrees: camera.rotationDegrees,
        fillColor: theme.interactiveAccent,
        fillAlpha: 0.38,
        strokeColor: theme.roomOutline,
        strokeAlpha: 0.92,
        strokeWidth: 1.5,
        haloPadding: 0,
        haloAlpha: 0,
      });
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

function drawStairDirectionArrow(
  graphics: Graphics,
  asset: Room["interiorAssets"][number],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme,
  isSelected: boolean
) {
  if ((asset.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED) === false) return;
  const normalizedRotationDegrees = normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0);
  const resolvedDirection = asset.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION;
  const rotationRadians = (normalizedRotationDegrees * Math.PI) / 180;
  const direction = {
    x: Math.sin(rotationRadians) * (resolvedDirection === "reverse" ? -1 : 1),
    y: -Math.cos(rotationRadians) * (resolvedDirection === "reverse" ? -1 : 1),
  };
  const runLengthMm = getStairRunLengthMm(asset);
  const arrowLengthMm = Math.max(
    STAIR_DIRECTION_ARROW_MIN_LENGTH_MM,
    Math.min(runLengthMm * STAIR_DIRECTION_ARROW_LENGTH_RATIO, runLengthMm - 260)
  );
  const tail = worldToScreen(
    {
      x: asset.xMm - direction.x * (arrowLengthMm / 2),
      y: asset.yMm - direction.y * (arrowLengthMm / 2),
    },
    camera,
    viewport
  );
  const head = worldToScreen(
    {
      x: asset.xMm + direction.x * (arrowLengthMm / 2),
      y: asset.yMm + direction.y * (arrowLengthMm / 2),
    },
    camera,
    viewport
  );
  const screenDirectionLength = Math.hypot(head.x - tail.x, head.y - tail.y);
  if (screenDirectionLength < 0.001) return;

  const screenDirection = {
    x: (head.x - tail.x) / screenDirectionLength,
    y: (head.y - tail.y) / screenDirectionLength,
  };
  const screenNormal = {
    x: -screenDirection.y,
    y: screenDirection.x,
  };
  const headSizePx = Math.max(camera.pixelsPerMm * STAIR_DIRECTION_ARROW_HEAD_WORLD_MM, 8);
  const headBase = {
    x: head.x - screenDirection.x * headSizePx,
    y: head.y - screenDirection.y * headSizePx,
  };

  graphics.setStrokeStyle({
    width: Math.max(camera.pixelsPerMm * 8, 1),
    color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
    alpha: isSelected ? 0.94 : 0.76,
    cap: "round",
    join: "round",
  });
  graphics.moveTo(tail.x, tail.y);
  graphics.lineTo(head.x, head.y);
  graphics.moveTo(head.x, head.y);
  graphics.lineTo(
    headBase.x + screenNormal.x * (headSizePx * 0.55),
    headBase.y + screenNormal.y * (headSizePx * 0.55)
  );
  graphics.moveTo(head.x, head.y);
  graphics.lineTo(
    headBase.x - screenNormal.x * (headSizePx * 0.55),
    headBase.y - screenNormal.y * (headSizePx * 0.55)
  );
  graphics.stroke();
}

function drawStairDirectionLabels(
  labelContainer: Container,
  rooms: Room[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme,
  stairRotationAnimations?: Map<string, StairRotationAnimation>
) {
  const renderedAtMs = performance.now();
  const textResolution = getTextResolution();
  const stairDirectionLabelFontSizePx = clampValue(
    camera.pixelsPerMm * STAIR_DIRECTION_LABEL_WORLD_MM,
    STAIR_DIRECTION_LABEL_MIN_FONT_SIZE_PX,
    STAIR_DIRECTION_LABEL_MAX_FONT_SIZE_PX
  );

  for (const room of rooms) {
    for (const asset of room.interiorAssets) {
      const animation = stairRotationAnimations?.get(asset.id);
      const displayedAsset =
        animation && animation.roomId === room.id
          ? getDisplayedInteriorAssetForAnimation(asset, animation, renderedAtMs)
          : asset;
      if ((displayedAsset.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED) === false) continue;
      const normalizedRotationDegrees = normalizeCanvasRotationDegrees(
        displayedAsset.rotationDegrees ?? 0
      );
      const resolvedDirection = displayedAsset.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION;
      const resolvedLabel = displayedAsset.arrowLabel?.trim() ?? "";
      if (resolvedLabel.length === 0) continue;
      const rotationRadians = (normalizedRotationDegrees * Math.PI) / 180;
      const direction = {
        x: Math.sin(rotationRadians) * (resolvedDirection === "reverse" ? -1 : 1),
        y: -Math.cos(rotationRadians) * (resolvedDirection === "reverse" ? -1 : 1),
      };
      const runLengthMm = getStairRunLengthMm(displayedAsset);
      const arrowLengthMm = Math.max(
        STAIR_DIRECTION_ARROW_MIN_LENGTH_MM,
        Math.min(runLengthMm * STAIR_DIRECTION_ARROW_LENGTH_RATIO, runLengthMm - 260)
      );
      const labelPoint = worldToScreen(
        {
          x:
            displayedAsset.xMm -
            direction.x * (arrowLengthMm / 2 + STAIR_DIRECTION_LABEL_OFFSET_WORLD_MM),
          y:
            displayedAsset.yMm -
            direction.y * (arrowLengthMm / 2 + STAIR_DIRECTION_LABEL_OFFSET_WORLD_MM),
        },
        camera,
        viewport
      );
      const text = new Text({
        text: resolvedLabel,
        resolution: textResolution,
        style: {
          fontFamily: ROOM_LABEL_AREA_FONT_FAMILY,
          fontSize: stairDirectionLabelFontSizePx,
          fontWeight: ROOM_LABEL_AREA_FONT_WEIGHT,
          fill: theme.roomLabelFill,
          stroke: {
            color: theme.roomLabelStroke,
            width: Math.max(1.25, stairDirectionLabelFontSizePx * 0.14),
            join: "round",
          },
          letterSpacing: Math.max(0.2, stairDirectionLabelFontSizePx * 0.025),
        },
      });
      text.roundPixels = true;
      text.anchor.set(0.5);
      text.position.set(
        snapToPixel(labelPoint.x, textResolution),
        snapToPixel(labelPoint.y, textResolution)
      );
      text.angle = 0;
      text.alpha = 0.82;
      labelContainer.addChild(text);
    }
  }
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
  theme: EditorCanvasTheme,
  options?: {
    includeStairDirectionLabels?: boolean;
    stairRotationAnimations?: Map<string, StairRotationAnimation>;
  }
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

  if (options?.includeStairDirectionLabels !== false) {
    drawStairDirectionLabels(
      labelContainer,
      rooms,
      camera,
      viewport,
      theme,
      options?.stairRotationAnimations
    );
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
    activeWallSegmentIndex: number | null;
    activeRoomId: string | null;
  },
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme
) {
  if (!roomResizeUi.activeRoomId) return;
  if (
    !roomResizeUi.activeWall &&
    !roomResizeUi.activeCorner &&
    roomResizeUi.activeWallSegmentIndex === null
  ) {
    return;
  }

  const activeRoom = rooms.find((room) => room.id === roomResizeUi.activeRoomId);
  if (!activeRoom) return;

  const bounds = getAxisAlignedRoomBounds(activeRoom);
  const roomLabelLayout = getRoomLabelLayout(activeRoom, camera, viewport, settings, {
    showArea: true,
  });
  const labelSpecs = getResizeDimensionLabelSpecs(
    activeRoom,
    bounds,
    roomResizeUi.activeWall,
    roomResizeUi.activeCorner,
    roomResizeUi.activeWallSegmentIndex,
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
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null,
  activeWall: RectWall | null,
  activeCorner: RectCorner | null,
  activeWallSegmentIndex: number | null,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">
): ResizeDimensionLabelSpec[] {
  if (activeWall) {
    if (!bounds) return [];
    const measurements = getRectResizeMeasurements(room);
    if (!measurements) return [];
    const { measurementWalls, measurementMillimetres } = getResizeWallsForWall(activeWall, measurements);

    return measurementWalls.map((wall) =>
      createDimensionLabelSpecForWallMeasurement(
        wall,
        measurementMillimetres,
        bounds,
        camera,
        viewport,
        settings
      )
    );
  }

  if (activeCorner) {
    if (!bounds) return [];
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

  if (activeWallSegmentIndex !== null) {
    return getResizeDimensionLabelSpecsForOrthogonalWallSegment(
      room,
      activeWallSegmentIndex,
      camera,
      viewport
    );
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

function getResizeWallsForWall(
  wall: RectWall,
  measurements: { widthMillimetres: number; heightMillimetres: number }
): {
  measurementWalls: RectWall[];
  measurementMillimetres: number;
} {
  if (wall === "top" || wall === "bottom") {
    return {
      measurementWalls: ["left", "right"],
      measurementMillimetres: measurements.heightMillimetres,
    };
  }

  return {
    measurementWalls: ["top", "bottom"],
    measurementMillimetres: measurements.widthMillimetres,
  };
}

function getResizeDimensionLabelSpecsForOrthogonalWallSegment(
  room: Room,
  wallSegmentIndex: number,
  camera: CameraState,
  viewport: ViewportSize
): ResizeDimensionLabelSpec[] {
  if (room.points.length < 4) return [];

  const pointCount = room.points.length;
  const adjacentWallIndices = [
    (wallSegmentIndex - 1 + pointCount) % pointCount,
    (wallSegmentIndex + 1) % pointCount,
  ];

  return adjacentWallIndices.flatMap((wallIndex) => {
    const wallMeasurement = getRoomWallMeasurement(room, wallIndex);
    if (!wallMeasurement) return [];

    const labelSpec = createDimensionLabelSpecForEdgeMeasurement(
      room,
      wallMeasurement,
      camera,
      viewport,
      { wallMeasurementPosition: "outside" }
    );
    return labelSpec ? [labelSpec] : [];
  });
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
  const roomCenter = worldToScreen(
    {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    },
    camera,
    viewport
  );
  const getEdgeOffsetPx = (wallLengthPx: number) =>
    wallLengthPx < RESIZE_DIMENSION_MIN_SHORT_WALL_PX
      ? getScaledMeasurementPx(
          RESIZE_DIMENSION_EDGE_OFFSET_PX + RESIZE_DIMENSION_SHORT_WALL_EXTRA_OFFSET_PX,
          settings
        )
      : getScaledMeasurementPx(RESIZE_DIMENSION_EDGE_OFFSET_PX, settings);
  const [start, end] =
    wall === "top"
      ? [topLeft, topRight]
      : wall === "right"
        ? [topRight, bottomRight]
        : wall === "bottom"
          ? [bottomLeft, bottomRight]
          : [topLeft, bottomLeft];
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const outwardDirection = normalizeScreenDirection({
    x: midpoint.x - roomCenter.x,
    y: midpoint.y - roomCenter.y,
  });
  const tangentDirection = normalizeScreenDirection({
    x: end.x - start.x,
    y: end.y - start.y,
  });
  const wallLengthPx = Math.hypot(end.x - start.x, end.y - start.y);
  const center = {
    x: midpoint.x + outwardDirection.x * getEdgeOffsetPx(wallLengthPx),
    y: midpoint.y + outwardDirection.y * getEdgeOffsetPx(wallLengthPx),
  };

  return {
    center,
    outwardDirection,
    tangentDirection,
    wallLengthPx,
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
    outwardDirection: normalizeScreenDirection(outwardVector),
    tangentDirection: normalizeScreenDirection(tangentVector),
    wallLengthPx: Math.hypot(endScreen.x - startScreen.x, endScreen.y - startScreen.y),
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

function normalizeScreenDirection(vector: ScreenPoint): ScreenPoint {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.001) {
    return { x: 0, y: -1 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function getFixedEdgeGapLabelOffsetPx(options: {
  width: number;
  height: number;
  direction: ScreenPoint;
  edgeGapPx: number;
}): number {
  const projectedHalfExtentPx =
    (Math.abs(options.direction.x) * options.width) / 2 +
    (Math.abs(options.direction.y) * options.height) / 2;

  return projectedHalfExtentPx + options.edgeGapPx;
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
    const normalOffsetPx =
      labelSpec.normalPlacement === "center"
        ? 0
        : getFixedEdgeGapLabelOffsetPx({
            width,
            height,
            direction: placementDirection,
            edgeGapPx:
              insideEdgePaddingPx + getScaledMeasurementPx(labelSpec.normalOffsetBiasPx, settings),
          });
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
  theme: EditorCanvasTheme,
  hideCursorHud = false
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

    if (!hideCursorHud) {
      drawCursorCrosshairGuides(
        graphics,
        worldToScreen(cursorHudWorld, camera, viewport),
        viewport,
        theme,
        "active"
      );
    }
    if (snapGuides) {
      drawSnapGuides(
        graphics,
        snapGuides,
        camera,
        viewport,
        theme
      );
    }
    if (!hideCursorHud) {
      drawCursorHud(graphics, worldToScreen(cursorHudWorld, camera, viewport), theme, "active");
    }
    return;
  }

  if (!cursorWorld || !cursorHudWorld) return;

  if (!hideCursorHud) {
    drawCursorCrosshairGuides(
      graphics,
      worldToScreen(cursorHudWorld, camera, viewport),
      viewport,
      theme,
      "idle"
    );
  }
  if (snapGuides) {
    drawSnapGuides(graphics, snapGuides, camera, viewport, theme);
  }
  if (!hideCursorHud) {
    drawCursorHud(graphics, worldToScreen(cursorHudWorld, camera, viewport), theme, "idle");
  }
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

  graphics.setStrokeStyle(stroke);

  for (let xMm = firstX; xMm <= maxX; xMm += stepMm) {
    const start = worldToScreen({ x: xMm, y: minY }, camera, viewport);
    const end = worldToScreen({ x: xMm, y: maxY }, camera, viewport);
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
  }

  for (let yMm = firstY; yMm <= maxY; yMm += stepMm) {
    const start = worldToScreen({ x: minX, y: yMm }, camera, viewport);
    const end = worldToScreen({ x: maxX, y: yMm }, camera, viewport);
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
  }

  graphics.stroke();
}

function getViewportWorldBounds(
  camera: CameraState,
  viewport: ViewportSize,
  paddingMm = 0
) {
  const viewportCorners = [
    screenToWorld({ x: 0, y: 0 }, camera, viewport),
    screenToWorld({ x: viewport.width, y: 0 }, camera, viewport),
    screenToWorld({ x: viewport.width, y: viewport.height }, camera, viewport),
    screenToWorld({ x: 0, y: viewport.height }, camera, viewport),
  ];
  const minX = Math.min(...viewportCorners.map((corner) => corner.x)) - paddingMm;
  const maxX = Math.max(...viewportCorners.map((corner) => corner.x)) + paddingMm;
  const minY = Math.min(...viewportCorners.map((corner) => corner.y)) - paddingMm;
  const maxY = Math.max(...viewportCorners.map((corner) => corner.y)) + paddingMm;

  return { minX, maxX, minY, maxY };
}

function drawCapsuleHandle(
  graphics: Graphics,
  options: {
    center: ScreenPoint;
    tangent: ScreenPoint;
    length: number;
    thickness: number;
    fillColor: number;
    fillAlpha: number;
    strokeColor: number;
    strokeAlpha: number;
    strokeWidth: number;
    haloPadding: number;
    haloAlpha: number;
  }
) {
  const tangentLength = Math.hypot(options.tangent.x, options.tangent.y);
  if (tangentLength < 0.001) return;

  const tangent = {
    x: options.tangent.x / tangentLength,
    y: options.tangent.y / tangentLength,
  };
  const normal = {
    x: -tangent.y,
    y: tangent.x,
  };

  if (options.haloPadding > 0 && options.haloAlpha > 0) {
    drawCapsuleHandleShape(graphics, {
      center: options.center,
      tangent,
      normal,
      length: options.length + options.haloPadding * 2,
      thickness: options.thickness + options.haloPadding * 2,
      fillColor: options.fillColor,
      fillAlpha: options.haloAlpha,
      strokeColor: options.fillColor,
      strokeAlpha: 0,
      strokeWidth: 0,
    });
  }

  drawCapsuleHandleShape(graphics, {
    center: options.center,
    tangent,
    normal,
    length: options.length,
    thickness: options.thickness,
    fillColor: options.fillColor,
    fillAlpha: options.fillAlpha,
    strokeColor: options.strokeColor,
    strokeAlpha: options.strokeAlpha,
    strokeWidth: options.strokeWidth,
  });
}

function drawCapsuleHandleShape(
  graphics: Graphics,
  options: {
    center: ScreenPoint;
    tangent: ScreenPoint;
    normal: ScreenPoint;
    length: number;
    thickness: number;
    fillColor: number;
    fillAlpha: number;
    strokeColor: number;
    strokeAlpha: number;
    strokeWidth: number;
  }
) {
  const radius = options.thickness / 2;
  const halfBodyLength = Math.max(options.length / 2 - radius, 0);
  const startCenter = {
    x: options.center.x - options.tangent.x * halfBodyLength,
    y: options.center.y - options.tangent.y * halfBodyLength,
  };
  const endCenter = {
    x: options.center.x + options.tangent.x * halfBodyLength,
    y: options.center.y + options.tangent.y * halfBodyLength,
  };
  const corners = [
    {
      x: startCenter.x + options.normal.x * radius,
      y: startCenter.y + options.normal.y * radius,
    },
    {
      x: endCenter.x + options.normal.x * radius,
      y: endCenter.y + options.normal.y * radius,
    },
    {
      x: endCenter.x - options.normal.x * radius,
      y: endCenter.y - options.normal.y * radius,
    },
    {
      x: startCenter.x - options.normal.x * radius,
      y: startCenter.y - options.normal.y * radius,
    },
  ];

  graphics.setFillStyle({ color: options.fillColor, alpha: options.fillAlpha });
  graphics.moveTo(corners[0].x, corners[0].y);
  for (let index = 1; index < corners.length; index += 1) {
    graphics.lineTo(corners[index].x, corners[index].y);
  }
  graphics.closePath();
  graphics.fill();
  graphics.circle(startCenter.x, startCenter.y, radius);
  graphics.fill();
  graphics.circle(endCenter.x, endCenter.y, radius);
  graphics.fill();

  if (options.strokeWidth <= 0 || options.strokeAlpha <= 0) return;

  graphics.setStrokeStyle({
    width: options.strokeWidth,
    color: options.strokeColor,
    alpha: options.strokeAlpha,
    join: "round",
  });
  graphics.moveTo(corners[0].x, corners[0].y);
  for (let index = 1; index < corners.length; index += 1) {
    graphics.lineTo(corners[index].x, corners[index].y);
  }
  graphics.closePath();
  graphics.stroke();
  graphics.circle(startCenter.x, startCenter.y, radius);
  graphics.stroke();
  graphics.circle(endCenter.x, endCenter.y, radius);
  graphics.stroke();
}

function drawRotatedSquareHandle(
  graphics: Graphics,
  options: {
    center: ScreenPoint;
    size: number;
    rotationDegrees: number;
    fillColor: number;
    fillAlpha: number;
    strokeColor: number;
    strokeAlpha: number;
    strokeWidth: number;
    haloPadding: number;
    haloAlpha: number;
  }
) {
  if (options.haloPadding > 0 && options.haloAlpha > 0) {
    drawPolygonHandle(graphics, {
      points: getRotatedSquarePoints(options.center, options.size + options.haloPadding * 2, options.rotationDegrees),
      fillColor: options.fillColor,
      fillAlpha: options.haloAlpha,
      strokeColor: options.fillColor,
      strokeAlpha: 0,
      strokeWidth: 0,
    });
  }

  drawPolygonHandle(graphics, {
    points: getRotatedSquarePoints(options.center, options.size, options.rotationDegrees),
    fillColor: options.fillColor,
    fillAlpha: options.fillAlpha,
    strokeColor: options.strokeColor,
    strokeAlpha: options.strokeAlpha,
    strokeWidth: options.strokeWidth,
  });
}

function drawPolygonHandle(
  graphics: Graphics,
  options: {
    points: ScreenPoint[];
    fillColor: number;
    fillAlpha: number;
    strokeColor: number;
    strokeAlpha: number;
    strokeWidth: number;
  }
) {
  if (options.points.length < 3) return;

  graphics.setFillStyle({ color: options.fillColor, alpha: options.fillAlpha });
  graphics.moveTo(options.points[0].x, options.points[0].y);
  for (let index = 1; index < options.points.length; index += 1) {
    graphics.lineTo(options.points[index].x, options.points[index].y);
  }
  graphics.closePath();
  graphics.fill();

  if (options.strokeWidth <= 0 || options.strokeAlpha <= 0) return;

  graphics.setStrokeStyle({
    width: options.strokeWidth,
    color: options.strokeColor,
    alpha: options.strokeAlpha,
  });
  graphics.moveTo(options.points[0].x, options.points[0].y);
  for (let index = 1; index < options.points.length; index += 1) {
    graphics.lineTo(options.points[index].x, options.points[index].y);
  }
  graphics.closePath();
  graphics.stroke();
}

function getRotatedSquarePoints(
  center: ScreenPoint,
  size: number,
  rotationDegrees: number
): ScreenPoint[] {
  const half = size / 2;
  const radians = (normalizeCanvasRotationDegrees(rotationDegrees) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];

  return corners.map((corner) => ({
    x: center.x + corner.x * cos - corner.y * sin,
    y: center.y + corner.x * sin + corner.y * cos,
  }));
}

function getTextResolution(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

function snapToPixel(value: number, resolution: number): number {
  return Math.round(value * resolution) / resolution;
}

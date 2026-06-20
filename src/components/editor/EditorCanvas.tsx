"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import { Application, Container, Graphics, Text } from "pixi.js";
import { screenToWorld, worldToScreen } from "@/lib/editor/camera";
import { GRID_MINOR_SIZE_MM, GRID_SIZE_MM, INITIAL_PIXELS_PER_MM, ZOOM_STEP } from "@/lib/editor/constants";
import {
  pointsEqual,
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
  getInteriorAssetDisplayName,
} from "@/lib/editor/interiorAssets";
import {
  getFortyFiveVertexHandleLayouts,
  getOrthogonalWallHandleLayouts,
  isNonRectangularEightWayRoom,
  hitTestOrthogonalWallHandle,
} from "@/lib/editor/orthogonalWallResize";
import {
  getWallSplitHandleLayout,
  hitTestWallSplitHandle,
  WALL_SPLIT_HANDLE_RADIUS_PX,
} from "@/lib/editor/wallSplit";
import { getVertexDeleteHandleCenter, hitTestVertexDeleteHandle } from "@/lib/editor/vertexDeletion";
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
import { attachCopyPasteHotkeys } from "@/lib/editor/input/copyPasteHotkeys";
import { isEditableTarget } from "@/lib/editor/input/editableTarget";
import { attachHistoryHotkeys } from "@/lib/editor/input/historyHotkeys";
import { getAutoFitExportFraming } from "@/lib/editor/exportAutoFitFraming";
import { getLayoutBoundsFromRooms } from "@/lib/editor/exportLayoutBounds";
import {
  buildEditorExportFilename,
  EDITOR_EXPORT_ROOM_COLOR_FILL_ALPHA,
  type EditorExportRoomColorOverride,
  type EditorExportScope,
  exportPixiCanvasToPngBlob,
  exportPixiCanvasToPngDataUrl,
  exportSvgToPdfBlob,
  exportSvgToPngBlob,
  exportSvgToPngDataUrl,
  exportToSVG,
  getEditorExportScopeFilenameParts,
  getRoomColorsForEditorExportRooms,
  getRoomsForEditorExportScope,
} from "@/lib/editor/exportPng";
import { exportPixiCanvasToThumbnailDataUrl } from "@/lib/editor/projectThumbnail";
import { getCameraFitTargetForBounds } from "@/lib/editor/cameraFit";
import {
  findRoomAtPoint,
  getPolygonLabelAnchor,
  isAxisAlignedRectangle,
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
  formatRoomAreaForRoom,
  formatWallDimension,
  getEdgeLengthMillimetres,
  getRoomEdgeMeasurements,
  getRectResizeMeasurements,
  getCornerResizeMeasurements,
} from "@/lib/editor/measurements";
import { normalizeRoomHeightMm } from "@/lib/editor/roomHeight";
import {
  getConstrainedDrawPoint,
  getActiveSnapStepMm,
  getMagneticSnapGuidesForSettings,
  getPredictiveSnapGuides,
  getScaleOverlayState,
  isSupportedDrawPointPath,
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
  ROOM_PRESET_OTHER_HOVER_COLOR,
  ROOM_PRESET_OTHER_COLOR,
  ROOM_PRESET_PICKER_OPTIONS,
  getRegionalRoomPresetLabel,
  type RoomPreset,
  type RoomPresetPickerOption,
} from "@/lib/editor/roomPresets";
import {
  matchEditorKeyboardShortcut,
  showKeyboardShortcutFeedback,
} from "@/lib/editor/keyboardMap";
import {
  formatCanvasRotationDegrees,
  formatCanvasRotationShortcutLabel,
  normalizeCanvasRotationDegrees,
  snapToCardinalRotationDegrees,
  ASSET_ROTATION_DURATION_MS,
  type AssetRotationAnimation,
} from "@/lib/editor/canvasRotation";
import {
  formatNorthBearingDegrees,
  getNorthBearingDegreesFromScreenDelta,
  normalizeNorthBearingDegrees,
  snapNorthBearingDegrees,
} from "@/lib/editor/north";
import { detectMacPlatform } from "@/lib/platform";
import {
  DEFAULT_FLOOR_ID,
  getRoomsForActiveFloor,
  getRoomsForFloor,
} from "@/lib/editor/history";
import {
  DEFAULT_EXTERNAL_WALL_THICKNESS_MM,
  DEFAULT_INTERNAL_WALL_THICKNESS_MM,
} from "@/lib/editor/wallThickness";
import { usePersistentPanelState } from "@/lib/editor/usePersistentPanelState";
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
  RoomOpening,
  RoomOpeningSelection,
  RulerMeasurement,
  SharedSelectionItem,
  RoomWall,
  RoomWallSelection,
  ScreenPoint,
  ViewportSize,
} from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";
import { type ExportPngRequest } from "@/components/editor/ExportPngDialog";
import { SelectedRoomNamePanel } from "@/components/editor/SelectedRoomNamePanel";
import { SelectedFloorInspector } from "@/components/editor/SelectedFloorInspector";
import { SelectedWallInspector } from "@/components/editor/SelectedWallInspector";
import { RoomDrawingInspector } from "@/components/editor/RoomDrawingInspector";
import { RulerInspector } from "@/components/editor/RulerInspector";
import { SelectedNorthInspector } from "@/components/editor/SelectedNorthInspector";
import { SelectedOpeningInspector } from "@/components/editor/SelectedOpeningInspector";
import { SelectedInteriorAssetInspector } from "@/components/editor/SelectedInteriorAssetInspector";
import { HistoryControls } from "@/components/editor/HistoryControls";
import { OnboardingHintCard } from "@/components/editor/OnboardingHintCard";
import { EditorInspectorEmptyState } from "@/components/editor/EditorInspectorEmptyState";
import { InspectorBreadcrumbHeader } from "@/components/editor/InspectorBreadcrumbHeader";
import { Button, ButtonGroup } from "@/components/ui/button";
import {
  Minus,
  PanelBottomCollapse,
  PanelBottomExpand,
  PanelLeftCollapse,
  PanelLeftExpand,
  Plus,
  PanelRightCollapse,
  PanelRightExpand,
  X,
  IconAngle,
} from "@/components/ui/icons";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  tooltipContentClassName,
} from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useMobile } from "@/lib/use-mobile";
import { usePrefersReducedMotion } from "@/lib/accessibility/use-prefers-reduced-motion";
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
import { normalizeUnitOrigin, type ProjectRegion, type UnitOrigin } from "@/lib/projects/region";
import { getTierConfig } from "@/lib/subscription/tiers";

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
const EMPTY_OPENING_MOVE_UI = null as {
  roomId: string;
  openingId: string;
} | null;
const PROJECT_NAME_HINT_ANCHOR_SELECTOR = "[data-editor-project-name-anchor]";
const HINT_TRANSITION_MS = 200;
const HINT_HANDOFF_DELAY_MS = 150;
const HINT_VIEWPORT_MARGIN_PX = 12;
const ANCHORED_HINT_MAX_WIDTH_PX = 352;
const ANCHORED_HINT_OFFSET_PX = 10;
const ANCHORED_HINT_ARROW_SIZE_PX = 12;
const PROJECT_RENAME_HINT_PAUSE_MS = 1200;
const FLOOR_FOOTPRINT_MAX_ALPHA = 0.50;
const FLOOR_FOOTPRINT_STROKE_WIDTH_PX = 2.25;
const MINOR_GRID_MIN_VISIBLE_PX = 4;
const EXTERNAL_WALL_FILL_ALPHA = 0.22;
const INTERNAL_WALL_FILL_ALPHA = 0.12;
const NORTH_INDICATOR_SURFACE_FADE_DELAY_MS = 320;
const DESKTOP_SIDEBAR_EXPANDED_WIDTH_PX = 288;
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH_PX = 44;
const MOBILE_SIDEBAR_EXPANDED_WIDTH_CSS = "min(15rem, 72vw)";
const COMPACT_LANDSCAPE_SIDEBAR_EXPANDED_WIDTH_CSS = "15rem";
const DESKTOP_INSPECTOR_EXPANDED_WIDTH_PX = 320;
const DESKTOP_INSPECTOR_COLLAPSED_WIDTH_PX = 44;
const COMPACT_LANDSCAPE_INSPECTOR_EXPANDED_WIDTH_CSS = "max(13rem, 30vw)";
const MOBILE_PORTRAIT_INSPECTOR_EXPANDED_HEIGHT_CSS = "min(22rem, 42vh)";
const MOBILE_PORTRAIT_INSPECTOR_COLLAPSED_HEIGHT_PX = 44;
const ROOM_PRESET_PICKER_RADIUS_PX = 184;
const ROOM_PRESET_PICKER_COMPACT_RADIUS_PX = 134;
const ROOM_PRESET_PICKER_BUTTON_SIZE_PX = 108;
const ROOM_PRESET_PICKER_COMPACT_BUTTON_SIZE_PX = 82;
const ROOM_PRESET_PICKER_VIEWPORT_MARGIN_PX = 18;
const ROOM_PRESET_PICKER_CONTROL_ATTRIBUTE = "data-room-preset-picker-control";
const ROOM_PRESET_PICKER_EXIT_MS = 110;
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
const OPENING_MOVE_DIMENSION_WALL_OFFSET_PX = 22;
const OPENING_MOVE_DIMENSION_NEIGHBOR_OFFSET_PX = 48;
const OPENING_MOVE_DIMENSION_MIN_LENGTH_PX = 34;
const OPENING_CUTOUT_WORLD_MM = 64;
const OPENING_SYMBOL_WORLD_MM = 18;
const DOOR_SWING_ARC_WORLD_MM = 8;
const WINDOW_LINE_INSET_WORLD_MM = 44;
const WINDOW_LINE_SEPARATION_WORLD_MM = 32;
const OPENING_SELECTION_STROKE_WORLD_MM = 28;
const OPENING_WIDTH_HANDLE_SIZE_PX = 8;
const OPENING_WIDTH_HANDLE_HALO_SIZE_PX = 12;
const OPENING_WIDTH_HANDLE_STROKE_PX = 1.5;
const METRIC_UNIT_ORIGIN_HIGHLIGHT_COLOR = 0xfacc15;
const IMPERIAL_UNIT_ORIGIN_HIGHLIGHT_COLOR = 0xd946ef;
const UNIT_ORIGIN_ROOM_FILL_ALPHA = 0.075;
const UNIT_ORIGIN_ROOM_STROKE_ALPHA = 0.38;
const UNIT_ORIGIN_ASSET_FILL_ALPHA = 0.095;
const UNIT_ORIGIN_ASSET_STROKE_ALPHA = 0.48;
const UNIT_ORIGIN_LINEAR_ALPHA = 0.56;
const WALL_SPLIT_HANDLE_PLUS_SIZE_PX = 8;
const WALL_SPLIT_TOOLTIP_TEXT = "Split wall here";
const WALL_SPLIT_TOOLTIP_FONT_SIZE_PX = 11;
const WALL_SPLIT_TOOLTIP_PADDING_X_PX = 8;
const WALL_SPLIT_TOOLTIP_PADDING_Y_PX = 5;
const WALL_SPLIT_TOOLTIP_RADIUS_PX = 8;
const WALL_SPLIT_TOOLTIP_CONTROL_GAP_PX = 8;
const WALL_SPLIT_TOOLTIP_VIEWPORT_MARGIN_PX = 8;
const WALL_SPLIT_TOOLTIP_DELAY_MS = 700;
const VERTEX_DELETE_HANDLE_RADIUS_PX = 9;
const VERTEX_DELETE_TOOLTIP_TEXT = "Remove corner";
const STAIR_DIRECTION_LABEL_MIN_FONT_SIZE_PX = 10;
const STAIR_DIRECTION_LABEL_MAX_FONT_SIZE_PX = 18;
const ROOM_HANDLE_LAYOUT_CACHE = new WeakMap<
  Room,
  {
    points: Point[];
    cameraKey: string;
    viewportKey: string;
    mode: "constrained-orthogonal" | "eight-way";
    vertexHandles: ReturnType<typeof getConstrainedVertexHandleLayouts>;
    wallSegmentHandles: ReturnType<typeof getOrthogonalWallHandleLayouts>;
  }
>();
const STAIR_DIRECTION_LABEL_WORLD_MM = 60;
const STAIR_DIRECTION_ARROW_LENGTH_RATIO = 0.56;
const STAIR_DIRECTION_ARROW_MIN_LENGTH_MM = 900;
const STAIR_DIRECTION_ARROW_HEAD_WORLD_MM = 140;
const STAIR_DIRECTION_LABEL_OFFSET_WORLD_MM = 140;
const FURNITURE_LABEL_FONT_SIZE_WORLD_MM = 55;
const FURNITURE_LABEL_MIN_FONT_SIZE_PX = 9;
const FURNITURE_LABEL_MAX_FONT_SIZE_PX = 14;
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

function getShortestRotationDeltaDegrees(fromDegrees: number, toDegrees: number) {
  const normalizedDelta = normalizeCanvasRotationDegrees(toDegrees - fromDegrees);
  if (normalizedDelta > 180) return normalizedDelta - 360;
  if (normalizedDelta <= -180) return normalizedDelta + 360;
  return normalizedDelta;
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

function formatGridStepDimension(lengthMillimetres: number, displayUnitOrigin?: UnitOrigin): string {
  if (displayUnitOrigin === "imperial") {
    return formatWallDimension(lengthMillimetres, displayUnitOrigin);
  }

  const metres = lengthMillimetres / 1_000;
  const fractionDigits = lengthMillimetres < 100 ? 2 : 1;
  return `${metres.toFixed(fractionDigits).replace(/\.?0+$/, "")} m`;
}

function getExportRoomColorOverride(request: ExportPngRequest): EditorExportRoomColorOverride {
  return {
    mode: request.roomColorMode,
    color: request.roomColorMode === "single" ? request.roomColorOverride : undefined,
  };
}

function getPngExportRoomColors(roomColors: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(roomColors).map(([roomId, roomColor]) => [
      roomId,
      blendHexColorWithWhite(roomColor, EDITOR_EXPORT_ROOM_COLOR_FILL_ALPHA),
    ])
  );
}

function blendHexColorWithWhite(hexColor: string, alpha: number): string {
  const normalizedColor = /^#[0-9a-fA-F]{6}$/.test(hexColor) ? hexColor : "#ffffff";
  const normalizedAlpha = Math.max(0, Math.min(1, alpha));
  const red = Number.parseInt(normalizedColor.slice(1, 3), 16);
  const green = Number.parseInt(normalizedColor.slice(3, 5), 16);
  const blue = Number.parseInt(normalizedColor.slice(5, 7), 16);
  const blendChannel = (channel: number) =>
    Math.round(channel * normalizedAlpha + 255 * (1 - normalizedAlpha));

  return `#${[blendChannel(red), blendChannel(green), blendChannel(blue)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function getExportCanvasTheme(theme: EditorCanvasTheme): EditorCanvasTheme {
  return {
    ...theme,
    roomLabelFill: 0x111827,
    roomLabelStroke: 0xffffff,
    roomLabelPillFill: 0xffffff,
    roomLabelPillStroke: 0xbccce0,
    roomLabelPillHoverFill: 0xffffff,
    roomLabelPillHoverStroke: 0xbccce0,
    roomLabelPillSelectedFill: 0xffffff,
    roomLabelPillSelectedStroke: 0xbccce0,
  };
}

type EditorCanvasProps = {
  projectId?: string | null;
  hasResolvedProject?: boolean;
  projectRenameCompletionCount?: number;
  onDisplayedHintChange?: (hintId: EditorOnboardingHintId | null) => void;
  onThumbnailGeneratorChange?: (generateThumbnailDataUrl: (() => Promise<string | null>) | null) => void;
  topBarLeadingContent?: ReactNode;
  leftSidebarContent?:
    | ReactNode
    | ((options: {
        sidebarCollapseControl: ReactNode;
        isLeftSidebarCollapsed: boolean;
      }) => ReactNode);
};
const RULER_ACCENT_COLOR = 0x84cc16;

type WallSplitHoverUi = {
  roomId: string;
  wall: RoomWall;
  tooltipVisible: boolean;
};

type VertexDeleteHoverUi = {
  roomId: string;
  vertexIndex: number;
  tooltipVisible: boolean;
};

function CanvasHudCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-md border border-border/70 bg-background/86 px-3 py-2 text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-sm dark:shadow-[0_8px_24px_rgba(0,0,0,0.24)]",
      className
    )}>
      {children}
    </div>
  );
}

function RoomPresetPickerOverlay({
  center,
  compact,
  prefersReducedMotion,
  isExiting,
  options,
  region,
  onSelectPreset,
  onOther,
}: {
  center: ScreenPoint;
  compact: boolean;
  prefersReducedMotion: boolean;
  isExiting: boolean;
  options: readonly RoomPresetPickerOption[];
  region: ProjectRegion;
  onSelectPreset: (preset: RoomPreset) => void;
  onOther: () => void;
}) {
  const radius = compact ? ROOM_PRESET_PICKER_COMPACT_RADIUS_PX : ROOM_PRESET_PICKER_RADIUS_PX;
  const buttonSize = compact
    ? ROOM_PRESET_PICKER_COMPACT_BUTTON_SIZE_PX
    : ROOM_PRESET_PICKER_BUTTON_SIZE_PX;
  const renderPresetLabel = (label: string) =>
    label.split("/").map((part, index, parts) => (
      <span key={`${part}-${index}`}>
        {part}
        {index < parts.length - 1 ? "/" : null}
        {index < parts.length - 1 ? <br /> : null}
      </span>
    ));
  const presetFillStyle = (color: string, hoverColor: string): CSSProperties => ({
    "--room-preset-fill": color,
    "--room-preset-hover-fill": hoverColor,
  } as CSSProperties);

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 will-change-transform",
        prefersReducedMotion
          ? "opacity-100"
          : isExiting
            ? "motion-safe:animate-[roomPresetPickerExit_110ms_cubic-bezier(0.4,0,1,1)_both]"
          : "motion-safe:animate-[roomPresetPickerSpring_420ms_linear_both]"
      )}
      style={{
        left: `${center.x}px`,
        top: `${center.y}px`,
        width: `${radius * 2 + buttonSize}px`,
        height: `${radius * 2 + buttonSize}px`,
        transform: "translate(-50%, -50%)",
      }}
      aria-label="Room preset picker"
    >
      {options.map((option, index) => {
        const angle = -Math.PI / 2 + (index / options.length) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        if (option.type === "split") {
          const topLabel = getRegionalRoomPresetLabel(option.top, region);
          const bottomLabel = getRegionalRoomPresetLabel(option.bottom, region);

          return (
            <div
              key={`${option.top.id}-${option.bottom.id}`}
              data-room-preset-picker-control="true"
              className={cn(
                "group absolute left-1/2 top-1/2",
                isExiting ? "pointer-events-none" : "pointer-events-auto"
              )}
              style={{
                width: `${buttonSize}px`,
                height: `${buttonSize}px`,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                fontFamily: MEASUREMENT_TEXT_FONT_FAMILY,
              }}
              aria-label={`${topLabel} or ${bottomLabel}`}
            >
              <div className="flex h-full w-full flex-col overflow-hidden rounded-full transition-transform duration-150 group-hover:scale-[1.04]">
                <button
                  type="button"
                  onClick={() => onSelectPreset(option.top)}
                  aria-label={`Name room ${topLabel}`}
                  className={cn(
                    "flex h-1/2 w-full items-center justify-center border-b border-zinc-950/38 bg-[var(--room-preset-fill)] px-2.5 text-center text-[13px] leading-tight font-semibold text-zinc-950/80 transition-[background-color,color] duration-150 hover:bg-[var(--room-preset-hover-fill)] hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                    compact ? "text-[11px]" : "text-[13px]"
                  )}
                  style={presetFillStyle(option.top.color, option.top.hoverColor)}
                >
                  <span>{renderPresetLabel(topLabel)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPreset(option.bottom)}
                  aria-label={`Name room ${bottomLabel}`}
                  className={cn(
                    "flex h-1/2 w-full items-center justify-center bg-[var(--room-preset-fill)] px-2.5 text-center text-[13px] leading-tight font-semibold text-zinc-950/80 transition-[background-color,color] duration-150 hover:bg-[var(--room-preset-hover-fill)] hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                    compact ? "text-[11px]" : "text-[13px]"
                  )}
                  style={presetFillStyle(option.bottom.color, option.bottom.hoverColor)}
                >
                  <span>{renderPresetLabel(bottomLabel)}</span>
                </button>
              </div>
            </div>
          );
        }

        if (option.type === "other") {
          return (
            <button
              key="other"
              type="button"
              data-room-preset-picker-control="true"
              onClick={onOther}
              className={cn(
                "group absolute left-1/2 top-1/2 flex items-center justify-center rounded-full px-3 text-center text-[13px] leading-tight font-semibold text-zinc-950/78 transition-colors duration-150 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-zinc-950/82",
                isExiting ? "pointer-events-none" : "pointer-events-auto",
                compact ? "text-[11px]" : "text-[13px]"
              )}
              style={{
                width: `${buttonSize}px`,
                height: `${buttonSize}px`,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                fontFamily: MEASUREMENT_TEXT_FONT_FAMILY,
              }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-[var(--room-preset-fill)] transition-[transform,background-color] duration-150 group-hover:scale-[1.03] group-hover:bg-[var(--room-preset-hover-fill)]"
                style={presetFillStyle(ROOM_PRESET_OTHER_COLOR, ROOM_PRESET_OTHER_HOVER_COLOR)}
              />
              <span className="relative">Other</span>
            </button>
          );
        }

        const { preset } = option;
        const label = getRegionalRoomPresetLabel(preset, region);

        return (
          <button
            key={preset.id}
            type="button"
            data-room-preset-picker-control="true"
            onClick={() => onSelectPreset(preset)}
            aria-label={`Name room ${label}`}
            className={cn(
              "group absolute left-1/2 top-1/2 flex items-center justify-center rounded-full px-3 text-center text-[13px] leading-tight font-semibold text-zinc-950/78 transition-colors duration-150 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-zinc-950/82",
              isExiting ? "pointer-events-none" : "pointer-events-auto",
              compact ? "text-[11px]" : "text-[13px]"
            )}
            style={{
              width: `${buttonSize}px`,
              height: `${buttonSize}px`,
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              fontFamily: MEASUREMENT_TEXT_FONT_FAMILY,
            }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-[var(--room-preset-fill)] transition-[transform,background-color] duration-150 group-hover:scale-[1.04] group-hover:bg-[var(--room-preset-hover-fill)]"
              style={presetFillStyle(preset.color, preset.hoverColor)}
            />
            <span className="relative">{renderPresetLabel(label)}</span>
          </button>
        );
      })}
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
  compact = false,
}: {
  rooms: Room[];
  camera: CameraState;
  viewport: ViewportSize;
  themeMode: "light" | "dark";
  onPanToWorldPoint: (point: Point) => void;
  onInteractionActiveChange: (isActive: boolean) => void;
  compact?: boolean;
}) {
  const dragPointerIdRef = useRef<number | null>(null);
  const miniMapWidth = compact ? 132 : MINI_MAP_WIDTH_PX;
  const miniMapHeight = compact ? 96 : MINI_MAP_HEIGHT_PX;
  const miniMapInset = compact ? 8 : MINI_MAP_INSET_PX;
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
    const drawableWidthPx = miniMapWidth - miniMapInset * 2;
    const drawableHeightPx = miniMapHeight - miniMapInset * 2;
    const scale = Math.min(drawableWidthPx / worldWidth, drawableHeightPx / worldHeight);
    const offsetX = (miniMapWidth - worldWidth * scale) / 2;
    const offsetY = (miniMapHeight - worldHeight * scale) / 2;
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
  }, [camera, layoutBounds, miniMapHeight, miniMapInset, miniMapWidth, rooms, viewport]);

  if (!miniMapState) return null;

  const updateCameraFromPointer = (
    event: ReactPointerEvent<HTMLDivElement> | PointerEvent,
    element: HTMLDivElement
  ) => {
    const rect = element.getBoundingClientRect();
    const localPoint = {
      x: ((event.clientX - rect.left) / rect.width) * miniMapWidth,
      y: ((event.clientY - rect.top) / rect.height) * miniMapHeight,
    };
    onPanToWorldPoint(miniMapState.screenToWorld(localPoint));
  };

  const roomFill = themeMode === "light" ? "rgba(82, 82, 91, 0.24)" : "rgba(212, 212, 216, 0.14)";
  const roomStroke = themeMode === "light" ? "rgba(63, 63, 70, 0.66)" : "rgba(228, 228, 231, 0.42)";
  const frameStroke = themeMode === "light" ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 255, 255, 0.98)";

  return (
    <CanvasHudCard className={compact ? "px-2 py-1.5" : undefined}>
      <div
        className={cn(
          "pointer-events-auto cursor-pointer touch-none overflow-hidden border border-black/8 bg-zinc-200/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.32)] dark:border-white/8 dark:bg-zinc-900/55 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
          compact ? "rounded-lg" : "rounded-[10px]"
        )}
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
          width={miniMapWidth}
          height={miniMapHeight}
          viewBox={`0 0 ${miniMapWidth} ${miniMapHeight}`}
          aria-hidden="true"
          className="block"
        >
          {miniMapState.roomPaths.map((room) => (
            <path
              key={room.id}
              d={room.path}
              fill={roomFill}
              stroke={roomStroke}
              strokeWidth={compact ? 1 : 1.25}
              strokeLinejoin="round"
            />
          ))}
          <rect
            x={miniMapState.viewportRect.x}
            y={miniMapState.viewportRect.y}
            width={miniMapState.viewportRect.width}
            height={miniMapState.viewportRect.height}
            rx={compact ? 2 : 3}
            fill="none"
            stroke={frameStroke}
            strokeWidth={compact ? 1.1 : 1.5}
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
  compact = false,
}: {
  rotationDegrees: number;
  northBearingDegrees: number;
  surfaceState: NorthIndicatorSurfaceState;
  onReset: () => void;
  compact?: boolean;
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
            className={`group relative flex touch-none items-center justify-center rounded-full border border-border/70 bg-background/90 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm transition-[transform,opacity] ease-out hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:shadow-[0_8px_24px_rgba(0,0,0,0.26)] ${
              showSurface ? "pointer-events-auto" : "pointer-events-none"
            } ${
              showSurface ? "opacity-100" : "opacity-0"
            } ${compact ? "h-11 w-11" : "h-14 w-14"}`}
            style={{ transitionDuration: showSurface ? "150ms" : "500ms" }}
          >
            <div
              aria-hidden="true"
              className={cn(
                "absolute rounded-full border-black shadow-[0_0_0_1px_rgba(255,255,255,0.82)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.58)]",
                compact ? "inset-[6px] border-2" : "inset-[7px] border-[2.5px]"
              )}
            />
            <div
              aria-hidden="true"
              className={cn("absolute transition-transform duration-75 ease-out", compact ? "inset-[8px]" : "inset-[10px]")}
              style={{ transform: `rotate(${normalizedRotationDegrees}deg)` }}
            >
              <div className={cn(
                "absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.72)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.4)]",
                compact ? "h-2.5 w-0.5" : "h-3.5 w-[2.5px]"
              )} />
            </div>
            <div
              aria-hidden="true"
              className={cn("absolute transition-transform duration-75 ease-out", compact ? "inset-[8px]" : "inset-[10px]")}
              style={{ transform: `rotate(${northMarkerDegrees}deg)` }}
            >
              <div className={cn(
                "absolute left-1/2 h-0 w-0 -translate-x-1/2 border-x-transparent border-b-red-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.28)]",
                compact ? "top-0 border-x-[4px] border-b-[6px]" : "top-[-1px] border-x-[6px] border-b-[9px]"
              )} />
            </div>
            <div
              className={cn("relative font-semibold tracking-[0.06em] text-foreground/82", compact ? "text-[8px]" : "text-[10px]")}
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
  compact = false,
}: {
  bearingDegrees: number;
  viewRotationDegrees: number;
  surfaceState: NorthIndicatorSurfaceState;
  isDragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  compact?: boolean;
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
            className={cn(
              "pointer-events-auto group relative flex touch-none items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              compact ? "h-11 w-11" : "h-14 w-14"
            )}
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
                        height: compact ? "16px" : "21px",
                      }}
                    >
                    <div
                      className={`mx-auto rounded-full ${
                        isMajorTick
                          ? compact
                            ? "h-1.5 w-px bg-black/90 dark:bg-white/90"
                            : "h-2 w-px bg-black/90 dark:bg-white/90"
                          : compact
                            ? "h-1 w-px bg-black/55 dark:bg-white/50"
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
              <div className={cn(
                "absolute left-1/2 h-0 w-0 -translate-x-1/2 border-x-transparent border-b-red-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]",
                compact ? "top-1 border-x-[4px] border-b-[6px]" : "top-1.5 border-x-[6px] border-b-[9px]"
              )} />
            </div>
            <div
              className={cn("relative font-semibold tracking-[0.2em] text-foreground/86", compact ? "text-[10px]" : "text-xs")}
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
  projectId,
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
  const floorFootprintRef = useRef<Graphics | null>(null);
  const roomRef = useRef<Graphics | null>(null);
  const openingRef = useRef<Graphics | null>(null);
  const wallOverlayRef = useRef<Graphics | null>(null);
  const roomLabelRef = useRef<Container | null>(null);
  const draftRef = useRef<Graphics | null>(null);
  const dimensionOverlayRef = useRef<Container | null>(null);
  const cursorWorldRef = useRef<Point | null>(null);
  const hoveredRoomLabelIdRef = useRef<string | null>(null);
  const assetDragTargetRoomIdRef = useRef<string | null>(null);
  const hoveredSelectableWallRef = useRef<{
    roomId: string;
    wall: RoomWall;
  } | null>(EMPTY_HOVERED_SELECTABLE_WALL);
  const openingMoveUiRef = useRef<{
    roomId: string;
    openingId: string;
  } | null>(EMPTY_OPENING_MOVE_UI);
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
  const wallSplitHoverUiRef = useRef<WallSplitHoverUi | null>(null);
  const wallSplitTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vertexDeleteHoverUiRef = useRef<VertexDeleteHoverUi | null>(null);
  const vertexDeleteTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rulerInteractionUiRef = useRef<RulerInteractionUi | null>(null);
  const transformFeedbackRef = useRef<TransformFeedback | null>(null);
  const snapGuidesRef = useRef<SnapGuides | null>(null);
  // Holds in-progress asset rotation animations keyed by assetId.
  // Populated by the rotation command; drained by the ticker once durationMs elapses.
  const assetRotationAnimationsRef = useRef<Map<string, AssetRotationAnimation>>(new Map());
  const draftConstraintModeRef = useRef<"orthogonal" | "diagonal45">("orthogonal");
  const transformAnimationFrameRef = useRef<number | null>(null);
  const footprintFadeAnimationFrameRef = useRef<number | null>(null);
  const assetRotationAnimationFrameRef = useRef<number | null>(null);
  const footprintPreviewFloorIdRef = useRef<string | null>(null);
  const footprintPreviewOpacityRef = useRef(0);
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
  const editorDocument = useEditorStore((state) => state.document);
  const displayUnitOrigin = editorDocument.region;
  const rooms = useMemo(() => getRoomsForActiveFloor(editorDocument), [editorDocument]);
  const roomCount = rooms.length;
  const roomDraftPointCount = useEditorStore((state) => state.roomDraft.points.length);
  const isRulerMode = useEditorStore((state) => state.isRulerMode);
  const canvasRotationDegrees = useEditorStore((state) => state.document.canvasRotationDegrees);
  const northBearingDegrees = useEditorStore((state) => state.document.northBearingDegrees);
  const selectFloorById = useEditorStore((state) => state.selectFloorById);
  const selectedNorthIndicator = useEditorStore((state) => state.selectedNorthIndicator);
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const applyRoomPreset = useEditorStore((state) => state.applyRoomPreset);
  const applyOtherRoomPreset = useEditorStore((state) => state.applyOtherRoomPreset);
  const roomPresetPickerRoomId = useEditorStore((state) => state.roomPresetPickerRoomId);
  const clearRoomPresetPicker = useEditorStore((state) => state.clearRoomPresetPicker);
  const selectedFloorId = useEditorStore((state) => {
    const floorSelection = state.selection.find(
      (item): item is Extract<SharedSelectionItem, { type: "floor" }> => item.type === "floor"
    );
    if (floorSelection) return floorSelection.id;
    return state.document.floors.some((floor) => floor.id === state.document.activeFloorId)
      ? state.document.activeFloorId
      : null;
  });
  const selectNorthIndicator = useEditorStore((state) => state.selectNorthIndicator);
  const updateCanvasRotationDegrees = useEditorStore((state) => state.updateCanvasRotationDegrees);
  const resetCanvasRotation = useEditorStore((state) => state.resetCanvasRotation);
  const previewNorthBearingDegrees = useEditorStore((state) => state.previewNorthBearingDegrees);
  const commitNorthBearingDegrees = useEditorStore((state) => state.commitNorthBearingDegrees);
  const setCanvasInteractionActive = useEditorStore((state) => state.setCanvasInteractionActive);
  const camera = useEditorStore((state) => state.camera);
  const viewport = useEditorStore((state) => state.viewport);
  const zoomAtScreenPoint = useEditorStore((state) => state.zoomAtScreenPoint);
  const setCameraCenterMm = useEditorStore((state) => state.setCameraCenterMm);
  const resetDraft = useEditorStore((state) => state.resetDraft);
  const rulerDraftHasStart = useEditorStore((state) => state.rulerDraft.start !== null);
  const resetRulerDraft = useEditorStore((state) => state.resetRulerDraft);
  const hasRooms = hasHydratedClient && roomCount > 0;
  const floors = editorDocument.floors;
  const displayedFloors = useMemo(() => [...floors].reverse(), [floors]);
  const activeFloorId = editorDocument.activeFloorId;
  const prefersReducedMotion = usePrefersReducedMotion();
  const showFloorFootprint = useEditorStore((state) => state.settings.showFloorFootprint);
  const [hoveredFloorPreviewId, setHoveredFloorPreviewId] = useState<string | null>(null);
  const [previousActiveFloorId, setPreviousActiveFloorId] = useState<string | null>(null);
  const [isFloorAnimating, setIsFloorAnimating] = useState(false);
  const floorButtonsContainerRef = useRef<HTMLDivElement | null>(null);
  const floorButtonRefsMap = useRef<Map<string, HTMLElement | null>>(new Map());
  const footprintFloorId = useMemo(() => {
    if (hoveredFloorPreviewId && hoveredFloorPreviewId !== activeFloorId) {
      return hoveredFloorPreviewId;
    }

    if (!showFloorFootprint) return null;

    const activeFloorIndex = floors.findIndex((floor) => floor.id === activeFloorId);
    return activeFloorIndex > 0 ? floors[activeFloorIndex - 1]?.id ?? null : null;
  }, [activeFloorId, floors, hoveredFloorPreviewId, showFloorFootprint]);
  const hydratedCanvasRotationDegrees = hasHydratedClient ? canvasRotationDegrees : 0;
  const hydratedNorthBearingDegrees = hasHydratedClient ? northBearingDegrees : 0;
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
  const [hasMountedClient, setHasMountedClient] = useState(false);
  const [isNorthIndicatorHovered, setIsNorthIndicatorHovered] = useState(false);
  const [northIndicatorSurfaceState, setNorthIndicatorSurfaceState] =
    useState<NorthIndicatorSurfaceState>("hidden");
  const [canvasRotationIndicatorSurfaceState, setCanvasRotationIndicatorSurfaceState] =
    useState<NorthIndicatorSurfaceState>(
      Math.abs(normalizeCanvasRotationDegrees(canvasRotationDegrees)) > 0.01 ? "visible" : "hidden"
    );
  const [isShiftKeyPressed, setIsShiftKeyPressed] = useState(false);
  const is45DegreeDrawingEnabled = useEditorStore((state) => state.is45DegreeDrawingEnabled);
  const setIs45DegreeDrawingEnabled = useEditorStore((state) => state.setIs45DegreeDrawingEnabled);
  const selection = useEditorStore((state) => state.selection);
  const selectRoomById = useEditorStore((state) => state.selectRoomById);

  const handleToggle45DegreeDrawing = useCallback(
    (pressed: boolean) => {
      setIs45DegreeDrawingEnabled(pressed);
    },
    [setIs45DegreeDrawingEnabled]
  );

  useEffect(() => {
    setHasMountedClient(true);
  }, []);
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

  useEffect(() => {
    if (!roomPresetPickerRoomId) return;
    const roomStillVisible = rooms.some((room) => room.id === roomPresetPickerRoomId);
    const shouldDismiss =
      !roomStillVisible ||
      selectedRoomId !== roomPresetPickerRoomId ||
      roomDraftPointCount > 0 ||
      isRulerMode ||
      selectedNorthIndicator;

    if (shouldDismiss) {
      clearRoomPresetPicker();
    }
  }, [
    clearRoomPresetPicker,
    isRulerMode,
    roomDraftPointCount,
    roomPresetPickerRoomId,
    rooms,
    selectedNorthIndicator,
    selectedRoomId,
  ]);

  useEffect(() => {
    if (!roomPresetPickerRoomId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const clickedPresetControl = event.composedPath().some(
        (target) =>
          target instanceof Element &&
          target.getAttribute(ROOM_PRESET_PICKER_CONTROL_ATTRIBUTE) === "true"
      );
      if (!clickedPresetControl) {
        clearRoomPresetPicker();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    };
  }, [clearRoomPresetPicker, roomPresetPickerRoomId]);

  const handleRoomPresetPickerSelect = useCallback(
    (preset: RoomPreset) => {
      if (!roomPresetPickerRoomId) return;
      applyRoomPreset(roomPresetPickerRoomId, preset.id);
    },
    [applyRoomPreset, roomPresetPickerRoomId]
  );

  const handleRoomPresetPickerOther = useCallback(() => {
    if (roomPresetPickerRoomId) {
      applyOtherRoomPreset(roomPresetPickerRoomId);
    }
    window.requestAnimationFrame(() => {
      const inputElement = document.getElementById("room-name-input");
      if (inputElement instanceof HTMLInputElement) {
        inputElement.focus({ preventScroll: true });
        inputElement.select();
      }
    });
  }, [applyOtherRoomPreset, roomPresetPickerRoomId]);

  const drawCurrentScene = useCallback(() => {
    const app = appRef.current;
    const grid = gridRef.current;
    const floorFootprint = floorFootprintRef.current;
    const rooms = roomRef.current;
    const openings = openingRef.current;
    const wallOverlay = wallOverlayRef.current;
    const roomLabels = roomLabelRef.current;
    const draft = draftRef.current;
    const dimensionOverlay = dimensionOverlayRef.current;
    if (!grid || !floorFootprint || !rooms || !openings || !wallOverlay || !roomLabels || !draft || !dimensionOverlay) return;
    if (
      grid.destroyed ||
      floorFootprint.destroyed ||
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
      floorFootprint,
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
      openingMoveUiRef.current,
      roomResizeUiRef.current,
      wallSplitHoverUiRef.current,
      vertexDeleteHoverUiRef.current,
      rulerInteractionUiRef.current,
      transformFeedbackRef.current,
      snapGuidesRef.current,
      draftConstraintModeRef.current,
      editorThemeRef.current,
      Boolean(activeNorthDragRef.current?.didDrag),
      footprintPreviewFloorIdRef.current,
      footprintPreviewOpacityRef.current,
      assetDragTargetRoomIdRef.current,
      assetRotationAnimationsRef.current
    );

    if (app) {
      app.render();
    }
  }, []);

  const stopTransformAnimation = useCallback(() => {
    if (transformAnimationFrameRef.current === null) return;
    cancelAnimationFrame(transformAnimationFrameRef.current);
    transformAnimationFrameRef.current = null;
  }, []);

  const stopFootprintFadeAnimation = useCallback(() => {
    if (footprintFadeAnimationFrameRef.current === null) return;
    cancelAnimationFrame(footprintFadeAnimationFrameRef.current);
    footprintFadeAnimationFrameRef.current = null;
  }, []);

  const stopAssetRotationAnimation = useCallback(() => {
    if (assetRotationAnimationFrameRef.current === null) return;
    cancelAnimationFrame(assetRotationAnimationFrameRef.current);
    assetRotationAnimationFrameRef.current = null;
  }, []);

  const startAssetRotationAnimation = useCallback(() => {
    // If a loop is already running, it will pick up the new entry from the map automatically.
    if (assetRotationAnimationFrameRef.current !== null) return;

    const step = () => {
      const now = performance.now();
      for (const [assetId, anim] of assetRotationAnimationsRef.current) {
        if (now - anim.startMs >= anim.durationMs) {
          assetRotationAnimationsRef.current.delete(assetId);
        }
      }

      drawCurrentScene();

      if (assetRotationAnimationsRef.current.size > 0) {
        assetRotationAnimationFrameRef.current = requestAnimationFrame(step);
      } else {
        assetRotationAnimationFrameRef.current = null;
      }
    };

    assetRotationAnimationFrameRef.current = requestAnimationFrame(step);
  }, [drawCurrentScene]);

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

  const startFootprintFadeAnimation = useCallback(() => {
    stopFootprintFadeAnimation();

    const step = () => {
      const targetOpacity = footprintPreviewFloorIdRef.current ? 1 : 0;
      const currentOpacity = footprintPreviewOpacityRef.current;
      const delta = targetOpacity - currentOpacity;

      if (Math.abs(delta) <= 0.02) {
        footprintPreviewOpacityRef.current = targetOpacity;
        footprintFadeAnimationFrameRef.current = null;
        drawCurrentScene();
        return;
      }

      footprintPreviewOpacityRef.current = currentOpacity + delta * 0.22;
      drawCurrentScene();
      footprintFadeAnimationFrameRef.current = requestAnimationFrame(step);
    };

    footprintFadeAnimationFrameRef.current = requestAnimationFrame(step);
  }, [drawCurrentScene, stopFootprintFadeAnimation]);

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
    footprintPreviewFloorIdRef.current = footprintFloorId;
    startFootprintFadeAnimation();
    drawCurrentScene();
  }, [drawCurrentScene, footprintFloorId, startFootprintFadeAnimation]);

  useEffect(() => {
    if (activeFloorId !== null && previousActiveFloorId !== null && activeFloorId !== previousActiveFloorId) {
      // Start animation on the indicator morphing to new position
      setIsFloorAnimating(true);
      
      // Clear animation state after duration (200ms total for grow + shrink)
      const animationTimeoutId = setTimeout(() => {
        setIsFloorAnimating(false);
        setPreviousActiveFloorId(activeFloorId);
      }, 200);
      
      return () => clearTimeout(animationTimeoutId);
    }
    
    setPreviousActiveFloorId(activeFloorId);
  }, [activeFloorId, previousActiveFloorId]);

  useEffect(() => {
    return () => {
      stopFootprintFadeAnimation();
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
  }, [stopFootprintFadeAnimation]);

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
      exportAssetMode,
      showScaleBar,
      legendPosition,
      signatureText,
      titleText,
      descriptionText,
      legendItems,
      themeMode,
      exportResolution,
      exportScope,
      roomColorOverride,
    }: {
      includeSignature: boolean;
      includeNorthIndicator?: boolean;
      innerPaddingPx: number;
      paddingPx: number;
      showDimensions: boolean;
      showGrid: boolean;
      exportAssetMode?: ExportPngRequest["exportAssetMode"];
      showScaleBar: boolean;
      legendPosition?: "bottom" | "right-side";
      signatureText?: string;
      titleText?: string;
      descriptionText?: string;
      legendItems?: { name: string; area: string }[];
      themeMode: "light" | "dark";
      exportResolution?: "normal" | "hi-res";
      exportScope?: EditorExportScope;
      roomColorOverride?: EditorExportRoomColorOverride;
    }) => {
      const app = appRef.current;
      if (!app) return null;

      const state = useEditorStore.getState();
      const exportTheme = getExportCanvasTheme(getEditorCanvasTheme(themeMode));
      const scopedRooms = getRoomsForEditorExportScope(state.document, exportScope);
      const exportRooms = scopedRooms.map((room) => ({
        ...room,
        interiorAssets:
          exportAssetMode === "none"
            ? []
            : exportAssetMode === "stairs-only"
              ? room.interiorAssets.filter((asset) => asset.type === "stairs")
              : room.interiorAssets,
      }));
      const layoutBounds = getLayoutBoundsFromRooms(scopedRooms);
      const roomColors = getRoomColorsForEditorExportRooms(scopedRooms, roomColorOverride);
      const pngRoomColors = getPngExportRoomColors(roomColors);
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
      const exportScaleOverlay = getScaleOverlayState(exportCamera, state.document.region);
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
        exportRooms,
        null,
        [],
        EMPTY_ROOM_RESIZE_UI,
        state.roomDraft.points.length > 0,
        exportCamera,
        exportViewport,
        null,
        exportTheme,
        roomColorOverride?.mode === "none" ? false : state.settings.showRoomColors,
        null,
        {
          roomColors: pngRoomColors,
          roomColorFillAlpha: 1,
          roomDefaultFillAlpha: roomColorOverride?.mode === "none" ? 0 : undefined,
        }
      );
      drawOpenings(
        exportOpeningGraphics,
        exportRooms,
        null,
        [],
        exportCamera,
        exportViewport,
        exportTheme,
        true,
        { includeStairDirectionVisuals: false }
      );
      drawWallInteractionOverlay(
        exportWallOverlayGraphics,
        exportRooms,
        null,
        [],
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
        exportRooms,
        null,
        null,
        exportCamera,
        exportViewport,
        state.settings,
        showDimensions,
        null,
        exportTheme,
        [],
        state.settings.showRoomNames,
        exportAssetMode !== "none",
        state.settings.showAssetLabels,
        { includeStairDirectionLabels: false, displayUnitOrigin: state.document.region }
      );
      drawDraft(
        exportDraftGraphics,
        state.roomDraft.points,
        null,
        exportCamera,
        exportViewport,
        getActiveSnapStepMm(exportCamera),
        getActiveSnapStepMm(exportCamera),
        "orthogonal",
        null,
        exportTheme,
        false
      );

      return {
        renderer: app.renderer,
        stage: exportStage,
        options: {
          backgroundColor: themeMode === "light" ? "#ffffff" : "#000000",
          exportScope,
          roomColors: pngRoomColors,
          roomColorOverride,
          paddingPx,
          exportResolution,
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
    const roomColorOverride = getExportRoomColorOverride(request);
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
    const state = useEditorStore.getState();
    const scopedRooms = getRoomsForEditorExportScope(
      state.document,
      request.exportScope
    );
    const exportLegendItems =
      effectiveLegendPosition !== "none"
        ? scopedRooms.map((room, index) => ({
            name: normalizeExportSingleLineText(room.name) || `Room ${index + 1}`,
            area: formatRoomAreaForRoom(room, state.document.region),
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
      exportAssetMode: request.exportAssetMode,
      showScaleBar: shouldShowScaleBar,
      legendPosition: hasRightLegend ? "right-side" : hasBottomLegend ? "bottom" : undefined,
      titleText: exportTitle || undefined,
      descriptionText: exportDescription || undefined,
      legendItems: exportLegendItems,
      signatureText: exportSignatureText || undefined,
      themeMode: resolvedThemeMode,
      exportResolution: request.exportResolution,
      exportScope: request.exportScope,
      roomColorOverride,
    });
  }, [createCanvasExportSnapshot, editorThemeMode]);

  const createSvgExportPayloadFromRequest = useCallback((request: ExportPngRequest) => {
    const state = useEditorStore.getState();
    const roomColorOverride = getExportRoomColorOverride(request);
    const exportTitle =
      request.titlePosition === "top" ? normalizeExportSingleLineText(request.title) : "";
    const exportDescription =
      request.descriptionPosition === "below-title"
        ? normalizeExportMultilineText(request.description)
        : "";
    const filenameParts = getEditorExportScopeFilenameParts(state.document, request.exportScope);
    const scopedRooms = getRoomsForEditorExportScope(state.document, request.exportScope);
    const exportSignatureText = normalizeEditorExportSignature(
      request.designedBy || state.settings.exportSignatureText
    );
    const exportSignatureLines = exportSignatureText
      ? [`Designed by ${exportSignatureText}`, "Designed with [s]paceforge", "spaceforge.app"]
      : ["Designed with [s]paceforge", "spaceforge.app"];
    const effectiveLegendPosition = request.showLegend ? request.legendPosition : "none";
    const exportLegendItems =
      effectiveLegendPosition !== "none"
        ? scopedRooms.map((room, index) => ({
            name: normalizeExportSingleLineText(room.name) || `Room ${index + 1}`,
            area: formatRoomAreaForRoom(room, state.document.region),
          }))
        : undefined;
    const svg = exportToSVG({
      rooms: state.document.rooms,
      floors: state.document.floors,
      activeFloorId: state.document.activeFloorId,
      exportScope: request.exportScope,
      title: exportTitle || undefined,
      description: exportDescription || undefined,
      exportAssetMode: request.exportAssetMode,
      northBearingDegrees: request.includeNorthIndicator
        ? state.document.northBearingDegrees
        : undefined,
      legendItems: exportLegendItems,
      legendPosition:
        effectiveLegendPosition === "bottom" || effectiveLegendPosition === "right-side"
          ? effectiveLegendPosition
          : undefined,
      roomColorOverride,
      exportViewMode: request.exportViewMode,
      signatureText: exportSignatureText || undefined,
      signatureLines: exportSignatureLines,
      displayUnitOrigin: state.document.region,
    });
    const filename = buildEditorExportFilename({
      projectName: exportTitle,
      floorName: filenameParts.floorName,
      roomName: filenameParts.roomName,
      format: request.exportFormat,
    });

    return {
      svg,
      filename,
      exportTitle,
    };
  }, []);

  const exportCurrentCanvasAsPng = useCallback(async (request: ExportPngRequest) => {
    if (isExportingPng) return;

    track(ANALYTICS_EVENTS.exportStarted, {
      exportType: request.exportFormat === "pdf" ? "pdf" : request.exportFormat === "svg" ? "svg" : "png",
    });
    trackFirstAction(ANALYTICS_EVENTS.exportStarted);

    if (request.exportFormat === "svg" || request.exportFormat === "pdf") {
      setIsExportingPng(true);

      try {
        const { svg, filename, exportTitle } = createSvgExportPayloadFromRequest(request);
        const blob =
          request.exportFormat === "pdf"
            ? await exportSvgToPdfBlob(svg, {
                title: exportTitle || "spaceforge export",
                author: "[s]paceforge",
                subject: "Floor plan export",
                creator: "spaceforge.app",
              })
            : new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        link.click();
        track(ANALYTICS_EVENTS.exportCompleted, {
          exportType: request.exportFormat,
        });
        trackFirstSuccess(ANALYTICS_EVENTS.exportCompleted);
        if (activeHintIdRef.current === "export-as-png") {
          completeHint("export-as-png");
        }
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      } catch (error) {
        console.error(`${request.exportFormat.toUpperCase()} export failed.`, error);
      } finally {
        setIsExportingPng(false);
      }

      return;
    }

    if (request.exportViewMode === "extruded") {
      setIsExportingPng(true);

      try {
        const { svg, filename } = createSvgExportPayloadFromRequest(request);
        const blob = await exportSvgToPngBlob(svg, {
          exportResolution: request.exportResolution,
        });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
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
        console.error("2.5D PNG export failed.", error);
      } finally {
        setIsExportingPng(false);
      }

      return;
    }

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
      const state = useEditorStore.getState();
      const exportTitle =
        request.titlePosition === "top" ? normalizeExportSingleLineText(request.title) : "";
      const filenameParts = getEditorExportScopeFilenameParts(state.document, request.exportScope);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = buildEditorExportFilename({
        projectName: exportTitle,
        floorName: filenameParts.floorName,
        roomName: filenameParts.roomName,
        format: request.exportFormat,
      });
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
  }, [completeHint, createPngExportSnapshotFromRequest, createSvgExportPayloadFromRequest, isExportingPng]);

  const generateExportPreviewDataUrl = useCallback(async (request: ExportPngRequest) => {
    if (request.exportViewMode === "extruded") {
      const { svg } = createSvgExportPayloadFromRequest(request);
      return exportSvgToPngDataUrl(svg, {
        exportResolution: request.exportResolution,
      });
    }

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
  }, [createPngExportSnapshotFromRequest, createSvgExportPayloadFromRequest]);

  const generateThumbnailDataUrl = useCallback(async () => {
    const exportSnapshot = createCanvasExportSnapshot({
      includeSignature: false,
      includeNorthIndicator: false,
      innerPaddingPx: 56,
      paddingPx: 24,
      showDimensions: false,
      showGrid: false,
      exportAssetMode: "all",
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
      const didCreateRoom = getRoomsForActiveFloor(state.document).length === getRoomsForActiveFloor(previousState.document).length + 1;
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
        getRoomsForActiveFloor(previousState.document).length === 0 && getRoomsForActiveFloor(state.document).length > 0;
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
    return attachCopyPasteHotkeys(useEditorStore);
  }, []);

  useEffect(() => {
    const isOpeningContextMenuOpen = () =>
      globalThis.document?.body?.hasAttribute("data-opening-context-menu-open") ?? false;

    const syncDimensionsOverride = (isActive: boolean) => {
      // Don't respond to Alt when opening context menu is open
      if (isOpeningContextMenuOpen()) {
        return;
      }
      const state = useEditorStore.getState();
      state.setDimensionsVisibilityOverrideActive(state.roomDraft.points.length > 0 ? false : isActive);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      syncDimensionsOverride(event.getModifierState("Alt"));

      if (event.key === "Shift" && !event.repeat) {
        setIsShiftKeyPressed(true);
        return;
      }

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
        "toggle-ruler-tool",
        "fit-selected-room",
        "fit-all-rooms",
      ]);
      if (!shortcut) return;

      event.preventDefault();

      if (shortcut.id === "toggle-guidelines") {
        const nextShowGuidelines = !store.settings.showGuidelines;
        store.updateSettings({ showGuidelines: nextShowGuidelines });
        showKeyboardShortcutFeedback(shortcut.id, {
          feedbackEnabled: store.keyboardShortcutFeedbackEnabled,
          context: { isEnabled: nextShowGuidelines },
        });
        return;
      }

      if (shortcut.id === "toggle-canvas-hud") {
        const nextShowCanvasHud = !store.settings.showCanvasHud;
        store.updateSettings({ showCanvasHud: nextShowCanvasHud });
        showKeyboardShortcutFeedback(shortcut.id, {
          feedbackEnabled: store.keyboardShortcutFeedbackEnabled,
          context: { isEnabled: nextShowCanvasHud },
        });
        return;
      }

      if (shortcut.id === "toggle-snapping") {
        const nextSnappingEnabled = !store.settings.snappingEnabled;
        store.updateSettings({ snappingEnabled: nextSnappingEnabled });
        showKeyboardShortcutFeedback(shortcut.id, {
          feedbackEnabled: store.keyboardShortcutFeedbackEnabled,
          context: { isEnabled: nextSnappingEnabled },
        });
        return;
      }

      if (shortcut.id === "toggle-ruler-tool") {
        const nextIsRulerMode = !store.isRulerMode;
        store.setRulerMode(nextIsRulerMode);
        showKeyboardShortcutFeedback(shortcut.id, {
          feedbackEnabled: store.keyboardShortcutFeedbackEnabled,
          context: { isEnabled: nextIsRulerMode },
        });
        return;
      }

      if (shortcut.id === "fit-selected-room") {
        const selectedRoomItems = store.selection.filter((item) => item.type === "room");
        if (store.selection.length !== 1 || selectedRoomItems.length !== 1) return;

        store.fitCameraToSelectedRoom();
        showKeyboardShortcutFeedback(shortcut.id, {
          feedbackEnabled: store.keyboardShortcutFeedbackEnabled,
        });
        return;
      }

      if (shortcut.id === "fit-all-rooms") {
        if (store.document.rooms.length === 0) return;

        store.resetCamera();
        showKeyboardShortcutFeedback(shortcut.id, {
          feedbackEnabled: store.keyboardShortcutFeedbackEnabled,
        });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      syncDimensionsOverride(event.getModifierState("Alt"));

      if (event.key === "Shift") {
        setIsShiftKeyPressed(false);
      }
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
      findRoomLabelAtScreenPoint(getRoomsForActiveFloor(state.document), screenPoint, state.camera, state.viewport) ||
      findSelectedOpeningWidthHandleAtScreenPoint(
        getRoomsForActiveFloor(state.document),
        state.selectedOpening,
        screenPoint,
        state.camera,
        state.viewport
      ) ||
      findOpeningAtScreenPoint(getRoomsForActiveFloor(state.document), screenPoint, state.camera, state.viewport) ||
      findInteriorAssetAtScreenPoint(getRoomsForActiveFloor(state.document), screenPoint, state.camera, state.viewport)
    ) {
      return false;
    }

    if (state.selectedInteriorAsset) {
      const room =
        getRoomsForActiveFloor(state.document).find((candidate) => candidate.id === state.selectedInteriorAsset?.roomId) ?? null;
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
        getRoomsForActiveFloor(state.document).find((candidate) => candidate.id === state.selectedRoomId) ?? null;
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
    return !findRoomAtPoint(getRoomsForActiveFloor(state.document), worldPoint);
  }, []);

  const canvasBootstrapCallbacks = useMemo(
    () => ({
      canStartCanvasRotation,
      completeHint,
      drawCurrentScene,
      setTransformFeedback,
      startAssetRotationAnimation,
      stopFootprintFadeAnimation,
      stopTransformAnimation,
      updateCanvasRotationTooltip,
    }),
    [
      canStartCanvasRotation,
      completeHint,
      drawCurrentScene,
      setTransformFeedback,
      startAssetRotationAnimation,
      stopFootprintFadeAnimation,
      stopTransformAnimation,
      updateCanvasRotationTooltip,
    ]
  );

  useEffect(() => {
    const {
      canStartCanvasRotation,
      completeHint,
      drawCurrentScene,
      setTransformFeedback,
      startAssetRotationAnimation,
      stopFootprintFadeAnimation,
      stopTransformAnimation,
      updateCanvasRotationTooltip,
    } = canvasBootstrapCallbacks;

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
      app.canvas.style.display = "block";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";

      const grid = new Graphics();
      const floorFootprint = new Graphics();
      const rooms = new Graphics();
      const openings = new Graphics();
      const wallOverlay = new Graphics();
      const roomLabels = new Container();
      const draft = new Graphics();
      const dimensionOverlay = new Container();
      gridRef.current = grid;
      floorFootprintRef.current = floorFootprint;
      roomRef.current = rooms;
      openingRef.current = openings;
      wallOverlayRef.current = wallOverlay;
      roomLabelRef.current = roomLabels;
      draftRef.current = draft;
      dimensionOverlayRef.current = dimensionOverlay;
      app.stage.addChild(grid);
      app.stage.addChild(floorFootprint);
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
      const resizeObserver = new ResizeObserver(([entry]) => {
        const nextWidth = Math.round(entry.contentRect.width);
        const nextHeight = Math.round(entry.contentRect.height);
        if (nextWidth <= 0 || nextHeight <= 0) return;
        if (app.screen.width === nextWidth && app.screen.height === nextHeight) return;

        app.renderer.resize(nextWidth, nextHeight);
        syncViewport();
        drawCurrentScene();
      });

      app.renderer.on("resize", handleResize);
      resizeObserver.observe(resizeTarget);

      const unsubscribe = useEditorStore.subscribe((state, previousState) => {
        // Detect asset rotations and populate the animation map BEFORE drawing,
        // so that the very first drawCurrentScene call sees the animation entry
        // and renders at progress=0 (fromDegrees) rather than the final state.
        if (state.document !== previousState.document) {
          const nowRooms = getRoomsForActiveFloor(state.document);
          const prevRooms = getRoomsForActiveFloor(previousState.document);
          let anyAdded = false;
          for (const room of nowRooms) {
            const prevRoom = prevRooms.find((r) => r.id === room.id);
            if (!prevRoom) continue;
            for (const asset of room.interiorAssets) {
              const prevAsset = prevRoom.interiorAssets.find((a) => a.id === asset.id);
              if (!prevAsset) continue;
              const fromDegrees = snapToCardinalRotationDegrees(prevAsset.rotationDegrees ?? 0);
              const toDegrees = snapToCardinalRotationDegrees(asset.rotationDegrees ?? 0);
              if (fromDegrees === toDegrees) continue;
              const usesSidewaysBaseDimensions = Math.abs(fromDegrees) === 90;
              assetRotationAnimationsRef.current.set(asset.id, {
                roomId: room.id,
                assetId: asset.id,
                fromDegrees,
                toDegrees,
                baseWidthMm: usesSidewaysBaseDimensions ? prevAsset.depthMm : prevAsset.widthMm,
                baseDepthMm: usesSidewaysBaseDimensions ? prevAsset.widthMm : prevAsset.depthMm,
                startMs: performance.now(),
                durationMs: ASSET_ROTATION_DURATION_MS,
              });
              anyAdded = true;
            }
          }
          if (anyAdded) {
            startAssetRotationAnimation();
          }
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
        onOpeningMoveUiChange: (openingMoveUi) => {
          openingMoveUiRef.current = openingMoveUi;
        },
        onTransformFeedbackChange: (feedback) => {
          setTransformFeedback(feedback);
        },
        onSnapGuidesChange: (guides) => {
          snapGuidesRef.current = guides;
        },
        onDraftConstraintModeChange: (mode) => {
          draftConstraintModeRef.current = mode;
        },
        onInteriorAssetDragTargetChange: (roomId) => {
          assetDragTargetRoomIdRef.current = roomId;
        },
        onRulerInteractionUiChange: (rulerUi) => {
          rulerInteractionUiRef.current = rulerUi;
          drawCurrentScene();
        },
        requestRender: () => {
          drawCurrentScene();
        },
      });
      const clearWallSplitTooltipTimeout = () => {
        if (!wallSplitTooltipTimeoutRef.current) return;
        clearTimeout(wallSplitTooltipTimeoutRef.current);
        wallSplitTooltipTimeoutRef.current = null;
      };
      const setWallSplitHoverUi = (next: WallSplitHoverUi | null) => {
        const current = wallSplitHoverUiRef.current;
        if (
          current?.roomId === next?.roomId &&
          current?.wall === next?.wall &&
          current?.tooltipVisible === next?.tooltipVisible
        ) {
          return;
        }
        wallSplitHoverUiRef.current = next;
        drawCurrentScene();
      };
      const clearWallSplitHoverUi = () => {
        clearWallSplitTooltipTimeout();
        setWallSplitHoverUi(null);
      };
      const scheduleWallSplitTooltip = (roomId: string, wall: RoomWall) => {
        if (wallSplitTooltipTimeoutRef.current) return;
        wallSplitTooltipTimeoutRef.current = setTimeout(() => {
          wallSplitTooltipTimeoutRef.current = null;
          const current = wallSplitHoverUiRef.current;
          if (!current || current.roomId !== roomId || current.wall !== wall) return;
          setWallSplitHoverUi({ roomId, wall, tooltipVisible: true });
        }, WALL_SPLIT_TOOLTIP_DELAY_MS);
      };
      const toCanvasPoint = (event: PointerEvent): ScreenPoint => {
        const rect = app.canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      };
      const setWallSplitCursor = (isHovered: boolean) => {
        if (!isHovered) return;
        app.canvas.style.cursor = "crosshair";
        document.body.style.cursor = "crosshair";
      };
      const onWallSplitPointerMove = (event: PointerEvent) => {
        if (event.buttons !== 0) {
          clearWallSplitHoverUi();
          return;
        }

        const state = useEditorStore.getState();
        const roomResizeUi = roomResizeUiRef.current;
        const targetRoomId = getSingleSelectedRoomIdForSplitAffordance(
          state.selectedRoomId,
          state.selection
        );
        if (!targetRoomId || state.roomDraft.points.length > 0 || roomResizeUi.activeRoomId) {
          clearWallSplitHoverUi();
          return;
        }

        const room =
          getVisibleRoomsForFocusedRoom(getRoomsForActiveFloor(state.document), state.focusedRoomId)
            .find((candidate) => candidate.id === targetRoomId) ?? null;
        if (!room) {
          clearWallSplitHoverUi();
          return;
        }

        const hoveredWall =
          roomResizeUi.hoveredRoomId === targetRoomId
            ? roomResizeUi.hoveredWallSegmentIndex ?? roomResizeUi.hoveredWall
            : null;
        const retainedWall =
          wallSplitHoverUiRef.current?.roomId === targetRoomId
            ? wallSplitHoverUiRef.current.wall
            : null;
        const candidateWalls = [hoveredWall, retainedWall].filter(
          (wall, index, walls): wall is RoomWall =>
            wall !== null && walls.findIndex((candidate) => candidate === wall) === index
        );
        const screenPoint = toCanvasPoint(event);

        for (const wall of candidateWalls) {
          const layout = getWallSplitHandleLayout(
            room,
            wall,
            state.camera,
            state.viewport,
            state.settings
          );
          if (!layout) continue;

          if (!hitTestWallSplitHandle(layout.center, screenPoint)) continue;

          setWallSplitCursor(true);
          const tooltipVisible =
            wallSplitHoverUiRef.current?.roomId === targetRoomId &&
            wallSplitHoverUiRef.current.wall === wall &&
            wallSplitHoverUiRef.current.tooltipVisible;
          setWallSplitHoverUi({ roomId: targetRoomId, wall, tooltipVisible });
          if (!tooltipVisible) {
            scheduleWallSplitTooltip(targetRoomId, wall);
          }
          return;
        }

        clearWallSplitTooltipTimeout();
        if (hoveredWall !== null) {
          setWallSplitHoverUi({ roomId: targetRoomId, wall: hoveredWall, tooltipVisible: false });
          return;
        }
        setWallSplitHoverUi(null);
      };
      const onWallSplitPointerLeave = () => {
        clearWallSplitHoverUi();
      };
      app.canvas.addEventListener("pointermove", onWallSplitPointerMove);
      app.canvas.addEventListener("pointerleave", onWallSplitPointerLeave);
      app.canvas.addEventListener("pointerdown", onWallSplitPointerLeave);

      // --- Vertex delete handle tooltip (delayed, mirrors wall-split pattern) ---
      const VERTEX_DELETE_TOOLTIP_DELAY_MS = 700;
      const clearVertexDeleteTooltipTimeout = () => {
        if (!vertexDeleteTooltipTimeoutRef.current) return;
        clearTimeout(vertexDeleteTooltipTimeoutRef.current);
        vertexDeleteTooltipTimeoutRef.current = null;
      };
      const setVertexDeleteHoverUi = (next: VertexDeleteHoverUi | null) => {
        const current = vertexDeleteHoverUiRef.current;
        if (
          current?.roomId === next?.roomId &&
          current?.vertexIndex === next?.vertexIndex &&
          current?.tooltipVisible === next?.tooltipVisible
        ) {
          return;
        }
        vertexDeleteHoverUiRef.current = next;
        drawCurrentScene();
      };
      const clearVertexDeleteHoverUi = () => {
        clearVertexDeleteTooltipTimeout();
        setVertexDeleteHoverUi(null);
      };
      const scheduleVertexDeleteTooltip = (roomId: string, vertexIndex: number) => {
        if (vertexDeleteTooltipTimeoutRef.current) return;
        vertexDeleteTooltipTimeoutRef.current = setTimeout(() => {
          vertexDeleteTooltipTimeoutRef.current = null;
          const current = vertexDeleteHoverUiRef.current;
          if (!current || current.roomId !== roomId || current.vertexIndex !== vertexIndex) return;
          setVertexDeleteHoverUi({ roomId, vertexIndex, tooltipVisible: true });
        }, VERTEX_DELETE_TOOLTIP_DELAY_MS);
      };
      const onVertexDeletePointerMove = (event: PointerEvent) => {
        if (event.buttons !== 0) {
          clearVertexDeleteHoverUi();
          return;
        }

        const state = useEditorStore.getState();
        const roomResizeUi = roomResizeUiRef.current;
        const targetRoomId = getSingleSelectedRoomIdForSplitAffordance(
          state.selectedRoomId,
          state.selection
        );
        if (!targetRoomId || state.roomDraft.points.length > 0 || roomResizeUi.activeRoomId) {
          clearVertexDeleteHoverUi();
          return;
        }

        const hoveredVertexIndex =
          roomResizeUi.hoveredRoomId === targetRoomId ? roomResizeUi.hoveredVertexIndex : null;
        if (hoveredVertexIndex === null) {
          clearVertexDeleteHoverUi();
          return;
        }

        const room =
          getVisibleRoomsForFocusedRoom(getRoomsForActiveFloor(state.document), state.focusedRoomId)
            .find((candidate) => candidate.id === targetRoomId) ?? null;
        if (!room) {
          clearVertexDeleteHoverUi();
          return;
        }

        const handleCenter = getVertexDeleteHandleCenter(
          room, hoveredVertexIndex, state.camera, state.viewport
        );
        const screenPoint = toCanvasPoint(event);

        if (!handleCenter || !hitTestVertexDeleteHandle(handleCenter, screenPoint)) {
          // Pointer is near the vertex but not yet over the × circle — clear the
          // tooltip schedule so the 700ms countdown only starts from the circle.
          clearVertexDeleteTooltipTimeout();
          if (hoveredVertexIndex !== null) {
            setVertexDeleteHoverUi({ roomId: targetRoomId, vertexIndex: hoveredVertexIndex, tooltipVisible: false });
          } else {
            setVertexDeleteHoverUi(null);
          }
          return;
        }

        const tooltipVisible =
          vertexDeleteHoverUiRef.current?.roomId === targetRoomId &&
          vertexDeleteHoverUiRef.current.vertexIndex === hoveredVertexIndex &&
          vertexDeleteHoverUiRef.current.tooltipVisible;
        setVertexDeleteHoverUi({ roomId: targetRoomId, vertexIndex: hoveredVertexIndex, tooltipVisible });
        if (!tooltipVisible) {
          scheduleVertexDeleteTooltip(targetRoomId, hoveredVertexIndex);
        }
      };
      const onVertexDeletePointerLeave = () => {
        clearVertexDeleteHoverUi();
      };
      app.canvas.addEventListener("pointermove", onVertexDeletePointerMove);
      app.canvas.addEventListener("pointerleave", onVertexDeletePointerLeave);
      app.canvas.addEventListener("pointerdown", onVertexDeletePointerLeave);

      return () => {
        app.canvas.removeEventListener("pointermove", onWallSplitPointerMove);
        app.canvas.removeEventListener("pointerleave", onWallSplitPointerLeave);
        app.canvas.removeEventListener("pointerdown", onWallSplitPointerLeave);
        clearWallSplitTooltipTimeout();
        wallSplitHoverUiRef.current = null;
        app.canvas.removeEventListener("pointermove", onVertexDeletePointerMove);
        app.canvas.removeEventListener("pointerleave", onVertexDeletePointerLeave);
        app.canvas.removeEventListener("pointerdown", onVertexDeletePointerLeave);
        clearVertexDeleteTooltipTimeout();
        vertexDeleteHoverUiRef.current = null;
        detachPanZoomInput();
        detachRoomResizeInput();
        detachRoomDrawInput();
        unsubscribe();
        resizeObserver.disconnect();
        app.renderer.off("resize", handleResize);
        appRef.current = null;
        setIsCanvasReadyForExport(false);
        gridRef.current = null;
        floorFootprintRef.current = null;
        roomRef.current = null;
        openingRef.current = null;
        wallOverlayRef.current = null;
        roomLabelRef.current = null;
        draftRef.current = null;
        dimensionOverlayRef.current = null;
        setTransformFeedback(null);
        stopTransformAnimation();
        stopFootprintFadeAnimation();
      };
    }

    let teardown: (() => void) | undefined;
    init().then((cleanup) => {
      teardown = cleanup;
    });

    return () => {
      destroyed = true;
      teardown?.();
      stopFootprintFadeAnimation();
      if (initialized) {
        app.destroy(true, { children: true });
      }
    };
  }, [canvasBootstrapCallbacks]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    if (!app.renderer.background) return;

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
  const scaleOverlay = useMemo(
    () => getScaleOverlayState(overlayCamera, displayUnitOrigin),
    [overlayCamera, displayUnitOrigin]
  );
  const activeSnapStepMm = useMemo(() => getActiveSnapStepMm(overlayCamera), [overlayCamera]);
  const snappingEnabled = useEditorStore((state) => state.settings.snappingEnabled);
  const hydratedSnappingEnabled = hasHydratedClient
    ? snappingEnabled
    : DEFAULT_EDITOR_SETTINGS.snappingEnabled;
  const showCanvasHud = useEditorStore((state) => state.settings.showCanvasHud);
  const showMiniMap = useEditorStore((state) => state.settings.showMiniMap);
  const hydratedShowCanvasHud = hasHydratedClient
    ? showCanvasHud
    : DEFAULT_EDITOR_SETTINGS.showCanvasHud;
  const hydratedShowMiniMap = hasHydratedClient
    ? showMiniMap
    : DEFAULT_EDITOR_SETTINGS.showMiniMap;
  const [isCanvasHudPresent, setIsCanvasHudPresent] = useState(hydratedShowCanvasHud);
  const canvasHudHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldShowMiniMap = hydratedShowCanvasHud && hydratedShowMiniMap && hasRooms;
  const [isMiniMapPresent, setIsMiniMapPresent] = useState(shouldShowMiniMap);
  const miniMapHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isMobile } = useMobile();
  const [isPortraitViewport, setIsPortraitViewport] = useState(false);
  const [isCompactLandscapeViewport, setIsCompactLandscapeViewport] = useState(false);
  const [isLandscapeViewport, setIsLandscapeViewport] = useState(false);
  const {
    isLeftSidebarCollapsed,
    setIsLeftSidebarCollapsed,
    isDesktopInspectorCollapsed,
    setIsDesktopInspectorCollapsed,
    isPortraitInspectorCollapsed,
    setIsPortraitInspectorCollapsed,
  } = usePersistentPanelState(projectId);
  const hasInitializedMobileSidebarRef = useRef(false);
  
  // Determine which inspector card to show based on selection
  const getInspectorContent = (isCompact: boolean) => {
    if (selectedNorthIndicator) {
      return isCompact ? <SelectedNorthInspector /> : <SelectedNorthInspector className="h-full" />;
    }
    
    if (roomDraftPointCount > 0) {
      return isCompact ? <RoomDrawingInspector /> : <RoomDrawingInspector className="h-full" />;
    }

    if (isRulerMode) {
      return isCompact ? <RulerInspector /> : <RulerInspector className="h-full" />;
    }

    // Get the last selected item from the selection array
    const selectedItem = selection.length > 0 ? selection[selection.length - 1] : null;
    
    if (selectedItem) {
      if (selectedItem.type === "floor") {
        return isCompact ? (
          <SelectedFloorInspector />
        ) : (
          <SelectedFloorInspector className="h-full" />
        );
      } else if (selectedItem.type === "room") {
        return isCompact ? (
          <SelectedRoomNamePanel />
        ) : (
          <SelectedRoomNamePanel className="h-full" />
        );
      } else if (selectedItem.type === "wall") {
        // Show wall inspector
        const room = rooms.find((r) => r.id === selectedItem.roomId);
        if (room) {
          return isCompact ? (
            <SelectedWallInspector room={room} wall={selectedItem.wall} />
          ) : (
            <SelectedWallInspector room={room} wall={selectedItem.wall} className="h-full" />
          );
        }
      } else if (selectedItem.type === "opening") {
        // Show opening inspector if available
        const room = rooms.find((r) => r.id === selectedItem.roomId);
        const opening = room?.openings.find((o) => o.id === selectedItem.openingId);
        if (opening) {
          return isCompact ? (
            <SelectedOpeningInspector opening={opening} />
          ) : (
            <SelectedOpeningInspector opening={opening} className="h-full" />
          );
        }
        // Fallback to room if opening not found
        if (room) {
          return isCompact ? (
            <SelectedRoomNamePanel />
          ) : (
            <SelectedRoomNamePanel className="h-full" />
          );
        }
      } else if (selectedItem.type === "asset") {
        // Show asset inspector if available
        const room = rooms.find((r) => r.id === selectedItem.roomId);
        const asset = room?.interiorAssets.find((a) => a.id === selectedItem.id);
        if (asset) {
          return isCompact ? (
            <SelectedInteriorAssetInspector asset={asset} />
          ) : (
            <SelectedInteriorAssetInspector asset={asset} className="h-full" />
          );
        }
        // Fallback to room if asset not found
        if (room) {
          return isCompact ? (
            <SelectedRoomNamePanel />
          ) : (
            <SelectedRoomNamePanel className="h-full" />
          );
        }
      }
    }

    // Fallback: show floor or empty state
    if (selectedFloorId) {
      return isCompact ? (
        <SelectedFloorInspector />
      ) : (
        <SelectedFloorInspector className="h-full" />
      );
    }

    return isCompact ? (
      <EditorInspectorEmptyState />
    ) : (
      <EditorInspectorEmptyState className="h-full" />
    );
  };
  
  const inspectorContent = getInspectorContent(false);
  const compactInspectorContent = getInspectorContent(true);
  const usesPortraitBottomInspector = isMobile && isPortraitViewport;
  const isCompactLandscapeInspector = isCompactLandscapeViewport && !isPortraitViewport;
  const canvasBackgroundCss = `#${editorTheme.canvasBackground.toString(16).padStart(6, "0")}`;
  const useCompactHud = isMobile || isLandscapeViewport;
  const useCompactMobileControls = isMobile || isCompactLandscapeViewport;
  const shouldShowTouchZoomControls = isMobile || isCompactLandscapeViewport;
  const shouldShowTouchCancelButton = (isMobile || isCompactLandscapeViewport) && roomDraftPointCount > 0;
  const shouldShowRulerCancelButton = (isMobile || isCompactLandscapeViewport) && isRulerMode && rulerDraftHasStart;
  const expandedLeftSidebarWidth = isMobile
    ? MOBILE_SIDEBAR_EXPANDED_WIDTH_CSS
    : isCompactLandscapeViewport
      ? COMPACT_LANDSCAPE_SIDEBAR_EXPANDED_WIDTH_CSS
      : `${DESKTOP_SIDEBAR_EXPANDED_WIDTH_PX}px`;
  const leftSidebarWidth = leftSidebarContent
    ? isLeftSidebarCollapsed
      ? `${DESKTOP_SIDEBAR_COLLAPSED_WIDTH_PX}px`
      : expandedLeftSidebarWidth
    : null;
  const sidebarCollapseControl = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={isLeftSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={() => setIsLeftSidebarCollapsed((current) => !current)}
      className="size-8 rounded-lg text-foreground/72 hover:bg-muted/80 hover:text-foreground"
    >
      {isLeftSidebarCollapsed ? (
        <PanelLeftExpand className="size-4" />
      ) : (
        <PanelLeftCollapse className="size-4" />
      )}
    </Button>
  );
  const resolvedLeftSidebarContent =
    typeof leftSidebarContent === "function"
      ? leftSidebarContent({
          sidebarCollapseControl,
          isLeftSidebarCollapsed,
        })
      : leftSidebarContent;
  const rightInspectorWidth = usesPortraitBottomInspector
    ? null
    : isDesktopInspectorCollapsed
      ? `${DESKTOP_INSPECTOR_COLLAPSED_WIDTH_PX}px`
      : isCompactLandscapeInspector
        ? COMPACT_LANDSCAPE_INSPECTOR_EXPANDED_WIDTH_CSS
        : `${DESKTOP_INSPECTOR_EXPANDED_WIDTH_PX}px`;
  const editorGridTemplateColumns = [leftSidebarWidth, "minmax(0,1fr)", rightInspectorWidth]
    .filter((value): value is string => value !== null)
    .join(" ");
  const [renderedRoomPresetPicker, setRenderedRoomPresetPicker] = useState<{
    center: ScreenPoint;
    compact: boolean;
    isExiting: boolean;
  } | null>(null);
  const roomPresetPickerPosition = useMemo(() => {
    if (!roomPresetPickerRoomId || viewport.width <= 0 || viewport.height <= 0) return null;
    const room = rooms.find((candidate) => candidate.id === roomPresetPickerRoomId);
    if (!room) return null;
    const anchor = getPolygonLabelAnchor(room.points);
    if (!anchor) return null;

    const screenCenter = worldToScreen(anchor, camera, viewport);
    const radius = useCompactHud ? ROOM_PRESET_PICKER_COMPACT_RADIUS_PX : ROOM_PRESET_PICKER_RADIUS_PX;
    const buttonSize = useCompactHud
      ? ROOM_PRESET_PICKER_COMPACT_BUTTON_SIZE_PX
      : ROOM_PRESET_PICKER_BUTTON_SIZE_PX;
    const halfSize = radius + buttonSize / 2;
    const margin = ROOM_PRESET_PICKER_VIEWPORT_MARGIN_PX + halfSize;

    return {
      x: clampValue(screenCenter.x, margin, Math.max(margin, viewport.width - margin)),
      y: clampValue(screenCenter.y, margin, Math.max(margin, viewport.height - margin)),
    };
  }, [camera, roomPresetPickerRoomId, rooms, useCompactHud, viewport]);

  useEffect(() => {
    if (roomPresetPickerPosition) {
      setRenderedRoomPresetPicker({
        center: roomPresetPickerPosition,
        compact: useCompactHud,
        isExiting: false,
      });
      return;
    }

    setRenderedRoomPresetPicker((current) =>
      current && !current.isExiting ? { ...current, isExiting: true } : current
    );
  }, [roomPresetPickerPosition, useCompactHud]);

  useEffect(() => {
    if (!renderedRoomPresetPicker?.isExiting) return;

    const timeout = window.setTimeout(
      () => {
        setRenderedRoomPresetPicker((current) => (current?.isExiting ? null : current));
      },
      prefersReducedMotion ? 0 : ROOM_PRESET_PICKER_EXIT_MS
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [prefersReducedMotion, renderedRoomPresetPicker?.isExiting]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const portraitMediaQuery = window.matchMedia("(orientation: portrait)");
    const compactLandscapeMediaQuery = window.matchMedia("(max-height: 540px) and (orientation: landscape)");
    const landscapeMediaQuery = window.matchMedia("(orientation: landscape)");
    const updateIsPortraitViewport = () => {
      setIsPortraitViewport(portraitMediaQuery.matches);
      setIsCompactLandscapeViewport(compactLandscapeMediaQuery.matches);
      setIsLandscapeViewport(landscapeMediaQuery.matches);
    };

    updateIsPortraitViewport();
    portraitMediaQuery.addEventListener("change", updateIsPortraitViewport);
    compactLandscapeMediaQuery.addEventListener("change", updateIsPortraitViewport);
    landscapeMediaQuery.addEventListener("change", updateIsPortraitViewport);

    return () => {
      portraitMediaQuery.removeEventListener("change", updateIsPortraitViewport);
      compactLandscapeMediaQuery.removeEventListener("change", updateIsPortraitViewport);
      landscapeMediaQuery.removeEventListener("change", updateIsPortraitViewport);
    };
  }, []);

  useEffect(() => {
    if (!isCompactLandscapeInspector) {
      return;
    }

    setIsDesktopInspectorCollapsed(true);
  }, [isCompactLandscapeInspector, setIsDesktopInspectorCollapsed]);

  useEffect(() => {
    // Only set sidebar to collapsed on mobile on first mount
    // Don't overwrite the persisted mobile state on every render
    if (isMobile && !hasInitializedMobileSidebarRef.current) {
      hasInitializedMobileSidebarRef.current = true;
      setIsLeftSidebarCollapsed(true);
    }
  }, [isMobile, setIsLeftSidebarCollapsed]);

  useEffect(() => {
    if (!usesPortraitBottomInspector) {
      return;
    }

    setIsPortraitInspectorCollapsed(true);
  }, [usesPortraitBottomInspector, setIsPortraitInspectorCollapsed]);

  useEffect(() => {
    if (canvasHudHideTimeoutRef.current) {
      clearTimeout(canvasHudHideTimeoutRef.current);
      canvasHudHideTimeoutRef.current = null;
    }

    if (hydratedShowCanvasHud) {
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
  }, [hydratedShowCanvasHud, isCanvasHudPresent]);

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

  const handleZoomIn = useCallback(() => {
    zoomAtScreenPoint(
      { x: viewport.width / 2, y: viewport.height / 2 },
      ZOOM_STEP
    );
  }, [viewport.height, viewport.width, zoomAtScreenPoint]);

  const handleZoomOut = useCallback(() => {
    zoomAtScreenPoint(
      { x: viewport.width / 2, y: viewport.height / 2 },
      1 / ZOOM_STEP
    );
  }, [viewport.height, viewport.width, zoomAtScreenPoint]);

  return (
    <section
      ref={sectionRef}
      aria-label="SpaceForge floor plan editor canvas"
      aria-describedby={instructionsId}
      role="region"
      className={cn(
        "relative grid h-full w-full",
        usesPortraitBottomInspector
          ? "grid-rows-[auto_minmax(0,1fr)_auto]"
          : "grid-rows-[auto_minmax(0,1fr)]"
      )}
    >
      <style>{`
        @keyframes floorIndicatorMorphDown {
          0% {
            height: 32px;
            top: var(--old-floor-top);
          }
          50% {
            height: var(--full-height);
            top: var(--old-floor-top);
          }
          100% {
            height: 32px;
            top: var(--new-floor-top);
          }
        }

        @keyframes floorIndicatorMorphUp {
          0% {
            height: 32px;
            top: var(--old-floor-top);
          }
          50% {
            height: var(--full-height);
            top: var(--new-floor-top);
          }
          100% {
            height: 32px;
            top: var(--new-floor-top);
          }
        }

        @keyframes floorTextMaskDown {
          0% {
            background-position: 0 0%;
          }
          100% {
            background-position: 0 100%;
          }
        }

        @keyframes floorTextMaskUp {
          0% {
            background-position: 0 100%;
          }
          100% {
            background-position: 0 0%;
          }
        }

        @keyframes roomPresetPickerSpring {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.82);
          }
          36% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.052);
          }
          58% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.986);
          }
          76% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.012);
          }
          90% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.998);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes roomPresetPickerExit {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.92);
          }
        }

        [data-floor-text-animating-down],
        [data-floor-text-animating-up] {
          background: linear-gradient(180deg, rgb(113, 113, 122) 0%, rgb(113, 113, 122) 48%, rgb(250, 250, 250) 52%, rgb(250, 250, 250) 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-size: 100% 200%;
        }

        [data-floor-text-animating-down] {
          animation: floorTextMaskDown 200ms cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        [data-floor-text-animating-up] {
          animation: floorTextMaskUp 200ms cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        [data-floor-indicator-animating="true"][data-floor-direction="down"] {
          animation: floorIndicatorMorphDown 200ms cubic-bezier(0.4, 0, 0.6, 1) forwards;
          will-change: height, top;
        }

        [data-floor-indicator-animating="true"][data-floor-direction="up"] {
          animation: floorIndicatorMorphUp 200ms cubic-bezier(0.4, 0, 0.6, 1) forwards;
          will-change: height, top;
        }

        [data-floor-text-animating-down],
        [data-floor-text-animating-up] {
          background: linear-gradient(180deg, 
            var(--text-normal-color, currentColor) 0%, 
            var(--text-normal-color, currentColor) 48%, 
            var(--text-contrast-color, currentColor) 52%, 
            var(--text-contrast-color, currentColor) 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: none;
        }

        [data-floor-text-animating-down] {
          animation: floorTextMaskDown 200ms cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        [data-floor-text-animating-up] {
          animation: floorTextMaskUp 200ms cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }
      `}</style>
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
      <div
        className="grid min-h-0 gap-3 p-3 transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:gap-4 sm:p-4 [@media(max-height:540px)_and_(orientation:landscape)]:gap-2.5 [@media(max-height:540px)_and_(orientation:landscape)]:p-2.5"
        style={{ gridTemplateColumns: editorGridTemplateColumns }}
      >
        {leftSidebarContent ? (
          <aside
            className="min-h-0"
            aria-label="Project sidebar"
            style={{
              width: leftSidebarWidth ?? undefined,
              transition: "width 300ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="relative flex h-full w-full overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm dark:border-border/70 dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              {isLeftSidebarCollapsed ? (
                <ImmediateTooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 [@media(max-height:540px)_and_(orientation:landscape)]:top-1.5 [@media(max-height:540px)_and_(orientation:landscape)]:right-1.5">
                        {sidebarCollapseControl}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start">
                      Expand sidebar
                    </TooltipContent>
                  </Tooltip>
                </ImmediateTooltipProvider>
              ) : null}
              <div
                className={cn(
                  "min-h-0 flex-1 overflow-hidden px-2 pt-2 pb-2 transition-[opacity,transform] duration-200 ease-out [@media(max-height:540px)_and_(orientation:landscape)]:pt-1.5",
                  isLeftSidebarCollapsed
                    ? "pointer-events-none -translate-x-2 opacity-0"
                    : "translate-x-0 opacity-100"
                )}
                aria-hidden={isLeftSidebarCollapsed}
              >
                {resolvedLeftSidebarContent}
              </div>
            </div>
          </aside>
        ) : null}
        <div
          className="relative min-h-0 overflow-hidden rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
          style={{ backgroundColor: canvasBackgroundCss }}
        >
          <div
            ref={containerRef}
            tabIndex={-1}
            className="h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {isCanvasHudPresent ? (
            <div
              className={cn(
                "pointer-events-none absolute z-10 flex items-end transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                useCompactHud
                  ? isPortraitViewport
                    ? "bottom-2 left-2 gap-1.5"
                    : "left-2 bottom-2 gap-1.5"
                  : "bottom-3 left-3 gap-2 sm:bottom-4 sm:left-4",
                hydratedShowCanvasHud
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-1 scale-[0.985] opacity-0"
              )}
            >
              <CanvasHudCard className={useCompactHud ? "px-2.5 py-1.5" : undefined}>
                <div
                  className={cn(
                    "font-medium tracking-[0.04em] text-foreground/72",
                    useCompactHud ? "text-[10px]" : "text-[11px]"
                  )}
                  style={{ fontFamily: MEASUREMENT_TEXT_FONT_FAMILY }}
                >
                  {scaleOverlay.label}
                </div>
                <div
                  className={cn("mt-1 border-x border-t border-foreground/70", useCompactHud ? "h-1.5" : "h-2")}
                  style={{ width: `${useCompactHud ? Math.round(scaleOverlay.widthPx * 0.78) : scaleOverlay.widthPx}px` }}
                />
                <div
                  className={cn("mt-1 text-muted-foreground", useCompactHud ? "text-[10px]" : "text-[11px]")}
                  style={{ fontFamily: MEASUREMENT_TEXT_FONT_FAMILY }}
                >
                  {hydratedSnappingEnabled
                    ? `Grid ${formatGridStepDimension(activeSnapStepMm, displayUnitOrigin)} · Magnet On`
                    : `Grid ${formatGridStepDimension(activeSnapStepMm, displayUnitOrigin)}`}
                </div>
              </CanvasHudCard>
              <NorthIndicatorControl
                bearingDegrees={hydratedNorthBearingDegrees}
                viewRotationDegrees={hydratedCanvasRotationDegrees}
                surfaceState={northIndicatorSurfaceState}
                isDragging={northDragTooltip !== null}
                onPointerDown={handleNorthIndicatorPointerDown}
                onPointerEnter={() => setIsNorthIndicatorHovered(true)}
                onPointerLeave={() => setIsNorthIndicatorHovered(false)}
                compact={useCompactHud}
              />
              {CANVAS_ROTATION_ENABLED ? (
                <div
                  ref={canvasRotationIndicatorSlotRef}
                  className={cn("relative shrink-0", useCompactHud ? "h-11 w-11" : "h-14 w-14")}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CanvasRotationIndicatorControl
                      rotationDegrees={hydratedCanvasRotationDegrees}
                      northBearingDegrees={hydratedNorthBearingDegrees}
                      surfaceState={canvasRotationIndicatorSurfaceState}
                      onReset={resetCanvasRotation}
                      compact={useCompactHud}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {hasMountedClient && floors.length > 1 ? (
            <div
              className={cn(
                "pointer-events-none absolute left-3 top-3 z-20 transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:left-4 sm:top-4 translate-x-0 opacity-100"
              )}
            >
              <div
                className="pointer-events-auto rounded-full border border-border/70 bg-background/90 p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.14)] backdrop-blur-sm dark:bg-zinc-950/78 dark:shadow-[0_10px_28px_rgba(0,0,0,0.3)]"
                onPointerLeave={() => setHoveredFloorPreviewId(null)}
              >
                <div className="relative flex flex-col gap-1.5" ref={floorButtonsContainerRef}>
                  {isFloorAnimating && previousActiveFloorId && activeFloorId && (
                    (() => {
                      const oldFloorIdx = displayedFloors.findIndex((f) => f.id === previousActiveFloorId);
                      const newFloorIdx = displayedFloors.findIndex((f) => f.id === activeFloorId);
                      const oldButton = floorButtonRefsMap.current.get(previousActiveFloorId);
                      const newButton = floorButtonRefsMap.current.get(activeFloorId);
                      
                      if (oldButton && newButton && oldFloorIdx >= 0 && newFloorIdx >= 0) {
                        const oldTop = oldButton.offsetTop;
                        const newTop = newButton.offsetTop;
                        const isMovingDown = newTop > oldTop;
                        const minTop = Math.min(oldTop, newTop);
                        const maxTop = Math.max(oldTop, newTop);
                        const fullHeight = maxTop - minTop + 32;
                        
                        return (
                          <div
                            data-floor-indicator-animating="true"
                            data-floor-direction={isMovingDown ? "down" : "up"}
                            className="absolute left-0 right-0 z-20 rounded-full bg-zinc-900 dark:bg-zinc-100 transition-none pointer-events-none"
                            style={{
                              "--old-floor-top": `${oldTop}px`,
                              "--new-floor-top": `${newTop}px`,
                              "--full-height": `${fullHeight}px`,
                            } as React.CSSProperties}
                          />
                        );
                      }
                      return null;
                    })()
                  )}
                  {displayedFloors.map((floor, floorIndex) => {
                    const isActiveFloor = floor.id === activeFloorId && !isFloorAnimating;
                    const floorNumber = displayedFloors.length - floorIndex;
                    
                    // Determine if this floor is in the animation path (but not the starting floor)
                    let isInAnimationPath = false;
                    let animationDirection: "down" | "up" | null = null;
                    if (isFloorAnimating && previousActiveFloorId && activeFloorId) {
                      const oldFloorIdx = displayedFloors.findIndex((f) => f.id === previousActiveFloorId);
                      const newFloorIdx = displayedFloors.findIndex((f) => f.id === activeFloorId);
                      const minIdx = Math.min(oldFloorIdx, newFloorIdx);
                      const maxIdx = Math.max(oldFloorIdx, newFloorIdx);
                      // Exclude the source floor from contrasting color during animation
                      isInAnimationPath = floorIndex >= minIdx && floorIndex <= maxIdx && floor.id !== previousActiveFloorId;
                      animationDirection = newFloorIdx > oldFloorIdx ? "down" : "up";
                    }

                    return (
                      <button
                        key={floor.id}
                        type="button"
                        ref={(el) => {
                          if (el) {
                            floorButtonRefsMap.current.set(floor.id, el);
                          }
                        }}
                        onClick={() => selectFloorById(floor.id)}
                        onPointerEnter={() => setHoveredFloorPreviewId(floor.id)}
                        onPointerMove={() => setHoveredFloorPreviewId(floor.id)}
                        onPointerLeave={() => setHoveredFloorPreviewId(null)}
                        onPointerCancel={() => setHoveredFloorPreviewId(null)}
                        onFocus={() => setHoveredFloorPreviewId(floor.id)}
                        onBlur={() => setHoveredFloorPreviewId(null)}
                        aria-pressed={isActiveFloor}
                        aria-label={`Switch to ${floor.name}`}
                        data-floor-text-animating-down={animationDirection === "down" && isInAnimationPath ? "" : undefined}
                        data-floor-text-animating-up={animationDirection === "up" && isInAnimationPath ? "" : undefined}
                        className={cn(
                          "relative z-10 flex items-center justify-center rounded-full w-8 h-8 text-sm font-medium",
                          !isFloorAnimating && "transition-colors",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          !isInAnimationPath && (isActiveFloor
                            ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950"
                            : "text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-50")
                        )}
                        style={{ 
                          fontFamily: MEASUREMENT_TEXT_FONT_FAMILY,
                          "--text-normal-color": "rgb(113, 113, 122)",
                          "--text-contrast-color": "rgb(250, 250, 250)",
                        } as React.CSSProperties}
                      >
                        <span>{floorNumber}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          {shouldShowTouchCancelButton || shouldShowRulerCancelButton || shouldShowTouchZoomControls || roomDraftPointCount > 0 ? (
            <div
              className={cn(
                "pointer-events-none absolute z-20 flex flex-col items-end sm:top-4 sm:right-4",
                useCompactMobileControls ? "top-2 right-2 gap-1.5" : "top-3 right-3 gap-2"
              )}
            >
              {shouldShowTouchZoomControls ? (
                <ButtonGroup
                  className={cn(
                    "pointer-events-auto flex-col border border-border/70 bg-background/90 backdrop-blur-sm dark:bg-zinc-950/78",
                    useCompactMobileControls ? "rounded-2xl" : "rounded-xl"
                  )}
                >
                  <div data-slot="button-group-item">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Zoom in"
                      onClick={handleZoomIn}
                      className={cn(useCompactMobileControls && "size-9 rounded-xl")}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <div data-slot="button-group-item">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Zoom out"
                      onClick={handleZoomOut}
                      className={cn(useCompactMobileControls && "size-9 rounded-xl")}
                    >
                      <Minus className="size-4" />
                    </Button>
                  </div>
                </ButtonGroup>
              ) : null}
              {roomDraftPointCount > 0 ? (
                <ImmediateTooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Toggle
                        pressed={is45DegreeDrawingEnabled}
                        onPressedChange={handleToggle45DegreeDrawing}
                        variant="toolbar"
                        size={useCompactMobileControls ? "icon-sm" : "icon"}
                        data-active={is45DegreeDrawingEnabled || isShiftKeyPressed}
                        className={cn(
                          "pointer-events-auto shadow-[0_8px_24px_rgba(15,23,42,0.2)]",
                          useCompactMobileControls && "size-9 rounded-xl"
                        )}
                        aria-label="Enable 45 degree angles"
                      >
                        <IconAngle className="size-4" />
                      </Toggle>
                    </TooltipTrigger>
                    <TooltipContent side="left" sideOffset={12}>
                      <div className="flex items-center gap-2">
                        <span>Enable 45° angles</span>
                        <KbdGroup>
                          <Kbd>Shift</Kbd>
                        </KbdGroup>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </ImmediateTooltipProvider>
              ) : null}
              {shouldShowTouchCancelButton ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  aria-label="Cancel drawing"
                  onClick={resetDraft}
                  className={cn(
                    "pointer-events-auto shadow-[0_8px_24px_rgba(15,23,42,0.2)]",
                    useCompactMobileControls && "size-9 rounded-xl"
                  )}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
              {shouldShowRulerCancelButton ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  aria-label="Cancel ruler"
                  onClick={resetRulerDraft}
                  className={cn(
                    "pointer-events-auto shadow-[0_8px_24px_rgba(15,23,42,0.2)]",
                    useCompactMobileControls && "size-9 rounded-xl"
                  )}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
          ) : null}
          {isMiniMapPresent ? (
            <div
              className={cn(
                "pointer-events-none absolute z-10 transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                useCompactHud
                  ? isPortraitViewport
                    ? "right-2 bottom-2"
                    : "right-2 bottom-2"
                  : "bottom-4 right-4 [@media(max-height:540px)_and_(orientation:landscape)]:bottom-3 [@media(max-height:540px)_and_(orientation:landscape)]:right-3",
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
                compact={useCompactHud}
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
          {renderedRoomPresetPicker ? (
            <RoomPresetPickerOverlay
              center={renderedRoomPresetPicker.center}
              compact={renderedRoomPresetPicker.compact}
              prefersReducedMotion={prefersReducedMotion}
              isExiting={renderedRoomPresetPicker.isExiting}
              options={ROOM_PRESET_PICKER_OPTIONS}
              region={displayUnitOrigin}
              onSelectPreset={handleRoomPresetPickerSelect}
              onOther={handleRoomPresetPickerOther}
            />
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
        <aside
          aria-label="Editor inspector"
          className="min-h-0"
          style={{
            width: rightInspectorWidth ?? undefined,
            transition: "width 300ms cubic-bezier(0.22, 1, 0.36, 1)",
            display: usesPortraitBottomInspector ? "none" : undefined,
          }}
        >
          <div className="relative flex h-full w-full overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-border/70 dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
              <ImmediateTooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={isDesktopInspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
                        onClick={() => setIsDesktopInspectorCollapsed((current) => !current)}
                        className={cn(
                          "text-muted-foreground hover:text-foreground [@media(max-height:540px)_and_(orientation:landscape)]:top-1.5 [@media(max-height:540px)_and_(orientation:landscape)]:left-1.5",
                          useCompactMobileControls && "size-9 rounded-xl"
                        )}
                      >
                      {isDesktopInspectorCollapsed ? (
                        <PanelRightExpand className="size-4" />
                      ) : (
                        <PanelRightCollapse className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" align="start">
                    {isDesktopInspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
                  </TooltipContent>
                </Tooltip>
              </ImmediateTooltipProvider>
              <InspectorBreadcrumbHeader
                selection={selection}
                floors={floors}
                rooms={rooms}
                onSelectFloor={selectFloorById}
                onSelectRoom={selectRoomById}
                activeFloorId={selectedFloorId ?? undefined}
              />
            </div>
            <div
              className={cn(
                "min-h-0 flex-1 overflow-hidden px-2 pt-11 pb-2 transition-[opacity,transform] duration-200 ease-out [@media(max-height:540px)_and_(orientation:landscape)]:pt-10",
                isDesktopInspectorCollapsed
                  ? "pointer-events-none translate-x-2 opacity-0"
                  : "translate-x-0 opacity-100"
              )}
              aria-hidden={isDesktopInspectorCollapsed}
            >
              {inspectorContent}
            </div>
          </div>
        </aside>
      </div>
      {usesPortraitBottomInspector ? (
        <aside
          aria-label="Editor inspector"
          className="min-h-0 px-3 pb-0 sm:hidden"
          style={{
            height: isPortraitInspectorCollapsed
              ? `${MOBILE_PORTRAIT_INSPECTOR_COLLAPSED_HEIGHT_PX}px`
              : MOBILE_PORTRAIT_INSPECTOR_EXPANDED_HEIGHT_CSS,
            transition: "height 300ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className="flex h-full w-full flex-col overflow-hidden rounded-t-xl border border-zinc-200/80 border-b-0 bg-zinc-50/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-border/70 dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex h-11 shrink-0 items-center px-2">
              <ImmediateTooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={isPortraitInspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
                      onClick={() => setIsPortraitInspectorCollapsed((current) => !current)}
                      className={cn(
                        "text-muted-foreground hover:text-foreground",
                        useCompactMobileControls && "size-9 rounded-xl"
                      )}
                    >
                      {isPortraitInspectorCollapsed ? (
                        <PanelBottomExpand className="size-4" />
                      ) : (
                        <PanelBottomCollapse className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start">
                    {isPortraitInspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
                  </TooltipContent>
                </Tooltip>
              </ImmediateTooltipProvider>
            </div>
            <div
              className={cn(
                "min-h-0 flex-1 overflow-hidden px-2 pb-2 transition-[opacity,transform] duration-200 ease-out",
                isPortraitInspectorCollapsed
                  ? "pointer-events-none translate-y-2 opacity-0"
                  : "translate-y-0 opacity-100"
              )}
              aria-hidden={isPortraitInspectorCollapsed}
            >
              {compactInspectorContent}
            </div>
          </div>
        </aside>
      ) : null}
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

type RulerInteractionUi = {
  rulerId: string;
  target: "start" | "end" | "body";
  isDragging: boolean;
};

function drawScene(
  gridGraphics: Graphics,
  floorFootprintGraphics: Graphics,
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
  openingMoveUi: {
    roomId: string;
    openingId: string;
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
  wallSplitHoverUi: WallSplitHoverUi | null,
  vertexDeleteHoverUi: VertexDeleteHoverUi | null,
  rulerInteractionUi: RulerInteractionUi | null,
  transformFeedback: TransformFeedback | null,
  snapGuides: SnapGuides | null,
  draftConstraintMode: "orthogonal" | "diagonal45",
  theme: EditorCanvasTheme,
  hideCursorHud: boolean,
  footprintFloorId: string | null,
  footprintOpacity: number,
  assetDragTargetRoomId: string | null = null,
  animations: ReadonlyMap<string, AssetRotationAnimation> = new Map()
) {
  clearContainerChildren(roomLabelContainer);
  clearContainerChildren(dimensionOverlayContainer);
  const activeSnapStepMm = getActiveSnapStepMm(state.camera);
  const angleIndicatorLabel = getDraftAngleIndicatorLabel(
    state.roomDraft.points,
    cursorWorld,
    activeSnapStepMm,
    draftConstraintMode
  );
  if (angleIndicatorLabel && cursorWorld) {
    drawAngleIndicator(
      roomLabelContainer,
      worldToScreen(cursorWorld, state.camera, state.viewport),
      angleIndicatorLabel,
      theme
    );
  }
  const cursorSnapStepMm = getActiveSnapStepMm(state.camera);
  const isDraftActive = state.roomDraft.points.length > 0;
  const draftAnchorPoint = state.roomDraft.points[state.roomDraft.points.length - 1] ?? null;
  const predictiveGuides = isDraftActive && cursorWorld
    ? getPredictiveSnapGuides(getRoomsForActiveFloor(state.document), cursorWorld, state.camera, {
        constraintMode: draftConstraintMode,
        anchorPoint: draftAnchorPoint ?? undefined,
      })
    : null;
  const magneticGuides = isDraftActive && cursorWorld
    ? getMagneticSnapGuidesForSettings(
        getRoomsForActiveFloor(state.document),
        cursorWorld,
        state.camera,
        state.settings,
        { constraintMode: draftConstraintMode }
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
  const activeFloorRooms = getRoomsForActiveFloor(state.document);
  const visibleRooms = getVisibleRoomsForFocusedRoom(activeFloorRooms, state.focusedRoomId);
  const renderedRooms = getRenderedRoomsForTransform(visibleRooms, transformFeedback);
  const renderedLabelRooms = getRenderedRoomsForLabelTransform(visibleRooms, transformFeedback);
  
  // Get the peer room for linked staircases
  let linkedStaircasePeerRoom: Room | null = null;
  if (state.selectedInteriorAsset) {
    const selectedRoom = state.document.rooms.find(
      (room) => room.id === state.selectedInteriorAsset!.roomId
    );
    const selectedAsset = selectedRoom?.interiorAssets.find(
      (asset) => asset.id === state.selectedInteriorAsset!.assetId
    );
    if (selectedAsset?.connectionId) {
      for (const room of state.document.rooms) {
        for (const asset of room.interiorAssets) {
          if (
            asset.id !== selectedAsset.id &&
            asset.connectionId === selectedAsset.connectionId
          ) {
            linkedStaircasePeerRoom = room;
            break;
          }
        }
        if (linkedStaircasePeerRoom) break;
      }
    }
  }
  
  // Always clear floor footprint graphics, then draw the resolved persistent or hover preview footprint.
  floorFootprintGraphics.clear();
  if (footprintFloorId) {
    drawFloorFootprint(
      floorFootprintGraphics,
      getRoomsForFloor(state.document, footprintFloorId),
      state.camera,
      state.viewport,
      theme,
      state.settings.floorFootprintOpacity
    );
  }
  drawRooms(
    roomGraphics,
    renderedRooms,
    state.selectedRoomId,
    state.selection,
    roomResizeUi,
    state.roomDraft.points.length > 0,
    state.camera,
    state.viewport,
    transformFeedback,
    theme,
    state.settings.showRoomColors,
    assetDragTargetRoomId
  );
  
  // Draw linked staircase peer room as overlay (visible even when on different floor)
  if (
    !state.focusedRoomId &&
    linkedStaircasePeerRoom &&
    linkedStaircasePeerRoom.points.length >= 3
  ) {
    drawDashedRoomOutline(
      roomGraphics,
      linkedStaircasePeerRoom.points,
      state.camera,
      state.viewport,
      theme.wallSelectionAccent,
      2.5,
      0.5
    );
  }
  drawOpenings(
    openingGraphics,
    renderedRooms,
    state.selectedOpening,
    state.selection,
    state.camera,
    state.viewport,
    theme,
    state.settings.showAssets,
    {
      includeStairDirectionVisuals: true,
      showUnitOriginHighlights:
        state.settings.showUnitOriginHighlights &&
        getTierConfig(state.devSubscriptionTier).hasUnitOriginHighlight,
      displayUnitOrigin: state.document.region,
    },
    animations
  );
  drawWallInteractionOverlay(
    wallOverlayGraphics,
    renderedRooms,
    state.selectedWall,
    state.selection,
    hoveredSelectableWall,
    roomResizeUi,
    state.roomDraft.points.length > 0,
    state.camera,
    state.viewport,
    transformFeedback,
    theme
  );
  if (
    state.settings.showUnitOriginHighlights &&
    getTierConfig(state.devSubscriptionTier).hasUnitOriginHighlight
  ) {
    drawUnitOriginHighlights(
      wallOverlayGraphics,
      renderedRooms,
      state.document.rulerMeasurements,
      state.camera,
      state.viewport,
      state.settings.showAssets
    );
  }
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
    state.selection,
    state.settings.showRoomNames,
    state.settings.showAssets,
    state.settings.showAssetLabels,
    { includeStairDirectionLabels: true, displayUnitOrigin: state.document.region }
  );
  clearContainerChildren(dimensionOverlayContainer);
  drawOpeningMoveDimensions(
    dimensionOverlayContainer,
    renderedRooms,
    openingMoveUi,
    state.camera,
    state.viewport,
    state.settings,
    theme,
    state.document.region
  );
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
      theme,
      state.document.region
    );
    drawActiveResizeDimensions(
      dimensionOverlayContainer,
      renderedLabelRooms,
      roomResizeUi,
      state.camera,
      state.viewport,
      state.settings,
      theme,
      state.document.region
    );
    drawDraftDimensions(
      dimensionOverlayContainer,
      state.roomDraft.points,
      draftCursorWorld,
      state.camera,
      state.viewport,
      activeSnapStepMm,
      draftConstraintMode,
      state.settings,
      theme,
      state.document.region
    );
  }
  drawRulerDimensionLabels(
    dimensionOverlayContainer,
    state.document.rulerMeasurements,
    state.rulerDraft,
    state.camera,
    state.viewport,
    state.settings,
    theme,
    state.document.region
  );
  drawWallSplitHoverAffordance(
    dimensionOverlayContainer,
    renderedRooms,
    state.selectedRoomId,
    state.selection,
    roomResizeUi,
    wallSplitHoverUi,
    state.camera,
    state.viewport,
    state.settings,
    theme
  );
  drawVertexDeleteHoverAffordance(
    dimensionOverlayContainer,
    renderedRooms,
    state.selectedRoomId,
    state.selection,
    roomResizeUi,
    vertexDeleteHoverUi,
    state.camera,
    state.viewport,
    theme
  );
  drawDraft(
    draftGraphics,
    state.roomDraft.points,
    draftCursorWorld,
    state.camera,
    state.viewport,
    cursorSnapStepMm,
    activeSnapStepMm,
    draftConstraintMode,
    visibleGuides,
    state.isRulerMode
      ? {
          ...theme,
          interactiveAccent: RULER_ACCENT_COLOR,
          guidelineAccent: RULER_ACCENT_COLOR,
        }
      : theme,
    hideCursorHud
  );
  drawRulers(
    draftGraphics,
    state.document.rulerMeasurements,
    state.rulerDraft,
    state.selectedRulerId,
    rulerInteractionUi,
    state.camera,
    state.viewport
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

  if (GRID_MINOR_SIZE_MM * camera.pixelsPerMm >= MINOR_GRID_MIN_VISIBLE_PX) {
    drawGridLines(graphics, camera, viewport, minX, maxX, minY, maxY, GRID_MINOR_SIZE_MM, {
      width: 1,
      color: theme.gridMinor,
      alpha: 0.9,
    });
  }

  drawAlternatingGridLines(graphics, camera, viewport, minX, maxX, minY, maxY, GRID_SIZE_MM, {
    width: 1,
    color: theme.gridMajor,
    alpha: 0.8,
  }, {
    width: 2,
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

function drawFloorFootprint(
  graphics: Graphics,
  rooms: Room[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme,
  opacity: number
) {
  graphics.clear();
  if (rooms.length === 0 || opacity <= 0.01) return;

  for (const room of rooms) {
    if (room.points.length < 3) continue;
    drawRoomShape(
      graphics,
      room.points,
      camera,
      viewport,
      theme.originAxis,
      0,
      FLOOR_FOOTPRINT_STROKE_WIDTH_PX,
      FLOOR_FOOTPRINT_MAX_ALPHA * opacity
    );
  }
}

function drawRooms(
  graphics: Graphics,
  rooms: Room[],
  selectedRoomId: string | null,
  selection: SharedSelectionItem[],
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
  theme: EditorCanvasTheme,
  showRoomColors: boolean,
  assetDragTargetRoomId: string | null = null,
  options: {
    roomColors?: Record<string, string>;
    roomColorFillAlpha?: number;
    roomDefaultFillAlpha?: number;
  } = {}
) {
  graphics.clear();
  const selectedRoomCount = selection.filter((item) => item.type === "room").length;
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

  drawRoomsWallThickness(graphics, rooms, camera, viewport, theme);

  for (const room of rooms) {
    if (room.points.length < 3) continue;
    const isSelected = room.id === selectedRoomId || isRoomSelected(selection, room.id);
    const isAssetDragTarget = room.id === assetDragTargetRoomId;
    const roomColor = getRoomColorNumber(
      options.roomColors?.[room.id] ?? (showRoomColors ? room.roomColor : undefined)
    );
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
    const fillAlpha =
      roomColor !== null && !isSelected
        ? options.roomColorFillAlpha ?? 0.12
        : isSelected
          ? selectedFillAlpha
          : options.roomDefaultFillAlpha ?? 0.12;

    drawRoomShape(
      graphics,
      room.points,
      camera,
      viewport,
      isSelected ? theme.roomSelectionOutline : theme.roomOutline,
      fillAlpha,
      isSelected ? selectedStrokeWidth : 2,
      isSelected ? selectedStrokeAlpha : 0.9,
      roomColor ?? undefined
    );

    if (isAssetDragTarget) {
      drawRoomShape(
        graphics,
        room.points,
        camera,
        viewport,
        theme.roomSelectionOutline,
        0.1,
        2,
        0.45
      );
    }

    if (
      !isSelected ||
      selectedRoomCount > 1 ||
      isDraftingRoom ||
      isActiveTransformRoom
    ) continue;
    const declutter = getRoomDeclutterState(room, camera, viewport);
    if (!declutter.showSelectionControls) continue;
    const { vertexHandles, wallSegmentHandles } = getCachedRoomSelectionHandles(
      room,
      camera,
      viewport
    );

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
          length: handle.length,
          thickness: handle.thickness,
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

function isRoomSelected(selection: SharedSelectionItem[], roomId: string) {
  return selection.some((item) => item.type === "room" && item.id === roomId);
}

function getRoomColorNumber(roomColor: string | undefined): number | null {
  if (!roomColor || !/^#[0-9a-fA-F]{6}$/.test(roomColor)) return null;
  return Number.parseInt(roomColor.slice(1), 16);
}

function getVisibleRoomsForFocusedRoom(rooms: Room[], focusedRoomId: string | null): Room[] {
  if (!focusedRoomId) return rooms;
  const focusedRoom = rooms.find((room) => room.id === focusedRoomId);
  return focusedRoom ? [focusedRoom] : rooms;
}

function isWallSelected(selection: SharedSelectionItem[], roomId: string, wall: RoomWall) {
  return selection.some(
    (item) => item.type === "wall" && item.roomId === roomId && item.wall === wall
  );
}

function isOpeningSelected(selection: SharedSelectionItem[], roomId: string, openingId: string) {
  return selection.some(
    (item) => item.type === "opening" && item.roomId === roomId && item.openingId === openingId
  );
}

function getSingleOpeningSelectionForHandles(
  selectedOpening: RoomOpeningSelection | null,
  selection: SharedSelectionItem[]
): RoomOpeningSelection | null {
  const selectedOpenings = selection.filter(
    (item): item is Extract<SharedSelectionItem, { type: "opening" }> => item.type === "opening"
  );
  if (selectedOpenings.length === 1) {
    return {
      roomId: selectedOpenings[0].roomId,
      openingId: selectedOpenings[0].openingId,
    };
  }
  if (selectedOpenings.length > 1) return null;
  return selectedOpening;
}

function drawOpenings(
  graphics: Graphics,
  rooms: Room[],
  selectedOpening: RoomOpeningSelection | null,
  selection: SharedSelectionItem[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme,
  showAssets: boolean = true,
  options?: {
    includeStairDirectionVisuals?: boolean;
    showUnitOriginHighlights?: boolean;
    displayUnitOrigin?: UnitOrigin;
  },
  animations: ReadonlyMap<string, AssetRotationAnimation> = new Map()
) {
  graphics.clear();

  for (const room of rooms) {
    if (room.points.length < 3) continue;
    drawRoomOpenings(graphics, room, selectedOpening, selection, camera, viewport, theme, {
      showUnitOriginHighlights: options?.showUnitOriginHighlights,
      displayUnitOrigin: options?.displayUnitOrigin,
    });
    drawRoomInteriorAssets(graphics, room, selection, camera, viewport, theme, animations, showAssets);
  }
}

function drawWallInteractionOverlay(
  graphics: Graphics,
  rooms: Room[],
  selectedWall: RoomWallSelection | null,
  selection: SharedSelectionItem[],
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
    (selectedWall?.roomId === hoveredRoomId && selectedWall.wall === hoveredWall ||
      (hoveredRoomId !== null && isWallSelected(selection, hoveredRoomId, hoveredWall)));

  if (hoveredRoom && hoveredWall !== null && !isSelectedWallAlsoHovered) {
    drawHoveredWallHighlight(graphics, hoveredRoom, hoveredWall, camera, viewport, theme);
  }

  const selectedWalls = selection.filter(
    (item): item is Extract<SharedSelectionItem, { type: "wall" }> => item.type === "wall"
  );
  if (selectedWall && !isWallSelected(selectedWalls, selectedWall.roomId, selectedWall.wall)) {
    selectedWalls.push({ type: "wall", roomId: selectedWall.roomId, wall: selectedWall.wall });
  }

  for (const wallSelection of selectedWalls) {
    const selectedRoom = rooms.find((room) => room.id === wallSelection.roomId);
    if (!selectedRoom) continue;
    if (transformFeedback?.roomId === selectedRoom.id) continue;
    drawSelectedWallHighlight(graphics, selectedRoom, wallSelection.wall, camera, viewport, theme);
  }
}

function drawUnitOriginHighlights(
  graphics: Graphics,
  rooms: Room[],
  rulers: RulerMeasurement[],
  camera: CameraState,
  viewport: ViewportSize,
  showAssets: boolean
) {
  for (const room of rooms) {
    if (room.points.length < 3) continue;
    const roomColor = getUnitOriginHighlightColor(room.unitOrigin);
    drawRoomShape(
      graphics,
      room.points,
      camera,
      viewport,
      roomColor,
      UNIT_ORIGIN_ROOM_FILL_ALPHA,
      2.25,
      UNIT_ORIGIN_ROOM_STROKE_ALPHA
    );

    for (const asset of room.interiorAssets) {
      if (asset.type !== "stairs" && !showAssets) continue;
      const bounds = getRoomInteriorAssetBounds(asset);
      const corners = [
        worldToScreen({ x: bounds.left, y: bounds.top }, camera, viewport),
        worldToScreen({ x: bounds.right, y: bounds.top }, camera, viewport),
        worldToScreen({ x: bounds.right, y: bounds.bottom }, camera, viewport),
        worldToScreen({ x: bounds.left, y: bounds.bottom }, camera, viewport),
      ];
      const color = getUnitOriginHighlightColor(asset.unitOrigin);
      graphics.setFillStyle({ color, alpha: UNIT_ORIGIN_ASSET_FILL_ALPHA });
      graphics.moveTo(corners[0].x, corners[0].y);
      for (let index = 1; index < corners.length; index += 1) {
        graphics.lineTo(corners[index].x, corners[index].y);
      }
      graphics.closePath();
      graphics.fill();
      graphics.setStrokeStyle({
        width: Math.max(camera.pixelsPerMm * 34, 2),
        color,
        alpha: UNIT_ORIGIN_ASSET_STROKE_ALPHA,
      });
      graphics.moveTo(corners[0].x, corners[0].y);
      for (let index = 1; index < corners.length; index += 1) {
        graphics.lineTo(corners[index].x, corners[index].y);
      }
      graphics.closePath();
      graphics.stroke();
    }
  }

  for (const ruler of rulers) {
    if (ruler.hidden) continue;
    const start = worldToScreen(ruler.start, camera, viewport);
    const end = worldToScreen(ruler.end, camera, viewport);
    graphics.setStrokeStyle({
      width: Math.max(camera.pixelsPerMm * 38, 2),
      color: getUnitOriginHighlightColor(ruler.unitOrigin),
      alpha: UNIT_ORIGIN_LINEAR_ALPHA,
      cap: "round",
    });
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
    graphics.stroke();
  }
}

function getUnitOriginHighlightColor(unitOrigin: UnitOrigin | undefined): number {
  return normalizeUnitOrigin(unitOrigin) === "imperial"
    ? IMPERIAL_UNIT_ORIGIN_HIGHLIGHT_COLOR
    : METRIC_UNIT_ORIGIN_HIGHLIGHT_COLOR;
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
  strokeAlpha: number,
  fillColor?: number
) {
  const screenPoints = points.map((point) => worldToScreen(point, camera, viewport));

  graphics.setFillStyle({
    color: fillColor ?? strokeColor,
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

function drawRoomsWallThickness(
  graphics: Graphics,
  rooms: Room[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const rawWallLinesByRoom = rooms.map((room) => getRoomWallThicknessLines(room, rooms));
  const rawWallLines = rawWallLinesByRoom.flat();
  const wallLinesByRoom = rawWallLinesByRoom.map((roomWallLines) =>
    roomWallLines.map((wallLine) => trimExternalWallInsideCornerOverlap(wallLine, rawWallLines))
  );
  const wallLines = wallLinesByRoom.flat();
  const wallQuads = wallLinesByRoom.flatMap(getRoomWallThicknessQuads);

  for (const wallQuad of wallQuads) {
    const screenPoints = [
      worldToScreen(wallQuad.innerStart, camera, viewport),
      worldToScreen(wallQuad.innerEnd, camera, viewport),
      worldToScreen(wallQuad.outerEnd, camera, viewport),
      worldToScreen(wallQuad.outerStart, camera, viewport),
    ];

    graphics.setFillStyle({
      color: theme.roomOutline,
      alpha: wallQuad.isExternal ? EXTERNAL_WALL_FILL_ALPHA : INTERNAL_WALL_FILL_ALPHA,
    });
    graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let index = 1; index < screenPoints.length; index += 1) {
      graphics.lineTo(screenPoints[index].x, screenPoints[index].y);
    }
    graphics.closePath();
    graphics.fill();
  }

  drawExternalWallBridges(graphics, wallLines, camera, viewport, theme);
}

type RoomWallThicknessLine = {
  roomId: string;
  segmentIndex: number;
  spanStartMm: number;
  spanEndMm: number;
  innerStart: Point;
  innerEnd: Point;
  outerStart: Point;
  outerEnd: Point;
  direction: Point;
  outwardNormal: Point;
  renderThicknessMm: number;
  isExternal?: boolean;
};

type WallSpanInterval = {
  startMm: number;
  endMm: number;
  isExternal: boolean;
};

type RoomWallThicknessQuad = {
  innerStart: Point;
  innerEnd: Point;
  outerStart: Point;
  outerEnd: Point;
  isExternal?: boolean;
};

function getRoomWallThicknessLines(room: Room, rooms: Room[]): RoomWallThicknessLine[] {
  const wallLines: RoomWallThicknessLine[] = [];
  if (!room.wallSegments || room.points.length < 2) return wallLines;

  for (let wallIndex = 0; wallIndex < room.points.length; wallIndex += 1) {
    const segment = getRoomWallSegment(room, wallIndex);
    if (!segment?.thicknessMm || segment.thicknessMm <= 0 || segment.lengthMm <= 0) continue;

    const outwardNormal = {
      x: -segment.interiorNormal.x,
      y: -segment.interiorNormal.y,
    };
    const direction = {
      x: (segment.originalEnd.x - segment.originalStart.x) / segment.lengthMm,
      y: (segment.originalEnd.y - segment.originalStart.y) / segment.lengthMm,
    };
    const wallSpanIntervals = getWallSpanIntervals(room.id, segment, rooms, outwardNormal, direction);

    for (const spanInterval of wallSpanIntervals) {
      const innerStart = {
        x: segment.originalStart.x + direction.x * spanInterval.startMm,
        y: segment.originalStart.y + direction.y * spanInterval.startMm,
      };
      const innerEnd = {
        x: segment.originalStart.x + direction.x * spanInterval.endMm,
        y: segment.originalStart.y + direction.y * spanInterval.endMm,
      };
      const renderThicknessMm = spanInterval.isExternal
        ? getExternalWallRenderThicknessMm(room.id, innerStart, innerEnd, rooms, outwardNormal, direction)
        : (segment.thicknessMm ?? 0) / 2;
      const outerStart = {
        x: innerStart.x + outwardNormal.x * renderThicknessMm,
        y: innerStart.y + outwardNormal.y * renderThicknessMm,
      };
      const outerEnd = {
        x: innerEnd.x + outwardNormal.x * renderThicknessMm,
        y: innerEnd.y + outwardNormal.y * renderThicknessMm,
      };

      wallLines.push({
        roomId: room.id,
        segmentIndex: wallIndex,
        spanStartMm: spanInterval.startMm,
        spanEndMm: spanInterval.endMm,
        innerStart,
        innerEnd,
        outerStart,
        outerEnd,
        direction,
        outwardNormal,
        renderThicknessMm,
        isExternal: spanInterval.isExternal,
      });
    }
  }

  return wallLines;
}

function getRoomWallThicknessQuads(wallLines: RoomWallThicknessLine[]): RoomWallThicknessQuad[] {
  return wallLines.map((wallLine, index) => {
    const previousWallLine = wallLines[(index - 1 + wallLines.length) % wallLines.length];
    const nextWallLine = wallLines[(index + 1) % wallLines.length];

    return {
      innerStart: wallLine.innerStart,
      innerEnd: wallLine.innerEnd,
      outerStart: getWallMiterPoint(previousWallLine, wallLine, wallLine.outerStart, wallLine),
      outerEnd: getWallMiterPoint(wallLine, nextWallLine, wallLine.outerEnd, wallLine),
      isExternal: wallLine.isExternal,
    };
  });
}

function getWallMiterPoint(
  incomingWallLine: RoomWallThicknessLine | undefined,
  outgoingWallLine: RoomWallThicknessLine | undefined,
  fallbackPoint: Point,
  wallLine: RoomWallThicknessLine
): Point {
  if (!incomingWallLine || !outgoingWallLine) return fallbackPoint;
  if (incomingWallLine.roomId !== outgoingWallLine.roomId) return fallbackPoint;
  if (incomingWallLine.isExternal !== outgoingWallLine.isExternal) return fallbackPoint;
  if (incomingWallLine.segmentIndex === outgoingWallLine.segmentIndex) return fallbackPoint;
  if (Math.abs(incomingWallLine.renderThicknessMm - wallLine.renderThicknessMm) > 0.001) return fallbackPoint;
  if (Math.abs(outgoingWallLine.renderThicknessMm - wallLine.renderThicknessMm) > 0.001) return fallbackPoint;

  return (
    getLineIntersection(
      incomingWallLine.outerStart,
      incomingWallLine.direction,
      outgoingWallLine.outerStart,
      outgoingWallLine.direction
    ) ?? fallbackPoint
  );
}

function getWallSpanIntervals(
  roomId: string,
  segment: NonNullable<ReturnType<typeof getRoomWallSegment>>,
  rooms: Room[],
  outwardNormal: Point,
  direction: Point
): WallSpanInterval[] {
  const internalIntervals: Array<Pick<WallSpanInterval, "startMm" | "endMm">> = [];
  for (const room of rooms) {
    if (room.id === roomId) continue;

    for (let otherWallIndex = 0; otherWallIndex < room.points.length; otherWallIndex += 1) {
      const otherSegment = getRoomWallSegment(room, otherWallIndex);
      if (!otherSegment || otherSegment.lengthMm <= 0) continue;

      const otherOutwardNormal = {
        x: -otherSegment.interiorNormal.x,
        y: -otherSegment.interiorNormal.y,
      };
      const overlap = getFacingWallOverlap(
        segment.originalStart,
        segment.originalEnd,
        direction,
        outwardNormal,
        otherSegment.originalStart,
        otherSegment.originalEnd,
        otherOutwardNormal
      );
      if (!overlap || Math.abs(overlap.gapMm - DEFAULT_INTERNAL_WALL_THICKNESS_MM) > 2) continue;

      internalIntervals.push({
        startMm: overlap.startMm,
        endMm: overlap.endMm,
      });
    }
  }
  internalIntervals.push(
    ...getInternalWallJunctionIntervals(roomId, segment, rooms, outwardNormal, direction)
  );

  const mergedInternalIntervals = mergeWallSpanIntervals(internalIntervals, segment.lengthMm);
  if (mergedInternalIntervals.length === 0) {
    return [{ startMm: 0, endMm: segment.lengthMm, isExternal: segment.isExternal !== false }];
  }

  const spans: WallSpanInterval[] = [];
  let cursorMm = 0;
  for (const internalInterval of mergedInternalIntervals) {
    if (internalInterval.startMm - cursorMm > 0.001) {
      spans.push({
        startMm: cursorMm,
        endMm: internalInterval.startMm,
        isExternal: true,
      });
    }
    spans.push({
      startMm: internalInterval.startMm,
      endMm: internalInterval.endMm,
      isExternal: false,
    });
    cursorMm = internalInterval.endMm;
  }
  if (segment.lengthMm - cursorMm > 0.001) {
    spans.push({
      startMm: cursorMm,
      endMm: segment.lengthMm,
      isExternal: true,
    });
  }

  return spans;
}

function getInternalWallJunctionIntervals(
  roomId: string,
  segment: NonNullable<ReturnType<typeof getRoomWallSegment>>,
  rooms: Room[],
  outwardNormal: Point,
  direction: Point
): Array<Pick<WallSpanInterval, "startMm" | "endMm">> {
  const junctionIntervals: Array<Pick<WallSpanInterval, "startMm" | "endMm">> = [];
  const perpendicularSegments = getPerpendicularInternalJunctionSegments(roomId, segment, rooms, direction);

  for (let index = 0; index < perpendicularSegments.length; index += 1) {
    const firstSegment = perpendicularSegments[index];
    const firstDirection = getWallSegmentDirection(firstSegment);
    if (!firstDirection) continue;
    const firstOutwardNormal = {
      x: -firstSegment.interiorNormal.x,
      y: -firstSegment.interiorNormal.y,
    };

    for (let otherIndex = index + 1; otherIndex < perpendicularSegments.length; otherIndex += 1) {
      const secondSegment = perpendicularSegments[otherIndex];
      if (firstSegment.roomId === secondSegment.roomId) continue;

      const secondDirection = getWallSegmentDirection(secondSegment);
      if (!secondDirection) continue;
      const secondOutwardNormal = {
        x: -secondSegment.interiorNormal.x,
        y: -secondSegment.interiorNormal.y,
      };
      const sharedInternalWall =
        getFacingWallOverlap(
          firstSegment.originalStart,
          firstSegment.originalEnd,
          firstDirection,
          firstOutwardNormal,
          secondSegment.originalStart,
          secondSegment.originalEnd,
          secondOutwardNormal
        ) ??
        getFacingWallOverlap(
          secondSegment.originalStart,
          secondSegment.originalEnd,
          secondDirection,
          secondOutwardNormal,
          firstSegment.originalStart,
          firstSegment.originalEnd,
          firstOutwardNormal
        );
      if (
        !sharedInternalWall ||
        Math.abs(sharedInternalWall.gapMm - DEFAULT_INTERNAL_WALL_THICKNESS_MM) > 2
      ) {
        continue;
      }

      const firstProjection = dotProduct(
        {
          x: firstSegment.originalStart.x - segment.originalStart.x,
          y: firstSegment.originalStart.y - segment.originalStart.y,
        },
        direction
      );
      const secondProjection = dotProduct(
        {
          x: secondSegment.originalStart.x - segment.originalStart.x,
          y: secondSegment.originalStart.y - segment.originalStart.y,
        },
        direction
      );
      const startMm = Math.max(0, Math.min(firstProjection, secondProjection));
      const endMm = Math.min(segment.lengthMm, Math.max(firstProjection, secondProjection));
      if (Math.abs(endMm - startMm - DEFAULT_INTERNAL_WALL_THICKNESS_MM) > 2) continue;
      if (!isInternalJunctionAdjacentToSegment(segment, outwardNormal, firstSegment, secondSegment)) {
        continue;
      }

      junctionIntervals.push({ startMm, endMm });
    }
  }

  return junctionIntervals;
}

function getPerpendicularInternalJunctionSegments(
  roomId: string,
  segment: NonNullable<ReturnType<typeof getRoomWallSegment>>,
  rooms: Room[],
  direction: Point
): Array<NonNullable<ReturnType<typeof getRoomWallSegment>> & { roomId: string }> {
  const perpendicularSegments: Array<NonNullable<ReturnType<typeof getRoomWallSegment>> & { roomId: string }> = [];

  for (const room of rooms) {
    if (room.id === roomId) continue;

    for (let wallIndex = 0; wallIndex < room.points.length; wallIndex += 1) {
      const otherSegment = getRoomWallSegment(room, wallIndex);
      if (!otherSegment || otherSegment.lengthMm <= 0) continue;
      const otherDirection = getWallSegmentDirection(otherSegment);
      if (!otherDirection || Math.abs(dotProduct(direction, otherDirection)) > 0.001) continue;

      const distanceToCurrentLineMm = Math.abs(
        dotProduct(
          {
            x: otherSegment.originalStart.x - segment.originalStart.x,
            y: otherSegment.originalStart.y - segment.originalStart.y,
          },
          direction
        )
      );
      if (distanceToCurrentLineMm > segment.lengthMm + DEFAULT_INTERNAL_WALL_THICKNESS_MM) continue;

      perpendicularSegments.push({
        ...otherSegment,
        roomId: room.id,
      });
    }
  }

  return perpendicularSegments;
}

function isInternalJunctionAdjacentToSegment(
  segment: NonNullable<ReturnType<typeof getRoomWallSegment>>,
  outwardNormal: Point,
  firstSegment: NonNullable<ReturnType<typeof getRoomWallSegment>>,
  secondSegment: NonNullable<ReturnType<typeof getRoomWallSegment>>
): boolean {
  const firstRange = getProjectedSegmentRange(firstSegment, segment.originalStart, outwardNormal);
  const secondRange = getProjectedSegmentRange(secondSegment, segment.originalStart, outwardNormal);

  return (
    isProjectedSegmentRangeInInternalJunctionCorridor(firstRange) &&
    isProjectedSegmentRangeInInternalJunctionCorridor(secondRange)
  );
}

function isProjectedSegmentRangeInInternalJunctionCorridor(range: { min: number; max: number }): boolean {
  return range.max >= -2 && range.min <= DEFAULT_INTERNAL_WALL_THICKNESS_MM + 2;
}

function getProjectedSegmentRange(
  segment: NonNullable<ReturnType<typeof getRoomWallSegment>>,
  origin: Point,
  direction: Point
): { min: number; max: number } {
  const startProjection = dotProduct(
    {
      x: segment.originalStart.x - origin.x,
      y: segment.originalStart.y - origin.y,
    },
    direction
  );
  const endProjection = dotProduct(
    {
      x: segment.originalEnd.x - origin.x,
      y: segment.originalEnd.y - origin.y,
    },
    direction
  );

  return {
    min: Math.min(startProjection, endProjection),
    max: Math.max(startProjection, endProjection),
  };
}

function getWallSegmentDirection(
  segment: NonNullable<ReturnType<typeof getRoomWallSegment>>
): Point | null {
  if (segment.lengthMm <= 0) return null;
  return {
    x: (segment.originalEnd.x - segment.originalStart.x) / segment.lengthMm,
    y: (segment.originalEnd.y - segment.originalStart.y) / segment.lengthMm,
  };
}

function mergeWallSpanIntervals(
  intervals: Array<Pick<WallSpanInterval, "startMm" | "endMm">>,
  wallLengthMm: number
): Array<Pick<WallSpanInterval, "startMm" | "endMm">> {
  const sortedIntervals = intervals
    .map((interval) => ({
      startMm: Math.max(0, Math.min(wallLengthMm, interval.startMm)),
      endMm: Math.max(0, Math.min(wallLengthMm, interval.endMm)),
    }))
    .filter((interval) => interval.endMm - interval.startMm > 0.001)
    .sort((a, b) => a.startMm - b.startMm);

  const mergedIntervals: Array<Pick<WallSpanInterval, "startMm" | "endMm">> = [];
  for (const interval of sortedIntervals) {
    const previousInterval = mergedIntervals[mergedIntervals.length - 1];
    if (!previousInterval || interval.startMm - previousInterval.endMm > 0.001) {
      mergedIntervals.push({ ...interval });
      continue;
    }
    previousInterval.endMm = Math.max(previousInterval.endMm, interval.endMm);
  }

  return mergedIntervals;
}

function getExternalWallRenderThicknessMm(
  roomId: string,
  start: Point,
  end: Point,
  rooms: Room[],
  outwardNormal: Point,
  direction: Point
): number {
  let renderThicknessMm = DEFAULT_EXTERNAL_WALL_THICKNESS_MM;
  for (const room of rooms) {
    if (room.id === roomId) continue;

    for (let otherWallIndex = 0; otherWallIndex < room.points.length; otherWallIndex += 1) {
      const otherSegment = getRoomWallSegment(room, otherWallIndex);
      if (!otherSegment?.isExternal || !otherSegment.thicknessMm || otherSegment.lengthMm <= 0) continue;

      const otherOutwardNormal = {
        x: -otherSegment.interiorNormal.x,
        y: -otherSegment.interiorNormal.y,
      };
      const overlap = getFacingWallOverlap(
        start,
        end,
        direction,
        outwardNormal,
        otherSegment.originalStart,
        otherSegment.originalEnd,
        otherOutwardNormal
      );
      if (!overlap || overlap.gapMm >= DEFAULT_EXTERNAL_WALL_THICKNESS_MM * 2) continue;

      renderThicknessMm = Math.min(renderThicknessMm, Math.max(overlap.gapMm / 2, 0));
    }
  }

  return renderThicknessMm;
}

function getFacingWallOverlap(
  start: Point,
  end: Point,
  direction: Point,
  outwardNormal: Point,
  otherStart: Point,
  otherEnd: Point,
  otherOutwardNormal: Point
): { gapMm: number; startMm: number; endMm: number } | null {
  const otherDx = otherEnd.x - otherStart.x;
  const otherDy = otherEnd.y - otherStart.y;
  const otherLength = Math.hypot(otherDx, otherDy);
  if (otherLength < 0.001) return null;
  const otherDirection = {
    x: otherDx / otherLength,
    y: otherDy / otherLength,
  };

  if (Math.abs(crossProduct(direction, otherDirection)) > 0.001) return null;
  if (dotProduct(outwardNormal, otherOutwardNormal) > -0.98) return null;

  const gapMm = dotProduct(
    {
      x: otherStart.x - start.x,
      y: otherStart.y - start.y,
    },
    outwardNormal
  );
  if (gapMm <= 0) return null;

  const projectedOtherStart = dotProduct(
    {
      x: otherStart.x - start.x,
      y: otherStart.y - start.y,
    },
    direction
  );
  const projectedOtherEnd = dotProduct(
    {
      x: otherEnd.x - start.x,
      y: otherEnd.y - start.y,
    },
    direction
  );
  const otherMin = Math.min(projectedOtherStart, projectedOtherEnd);
  const otherMax = Math.max(projectedOtherStart, projectedOtherEnd);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const overlapStartMm = Math.max(0, otherMin);
  const overlapEndMm = Math.min(length, otherMax);
  const overlapMm = overlapEndMm - overlapStartMm;
  if (overlapMm < 50) return null;

  return {
    gapMm,
    startMm: overlapStartMm,
    endMm: overlapEndMm,
  };
}

function drawExternalWallBridges(
  graphics: Graphics,
  wallLines: RoomWallThicknessLine[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const externalLines = wallLines.filter((wallLine) => wallLine.isExternal && wallLine.renderThicknessMm > 0);

  for (let index = 0; index < externalLines.length; index += 1) {
    const wallLine = externalLines[index];
    for (let otherIndex = index + 1; otherIndex < externalLines.length; otherIndex += 1) {
      const otherWallLine = externalLines[otherIndex];
      const bridge = getExternalWallBridge(wallLine, otherWallLine);
      if (!bridge) continue;

      const screenPoints = bridge.map((point) => worldToScreen(point, camera, viewport));
      graphics.setFillStyle({
        color: theme.roomOutline,
        alpha: EXTERNAL_WALL_FILL_ALPHA,
      });
      graphics.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let pointIndex = 1; pointIndex < screenPoints.length; pointIndex += 1) {
        graphics.lineTo(screenPoints[pointIndex].x, screenPoints[pointIndex].y);
      }
      graphics.closePath();
      graphics.fill();
    }
  }
}

function getExternalWallBridge(
  wallLine: RoomWallThicknessLine,
  otherWallLine: RoomWallThicknessLine
): Point[] | null {
  if (dotProduct(wallLine.outwardNormal, otherWallLine.outwardNormal) < 0.98) return null;
  if (Math.abs(crossProduct(wallLine.direction, otherWallLine.direction)) > 0.001) return null;

  const normalOffsetMm = Math.abs(
    dotProduct(
      {
        x: otherWallLine.innerStart.x - wallLine.innerStart.x,
        y: otherWallLine.innerStart.y - wallLine.innerStart.y,
      },
      wallLine.outwardNormal
    )
  );
  if (normalOffsetMm > 0.001) return null;

  const lengthMm = Math.hypot(
    wallLine.innerEnd.x - wallLine.innerStart.x,
    wallLine.innerEnd.y - wallLine.innerStart.y
  );
  const otherStartProjection = dotProduct(
    {
      x: otherWallLine.innerStart.x - wallLine.innerStart.x,
      y: otherWallLine.innerStart.y - wallLine.innerStart.y,
    },
    wallLine.direction
  );
  const otherEndProjection = dotProduct(
    {
      x: otherWallLine.innerEnd.x - wallLine.innerStart.x,
      y: otherWallLine.innerEnd.y - wallLine.innerStart.y,
    },
    wallLine.direction
  );
  const otherMin = Math.min(otherStartProjection, otherEndProjection);
  const otherMax = Math.max(otherStartProjection, otherEndProjection);
  let gapStart: number;
  let gapEnd: number;

  if (lengthMm < otherMin) {
    gapStart = lengthMm;
    gapEnd = otherMin;
  } else if (otherMax < 0) {
    gapStart = otherMax;
    gapEnd = 0;
  } else {
    return null;
  }

  const gapMm = gapEnd - gapStart;
  if (gapMm <= 0.001 || gapMm > DEFAULT_EXTERNAL_WALL_THICKNESS_MM * 2) return null;

  const thicknessMm = Math.min(wallLine.renderThicknessMm, otherWallLine.renderThicknessMm);
  const innerStart = {
    x: wallLine.innerStart.x + wallLine.direction.x * gapStart,
    y: wallLine.innerStart.y + wallLine.direction.y * gapStart,
  };
  const innerEnd = {
    x: wallLine.innerStart.x + wallLine.direction.x * gapEnd,
    y: wallLine.innerStart.y + wallLine.direction.y * gapEnd,
  };
  return [
    innerStart,
    innerEnd,
    {
      x: innerEnd.x + wallLine.outwardNormal.x * thicknessMm,
      y: innerEnd.y + wallLine.outwardNormal.y * thicknessMm,
    },
    {
      x: innerStart.x + wallLine.outwardNormal.x * thicknessMm,
      y: innerStart.y + wallLine.outwardNormal.y * thicknessMm,
    },
  ];
}

function trimExternalWallInsideCornerOverlap(
  wallLine: RoomWallThicknessLine,
  wallLines: RoomWallThicknessLine[]
): RoomWallThicknessLine {
  if (!wallLine.isExternal || wallLine.renderThicknessMm <= 0) return wallLine;

  let startTrimMm = 0;
  let endTrimMm = 0;
  const wallLengthMm = getWallLineLengthMm(wallLine);

  for (const otherWallLine of wallLines) {
    if (otherWallLine === wallLine) continue;
    if (!otherWallLine.isExternal || otherWallLine.renderThicknessMm <= 0) continue;
    if (wallLine.roomId === otherWallLine.roomId) continue;
    if (Math.abs(dotProduct(wallLine.direction, otherWallLine.direction)) > 0.001) continue;

    const startTrimCandidate = getExternalWallInsideCornerTrimMm(
      wallLine.innerStart,
      wallLine.direction,
      otherWallLine
    );
    if (startTrimCandidate !== null) {
      startTrimMm = Math.max(startTrimMm, startTrimCandidate);
    }

    const endTrimCandidate = getExternalWallInsideCornerTrimMm(
      wallLine.innerEnd,
      { x: -wallLine.direction.x, y: -wallLine.direction.y },
      otherWallLine
    );
    if (endTrimCandidate !== null) {
      endTrimMm = Math.max(endTrimMm, endTrimCandidate);
    }
  }

  if (startTrimMm <= 0.001 && endTrimMm <= 0.001) return wallLine;
  if (startTrimMm + endTrimMm >= wallLengthMm - 0.001) return wallLine;

  const nextInnerStart = {
    x: wallLine.innerStart.x + wallLine.direction.x * startTrimMm,
    y: wallLine.innerStart.y + wallLine.direction.y * startTrimMm,
  };
  const nextInnerEnd = {
    x: wallLine.innerEnd.x - wallLine.direction.x * endTrimMm,
    y: wallLine.innerEnd.y - wallLine.direction.y * endTrimMm,
  };

  return {
    ...wallLine,
    spanStartMm: wallLine.spanStartMm + startTrimMm,
    spanEndMm: wallLine.spanEndMm - endTrimMm,
    innerStart: nextInnerStart,
    innerEnd: nextInnerEnd,
    outerStart: {
      x: nextInnerStart.x + wallLine.outwardNormal.x * wallLine.renderThicknessMm,
      y: nextInnerStart.y + wallLine.outwardNormal.y * wallLine.renderThicknessMm,
    },
    outerEnd: {
      x: nextInnerEnd.x + wallLine.outwardNormal.x * wallLine.renderThicknessMm,
      y: nextInnerEnd.y + wallLine.outwardNormal.y * wallLine.renderThicknessMm,
    },
  };
}

function getExternalWallInsideCornerTrimMm(
  endpoint: Point,
  trimDirection: Point,
  otherWallLine: RoomWallThicknessLine
): number | null {
  const projectedAlongOther = dotProduct(
    {
      x: endpoint.x - otherWallLine.innerStart.x,
      y: endpoint.y - otherWallLine.innerStart.y,
    },
    otherWallLine.direction
  );
  const otherLengthMm = getWallLineLengthMm(otherWallLine);
  if (projectedAlongOther < -0.001 || projectedAlongOther > otherLengthMm + 0.001) return null;

  const projectedAcrossOther = dotProduct(
    {
      x: endpoint.x - otherWallLine.innerStart.x,
      y: endpoint.y - otherWallLine.innerStart.y,
    },
    otherWallLine.outwardNormal
  );
  if (projectedAcrossOther < -0.001 || projectedAcrossOther > otherWallLine.renderThicknessMm + 0.001) {
    return null;
  }

  const trimToOtherOuterFaceMm = dotProduct(
    {
      x: otherWallLine.outerStart.x - endpoint.x,
      y: otherWallLine.outerStart.y - endpoint.y,
    },
    trimDirection
  );
  if (trimToOtherOuterFaceMm <= 0.001 || trimToOtherOuterFaceMm > otherWallLine.renderThicknessMm + 0.001) {
    return null;
  }

  return trimToOtherOuterFaceMm;
}

function getWallLineLengthMm(wallLine: RoomWallThicknessLine): number {
  return Math.hypot(
    wallLine.innerEnd.x - wallLine.innerStart.x,
    wallLine.innerEnd.y - wallLine.innerStart.y
  );
}

function getLineIntersection(
  firstPoint: Point,
  firstDirection: Point,
  secondPoint: Point,
  secondDirection: Point
): Point | null {
  const denominator = crossProduct(firstDirection, secondDirection);
  if (Math.abs(denominator) < 0.000001) return null;

  const delta = {
    x: secondPoint.x - firstPoint.x,
    y: secondPoint.y - firstPoint.y,
  };
  const distanceAlongFirst = crossProduct(delta, secondDirection) / denominator;

  return {
    x: firstPoint.x + firstDirection.x * distanceAlongFirst,
    y: firstPoint.y + firstDirection.y * distanceAlongFirst,
  };
}

function dotProduct(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function crossProduct(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function drawRoomOpenings(
  graphics: Graphics,
  room: Room,
  selectedOpening: RoomOpeningSelection | null,
  selection: SharedSelectionItem[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme,
  options?: {
    showUnitOriginHighlights?: boolean;
    displayUnitOrigin?: UnitOrigin;
  }
) {
  const selectedOpeningCount = selection.filter((item) => item.type === "opening").length;
  const handleOpening = getSingleOpeningSelectionForHandles(selectedOpening, selection);
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
      (selectedOpening?.roomId === room.id && selectedOpening.openingId === opening.id) ||
      isOpeningSelected(selection, room.id, opening.id);
    const cutoutStrokePx = Math.max(camera.pixelsPerMm * OPENING_CUTOUT_WORLD_MM, 2.25);
    const symbolStrokePx = Math.max(camera.pixelsPerMm * OPENING_SYMBOL_WORLD_MM, 1.2);
    const selectionStrokePx = Math.max(camera.pixelsPerMm * OPENING_SELECTION_STROKE_WORLD_MM, 2);
    const originHighlightColor = getUnitOriginHighlightColor(
      opening.unitOrigin ?? room.unitOrigin ?? options?.displayUnitOrigin
    );
    const openingColor = options?.showUnitOriginHighlights
      ? originHighlightColor
      : theme.roomOutline;
    const selectionColor = options?.showUnitOriginHighlights
      ? originHighlightColor
      : theme.wallSelectionAccent;

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
      const hingePoint = opening.hingeSide === "end" ? end : start;
      const hingeTangent =
        opening.hingeSide === "end"
          ? { x: -tangent.x, y: -tangent.y }
          : tangent;
      const swingNormal =
        opening.openingSide === "exterior"
          ? { x: -interiorNormal.x, y: -interiorNormal.y }
          : interiorNormal;
      const leafLengthPx = Math.max(openingWidthPx, 1);
      const closedLeafEnd = {
        x: hingePoint.x + hingeTangent.x * leafLengthPx,
        y: hingePoint.y + hingeTangent.y * leafLengthPx,
      };
      const openLeafEnd = {
        x: hingePoint.x + swingNormal.x * leafLengthPx,
        y: hingePoint.y + swingNormal.y * leafLengthPx,
      };
      const closedAngle = Math.atan2(closedLeafEnd.y - hingePoint.y, closedLeafEnd.x - hingePoint.x);
      const openAngle = Math.atan2(openLeafEnd.y - hingePoint.y, openLeafEnd.x - hingePoint.x);
      const shouldDrawArcAnticlockwise =
        hingeTangent.x * swingNormal.y - hingeTangent.y * swingNormal.x < 0;

      const doorSymbolColor = isSelected ? selectionColor : openingColor;
      graphics.setStrokeStyle({
        width: isSelected ? selectionStrokePx : symbolStrokePx,
        color: doorSymbolColor,
        alpha: isSelected ? 1 : 0.96,
        cap: "round",
      });
      graphics.moveTo(hingePoint.x, hingePoint.y);
      graphics.lineTo(openLeafEnd.x, openLeafEnd.y);
      graphics.stroke();

      graphics.setStrokeStyle({
        width: Math.max(camera.pixelsPerMm * DOOR_SWING_ARC_WORLD_MM, 1),
        color: doorSymbolColor,
        alpha: isSelected ? 0.94 : 0.76,
        cap: "round",
        join: "round",
      });
      graphics.moveTo(closedLeafEnd.x, closedLeafEnd.y);
      graphics.arc(
        hingePoint.x,
        hingePoint.y,
        leafLengthPx,
        closedAngle,
        openAngle,
        shouldDrawArcAnticlockwise
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
            color: isSelected ? selectionColor : openingColor,
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

    const shouldDrawHandles =
      handleOpening?.roomId === room.id && handleOpening.openingId === opening.id;
    if (!isSelected || selectedOpeningCount > 1 || !shouldDrawHandles) continue;

    drawOpeningWidthHandle(graphics, start, selectionColor, theme);
    drawOpeningWidthHandle(graphics, end, selectionColor, theme);
  }
}

function drawRoomInteriorAssets(
  graphics: Graphics,
  room: Room,
  selection: SharedSelectionItem[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme,
  animations: ReadonlyMap<string, AssetRotationAnimation> = new Map(),
  showAssets: boolean = true
) {
  for (const asset of room.interiorAssets) {
    // Always show stairs, but hide other assets if showAssets is false
    if (asset.type !== "stairs" && !showAssets) continue;
    // baseWidthMm/baseDepthMm are the canonical local dimensions used for the
    // whole rotation, while rotationDegrees is interpolated between the two
    // cardinal endpoints when animation is active.
    const anim = animations.get(asset.id) ?? null;

    // displayedAsset is the view-model used for all drawing in this iteration.
    // At rest it equals the stored asset. During animation it carries the canonical
    // base dimensions and an eased-out interpolated rotationDegrees between fromDegrees
    // and toDegrees so the visual shape rotates smoothly.
    let displayedAsset: Room["interiorAssets"][number];
    if (anim) {
      const rawProgress = Math.min(1, (performance.now() - anim.startMs) / anim.durationMs);
      const easedProgress = easeOutCubic(rawProgress);
      const delta = getShortestRotationDeltaDegrees(anim.fromDegrees, anim.toDegrees);
      displayedAsset = {
        ...asset,
        widthMm: anim.baseWidthMm,
        depthMm: anim.baseDepthMm,
        rotationDegrees: anim.fromDegrees + delta * easedProgress,
      };
    } else {
      displayedAsset = asset;
    }

    // Corners: use the rotation-matrix helper when animating (supports arbitrary angles);
    // fall back to fast axis-aligned bounds at rest (cardinal angles only).
    let topLeft: ScreenPoint,
        topRight: ScreenPoint,
        bottomRight: ScreenPoint,
        bottomLeft: ScreenPoint;
    if (anim) {
      [topLeft, topRight, bottomRight, bottomLeft] = getRotatedAssetScreenCorners(displayedAsset, camera, viewport);
    } else {
      const b = getRoomInteriorAssetBounds(asset);
      topLeft     = worldToScreen({ x: b.left,  y: b.top    }, camera, viewport);
      topRight    = worldToScreen({ x: b.right, y: b.top    }, camera, viewport);
      bottomRight = worldToScreen({ x: b.right, y: b.bottom }, camera, viewport);
      bottomLeft  = worldToScreen({ x: b.left,  y: b.bottom }, camera, viewport);
    }
    const corners = [topLeft, topRight, bottomRight, bottomLeft];
    const isSelected = selection.some(
      (item) => item.type === "asset" && item.roomId === room.id && item.id === asset.id
    );
    const selectionStrokePx = Math.max(camera.pixelsPerMm * OPENING_SELECTION_STROKE_WORLD_MM, 2);

    // Skip rectangular bounding box for unselected round dining tables, toilets, showers, baths, and desks
    const isCustomDetailAsset =
      (displayedAsset.type === "dining-table" && displayedAsset.shape === "round") ||
      displayedAsset.type === "toilet" ||
      displayedAsset.type === "shower" ||
      displayedAsset.type === "bath" ||
      displayedAsset.type === "desk";
    const shouldDrawBoundingBox = isSelected || !isCustomDetailAsset;

    if (shouldDrawBoundingBox) {
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
    }

    // Furniture-specific type visuals
    if (displayedAsset.type !== "stairs") {
      const fgAlpha = isSelected ? 0.78 : 0.56;
      const fgLineWidth = Math.max(camera.pixelsPerMm * 10, 1.1);
      const fgColor = isSelected ? theme.wallSelectionAccent : theme.roomOutline;
      const fgFillAlpha = isSelected ? 0.30 : 0.20;

      // Determine front edge based on rotation.
      // During animation, use the rotated local top/bottom edges directly so
      // details (bed headboard, sofa backrest, wardrobe doors) rotate smoothly
      // with the rectangle for both clockwise and counter-clockwise turns.
      // At rest, rotationDegrees is cardinal, so map front/back by cardinal side.
      // 0°=top, 90°=right, -180°=bottom, -90°=left
      const [frontC1, frontC2, backC1, backC2] = anim
        ? [topLeft, topRight, bottomLeft, bottomRight]
        : (() => {
            const closestCardinal = snapToCardinalRotationDegrees(displayedAsset.rotationDegrees ?? 0);
            return closestCardinal === 0 ? [topLeft, topRight, bottomLeft, bottomRight]
              : closestCardinal === 90 ? [topRight, bottomRight, topLeft, bottomLeft]
              : closestCardinal === -180 ? [bottomLeft, bottomRight, topLeft, topRight]
              : [topLeft, bottomLeft, topRight, bottomRight]; // -90
          })();

      if (displayedAsset.type === "bed") {
        // Headboard: filled strip at front ~14% depth
        const hFrac = 0.14;
        const hC1 = { x: frontC1.x + (backC1.x - frontC1.x) * hFrac, y: frontC1.y + (backC1.y - frontC1.y) * hFrac };
        const hC2 = { x: frontC2.x + (backC2.x - frontC2.x) * hFrac, y: frontC2.y + (backC2.y - frontC2.y) * hFrac };
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha });
        graphics.moveTo(frontC1.x, frontC1.y);
        graphics.lineTo(frontC2.x, frontC2.y);
        graphics.lineTo(hC2.x, hC2.y);
        graphics.lineTo(hC1.x, hC1.y);
        graphics.closePath();
        graphics.fill();
      }

      if (displayedAsset.type === "sofa") {
        // Back rest: filled strip at front ~30%
        const bFrac = 0.30;
        const bC1 = { x: frontC1.x + (backC1.x - frontC1.x) * bFrac, y: frontC1.y + (backC1.y - frontC1.y) * bFrac };
        const bC2 = { x: frontC2.x + (backC2.x - frontC2.x) * bFrac, y: frontC2.y + (backC2.y - frontC2.y) * bFrac };
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha - 0.04 });
        graphics.moveTo(frontC1.x, frontC1.y);
        graphics.lineTo(frontC2.x, frontC2.y);
        graphics.lineTo(bC2.x, bC2.y);
        graphics.lineTo(bC1.x, bC1.y);
        graphics.closePath();
        graphics.fill();
        // 2 cushion dividers perpendicular to front edge
        graphics.setStrokeStyle({ width: fgLineWidth, color: fgColor, alpha: fgAlpha, cap: "round" });
        for (const t of [1 / 3, 2 / 3]) {
          const divStart = { x: bC1.x + (bC2.x - bC1.x) * t, y: bC1.y + (bC2.y - bC1.y) * t };
          const divEnd = { x: backC1.x + (backC2.x - backC1.x) * t, y: backC1.y + (backC2.y - backC1.y) * t };
          graphics.moveTo(divStart.x, divStart.y);
          graphics.lineTo(divEnd.x, divEnd.y);
          graphics.stroke();
        }
      }

      if (displayedAsset.type === "wardrobe") {
        graphics.setStrokeStyle({ width: fgLineWidth, color: fgColor, alpha: fgAlpha, cap: "round" });
        if (displayedAsset.doorType === "sliding") {
          // Two equal-length parallel sliding door tracks outside the front edge
          const midFront = { x: (frontC1.x + frontC2.x) / 2, y: (frontC1.y + frontC2.y) / 2 };
          
          // Calculate outward direction (opposite to depth, away from wardrobe interior)
          const depthVec = { x: backC1.x - frontC1.x, y: backC1.y - frontC1.y };
          const depthLen = Math.sqrt(depthVec.x * depthVec.x + depthVec.y * depthVec.y);
          const outwardUnit = depthLen > 0 ? { x: -depthVec.x / depthLen, y: -depthVec.y / depthLen } : { x: 0, y: -1 };
          
          // Scale offset based on wardrobe depth to maintain proportions at any zoom level
          const offsetDist = Math.max(4, depthLen * 0.08);
          const offset2Dist = Math.max(5, depthLen * 0.1);
          
          // Left track: from frontC1 to midFront, offset outward
          const track1Start = { x: frontC1.x + outwardUnit.x * offsetDist, y: frontC1.y + outwardUnit.y * offsetDist };
          const track1End = { x: midFront.x + outwardUnit.x * offsetDist, y: midFront.y + outwardUnit.y * offsetDist };
          graphics.moveTo(track1Start.x, track1Start.y);
          graphics.lineTo(track1End.x, track1End.y);
          graphics.stroke();
          
          // Right track: from midFront to frontC2, offset slightly more for layering effect
          const track2Start = { x: midFront.x + outwardUnit.x * offset2Dist, y: midFront.y + outwardUnit.y * offset2Dist };
          const track2End = { x: frontC2.x + outwardUnit.x * offset2Dist, y: frontC2.y + outwardUnit.y * offset2Dist };
          graphics.moveTo(track2Start.x, track2Start.y);
          graphics.lineTo(track2End.x, track2End.y);
          graphics.stroke();
        } else {
          // Swing door: diagonals opening outward from front corners
          const depthVec = { x: backC1.x - frontC1.x, y: backC1.y - frontC1.y };
          const depthLen = Math.sqrt(depthVec.x * depthVec.x + depthVec.y * depthVec.y);
          const depthUnit = depthLen > 0 ? { x: depthVec.x / depthLen, y: depthVec.y / depthLen } : { x: 0, y: 0 };
          
          const widthVec = { x: frontC2.x - frontC1.x, y: frontC2.y - frontC1.y };
          const widthLen = Math.sqrt(widthVec.x * widthVec.x + widthVec.y * widthVec.y);
          const leafLen = Math.min(widthLen * 0.4, depthLen * 0.6);
          
          // Left door swings outward (away from center, towards -y in 0° config)
          graphics.moveTo(frontC1.x, frontC1.y);
          graphics.lineTo(frontC1.x - depthUnit.x * leafLen, frontC1.y - depthUnit.y * leafLen);
          graphics.stroke();
          
          // Right door swings outward
          graphics.moveTo(frontC2.x, frontC2.y);
          graphics.lineTo(frontC2.x - depthUnit.x * leafLen, frontC2.y - depthUnit.y * leafLen);
          graphics.stroke();
        }
      }

      if (displayedAsset.type === "dining-table" && displayedAsset.shape === "round") {
        // Ellipse fills the entire rectangular bounds
        const cx = (topLeft.x + bottomRight.x) / 2;
        const cy = (topLeft.y + bottomRight.y) / 2;
        const rX = Math.abs(bottomRight.x - topLeft.x) / 2;
        const rY = Math.abs(bottomRight.y - topLeft.y) / 2;
        
        // Fill layer
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha * 0.4 });
        
        graphics.setStrokeStyle({
          width: isSelected ? selectionStrokePx : Math.max(camera.pixelsPerMm * 14, 1.4),
          color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
          alpha: isSelected ? 0.96 : 0.9,
        });
        graphics.ellipse(cx, cy, rX, rY);
        graphics.fill();
        graphics.stroke();
      }

      if (displayedAsset.type === "kitchen-appliance") {
        // Dashed diagonal lines corner-to-corner (microwave-style X pattern)
        graphics.setStrokeStyle({
          width: fgLineWidth * 0.85,
          color: fgColor,
          alpha: fgAlpha * 0.5,
        });
        
        // Calculate dash pattern based on viewport zoom for consistent appearance
        const diagonalLen = Math.sqrt(
          Math.pow(bottomRight.x - topLeft.x, 2) + Math.pow(bottomRight.y - topLeft.y, 2)
        );
        const dashLen = Math.max(3, diagonalLen * 0.06); // Dash length ~6% of diagonal
        const gapLen = dashLen * 1.3; // Gap slightly larger than dash
        const period = dashLen + gapLen;
        
        // Helper to draw dashed line using short segments
        const drawDashedLine = (x1: number, y1: number, x2: number, y2: number) => {
          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.sqrt(dx * dx + dy * dy);
          const unitX = length > 0 ? dx / length : 0;
          const unitY = length > 0 ? dy / length : 0;
          const numSegments = Math.ceil(length / period);
          
          for (let i = 0; i < numSegments; i += 1) {
            const segStart = i * period;
            const segEnd = Math.min(segStart + dashLen, length);
            if (segStart < length) {
              const sx = x1 + unitX * segStart;
              const sy = y1 + unitY * segStart;
              const ex = x1 + unitX * segEnd;
              const ey = y1 + unitY * segEnd;
              graphics.moveTo(sx, sy);
              graphics.lineTo(ex, ey);
              graphics.stroke();
            }
          }
        };
        
        // Top-left to bottom-right diagonal
        drawDashedLine(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y);
        
        // Top-right to bottom-left diagonal
        drawDashedLine(bottomRight.x, topLeft.y, topLeft.x, bottomRight.y);
      }

      if (displayedAsset.type === "hob") {
        // Burner circles — positioned using frontC1/frontC2/backC1/backC2 bilinear
        // interpolation so they rotate correctly with the hob at all cardinal angles.
        const burnerCount = displayedAsset.burnerCount ?? 4;

        // Lerp helper and bilinear place()
        const lerpPt = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });
        // wf = width fraction (frontC1→frontC2), df = depth fraction (front→back)
        const place = (wf: number, df: number) =>
          lerpPt(lerpPt(frontC1, frontC2, wf), lerpPt(backC1, backC2, wf), df);

        const widthPx = Math.sqrt((frontC2.x - frontC1.x) ** 2 + (frontC2.y - frontC1.y) ** 2);
        const depthPx = Math.sqrt((backC1.x - frontC1.x) ** 2 + (backC1.y - frontC1.y) ** 2);
        const burnerRadius = Math.max(3, Math.min(widthPx, depthPx) * 0.12);

        graphics.setStrokeStyle({
          width: fgLineWidth * 0.8,
          color: fgColor,
          alpha: fgAlpha * 0.7,
        });
        graphics.setFillStyle({ color: fgColor, alpha: 0 });

        // Burner definitions: [wf, df, radiusMultiplier]
        const burnerDefs: Array<[number, number, number]> =
          burnerCount === 2
            ? [[0.25, 0.5, 1], [0.75, 0.5, 1]]
            : burnerCount === 5
            ? [[0.2, 0.2, 1], [0.8, 0.2, 1], [0.2, 0.8, 1], [0.8, 0.8, 1], [0.5, 0.5, 1.4]]
            : burnerCount === 6
            ? [[0.2, 0.25, 1], [0.5, 0.25, 1], [0.8, 0.25, 1], [0.2, 0.75, 1], [0.5, 0.75, 1], [0.8, 0.75, 1]]
            : [[0.25, 0.25, 1], [0.75, 0.25, 1], [0.25, 0.75, 1], [0.75, 0.75, 1]]; // 4-burner default

        for (const [wf, df, rm] of burnerDefs) {
          const pt = place(wf, df);
          graphics.circle(pt.x, pt.y, burnerRadius * rm);
          graphics.stroke();
        }
      }

      if (displayedAsset.type === "sink") {
        // Uses frontC1/frontC2/backC1/backC2 like bed/sofa — rotates smoothly.
        // front edge = wall-mount/tap side. back edge = far side.
        // frontC1→frontC2 = width axis. frontC1→backC1 = depth axis.
        // Bowl occupies one half along the width; drainer lines the other.
        const bowlType = displayedAsset.bowlType ?? "single";
        const hasDefaultDrainer = displayedAsset.hasDefaultDrainer ?? true;

        graphics.setStrokeStyle({ width: fgLineWidth * 0.9, color: fgColor, alpha: fgAlpha * 0.75 });
        graphics.setFillStyle({ color: fgColor, alpha: 0 });

        // Lerp two screen points
        const lerp = (a: ScreenPoint, b: ScreenPoint, t: number): ScreenPoint => ({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });

        // Draw a rounded rect given 4 screen-space corners (tl, tr, br, bl)
        const drawRoundedRectCorners = (tl: ScreenPoint, tr: ScreenPoint, br: ScreenPoint, bl: ScreenPoint, radiusFrac = 0.12) => {
          const w = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2);
          const h = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2);
          const r = Math.max(3, Math.min(w, h) * radiusFrac);
          const rt = Math.min(r / w, 0.499);
          const rs = Math.min(r / h, 0.499);
          graphics.moveTo(lerp(tl, tr, rt).x, lerp(tl, tr, rt).y);
          graphics.lineTo(lerp(tr, tl, rt).x, lerp(tr, tl, rt).y);
          graphics.arcTo(tr.x, tr.y, lerp(tr, br, rs).x, lerp(tr, br, rs).y, r);
          graphics.lineTo(lerp(br, tr, rs).x, lerp(br, tr, rs).y);
          graphics.arcTo(br.x, br.y, lerp(br, bl, rt).x, lerp(br, bl, rt).y, r);
          graphics.lineTo(lerp(bl, br, rt).x, lerp(bl, br, rt).y);
          graphics.arcTo(bl.x, bl.y, lerp(bl, tl, rs).x, lerp(bl, tl, rs).y, r);
          graphics.lineTo(lerp(tl, bl, rs).x, lerp(tl, bl, rs).y);
          graphics.arcTo(tl.x, tl.y, lerp(tl, tr, rt).x, lerp(tl, tr, rt).y, r);
          graphics.closePath();
          graphics.stroke();
        };

        // The bowl is at local x=0 (the frontC1 end at 0°/90°).
        // During animation, frontC1=topLeft is always the local bowl corner — correct by definition.
        // At rest, the cardinal mapping reverses the width axis at -180° and -90°, so frontC1 lands
        // on the wrong (drainer) side. We detect this and swap bowl/drain corners accordingly.
        const needsBowlSwap = !anim && (() => {
          const r = snapToCardinalRotationDegrees(displayedAsset.rotationDegrees ?? 0);
          return r === -180 || r === -90;
        })();
        const bowlF  = needsBowlSwap ? frontC2 : frontC1;
        const bowlB  = needsBowlSwap ? backC2  : backC1;
        const drainF = needsBowlSwap ? frontC1 : frontC2;
        const drainB = needsBowlSwap ? backC1  : backC2;

        // Midpoints of front and back edges (always the true centre regardless of swap)
        const midF = lerp(frontC1, frontC2, 0.5);
        const midB = lerp(backC1, backC2, 0.5);

        if (hasDefaultDrainer) {
          // Bowl half (bowlF side), inset slightly
          const iW = 0.08;
          const iD = 0.08;
          const bowlWidthEnd = bowlType === "single" ? 1.0 : 0.65;
          const bowl_tl = lerp(lerp(bowlF, midF, iW),                          lerp(bowlB, midB, iW),                          iD);
          const bowl_tr = lerp(lerp(midF, bowlF, 1 - bowlWidthEnd),             lerp(midB, bowlB, 1 - bowlWidthEnd),             iD);
          const bowl_br = lerp(lerp(midF, bowlF, 1 - bowlWidthEnd),             lerp(midB, bowlB, 1 - bowlWidthEnd),             1 - iD);
          const bowl_bl = lerp(lerp(bowlF, midF, iW),                          lerp(bowlB, midB, iW),                          1 - iD);
          drawRoundedRectCorners(bowl_tl, bowl_tr, bowl_br, bowl_bl);

          // Half-bowl: small rounded rect in the gap between main bowl and midline
          if (bowlType === "1.5") {
            const hbL = bowlWidthEnd + 0.1;  // left edge: spaced away from main bowl
            const hbR = 1.01 - 0.01;          // right edge: close to midline, clear of drainer
            const hbT = 0.18;                 // top inset (along depth)
            const hbBo = 1.0 - 0.18;          // bottom inset
            const hb_tl = lerp(lerp(bowlF, midF, hbL), lerp(bowlB, midB, hbL), hbT);
            const hb_tr = lerp(lerp(bowlF, midF, hbR), lerp(bowlB, midB, hbR), hbT);
            const hb_br = lerp(lerp(bowlF, midF, hbR), lerp(bowlB, midB, hbR), hbBo);
            const hb_bl = lerp(lerp(bowlF, midF, hbL), lerp(bowlB, midB, hbL), hbBo);
            drawRoundedRectCorners(hb_tl, hb_tr, hb_br, hb_bl);
          }

          // Drainer lines: parallel to the front edge (width axis), in the drain half
          // drainDepthInset: padding top/bottom (along depth axis)
          // drainWidthInset: padding toward bowl side and toward outer edge (along width axis)
          const lineCount = 5;
          const drainDepthInset = 0.15;
          const drainWidthInset = 0.12;
          for (let i = 0; i < lineCount; i++) {
            const t = drainDepthInset + (1 - 2 * drainDepthInset) * (i / (lineCount - 1));
            const ls = lerp(lerp(midF, drainF, drainWidthInset),  lerp(midB, drainB, drainWidthInset),  t);
            const le = lerp(lerp(drainF, midF, drainWidthInset),  lerp(drainB, midB, drainWidthInset),  t);
            graphics.moveTo(ls.x, ls.y);
            graphics.lineTo(le.x, le.y);
            graphics.stroke();
          }
        } else {
          // No drainer: full-width bowl (symmetric, no swap needed)
          const iW = 0.05;
          const iD = 0.08;
          const bowl_tl = lerp(lerp(frontC1, frontC2, iW), lerp(backC1, backC2, iW),   iD);
          const bowl_tr = lerp(lerp(frontC2, frontC1, iW), lerp(backC2, backC1, iW),   iD);
          const bowl_br = lerp(lerp(frontC2, frontC1, iW), lerp(backC2, backC1, iW),   1 - iD);
          const bowl_bl = lerp(lerp(frontC1, frontC2, iW), lerp(backC1, backC2, iW),   1 - iD);
          drawRoundedRectCorners(bowl_tl, bowl_tr, bowl_br, bowl_bl);
        }
      }

      if (displayedAsset.type === "toilet") {
        // Toilet viewed from above (top-down floor plan):
        // backC1/backC2 edge = cistern (wall) side
        // frontC1/frontC2 edge = bowl front
        // Width axis (C1→C2) is symmetric — no needsWidthSwap required.

        // Apply same styling as round dining table: responsive stroke width, selection feedback
        graphics.setStrokeStyle({
          width: isSelected ? selectionStrokePx : Math.max(camera.pixelsPerMm * 14, 1.4),
          color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
          alpha: isSelected ? 0.96 : 0.9,
        });

        // Lerp helper (may be shared in a future refactor, defined locally for now)
        const lerpT = (a: ScreenPoint, b: ScreenPoint, t: number): ScreenPoint => ({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });

        // 1. Cistern rectangle — back 25% of depth, full width inset slightly
        const cisternDepth = 0.25;
        const cisternInsetW = 0.05;
        const cis_tl = lerpT(lerpT(backC1, frontC1, cisternDepth), lerpT(backC2, frontC2, cisternDepth), cisternInsetW);
        const cis_tr = lerpT(lerpT(backC1, frontC1, cisternDepth), lerpT(backC2, frontC2, cisternDepth), 1 - cisternInsetW);
        const cis_br = lerpT(backC1, backC2, 1 - cisternInsetW);
        const cis_bl = lerpT(backC1, backC2, cisternInsetW);

        // drawRoundedRectCorners is defined inside the sink block above; redefine inline:
        const drawToiletRect = (tl: ScreenPoint, tr: ScreenPoint, br: ScreenPoint, bl: ScreenPoint, radiusFrac = 0.12, shouldFill = false) => {
          const w = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2);
          const h = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2);
          const r = Math.max(3, Math.min(w, h) * radiusFrac);
          const rt = Math.min(r / w, 0.499);
          const rs = Math.min(r / h, 0.499);
          graphics.moveTo(lerpT(tl, tr, rt).x, lerpT(tl, tr, rt).y);
          graphics.lineTo(lerpT(tr, tl, rt).x, lerpT(tr, tl, rt).y);
          graphics.arcTo(tr.x, tr.y, lerpT(tr, br, rs).x, lerpT(tr, br, rs).y, r);
          graphics.lineTo(lerpT(br, tr, rs).x, lerpT(br, tr, rs).y);
          graphics.arcTo(br.x, br.y, lerpT(br, bl, rt).x, lerpT(br, bl, rt).y, r);
          graphics.lineTo(lerpT(bl, br, rt).x, lerpT(bl, br, rt).y);
          graphics.arcTo(bl.x, bl.y, lerpT(bl, tl, rs).x, lerpT(bl, tl, rs).y, r);
          graphics.lineTo(lerpT(tl, bl, rs).x, lerpT(tl, bl, rs).y);
          graphics.arcTo(tl.x, tl.y, lerpT(tl, tr, rt).x, lerpT(tl, tr, rt).y, r);
          graphics.closePath();
          if (shouldFill) graphics.fill();
          graphics.stroke();
        };

        // Cistern with subtle fill
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha * 0.4 });
        drawToiletRect(cis_tl, cis_tr, cis_br, cis_bl, 0.08, true);

        // 2. Outer bowl oval — from just below cistern to front inset, with side insets
        const bowlTopT  = cisternDepth + 0.03; // slight gap below cistern
        const bowlBotT  = 0.94;
        const bowlSideI = 0.06;
        const ob_tl = lerpT(lerpT(backC1, frontC1, bowlTopT), lerpT(backC2, frontC2, bowlTopT), bowlSideI);
        const ob_tr = lerpT(lerpT(backC1, frontC1, bowlTopT), lerpT(backC2, frontC2, bowlTopT), 1 - bowlSideI);
        const ob_br = lerpT(lerpT(backC1, frontC1, bowlBotT), lerpT(backC2, frontC2, bowlBotT), 1 - bowlSideI);
        const ob_bl = lerpT(lerpT(backC1, frontC1, bowlBotT), lerpT(backC2, frontC2, bowlBotT), bowlSideI);
        
        // Outer bowl with subtle fill
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha * 0.4 });
        drawToiletRect(ob_tl, ob_tr, ob_br, ob_bl, 0.35, true);

        // 3. Inner hole oval — smaller, centred, nearer the cistern (no fill, secondary stroke)
        graphics.setStrokeStyle({
          width: fgLineWidth * 0.8,
          color: fgColor,
          alpha: fgAlpha * 0.7,
        });
        graphics.setFillStyle({ color: "transparent", alpha: 0 });
        const holeTopT  = cisternDepth + 0.11;
        const holeBotT  = 0.55;
        const holeSideI = 0.32;
        const ih_tl = lerpT(lerpT(backC1, frontC1, holeTopT), lerpT(backC2, frontC2, holeTopT), holeSideI);
        const ih_tr = lerpT(lerpT(backC1, frontC1, holeTopT), lerpT(backC2, frontC2, holeTopT), 1 - holeSideI);
        const ih_br = lerpT(lerpT(backC1, frontC1, holeBotT), lerpT(backC2, frontC2, holeBotT), 1 - holeSideI);
        const ih_bl = lerpT(lerpT(backC1, frontC1, holeBotT), lerpT(backC2, frontC2, holeBotT), holeSideI);
        drawToiletRect(ih_tl, ih_tr, ih_br, ih_bl, 0.40, false);
      }

      if (displayedAsset.type === "shower") {
        // Shower viewed from above (top-down floor plan):
        // Large rounded rectangle interior detail (like hob burners pattern)
        // Small drain circle in the inside corner.

        // Lerp helper
        const lerpT = (a: ScreenPoint, b: ScreenPoint, t: number): ScreenPoint => ({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });

        // Fill layer for whole asset (more subtle than default)
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha * 0.4 });

        // 0. Outer square boundary (main asset outline)
        graphics.setStrokeStyle({
          width: isSelected ? selectionStrokePx : Math.max(camera.pixelsPerMm * 14, 1.4),
          color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
          alpha: isSelected ? 0.96 : 0.9,
        });
        graphics.moveTo(backC1.x, backC1.y);
        graphics.lineTo(backC2.x, backC2.y);
        graphics.lineTo(frontC2.x, frontC2.y);
        graphics.lineTo(frontC1.x, frontC1.y);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();

        // Width-axis swap fix for 180° and 270° rotations
        // (shower details are asymmetric along width, so cardinal at-rest mapping reverses at -180° and -90°)
        const needsWidthSwap = !anim && (() => {
          const r = snapToCardinalRotationDegrees(displayedAsset.rotationDegrees ?? 0);
          return r === -180 || r === -90;
        })();
        const leftF  = needsWidthSwap ? frontC2 : frontC1;
        const leftB  = needsWidthSwap ? backC2  : backC1;
        const rightF = needsWidthSwap ? frontC1 : frontC2;
        const rightB = needsWidthSwap ? backC1  : backC2;

        // 1. Large rounded rectangle interior detail (fixed 50mm inset from edge)
        graphics.setStrokeStyle({
          width: fgLineWidth * 0.8,
          color: fgColor,
          alpha: fgAlpha * 0.7,
        });

        // Fixed 50mm inset from edge in world space
        const insetMm = 50;
        const insetPx = camera.pixelsPerMm * insetMm;
        
        // Calculate unit vectors along edges for rotation-aware inset
        const widthVec = { x: rightB.x - leftB.x, y: rightB.y - leftB.y };
        const depthVec = { x: leftF.x - leftB.x, y: leftF.y - leftB.y };
        const widthLen = Math.sqrt(widthVec.x ** 2 + widthVec.y ** 2);
        const depthLen = Math.sqrt(depthVec.x ** 2 + depthVec.y ** 2);
        const widthUnit = { x: widthVec.x / widthLen, y: widthVec.y / widthLen };
        const depthUnit = { x: depthVec.x / depthLen, y: depthVec.y / depthLen };
        
        // Inset each corner by fixed 50mm
        const inner_tl = {
          x: leftB.x + widthUnit.x * insetPx + depthUnit.x * insetPx,
          y: leftB.y + widthUnit.y * insetPx + depthUnit.y * insetPx,
        };
        const inner_tr = {
          x: rightB.x - widthUnit.x * insetPx + depthUnit.x * insetPx,
          y: rightB.y - widthUnit.y * insetPx + depthUnit.y * insetPx,
        };
        const inner_br = {
          x: rightF.x - widthUnit.x * insetPx - depthUnit.x * insetPx,
          y: rightF.y - widthUnit.y * insetPx - depthUnit.y * insetPx,
        };
        const inner_bl = {
          x: leftF.x + widthUnit.x * insetPx - depthUnit.x * insetPx,
          y: leftF.y + widthUnit.y * insetPx - depthUnit.y * insetPx,
        };

        const drawRoundedShowerFloor = (tl: ScreenPoint, tr: ScreenPoint, br: ScreenPoint, bl: ScreenPoint) => {
          const w = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2);
          const h = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2);
          // Fixed 60mm radius regardless of shower size
          const radiusMm = 60;
          const r = Math.max(3, camera.pixelsPerMm * radiusMm);
          const rt = Math.min(r / w, 0.499);
          const rs = Math.min(r / h, 0.499);
          graphics.moveTo(lerpT(tl, tr, rt).x, lerpT(tl, tr, rt).y);
          graphics.lineTo(lerpT(tr, tl, rt).x, lerpT(tr, tl, rt).y);
          graphics.arcTo(tr.x, tr.y, lerpT(tr, br, rs).x, lerpT(tr, br, rs).y, r);
          graphics.lineTo(lerpT(br, tr, rs).x, lerpT(br, tr, rs).y);
          graphics.arcTo(br.x, br.y, lerpT(br, bl, rt).x, lerpT(br, bl, rt).y, r);
          graphics.lineTo(lerpT(bl, br, rt).x, lerpT(bl, br, rt).y);
          graphics.arcTo(bl.x, bl.y, lerpT(bl, tl, rs).x, lerpT(bl, tl, rs).y, r);
          graphics.lineTo(lerpT(tl, bl, rs).x, lerpT(tl, bl, rs).y);
          graphics.arcTo(tl.x, tl.y, lerpT(tl, tr, rt).x, lerpT(tl, tr, rt).y, r);
          graphics.closePath();
          graphics.stroke();
        };

        drawRoundedShowerFloor(inner_tl, inner_tr, inner_br, inner_bl);

        // 2. Drain circle positioned at fixed 90mm offset from inner rectangle corner (top-left)
        const drainOffsetMm = 90;
        const drainOffsetPx = camera.pixelsPerMm * drainOffsetMm;
        
        // Offset 90mm along both width and depth axes from inner_tl
        const drainCenter = {
          x: inner_tl.x + widthUnit.x * drainOffsetPx + depthUnit.x * drainOffsetPx,
          y: inner_tl.y + widthUnit.y * drainOffsetPx + depthUnit.y * drainOffsetPx,
        };
        const drainRadiusMm = 60;
        const drainRadiusPx = Math.max(2, camera.pixelsPerMm * drainRadiusMm);
        graphics.beginPath();
        graphics.arc(drainCenter.x, drainCenter.y, drainRadiusPx, 0, Math.PI * 2);
        graphics.stroke();
      }

      if (displayedAsset.type === "bath") {
        // Bath viewed from above (top-down floor plan):
        // Outer rectangle boundary
        // Inner oval (rounded rectangle) tub interior
        // Circle plug hole at one end (bottom)

        // Lerp helper
        const lerpT = (a: ScreenPoint, b: ScreenPoint, t: number): ScreenPoint => ({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });

        // Fill layer for whole asset
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha * 0.4 });

        // 0. Outer rectangle boundary (main asset outline)
        graphics.setStrokeStyle({
          width: isSelected ? selectionStrokePx : Math.max(camera.pixelsPerMm * 14, 1.4),
          color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
          alpha: isSelected ? 0.96 : 0.9,
        });
        graphics.moveTo(backC1.x, backC1.y);
        graphics.lineTo(backC2.x, backC2.y);
        graphics.lineTo(frontC2.x, frontC2.y);
        graphics.lineTo(frontC1.x, frontC1.y);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();

        // 1. Inner oval tub interior (secondary stroke, no fill)
        graphics.setStrokeStyle({
          width: fgLineWidth * 0.8,
          color: fgColor,
          alpha: fgAlpha * 0.7,
        });

        // Fixed 40mm inset from edge
        const insetMm = 40;
        const insetPx = camera.pixelsPerMm * insetMm;

        // Calculate unit vectors along edges for rotation-aware inset
        const widthVec = { x: backC2.x - backC1.x, y: backC2.y - backC1.y };
        const depthVec = { x: frontC1.x - backC1.x, y: frontC1.y - backC1.y };
        const widthLen = Math.sqrt(widthVec.x ** 2 + widthVec.y ** 2);
        const depthLen = Math.sqrt(depthVec.x ** 2 + depthVec.y ** 2);
        const widthUnit = { x: widthVec.x / widthLen, y: widthVec.y / widthLen };
        const depthUnit = { x: depthVec.x / depthLen, y: depthVec.y / depthLen };

        // Inset each corner by fixed 40mm
        const inner_tl = {
          x: backC1.x + widthUnit.x * insetPx + depthUnit.x * insetPx,
          y: backC1.y + widthUnit.y * insetPx + depthUnit.y * insetPx,
        };
        const inner_tr = {
          x: backC2.x - widthUnit.x * insetPx + depthUnit.x * insetPx,
          y: backC2.y - widthUnit.y * insetPx + depthUnit.y * insetPx,
        };
        const inner_br = {
          x: frontC2.x - widthUnit.x * insetPx - depthUnit.x * insetPx,
          y: frontC2.y - widthUnit.y * insetPx - depthUnit.y * insetPx,
        };
        const inner_bl = {
          x: frontC1.x + widthUnit.x * insetPx - depthUnit.x * insetPx,
          y: frontC1.y + widthUnit.y * insetPx - depthUnit.y * insetPx,
        };

        // Draw rounded rectangle for tub interior
        const drawBathOval = (tl: ScreenPoint, tr: ScreenPoint, br: ScreenPoint, bl: ScreenPoint) => {
          const w = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2);
          const h = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2);
          // Fixed 100mm radius for tub curves (larger, doesn't scale with resize)
          const radiusMm = 240;
          const r = Math.max(3, camera.pixelsPerMm * radiusMm);
          const rt = Math.min(r / w, 0.499);
          const rs = Math.min(r / h, 0.499);
          graphics.moveTo(lerpT(tl, tr, rt).x, lerpT(tl, tr, rt).y);
          graphics.lineTo(lerpT(tr, tl, rt).x, lerpT(tr, tl, rt).y);
          graphics.arcTo(tr.x, tr.y, lerpT(tr, br, rs).x, lerpT(tr, br, rs).y, r);
          graphics.lineTo(lerpT(br, tr, rs).x, lerpT(br, tr, rs).y);
          graphics.arcTo(br.x, br.y, lerpT(br, bl, rt).x, lerpT(br, bl, rt).y, r);
          graphics.lineTo(lerpT(bl, br, rt).x, lerpT(bl, br, rt).y);
          graphics.arcTo(bl.x, bl.y, lerpT(bl, tl, rs).x, lerpT(bl, tl, rs).y, r);
          graphics.lineTo(lerpT(tl, bl, rs).x, lerpT(tl, bl, rs).y);
          graphics.arcTo(tl.x, tl.y, lerpT(tl, tr, rt).x, lerpT(tl, tr, rt).y, r);
          graphics.closePath();
          graphics.stroke();
        };

        drawBathOval(inner_tl, inner_tr, inner_br, inner_bl);

        // 2. Plug hole circle - centred on short side, 150mm from front edge
        const plugOffsetMm = 150;
        const plugOffsetPx = camera.pixelsPerMm * plugOffsetMm;

        // Centre of the front edge (short side)
        const frontMid_x = (inner_bl.x + inner_br.x) / 2;
        const frontMid_y = (inner_bl.y + inner_br.y) / 2;

        // Position 200mm from the front edge, moving towards the back
        const plugCenter = {
          x: frontMid_x - depthUnit.x * plugOffsetPx,
          y: frontMid_y - depthUnit.y * plugOffsetPx,
        };
        const plugRadiusMm = 30;
        const plugRadiusPx = Math.max(2, camera.pixelsPerMm * plugRadiusMm);
        graphics.beginPath();
        graphics.arc(plugCenter.x, plugCenter.y, plugRadiusPx, 0, Math.PI * 2);
        graphics.stroke();
      }

      if (displayedAsset.type === "basin") {
        // Basin viewed from above (top-down floor plan):
        // Outer elliptical boundary with fill
        // Inner concentric elliptical detail
        // Central drain circle

        // Fill layer for whole asset
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha * 0.4 });

        // 0. Outer elliptical boundary (secondary stroke detail)
        graphics.setStrokeStyle({
          width: fgLineWidth * 0.8,
          color: fgColor,
          alpha: fgAlpha * 0.7,
        });

        // Centre of the basin (center of bounding box)
        const centerX = (frontC1.x + frontC2.x + backC1.x + backC2.x) / 4;
        const centerY = (frontC1.y + frontC2.y + backC1.y + backC2.y) / 4;

        // Basin details are asymmetric along the depth axis (shallow 50mm, deep 100mm).
        // The corners rotate with the asset, so use them directly without swapping.
        const shallowC1 = frontC1;
        const shallowC2 = frontC2;
        const deepC1 = backC1;
        const deepC2 = backC2;

        // Calculate radii from corners
        const widthVec = { x: shallowC2.x - shallowC1.x, y: shallowC2.y - shallowC1.y };
        const depthVec = { x: deepC1.x - shallowC1.x, y: deepC1.y - shallowC1.y };
        const widthLen = Math.sqrt(widthVec.x ** 2 + widthVec.y ** 2);
        const depthLen = Math.sqrt(depthVec.x ** 2 + depthVec.y ** 2);
        const depthUnit = { x: depthVec.x / depthLen, y: depthVec.y / depthLen };
        
        // Asymmetric insets: 50mm from shallow end, 100mm from deep end, 50mm from sides
        const shallowInsetMm = 50;
        const deepInsetMm = 100;
        const sideInsetMm = 50;
        const shallowInsetPx = camera.pixelsPerMm * shallowInsetMm;
        const deepInsetPx = camera.pixelsPerMm * deepInsetMm;
        const sideInsetPx = camera.pixelsPerMm * sideInsetMm;
        
        // Width radius remains symmetric
        const radiusWidth = Math.max(3, widthLen / 2 - sideInsetPx);
        
        // Depth: new radius from asymmetric insets
        const availableDepth = depthLen - shallowInsetPx - deepInsetPx;
        const radiusDepth = Math.max(3, availableDepth / 2);
        
        // Shift center towards deep end by (deepInset - shallowInset) / 2
        const depthCenterOffset = (deepInsetPx - shallowInsetPx) / 2;
        const adjustedCenterX = centerX + depthUnit.x * depthCenterOffset;
        const adjustedCenterY = centerY + depthUnit.y * depthCenterOffset;

        // Calculate rotation angle from width vector
        const rotationAngle = Math.atan2(widthVec.y, widthVec.x);
        const cosA = Math.cos(rotationAngle);
        const sinA = Math.sin(rotationAngle);

        // Draw outer ellipse as rotated path
        graphics.beginPath();
        const ellipseSegments = 64;
        for (let i = 0; i <= ellipseSegments; i++) {
          const angle = (i / ellipseSegments) * Math.PI * 2;
          const x = radiusWidth * Math.cos(angle);
          const y = radiusDepth * Math.sin(angle);
          // Apply rotation
          const rotX = x * cosA - y * sinA;
          const rotY = x * sinA + y * cosA;
          // Apply translation
          const px = adjustedCenterX + rotX;
          const py = adjustedCenterY + rotY;
          
          if (i === 0) {
            graphics.moveTo(px, py);
          } else {
            graphics.lineTo(px, py);
          }
        }
        graphics.closePath();
        graphics.fill();
        graphics.stroke();

        // 1. Inner circle detail (secondary stroke, no fill)
        graphics.setStrokeStyle({
          width: fgLineWidth * 0.8,
          color: fgColor,
          alpha: fgAlpha * 0.7,
        });

        // Fixed 50mm diameter circle (25mm radius)
        const circleRadiusMm = 25;
        const circleRadiusPx = Math.max(2, camera.pixelsPerMm * circleRadiusMm);

        // Draw inner circle at true center of bounding box
        graphics.beginPath();
        graphics.arc(centerX, centerY, circleRadiusPx, 0, Math.PI * 2);
        graphics.stroke();
      }

      if (displayedAsset.type === "desk") {
        // Desk: two interior details within 1200×900 mm bounds
        // - Rectangle (1200×600) for desktop surface
        // - Semicircle (300mm radius = 600mm diameter) extending from one long edge
        // Both rendered with fill layer and primary stroke, no outer boundary
        
        // Use the pre-computed front/back mapping which handles animation correctly:
        // During animation: front is topLeft/topRight (local space), back is bottomLeft/bottomRight
        // At rest: front/back mapping changes based on cardinal rotation to maintain consistency
        const rectangleDepthMm = 600;
        const semicircleRadiusMm = 300;
        const totalDepthMm = rectangleDepthMm + semicircleRadiusMm; // 900
        const depthFraction = rectangleDepthMm / totalDepthMm; // 600/900 = 2/3
        
        // Rectangle occupies front portion (2/3 of depth), chair extends from back
        const rectC1 = frontC1;
        const rectC2 = frontC2;
        const rectC3 = { x: frontC1.x + (backC1.x - frontC1.x) * depthFraction, y: frontC1.y + (backC1.y - frontC1.y) * depthFraction };
        const rectC4 = { x: frontC2.x + (backC2.x - frontC2.x) * depthFraction, y: frontC2.y + (backC2.y - frontC2.y) * depthFraction };
        
        // Chair edge is on the back (extends from the far edge of rectangle toward back corner)
        const chairEdgeStart = rectC3;
        const chairEdgeEnd = rectC4;
        
        // 1. Draw rectangle (desktop surface)
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha * 0.4 });
        graphics.setStrokeStyle({
          width: isSelected ? selectionStrokePx : Math.max(camera.pixelsPerMm * 14, 1.4),
          color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
          alpha: isSelected ? 0.96 : 0.9,
        });
        graphics.moveTo(rectC1.x, rectC1.y);
        graphics.lineTo(rectC2.x, rectC2.y);
        graphics.lineTo(rectC4.x, rectC4.y);
        graphics.lineTo(rectC3.x, rectC3.y);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 2. Draw semicircle chair
        const chairMidX = (chairEdgeStart.x + chairEdgeEnd.x) / 2;
        const chairMidY = (chairEdgeStart.y + chairEdgeEnd.y) / 2;
        
        // Desk center (for outward direction check)
        const deskCenterX = (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4;
        const deskCenterY = (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4;
        
        // Calculate direction vector along chair edge (width direction)
        const chairWidthVec = { x: chairEdgeEnd.x - chairEdgeStart.x, y: chairEdgeEnd.y - chairEdgeStart.y };
        const chairWidthLen = Math.sqrt(chairWidthVec.x ** 2 + chairWidthVec.y ** 2);
        const chairWidthUnit = { x: chairWidthVec.x / chairWidthLen, y: chairWidthVec.y / chairWidthLen };
        
        // Calculate perpendicular direction (should point away from desk center)
        const perpCandidate = { x: -chairWidthUnit.y, y: chairWidthUnit.x };
        
        // Vector from desk center to chair edge midpoint
        const fromCenterToChairMid = { x: chairMidX - deskCenterX, y: chairMidY - deskCenterY };
        
        // If perpendicular points toward center (dot product < 0), flip it
        const dotProduct = perpCandidate.x * fromCenterToChairMid.x + perpCandidate.y * fromCenterToChairMid.y;
        const perpUnit = dotProduct < 0 ? { x: -perpCandidate.x, y: -perpCandidate.y } : perpCandidate;
        
        // Semicircle radius
        const chairRadiusPx = Math.max(3, camera.pixelsPerMm * semicircleRadiusMm);
        
        // Fill and stroke layers
        graphics.setFillStyle({ color: fgColor, alpha: fgFillAlpha * 0.4 });
        graphics.setStrokeStyle({
          width: isSelected ? selectionStrokePx : Math.max(camera.pixelsPerMm * 14, 1.4),
          color: isSelected ? theme.wallSelectionAccent : theme.roomOutline,
          alpha: isSelected ? 0.96 : 0.9,
        });
        
        // Draw semicircle extending outward from desk
        graphics.beginPath();
        const semicircleSegments = 32;
        let firstPointX = 0, firstPointY = 0;
        for (let i = 0; i <= semicircleSegments; i++) {
          const angle = (i / semicircleSegments) * Math.PI;
          // Semicircle with diameter along width axis, opening perpendicular outward
          const localX = chairRadiusPx * Math.cos(angle);
          const localY = chairRadiusPx * Math.sin(angle);
          
          // Transform to world coords
          const worldX = chairMidX + chairWidthUnit.x * localX + perpUnit.x * localY;
          const worldY = chairMidY + chairWidthUnit.y * localX + perpUnit.y * localY;
          
          if (i === 0) {
            firstPointX = worldX;
            firstPointY = worldY;
            graphics.moveTo(worldX, worldY);
          } else {
            graphics.lineTo(worldX, worldY);
          }
        }
        // Close the shape by connecting back to the start point
        graphics.lineTo(firstPointX, firstPointY);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
      }

    }

    // Stairs-specific visuals (tread lines and direction arrow)
    if (asset.type === "stairs") {
      const stairRunLengthMm = Math.max(anim ? anim.baseDepthMm : getStairRunLengthMm(displayedAsset), 1);
      const treadCount = Math.max(
        0,
        Math.floor(stairRunLengthMm / DEFAULT_STAIR_TREAD_SPACING_MM) - 1
      );
      for (let index = 1; index <= treadCount; index += 1) {
        const progress = (index * DEFAULT_STAIR_TREAD_SPACING_MM) / stairRunLengthMm;
        if (progress <= 0 || progress >= 1) continue;
        const [start, end] = anim
          ? [
              {
                x: topLeft.x + (bottomLeft.x - topLeft.x) * progress,
                y: topLeft.y + (bottomLeft.y - topLeft.y) * progress,
              },
              {
                x: topRight.x + (bottomRight.x - topRight.x) * progress,
                y: topRight.y + (bottomRight.y - topRight.y) * progress,
              },
            ]
          : (() => {
              const isQuarterTurnSideways =
                Math.abs(snapToCardinalRotationDegrees(displayedAsset.rotationDegrees ?? 0)) === 90;
              const startEdgeEnd = isQuarterTurnSideways ? topRight : bottomLeft;
              const endEdgeStart = isQuarterTurnSideways ? bottomLeft : topRight;
              return [
                {
                  x: topLeft.x + (startEdgeEnd.x - topLeft.x) * progress,
                  y: topLeft.y + (startEdgeEnd.y - topLeft.y) * progress,
                },
                {
                  x: endEdgeStart.x + (bottomRight.x - endEdgeStart.x) * progress,
                  y: endEdgeStart.y + (bottomRight.y - endEdgeStart.y) * progress,
                },
              ];
            })();
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

      drawStairDirectionArrow(
        graphics,
        displayedAsset,
        camera,
        viewport,
        theme,
        isSelected,
        stairRunLengthMm
      );
    }

    if (!isSelected) continue;

    // Only show resize handles for single selection, not for multi-select
    const assetSelections = selection.filter(
      (item): item is Extract<SharedSelectionItem, { type: "asset" }> => item.type === "asset"
    );
    if (assetSelections.length !== 1) continue;

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
  isSelected: boolean,
  runLengthMm = getStairRunLengthMm(asset)
) {
  if ((asset.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED) === false) return;
  const normalizedRotationDegrees = normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0);
  const resolvedDirection = asset.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION;
  const rotationRadians = (normalizedRotationDegrees * Math.PI) / 180;
  const direction = {
    x: Math.sin(rotationRadians) * (resolvedDirection === "reverse" ? -1 : 1),
    y: -Math.cos(rotationRadians) * (resolvedDirection === "reverse" ? -1 : 1),
  };
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
  theme: EditorCanvasTheme
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
      const displayedAsset = asset;
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

function drawFurnitureLabels(
  labelContainer: Container,
  rooms: Room[],
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme,
  selection: SharedSelectionItem[],
  showAssetLabels: boolean = true,
  showAssets: boolean = true
) {
  // Don't show labels if assets are hidden or if asset labels are hidden
  if (!showAssets || !showAssetLabels) return;
  
  const fontSizePx = clampValue(
    camera.pixelsPerMm * FURNITURE_LABEL_FONT_SIZE_WORLD_MM,
    FURNITURE_LABEL_MIN_FONT_SIZE_PX,
    FURNITURE_LABEL_MAX_FONT_SIZE_PX
  );
  const textResolution = getTextResolution();
  const renderedAtMs = performance.now();

  for (const room of rooms) {
    for (const asset of room.interiorAssets) {
      if (asset.type === "stairs") continue;
      const displayedAsset = asset;
      const screenWidthPx = (displayedAsset.widthMm) * camera.pixelsPerMm;
      const screenHeightPx = (displayedAsset.depthMm) * camera.pixelsPerMm;
      const isSelected = selection.some(
        (item) => item.type === "asset" && item.roomId === room.id && item.id === asset.id
      );
      // Show label if asset is large enough OR if it's selected
      if (!isSelected && (screenWidthPx < fontSizePx * 2.5 || screenHeightPx < fontSizePx * 2.5)) continue;

      const center = worldToScreen({ x: asset.xMm, y: asset.yMm }, camera, viewport);
      const labelText = asset.name || getInteriorAssetDisplayName(asset.type);

      const text = new Text({
        text: labelText,
        resolution: textResolution,
        style: {
          fontFamily: ROOM_LABEL_AREA_FONT_FAMILY,
          fontSize: fontSizePx,
          fontWeight: ROOM_LABEL_AREA_FONT_WEIGHT,
          fill: theme.roomLabelFill,
          stroke: {
            color: theme.roomLabelStroke,
            width: Math.max(1.1, fontSizePx * 0.12),
            join: "round",
          },
          letterSpacing: 0.15,
        },
      });
      text.roundPixels = true;
      text.anchor.set(0.5);
      text.position.set(snapToPixel(center.x, textResolution), snapToPixel(center.y, textResolution));
      text.alpha = isSelected ? 0.98 : 0.72;
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

function getCachedRoomSelectionHandles(
  room: Room,
  camera: CameraState,
  viewport: ViewportSize
) {
  const mode: "constrained-orthogonal" | "eight-way" = isNonRectangularEightWayRoom(room)
    ? "eight-way"
    : "constrained-orthogonal";
  const cameraKey = `${camera.xMm}:${camera.yMm}:${camera.pixelsPerMm}:${camera.rotationDegrees}`;
  const viewportKey = `${viewport.width}:${viewport.height}`;
  const cached = ROOM_HANDLE_LAYOUT_CACHE.get(room);

  if (
    cached &&
    cached.points === room.points &&
    cached.cameraKey === cameraKey &&
    cached.viewportKey === viewportKey &&
    cached.mode === mode
  ) {
    return cached;
  }

  const vertexHandles =
    mode === "eight-way"
      ? getFortyFiveVertexHandleLayouts(room, camera, viewport)
      : getConstrainedVertexHandleLayouts(room, camera, viewport);
  const wallSegmentHandles =
    vertexHandles.length > 0 ? getOrthogonalWallHandleLayouts(room, camera, viewport) : [];
  const next = {
    points: room.points,
    cameraKey,
    viewportKey,
    mode,
    vertexHandles,
    wallSegmentHandles,
  };
  ROOM_HANDLE_LAYOUT_CACHE.set(room, next);
  return next;
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
  selection: SharedSelectionItem[],
  showRoomNames: boolean = true,
  showAssets: boolean = true,
  showAssetLabels: boolean = true,
  options?: {
    includeStairDirectionLabels?: boolean;
    displayUnitOrigin?: UnitOrigin;
  }
) {
  clearContainerChildren(labelContainer);
  const measurementTextScale = getMeasurementTextScale(settings);
  const areaFontSizePx = getScaledMeasurementPx(ROOM_LABEL_AREA_FONT_SIZE_PX, settings);

  for (const room of rooms) {
    const layout = getRoomLabelLayout(room, camera, viewport, settings, {
      showArea: showDimensions,
      displayUnitOrigin: options?.displayUnitOrigin,
    });
    if (!layout) continue;
    if (!showRoomNames) continue;
    const textResolution = getTextResolution();
    const left = snapToPixel(layout.left, textResolution);
    const top = snapToPixel(layout.top, textResolution);
    const width = snapToPixel(layout.width, textResolution);
    const height = snapToPixel(layout.height, textResolution);
    const centerX = snapToPixel(layout.center.x, textResolution);
    const nameCenterY = snapToPixel(layout.nameCenterY, textResolution);
    const areaCenterY =
      layout.areaCenterY === null ? null : snapToPixel(layout.areaCenterY, textResolution);

    const isSelected = selectedRoomId === room.id || isRoomSelected(selection, room.id);
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
      theme
    );
  }

  drawFurnitureLabels(labelContainer, rooms, camera, viewport, theme, selection, showAssetLabels, showAssets);
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
  strokeColor?: number;
  strokeAlpha?: number;
};

type ResizeDimensionLabelLayout = {
  text: string;
  center: ScreenPoint;
  outwardDirection: ScreenPoint;
  tangentDirection: ScreenPoint;
  avoidanceDirection: ScreenPoint;
  strokeColor?: number;
  strokeAlpha?: number;
  width: number;
  height: number;
};

type OverlayAvoidRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type OpeningMoveDimensionSpan = {
  start: Point;
  end: Point;
  lengthMillimetres: number;
  offsetPx: number;
};

function drawOpeningMoveDimensions(
  labelContainer: Container,
  rooms: Room[],
  openingMoveUi: { roomId: string; openingId: string } | null,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme,
  displayUnitOrigin?: UnitOrigin
) {
  if (!openingMoveUi) return;

  const room = rooms.find((candidate) => candidate.id === openingMoveUi.roomId);
  const opening = room?.openings.find((candidate) => candidate.id === openingMoveUi.openingId);
  if (!room || !opening) return;

  const segment = getRoomWallSegment(room, opening.wall);
  if (!segment || segment.lengthMm <= 0) return;

  const currentRange = getOpeningWallOffsetRange(opening, segment.lengthMm);
  if (!currentRange) return;

  const sameWallRanges = room.openings
    .filter(
      (candidate) =>
        candidate.id !== opening.id &&
        candidate.wall === opening.wall
    )
    .map((candidate) => getOpeningWallOffsetRange(candidate, segment.lengthMm))
    .filter((range): range is { startOffsetMm: number; endOffsetMm: number } => range !== null)
    .sort((a, b) => a.startOffsetMm - b.startOffsetMm);

  const previousOpening = [...sameWallRanges]
    .reverse()
    .find((range) => range.endOffsetMm <= currentRange.startOffsetMm);
  const nextOpening = sameWallRanges.find((range) => range.startOffsetMm >= currentRange.endOffsetMm);

  const wallOffsetPx = getScaledMeasurementPx(OPENING_MOVE_DIMENSION_WALL_OFFSET_PX, settings);
  const neighborOffsetPx = getScaledMeasurementPx(OPENING_MOVE_DIMENSION_NEIGHBOR_OFFSET_PX, settings);
  const spans: OpeningMoveDimensionSpan[] = [
    {
      start: getWallPointAtOffsetForCanvas(segment, 0),
      end: getWallPointAtOffsetForCanvas(segment, currentRange.startOffsetMm),
      lengthMillimetres: currentRange.startOffsetMm,
      offsetPx: wallOffsetPx,
    },
    {
      start: getWallPointAtOffsetForCanvas(segment, currentRange.endOffsetMm),
      end: getWallPointAtOffsetForCanvas(segment, segment.lengthMm),
      lengthMillimetres: segment.lengthMm - currentRange.endOffsetMm,
      offsetPx: wallOffsetPx,
    },
  ];

  if (previousOpening) {
    spans.push({
      start: getWallPointAtOffsetForCanvas(segment, previousOpening.endOffsetMm),
      end: getWallPointAtOffsetForCanvas(segment, currentRange.startOffsetMm),
      lengthMillimetres: currentRange.startOffsetMm - previousOpening.endOffsetMm,
      offsetPx: neighborOffsetPx,
    });
  }

  if (nextOpening) {
    spans.push({
      start: getWallPointAtOffsetForCanvas(segment, currentRange.endOffsetMm),
      end: getWallPointAtOffsetForCanvas(segment, nextOpening.startOffsetMm),
      lengthMillimetres: nextOpening.startOffsetMm - currentRange.endOffsetMm,
      offsetPx: neighborOffsetPx,
    });
  }

  const arrowGraphics = new Graphics();
  const labelLayouts: ResizeDimensionLabelLayout[] = [];

  for (const span of spans) {
    const start = worldToScreen(span.start, camera, viewport);
    const end = worldToScreen(span.end, camera, viewport);
    const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
    if (span.lengthMillimetres <= 0 || lengthPx < OPENING_MOVE_DIMENSION_MIN_LENGTH_PX) continue;

    const midpointWorld = {
      x: (span.start.x + span.end.x) / 2,
      y: (span.start.y + span.end.y) / 2,
    };
    const midpoint = worldToScreen(midpointWorld, camera, viewport);
    const normalTarget = worldToScreen(
      {
        x: midpointWorld.x + segment.interiorNormal.x * 100,
        y: midpointWorld.y + segment.interiorNormal.y * 100,
      },
      camera,
      viewport
    );
    const normal = normalizeScreenDirection({
      x: normalTarget.x - midpoint.x,
      y: normalTarget.y - midpoint.y,
    });
    const tangent = normalizeScreenDirection({
      x: end.x - start.x,
      y: end.y - start.y,
    });
    const arrowStart = {
      x: start.x + normal.x * span.offsetPx,
      y: start.y + normal.y * span.offsetPx,
    };
    const arrowEnd = {
      x: end.x + normal.x * span.offsetPx,
      y: end.y + normal.y * span.offsetPx,
    };

    drawDoubleEndedDimensionArrow(arrowGraphics, arrowStart, arrowEnd, tangent, settings, theme);
    labelLayouts.push(
      createOpeningMoveDimensionLabelLayout(
        formatWallDimension(span.lengthMillimetres, displayUnitOrigin),
        {
          x: (arrowStart.x + arrowEnd.x) / 2,
          y: (arrowStart.y + arrowEnd.y) / 2,
        },
        normal,
        tangent,
        viewport,
        settings,
        theme
      )
    );
  }

  if (labelLayouts.length === 0) {
    arrowGraphics.destroy();
    return;
  }

  labelContainer.addChild(arrowGraphics);
  drawDimensionLabels(labelContainer, labelLayouts, settings, theme);
}

function getOpeningWallOffsetRange(
  opening: RoomOpening,
  wallLengthMm: number
): { startOffsetMm: number; endOffsetMm: number } | null {
  const centerOffsetMm = clampValue(opening.offsetMm, 0, wallLengthMm);
  const halfWidthMm = opening.widthMm / 2;
  const startOffsetMm = Math.max(0, centerOffsetMm - halfWidthMm);
  const endOffsetMm = Math.min(wallLengthMm, centerOffsetMm + halfWidthMm);
  if (endOffsetMm <= startOffsetMm) return null;

  return { startOffsetMm, endOffsetMm };
}

function getWallPointAtOffsetForCanvas(
  segment: NonNullable<ReturnType<typeof getRoomWallSegment>>,
  offsetMm: number
): Point {
  const safeLengthMm = Math.max(segment.lengthMm, 0.001);
  const t = clampValue(offsetMm / safeLengthMm, 0, 1);

  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * t,
    y: segment.start.y + (segment.end.y - segment.start.y) * t,
  };
}

function drawDoubleEndedDimensionArrow(
  graphics: Graphics,
  start: ScreenPoint,
  end: ScreenPoint,
  tangent: ScreenPoint,
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme
) {
  const measurementTextScale = getMeasurementTextScale(settings);
  const widthPx = Math.max(1, 1.25 * measurementTextScale);
  const arrowSizePx = getScaledMeasurementPx(6, settings);
  const arrowSpreadPx = getScaledMeasurementPx(4, settings);
  const normal = { x: -tangent.y, y: tangent.x };

  graphics.setStrokeStyle({
    width: widthPx,
    color: theme.wallSelectionAccent,
    alpha: 0.78,
    cap: "round",
    join: "round",
  });
  graphics.moveTo(start.x, start.y);
  graphics.lineTo(end.x, end.y);

  for (const [point, direction] of [
    [start, { x: tangent.x, y: tangent.y }],
    [end, { x: -tangent.x, y: -tangent.y }],
  ] as const) {
    graphics.moveTo(point.x, point.y);
    graphics.lineTo(
      point.x + direction.x * arrowSizePx + normal.x * arrowSpreadPx,
      point.y + direction.y * arrowSizePx + normal.y * arrowSpreadPx
    );
    graphics.moveTo(point.x, point.y);
    graphics.lineTo(
      point.x + direction.x * arrowSizePx - normal.x * arrowSpreadPx,
      point.y + direction.y * arrowSizePx - normal.y * arrowSpreadPx
    );
  }
  graphics.stroke();
}

function createOpeningMoveDimensionLabelLayout(
  text: string,
  center: ScreenPoint,
  outwardDirection: ScreenPoint,
  tangentDirection: ScreenPoint,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme
): ResizeDimensionLabelLayout {
  const measurementTextScale = getMeasurementTextScale(settings);
  const dimensionFontSizePx = getScaledMeasurementPx(RESIZE_DIMENSION_FONT_SIZE_PX, settings);
  const dimensionPaddingXPx = getScaledMeasurementPx(RESIZE_DIMENSION_PADDING_X_PX, settings);
  const dimensionPaddingYPx = getScaledMeasurementPx(RESIZE_DIMENSION_PADDING_Y_PX, settings);
  const labelGapPx = getScaledMeasurementPx(RESIZE_DIMENSION_LABEL_GAP_PX, settings);
  const measurementText = new Text({
    text,
    resolution: getTextResolution(),
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
    text,
    center: clampResizeDimensionLabelCenter(
      {
        x: center.x + outwardDirection.x * labelGapPx,
        y: center.y + outwardDirection.y * labelGapPx,
      },
      width,
      height,
      viewport
    ),
    outwardDirection,
    tangentDirection,
    avoidanceDirection: outwardDirection,
    strokeColor: theme.wallSelectionAccent,
    strokeAlpha: 0.82,
    width,
    height,
  };
}

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
  theme: EditorCanvasTheme,
  displayUnitOrigin?: UnitOrigin
) {
  if (!roomResizeUi.activeRoomId) return;
  if (
    !roomResizeUi.activeWall &&
    !roomResizeUi.activeCorner &&
    roomResizeUi.activeVertexIndex === null &&
    roomResizeUi.activeWallSegmentIndex === null
  ) {
    return;
  }

  const activeRoom = rooms.find((room) => room.id === roomResizeUi.activeRoomId);
  if (!activeRoom) return;

  const bounds = getAxisAlignedRoomBounds(activeRoom);
  const roomLabelLayout = getRoomLabelLayout(activeRoom, camera, viewport, settings, {
    showArea: true,
    displayUnitOrigin,
  });
  const labelSpecs = getResizeDimensionLabelSpecs(
    activeRoom,
    bounds,
    roomResizeUi.activeWall,
    roomResizeUi.activeCorner,
    roomResizeUi.activeVertexIndex,
    roomResizeUi.activeWallSegmentIndex,
    camera,
    viewport,
    settings,
    displayUnitOrigin
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
  theme: EditorCanvasTheme,
  displayUnitOrigin?: UnitOrigin
) {
  if (roomResizeUi.activeRoomId || roomResizeUi.activeWall || roomResizeUi.activeCorner) return;

  const targetRoomId = selectedWall?.roomId ?? selectedRoomId;
  if (!targetRoomId) return;

  const selectedRoom = rooms.find((room) => room.id === targetRoomId);
  if (!selectedRoom) return;

  const roomLabelLayout = getRoomLabelLayout(selectedRoom, camera, viewport, settings, {
    showArea: true,
    displayUnitOrigin,
  });
  const labelLayouts = getResolvedResizeDimensionLabelLayouts(
    getSelectedRoomDimensionLabelSpecs(
      selectedRoom,
      selectedWall,
      camera,
      viewport,
      settings,
      displayUnitOrigin
    ),
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
  constraintMode: "orthogonal" | "diagonal45",
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme,
  displayUnitOrigin?: UnitOrigin
) {
  const activeSegmentLabelSpec = getDraftActiveSegmentDimensionLabelSpec(
    draftPoints,
    cursorWorld,
    camera,
    viewport,
    activeSnapStepMm,
    constraintMode,
    displayUnitOrigin
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

  const draftPreviewRoom = getDraftPreviewRoom(
    draftPoints,
    cursorWorld,
    activeSnapStepMm,
    constraintMode
  );
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
        settings,
        displayUnitOrigin
      ),
      createDimensionLabelSpecForWallMeasurement(
        draftDimensionWalls.verticalWall,
        measurements.heightMillimetres,
        bounds,
        camera,
        viewport,
        settings,
        displayUnitOrigin
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
      color: labelLayout.strokeColor ?? theme.roomLabelPillSelectedStroke,
      alpha: labelLayout.strokeAlpha ?? RESIZE_DIMENSION_ACTIVE_STROKE_ALPHA,
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

function drawRulerDimensionLabels(
  labelContainer: Container,
  rulers: Array<{ start: Point; end: Point; hidden?: boolean }>,
  draft: { start: Point | null; end: Point | null },
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">,
  theme: EditorCanvasTheme,
  displayUnitOrigin?: UnitOrigin
) {
  const labelSpecs = [
    ...rulers
      .filter((ruler) => !ruler.hidden)
      .map((ruler) =>
        createRulerDimensionLabelSpec(ruler.start, ruler.end, camera, viewport, displayUnitOrigin)
      ),
    draft.start && draft.end
      ? createRulerDimensionLabelSpec(draft.start, draft.end, camera, viewport, displayUnitOrigin)
      : null,
  ].filter((labelSpec): labelSpec is ResizeDimensionLabelSpec => labelSpec !== null);

  if (labelSpecs.length === 0) return;

  const rulerTheme = {
    ...theme,
    roomLabelPillSelectedStroke: RULER_ACCENT_COLOR,
  };
  const labelLayouts = getResolvedResizeDimensionLabelLayouts(
    labelSpecs,
    null,
    viewport,
    [],
    settings
  );
  drawDimensionLabels(labelContainer, labelLayouts, settings, rulerTheme);
}

function createRulerDimensionLabelSpec(
  start: Point,
  end: Point,
  camera: CameraState,
  viewport: ViewportSize,
  displayUnitOrigin?: UnitOrigin
): ResizeDimensionLabelSpec | null {
  if (pointsEqual(start, end)) return null;

  const startScreen = worldToScreen(start, camera, viewport);
  const endScreen = worldToScreen(end, camera, viewport);
  const tangent = normalizeScreenDirection({
    x: endScreen.x - startScreen.x,
    y: endScreen.y - startScreen.y,
  });
  const normal = normalizeScreenDirection({
    x: -tangent.y,
    y: tangent.x,
  });
  const upwardNormal = normal.y > 0 ? { x: -normal.x, y: -normal.y } : normal;

  return {
    text: formatWallDimension(getEdgeLengthMillimetres(start, end), displayUnitOrigin),
    wall: "top",
    axis: Math.abs(tangent.x) >= Math.abs(tangent.y) ? "horizontal" : "vertical",
    center: {
      x: (startScreen.x + endScreen.x) / 2,
      y: (startScreen.y + endScreen.y) / 2,
    },
    outwardDirection: upwardNormal,
    tangentDirection: tangent,
    wallLengthPx: Math.hypot(endScreen.x - startScreen.x, endScreen.y - startScreen.y),
    normalPlacement: "outside",
    normalOffsetBiasPx: 0,
    strokeColor: RULER_ACCENT_COLOR,
    strokeAlpha: 0.86,
  };
}

function drawWallSplitHoverAffordance(
  labelContainer: Container,
  rooms: Room[],
  selectedRoomId: string | null,
  selection: SharedSelectionItem[],
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
  wallSplitHoverUi: WallSplitHoverUi | null,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "wallMeasurementPosition">,
  theme: EditorCanvasTheme
) {
  const targetRoomId = getSingleSelectedRoomIdForSplitAffordance(selectedRoomId, selection);
  if (!targetRoomId || roomResizeUi.activeRoomId) {
    return;
  }
  if (
    roomResizeUi.hoveredCorner ||
    roomResizeUi.hoveredVertexIndex !== null ||
    roomResizeUi.activeWall ||
    roomResizeUi.activeCorner ||
    roomResizeUi.activeVertexIndex !== null ||
    roomResizeUi.activeWallSegmentIndex !== null
  ) {
    return;
  }

  const hoveredWall: RoomWall | null =
    roomResizeUi.hoveredRoomId === targetRoomId
      ? roomResizeUi.hoveredWallSegmentIndex ?? roomResizeUi.hoveredWall
      : null;
  const wall = hoveredWall ?? (
    wallSplitHoverUi?.roomId === targetRoomId ? wallSplitHoverUi.wall : null
  );
  if (wall === null) return;

  const room = rooms.find((candidate) => candidate.id === targetRoomId);
  if (!room) return;

  const layout = getWallSplitHandleLayout(room, wall, camera, viewport, settings);
  if (!layout) return;

  drawWallSplitHandle(labelContainer, layout.center, theme);
  if (wallSplitHoverUi?.roomId === targetRoomId && wallSplitHoverUi.wall === wall && wallSplitHoverUi.tooltipVisible) {
    drawWallSplitTooltip(labelContainer, layout.center, viewport, theme);
  }
}

function getSingleSelectedRoomIdForSplitAffordance(
  selectedRoomId: string | null,
  selection: SharedSelectionItem[]
) {
  if (!selectedRoomId) return null;
  if (selection.length === 0) return selectedRoomId;
  if (selection.length !== 1) return null;

  const [item] = selection;
  if (item.type === "room" && item.id === selectedRoomId) return selectedRoomId;
  if (item.type === "wall" && item.roomId === selectedRoomId) return selectedRoomId;
  return null;
}

function drawWallSplitHandle(
  labelContainer: Container,
  center: ScreenPoint,
  theme: EditorCanvasTheme
) {
  const graphics = new Graphics();
  const resolution = getTextResolution();
  const x = snapToPixel(center.x, resolution);
  const y = snapToPixel(center.y, resolution);

  graphics.setFillStyle({ color: theme.wallSelectionAccent, alpha: 0.1 });
  graphics.circle(x, y, WALL_SPLIT_HANDLE_RADIUS_PX + 3);
  graphics.fill();
  graphics.setFillStyle({ color: theme.roomLabelPillFill, alpha: 0.96 });
  graphics.circle(x, y, WALL_SPLIT_HANDLE_RADIUS_PX);
  graphics.fill();
  graphics.setStrokeStyle({
    width: 1.2,
    color: theme.wallSelectionAccent,
    alpha: 0.74,
    cap: "round",
    join: "round",
  });
  graphics.circle(x, y, WALL_SPLIT_HANDLE_RADIUS_PX);
  graphics.stroke();

  const halfPlus = WALL_SPLIT_HANDLE_PLUS_SIZE_PX / 2;
  graphics.setStrokeStyle({
    width: 1.6,
    color: theme.wallSelectionAccent,
    alpha: 0.9,
    cap: "round",
    join: "round",
  });
  graphics.moveTo(x - halfPlus, y);
  graphics.lineTo(x + halfPlus, y);
  graphics.moveTo(x, y - halfPlus);
  graphics.lineTo(x, y + halfPlus);
  graphics.stroke();
  labelContainer.addChild(graphics);
}

function drawWallSplitTooltip(
  labelContainer: Container,
  controlCenter: ScreenPoint,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const resolution = getTextResolution();
  const text = new Text({
    text: WALL_SPLIT_TOOLTIP_TEXT,
    resolution,
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: WALL_SPLIT_TOOLTIP_FONT_SIZE_PX,
      fontWeight: "500",
      fill: theme.roomLabelFill,
      letterSpacing: 0,
    },
  });
  const width = text.width + WALL_SPLIT_TOOLTIP_PADDING_X_PX * 2;
  const height = text.height + WALL_SPLIT_TOOLTIP_PADDING_Y_PX * 2;
  const center = getWallSplitTooltipCenter(controlCenter, width, height, viewport);
  const left = snapToPixel(center.x - width / 2, resolution);
  const top = snapToPixel(center.y - height / 2, resolution);
  const tooltip = new Graphics();

  tooltip.setFillStyle({ color: theme.roomLabelPillFill, alpha: 0.96 });
  tooltip.roundRect(left, top, width, height, WALL_SPLIT_TOOLTIP_RADIUS_PX);
  tooltip.fill();
  tooltip.setStrokeStyle({
    width: 1,
    color: theme.roomLabelPillSelectedStroke,
    alpha: 0.48,
  });
  tooltip.roundRect(left, top, width, height, WALL_SPLIT_TOOLTIP_RADIUS_PX);
  tooltip.stroke();
  labelContainer.addChild(tooltip);

  text.roundPixels = true;
  text.anchor.set(0.5);
  text.position.set(snapToPixel(center.x, resolution), snapToPixel(center.y, resolution));
  labelContainer.addChild(text);
}

function getWallSplitTooltipCenter(
  controlCenter: ScreenPoint,
  width: number,
  height: number,
  viewport: ViewportSize
): ScreenPoint {
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  const minX = WALL_SPLIT_TOOLTIP_VIEWPORT_MARGIN_PX + width / 2;
  const maxX = Math.max(minX, viewport.width - WALL_SPLIT_TOOLTIP_VIEWPORT_MARGIN_PX - width / 2);
  const minY = WALL_SPLIT_TOOLTIP_VIEWPORT_MARGIN_PX + height / 2;
  const maxY = Math.max(minY, viewport.height - WALL_SPLIT_TOOLTIP_VIEWPORT_MARGIN_PX - height / 2);

  let best: { center: ScreenPoint; overflow: number; distance: number } | null = null;

  for (const direction of directions) {
    const projectedHalfExtent =
      (Math.abs(direction.x) * width) / 2 + (Math.abs(direction.y) * height) / 2;
    const offset =
      WALL_SPLIT_HANDLE_RADIUS_PX + WALL_SPLIT_TOOLTIP_CONTROL_GAP_PX + projectedHalfExtent;
    const rawCenter = {
      x: controlCenter.x + direction.x * offset,
      y: controlCenter.y + direction.y * offset,
    };
    const clampedCenter = {
      x: clampValue(rawCenter.x, minX, maxX),
      y: clampValue(rawCenter.y, minY, maxY),
    };
    const rect = getCenteredRect(clampedCenter, width, height);
    const controlRect = getCenteredRect(
      controlCenter,
      (WALL_SPLIT_HANDLE_RADIUS_PX + WALL_SPLIT_TOOLTIP_CONTROL_GAP_PX / 2) * 2,
      (WALL_SPLIT_HANDLE_RADIUS_PX + WALL_SPLIT_TOOLTIP_CONTROL_GAP_PX / 2) * 2
    );
    const overlapsControl = rectsOverlap(rect, controlRect);
    const overflow = Math.abs(clampedCenter.x - rawCenter.x) + Math.abs(clampedCenter.y - rawCenter.y);
    const distance = Math.hypot(clampedCenter.x - controlCenter.x, clampedCenter.y - controlCenter.y);
    const score = {
      center: clampedCenter,
      overflow: overlapsControl ? overflow + 10000 : overflow,
      distance,
    };

    if (!best || score.overflow < best.overflow || (score.overflow === best.overflow && score.distance < best.distance)) {
      best = score;
    }
  }

  return best?.center ?? {
    x: clampValue(controlCenter.x, minX, maxX),
    y: clampValue(controlCenter.y, minY, maxY),
  };
}

function drawVertexDeleteHandle(
  labelContainer: Container,
  center: ScreenPoint,
  theme: EditorCanvasTheme
) {
  const graphics = new Graphics();
  const resolution = getTextResolution();
  const x = snapToPixel(center.x, resolution);
  const y = snapToPixel(center.y, resolution);

  graphics.setFillStyle({ color: theme.wallSelectionAccent, alpha: 0.1 });
  graphics.circle(x, y, VERTEX_DELETE_HANDLE_RADIUS_PX + 3);
  graphics.fill();
  graphics.setFillStyle({ color: theme.roomLabelPillFill, alpha: 0.96 });
  graphics.circle(x, y, VERTEX_DELETE_HANDLE_RADIUS_PX);
  graphics.fill();
  graphics.setStrokeStyle({
    width: 1.2,
    color: theme.wallSelectionAccent,
    alpha: 0.74,
    cap: "round",
    join: "round",
  });
  graphics.circle(x, y, VERTEX_DELETE_HANDLE_RADIUS_PX);
  graphics.stroke();

  const half = WALL_SPLIT_HANDLE_PLUS_SIZE_PX / 2;
  // Draw a × by rotating the + arms 45°. cos45 = sin45 = √2/2 ≈ 0.7071.
  const c45 = half * 0.7071;
  graphics.setStrokeStyle({
    width: 1.6,
    color: theme.wallSelectionAccent,
    alpha: 0.9,
    cap: "round",
    join: "round",
  });
  graphics.moveTo(x - c45, y - c45);
  graphics.lineTo(x + c45, y + c45);
  graphics.moveTo(x + c45, y - c45);
  graphics.lineTo(x - c45, y + c45);
  graphics.stroke();
  labelContainer.addChild(graphics);
}

function drawVertexDeleteTooltip(
  labelContainer: Container,
  controlCenter: ScreenPoint,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const resolution = getTextResolution();
  const text = new Text({
    text: VERTEX_DELETE_TOOLTIP_TEXT,
    resolution,
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: WALL_SPLIT_TOOLTIP_FONT_SIZE_PX,
      fontWeight: "500",
      fill: theme.roomLabelFill,
      letterSpacing: 0,
    },
  });
  const width = text.width + WALL_SPLIT_TOOLTIP_PADDING_X_PX * 2;
  const height = text.height + WALL_SPLIT_TOOLTIP_PADDING_Y_PX * 2;
  const center = getWallSplitTooltipCenter(controlCenter, width, height, viewport);
  const left = snapToPixel(center.x - width / 2, resolution);
  const top = snapToPixel(center.y - height / 2, resolution);
  const tooltip = new Graphics();

  tooltip.setFillStyle({ color: theme.roomLabelPillFill, alpha: 0.96 });
  tooltip.roundRect(left, top, width, height, WALL_SPLIT_TOOLTIP_RADIUS_PX);
  tooltip.fill();
  tooltip.setStrokeStyle({
    width: 1,
    color: theme.roomLabelPillSelectedStroke,
    alpha: 0.48,
  });
  tooltip.roundRect(left, top, width, height, WALL_SPLIT_TOOLTIP_RADIUS_PX);
  tooltip.stroke();
  labelContainer.addChild(tooltip);

  text.roundPixels = true;
  text.anchor.set(0.5);
  text.position.set(snapToPixel(center.x, resolution), snapToPixel(center.y, resolution));
  labelContainer.addChild(text);
}

function drawVertexDeleteHoverAffordance(
  labelContainer: Container,
  rooms: Room[],
  selectedRoomId: string | null,
  selection: SharedSelectionItem[],
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
  vertexDeleteHoverUi: VertexDeleteHoverUi | null,
  camera: CameraState,
  viewport: ViewportSize,
  theme: EditorCanvasTheme
) {
  const targetRoomId = getSingleSelectedRoomIdForSplitAffordance(selectedRoomId, selection);
  if (!targetRoomId || roomResizeUi.activeRoomId) return;
  if (
    roomResizeUi.activeWall ||
    roomResizeUi.activeCorner ||
    roomResizeUi.activeVertexIndex !== null ||
    roomResizeUi.activeWallSegmentIndex !== null
  ) {
    return;
  }

  const hoveredVertexIndex =
    roomResizeUi.hoveredRoomId === targetRoomId ? roomResizeUi.hoveredVertexIndex : null;
  if (hoveredVertexIndex === null) return;

  const room = rooms.find((r) => r.id === targetRoomId);
  if (!room || hoveredVertexIndex >= room.points.length) return;

  const handleCenter = getVertexDeleteHandleCenter(room, hoveredVertexIndex, camera, viewport);
  if (!handleCenter) return;

  drawVertexDeleteHandle(labelContainer, handleCenter, theme);
  if (
    vertexDeleteHoverUi?.roomId === targetRoomId &&
    vertexDeleteHoverUi.vertexIndex === hoveredVertexIndex &&
    vertexDeleteHoverUi.tooltipVisible
  ) {
    drawVertexDeleteTooltip(labelContainer, handleCenter, viewport, theme);
  }
}

function getResizeDimensionLabelSpecs(
  room: Room,
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null,
  activeWall: RectWall | null,
  activeCorner: RectCorner | null,
  activeVertexIndex: number | null,
  activeWallSegmentIndex: number | null,
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "measurementFontSize">,
  displayUnitOrigin?: UnitOrigin
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
        settings,
        displayUnitOrigin
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
        settings,
        displayUnitOrigin
      ),
      createDimensionLabelSpecForWallMeasurement(
        verticalWall,
        measurements.heightMillimetres,
        bounds,
        camera,
        viewport,
        settings,
        displayUnitOrigin
      ),
    ];
  }

  if (activeVertexIndex !== null) {
    return getResizeDimensionLabelSpecsForVertex(
      room,
      activeVertexIndex,
      camera,
      viewport,
      displayUnitOrigin
    );
  }

  if (activeWallSegmentIndex !== null) {
    return getResizeDimensionLabelSpecsForOrthogonalWallSegment(
      room,
      activeWallSegmentIndex,
      camera,
      viewport,
      displayUnitOrigin
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
  viewport: ViewportSize,
  displayUnitOrigin?: UnitOrigin
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
      { wallMeasurementPosition: "outside" },
      displayUnitOrigin
    );
    return labelSpec ? [labelSpec] : [];
  });
}

function getResizeDimensionLabelSpecsForVertex(
  room: Room,
  vertexIndex: number,
  camera: CameraState,
  viewport: ViewportSize,
  displayUnitOrigin?: UnitOrigin
): ResizeDimensionLabelSpec[] {
  if (room.points.length < 4) return [];

  const pointCount = room.points.length;
  const adjacentWallIndices = [
    (vertexIndex - 1 + pointCount) % pointCount,
    vertexIndex,
  ];

  return adjacentWallIndices.flatMap((wallIndex) => {
    const wallMeasurement = getRoomWallMeasurement(room, wallIndex);
    if (!wallMeasurement) return [];

    const labelSpec = createDimensionLabelSpecForEdgeMeasurement(
      room,
      wallMeasurement,
      camera,
      viewport,
      { wallMeasurementPosition: "outside" },
      displayUnitOrigin
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
  settings: Pick<EditorSettings, "measurementFontSize">,
  displayUnitOrigin?: UnitOrigin
): ResizeDimensionLabelSpec {
  return {
    text: formatWallDimension(lengthMillimetres, displayUnitOrigin),
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
  settings: Pick<EditorSettings, "wallMeasurementPosition">,
  displayUnitOrigin?: UnitOrigin
): ResizeDimensionLabelSpec[] {
  if (selectedWall) {
    const wallMeasurement = getRoomWallMeasurement(room, selectedWall.wall);
    if (!wallMeasurement) return [];

    const labelSpec = createDimensionLabelSpecForEdgeMeasurement(
      room,
      wallMeasurement,
      camera,
      viewport,
      settings,
      displayUnitOrigin
    );
    return labelSpec ? [labelSpec] : [];
  }

  return getRoomEdgeMeasurements(room).flatMap((edge) => {
    const labelSpec = createDimensionLabelSpecForEdgeMeasurement(
      room,
      edge,
      camera,
      viewport,
      settings,
      displayUnitOrigin
    );
    return labelSpec ? [labelSpec] : [];
  });
}

function createDimensionLabelSpecForEdgeMeasurement(
  room: Room,
  edge: { start: Point; end: Point; lengthMillimetres: number },
  camera: CameraState,
  viewport: ViewportSize,
  settings: Pick<EditorSettings, "wallMeasurementPosition">,
  displayUnitOrigin?: UnitOrigin
): ResizeDimensionLabelSpec | null {
  const midpoint = {
    x: (edge.start.x + edge.end.x) / 2,
    y: (edge.start.y + edge.end.y) / 2,
  };
  const outwardOffsetWorld = getEdgeOutwardOffsetWorld(room.points, edge.start, edge.end);
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
    text: formatWallDimension(edge.lengthMillimetres, displayUnitOrigin),
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

function getEdgeOutwardOffsetWorld(
  polygonPoints: Point[],
  start: Point,
  end: Point
): Point | null {
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return null;

  const candidateNormals = [
    { x: -dy / length, y: dx / length },
    { x: dy / length, y: -dx / length },
  ];

  for (const normal of candidateNormals) {
    const inwardProbe = {
      x: midpoint.x - normal.x,
      y: midpoint.y - normal.y,
    };
    const outwardProbe = {
      x: midpoint.x + normal.x,
      y: midpoint.y + normal.y,
    };

    if (isPointInPolygon(inwardProbe, polygonPoints) && !isPointInPolygon(outwardProbe, polygonPoints)) {
      return normal;
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
      strokeColor: labelSpec.strokeColor,
      strokeAlpha: labelSpec.strokeAlpha,
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
  activeSnapStepMm: number | null,
  constraintMode: "orthogonal" | "diagonal45"
): Point {
  return getConstrainedDrawPoint(anchorPoint, cursorWorld, activeSnapStepMm, null, constraintMode);
}

function getDraftPreviewRoom(
  draftPoints: Point[],
  cursorWorld: Point | null,
  activeSnapStepMm: number | null,
  constraintMode: "orthogonal" | "diagonal45"
): Room | null {
  if (!cursorWorld) return null;
  if (draftPoints.length < 4) return null;

  const previewPoint = getDraftPreviewPoint(
    draftPoints[draftPoints.length - 1],
    cursorWorld,
    activeSnapStepMm,
    constraintMode
  );
  if (!pointsEqual(previewPoint, draftPoints[0])) return null;
  if (!isSupportedDrawPointPath(draftPoints, { closed: true }) || !isSimplePolygon(draftPoints)) {
    return null;
  }

  return {
    id: "__draft-preview__",
    floorId: DEFAULT_FLOOR_ID,
    name: "",
    heightMm: normalizeRoomHeightMm(undefined),
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
  activeSnapStepMm: number | null,
  constraintMode: "orthogonal" | "diagonal45",
  displayUnitOrigin?: UnitOrigin
): ResizeDimensionLabelSpec | null {
  if (!cursorWorld || draftPoints.length === 0) return null;

  const anchorPoint = draftPoints[draftPoints.length - 1];
  const previewPoint = getDraftPreviewPoint(anchorPoint, cursorWorld, activeSnapStepMm, constraintMode);
  if (anchorPoint.x === previewPoint.x && anchorPoint.y === previewPoint.y) return null;
  if (draftPoints.length >= 4 && pointsEqual(previewPoint, draftPoints[0])) return null;
  if (anchorPoint.x !== previewPoint.x && anchorPoint.y !== previewPoint.y) return null;

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
    text: formatWallDimension(
      getEdgeLengthMillimetres(anchorPoint, previewPoint),
      displayUnitOrigin
    ),
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
  // Draw diagonal guide segments in blue
  for (const segment of guides.diagonalGuideSegments) {
    drawDashedGuideLine(
      graphics,
      worldToScreen(segment.start, camera, viewport),
      worldToScreen(segment.end, camera, viewport),
      theme.interactiveAccent
    );
  }

  if (guides.segments.length > 0) {
    for (const segment of guides.segments) {
      drawDashedGuideLine(
        graphics,
        worldToScreen(segment.start, camera, viewport),
        worldToScreen(segment.end, camera, viewport),
        theme.guidelineAccent
      );
    }
    return;
  }

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
  constraintMode: "orthogonal" | "diagonal45",
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
      activeSnapStepMm,
      constraintMode
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

function drawRulers(
  graphics: Graphics,
  rulers: Array<{ id: string; start: Point; end: Point; hidden?: boolean }>,
  draft: { start: Point | null; end: Point | null },
  selectedRulerId: string | null,
  rulerInteractionUi: RulerInteractionUi | null,
  camera: CameraState,
  viewport: ViewportSize
) {
  for (const ruler of rulers) {
    if (ruler.hidden) continue;
    const interactionTarget =
      rulerInteractionUi?.rulerId === ruler.id ? rulerInteractionUi.target : null;
    const isActive = ruler.id === selectedRulerId || interactionTarget !== null;
    drawRulerLine(
      graphics,
      ruler.start,
      ruler.end,
      camera,
      viewport,
      isActive ? 1 : 0.78,
      isActive,
      interactionTarget,
      rulerInteractionUi?.rulerId === ruler.id && rulerInteractionUi.isDragging
    );
  }

  if (draft.start) {
    const end = draft.end ?? draft.start;
    drawRulerLine(graphics, draft.start, end, camera, viewport, 1, true);
  }
}

function drawRulerLine(
  graphics: Graphics,
  start: Point,
  end: Point,
  camera: CameraState,
  viewport: ViewportSize,
  alpha: number,
  isSelected: boolean,
  interactionTarget: "start" | "end" | "body" | null = null,
  isDragging = false
) {
  const startScreen = worldToScreen(start, camera, viewport);
  const endScreen = worldToScreen(end, camera, viewport);
  const textResolution = getTextResolution();
  const startX = snapToPixel(startScreen.x, textResolution);
  const startY = snapToPixel(startScreen.y, textResolution);
  const endX = snapToPixel(endScreen.x, textResolution);
  const endY = snapToPixel(endScreen.y, textResolution);

  if (startX !== endX || startY !== endY) {
    graphics.setStrokeStyle({
      width: isSelected ? 2 : 1.5,
      color: RULER_ACCENT_COLOR,
      alpha: isSelected ? alpha : alpha * 0.72,
      cap: "round",
      join: "round",
    });
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.stroke();
  }

  graphics.setFillStyle({ color: RULER_ACCENT_COLOR, alpha: 0.12 * alpha });
  graphics.circle(startX, startY, isSelected ? 6 : 5);
  graphics.fill();
  graphics.setFillStyle({ color: RULER_ACCENT_COLOR, alpha: alpha * 0.8 });
  graphics.circle(startX, startY, isSelected ? 3 : 2.5);
  graphics.fill();

  if (startX === endX && startY === endY) return;

  graphics.setFillStyle({ color: RULER_ACCENT_COLOR, alpha: 0.1 * alpha });
  graphics.circle(endX, endY, isSelected ? 6 : 5);
  graphics.fill();
  graphics.setFillStyle({ color: RULER_ACCENT_COLOR, alpha: isSelected ? alpha * 0.8 : alpha * 0.65 });
  graphics.circle(endX, endY, isSelected ? 3 : 2.5);
  graphics.fill();

  if (interactionTarget === "start" || interactionTarget === "end") {
    const handleX = interactionTarget === "start" ? startX : endX;
    const handleY = interactionTarget === "start" ? startY : endY;
    graphics.setFillStyle({ color: RULER_ACCENT_COLOR, alpha: isDragging ? 0.18 : 0.12 });
    graphics.circle(handleX, handleY, isDragging ? 10 : 9);
    graphics.fill();
    graphics.setStrokeStyle({
      width: isDragging ? 2 : 1.5,
      color: RULER_ACCENT_COLOR,
      alpha: 0.9,
    });
    graphics.circle(handleX, handleY, isDragging ? 10 : 9);
    graphics.stroke();
  }
}

function drawAngleIndicator(
  labelContainer: Container,
  point: Point,
  label: string,
  theme: EditorCanvasTheme
) {
  const textResolution = getTextResolution();
  const text = new Text({
    text: label,
    resolution: textResolution,
    style: {
      fontFamily: MEASUREMENT_TEXT_FONT_FAMILY,
      fontSize: 12,
      fontWeight: "500",
      fill: theme.roomLabelFill,
      stroke: {
        color: theme.roomLabelStroke,
        width: 2,
        join: "round",
      },
      letterSpacing: 0.2,
    },
  });
  text.roundPixels = true;
  text.anchor.set(0.5, 1); // Center horizontally, bottom align
  text.position.set(
    snapToPixel(point.x, textResolution),
    snapToPixel(point.y - 8, textResolution) // Position above the cursor
  );
  text.alpha = 0.9;
  labelContainer.addChild(text);
}

function getDraftAngleIndicatorLabel(
  draftPoints: Point[],
  cursorWorld: Point | null,
  activeSnapStepMm: number | null,
  constraintMode: "orthogonal" | "diagonal45"
): string | null {
  if (constraintMode !== "diagonal45" || !cursorWorld || draftPoints.length === 0) return null;

  const anchorPoint = draftPoints[draftPoints.length - 1];
  const previewPoint = getDraftPreviewPoint(anchorPoint, cursorWorld, activeSnapStepMm, constraintMode);
  const dx = previewPoint.x - anchorPoint.x;
  const dy = previewPoint.y - anchorPoint.y;
  if (dx === 0 && dy === 0) return null;

  const normalizedAngle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const snappedAngle = Math.round(normalizedAngle / 45) * 45;

  return `${snappedAngle % 360}°`;
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

function drawDashedRoomOutline(
  graphics: Graphics,
  points: Point[],
  camera: CameraState,
  viewport: ViewportSize,
  color: number,
  strokeWidth: number,
  strokeAlpha: number
) {
  const screenPoints = points.map((point) => worldToScreen(point, camera, viewport));
  if (screenPoints.length < 2) return;

  const dashLength = 10;
  const gapLength = 8;

  graphics.setStrokeStyle({ width: strokeWidth, color, alpha: strokeAlpha });

  // Draw dashed lines for each wall of the room
  for (let i = 0; i < screenPoints.length; i += 1) {
    const start = screenPoints[i];
    const end = screenPoints[(i + 1) % screenPoints.length];

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) continue;

    const stepX = dx / length;
    const stepY = dy / length;

    for (let distance = 0; distance < length; distance += dashLength + gapLength) {
      const dashStart = distance;
      const dashEnd = Math.min(distance + dashLength, length);
      graphics.moveTo(start.x + stepX * dashStart, start.y + stepY * dashStart);
      graphics.lineTo(start.x + stepX * dashEnd, start.y + stepY * dashEnd);
    }
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

function drawAlternatingGridLines(
  graphics: Graphics,
  camera: CameraState,
  viewport: ViewportSize,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  stepMm: number,
  subtleStroke: { width: number; color: number; alpha: number },
  prominentStroke: { width: number; color: number; alpha: number }
) {
  const firstX = Math.floor(minX / stepMm) * stepMm;
  const firstY = Math.floor(minY / stepMm) * stepMm;
  const doubleStep = stepMm * 2;

  // Draw vertical lines, alternating between subtle and prominent
  for (let xMm = firstX; xMm <= maxX; xMm += stepMm) {
    const isProminent = Math.round(xMm / stepMm) % 2 === 0;
    const stroke = isProminent ? prominentStroke : subtleStroke;
    graphics.setStrokeStyle(stroke);

    const start = worldToScreen({ x: xMm, y: minY }, camera, viewport);
    const end = worldToScreen({ x: xMm, y: maxY }, camera, viewport);
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
    graphics.stroke();
  }

  // Draw horizontal lines, alternating between subtle and prominent
  for (let yMm = firstY; yMm <= maxY; yMm += stepMm) {
    const isProminent = Math.round(yMm / stepMm) % 2 === 0;
    const stroke = isProminent ? prominentStroke : subtleStroke;
    graphics.setStrokeStyle(stroke);

    const start = worldToScreen({ x: minX, y: yMm }, camera, viewport);
    const end = worldToScreen({ x: maxX, y: yMm }, camera, viewport);
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
    graphics.stroke();
  }
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

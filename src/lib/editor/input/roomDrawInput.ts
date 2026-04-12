import {
  findInteriorAssetAtScreenPoint,
  getInteriorAssetBoundsAsRectBounds,
} from "@/lib/editor/interiorAssets";
import { findOpeningAtScreenPoint } from "@/lib/editor/openings";
import { findRoomWallAtScreenPoint } from "@/lib/editor/openings";
import { findSelectedOpeningWidthHandleAtScreenPoint } from "@/lib/editor/openings";
import { screenToWorld } from "@/lib/editor/camera";
import { track } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { findRoomLabelAtScreenPoint } from "@/lib/editor/roomLabel";
import {
  getActiveSnapStepMm,
  getConstrainedDrawPoint,
  getMagneticSnapGuidesForSettings,
  getPredictiveSnapGuides,
  getSnappedPointFromGuides,
  type DrawConstraintMode,
  type SnapGuides,
} from "@/lib/editor/snapping";
import {
  findRoomAtPoint,
  isAxisAlignedRectangle,
  isPointInPolygon,
} from "@/lib/editor/roomGeometry";
import {
  getCornerHandleLayouts,
  getAxisAlignedRoomBounds,
  getWallHandleLayouts,
  hitTestCornerHandle,
  hitTestRoomWallEdge,
  hitTestWallHandle,
  type RectWall,
} from "@/lib/editor/rectRoomResize";
import {
  getRoomTranslationDelta,
  translateRoomPointsOnGrid,
} from "@/lib/editor/roomTranslation";
import type { Point, Room } from "@/lib/editor/types";
import type { RoomWall } from "@/lib/editor/types";
import {
  getInteriorAssetResizeFromCornerForCursor,
  getInteriorAssetResizeFromWallForCursor,
  getInteriorAssetMoveCenterForCursor,
  getOpeningMoveOffsetForCursor,
  getOpeningResizeWidthForCursor,
} from "@/stores/editorStore";
import {
  createTransformFeedbackTargetFromPoints,
  createTransformFeedback,
  TRANSFORM_SETTLE_TOTAL_MS,
  type TransformFeedback,
} from "@/lib/editor/transformFeedback";

type RoomDrawStoreState = {
  camera: { xMm: number; yMm: number; pixelsPerMm: number; rotationDegrees: number };
  viewport: { width: number; height: number };
  settings: { showGuidelines: boolean; snappingEnabled: boolean };
  document: { rooms: Room[] };
  roomDraft: { points: Point[] };
  selectedRoomId: string | null;
  selectedWall: { roomId: string; wall: RoomWall } | null;
  selectedOpening: { roomId: string; openingId: string } | null;
  selectedInteriorAsset: { roomId: string; assetId: string } | null;
  placeDraftPointFromCursor: (
    cursorWorld: Point,
    options?: { constraintMode?: DrawConstraintMode }
  ) => void;
  stepBackDraft: () => void;
  resetDraft: () => void;
  selectRoomById: (roomId: string | null) => void;
  selectWallByRoomId: (roomId: string, wall: RoomWall) => void;
  selectOpeningById: (roomId: string, openingId: string) => void;
  selectInteriorAssetById: (roomId: string, assetId: string) => void;
  clearRoomSelection: () => void;
  previewOpeningMove: (roomId: string, openingId: string, nextOffsetMm: number) => void;
  previewOpeningResize: (roomId: string, openingId: string, nextWidthMm: number) => void;
  commitOpeningMove: (
    roomId: string,
    openingId: string,
    previousOffsetMm: number,
    nextOffsetMm: number
  ) => void;
  commitOpeningResize: (
    roomId: string,
    openingId: string,
    previousWidthMm: number,
    nextWidthMm: number
  ) => void;
  previewInteriorAssetMove: (roomId: string, assetId: string, nextCenter: Point) => void;
  commitInteriorAssetMove: (
    roomId: string,
    assetId: string,
    previousCenter: Point,
    nextCenter: Point
  ) => void;
  previewInteriorAssetResize: (
    roomId: string,
    assetId: string,
    nextAsset: { widthMm: number; depthMm: number; xMm: number; yMm: number }
  ) => void;
  commitInteriorAssetResize: (
    roomId: string,
    assetId: string,
    previousAsset: { widthMm: number; depthMm: number; xMm: number; yMm: number },
    nextAsset: { widthMm: number; depthMm: number; xMm: number; yMm: number }
  ) => void;
  previewRoomMove: (roomId: string, nextPoints: Point[]) => void;
  commitRoomMove: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
  setCanvasInteractionActive: (isActive: boolean) => void;
};

type RoomDrawStore = {
  getState: () => RoomDrawStoreState;
};

type RoomDrawInputCallbacks = {
  onCursorWorldChange: (cursorWorld: Point | null) => void;
  onHoveredRoomLabelChange: (roomId: string | null) => void;
  onHoveredSelectableWallChange?: (wallSelection: { roomId: string; wall: RoomWall } | null) => void;
  onTransformFeedbackChange?: (feedback: TransformFeedback | null) => void;
  onSnapGuidesChange?: (guides: SnapGuides | null) => void;
  onDraftConstraintModeChange?: (mode: DrawConstraintMode) => void;
  onRoomLabelSelected?: (roomId: string) => void;
  requestRender: () => void;
};

type LabelDragSession = {
  pointerId: number;
  roomId: string;
  startScreenPoint: Point;
  startWorldPoint: Point;
  startPoints: Point[];
  latestPoints: Point[] | null;
  didDrag: boolean;
};

type OpeningDragSession = {
  pointerId: number;
  roomId: string;
  openingId: string;
  startScreenPoint: Point;
  startOffsetMm: number;
  latestOffsetMm: number | null;
  didDrag: boolean;
};

type OpeningResizeSession = {
  pointerId: number;
  roomId: string;
  openingId: string;
  startScreenPoint: Point;
  startWidthMm: number;
  latestWidthMm: number | null;
  didDrag: boolean;
};

type InteriorAssetDragSession = {
  pointerId: number;
  roomId: string;
  assetId: string;
  startScreenPoint: Point;
  startWorldPoint: Point;
  startCenter: Point;
  latestCenter: Point | null;
  didDrag: boolean;
};

type InteriorAssetResizeSession = {
  pointerId: number;
  roomId: string;
  assetId: string;
  startScreenPoint: Point;
  startWorldPoint: Point;
  startAsset: { widthMm: number; depthMm: number; xMm: number; yMm: number };
  latestAsset: { widthMm: number; depthMm: number; xMm: number; yMm: number } | null;
  didDrag: boolean;
  target:
    | { type: "wall"; wall: "left" | "right" | "top" | "bottom" }
    | { type: "corner"; corner: "top-left" | "top-right" | "bottom-right" | "bottom-left" };
};

type SelectableWallHit = {
  roomId: string;
  wall: RoomWall;
  candidateCount: number;
};

const ROOM_LABEL_DRAG_THRESHOLD_PX = 6;
const WALL_INTERIOR_SIDE_EPSILON_MM = 0.001;
const DRAFT_GUIDE_TAIL_PX = 44;

/**
 * Handles room drawing interactions:
 * - left click places points while drafting
 * - room labels are the selection affordance when not drafting
 * - first click outside an active selection clears it without starting draw
 * - right click cancels active draft
 * - escape cancels active draft or clears room selection
 * - backspace steps the active draft back one click before fully canceling
 * Rendering stays in EditorCanvas.
 */
export function attachRoomDrawInput(
  canvas: HTMLCanvasElement,
  store: RoomDrawStore,
  callbacks: RoomDrawInputCallbacks
) {
  let isSpaceHeld = false;
  let isShiftHeld = false;
  let shouldSuppressNextContextMenu = false;
  let activePointerCount = 0;
  let latestCursorWorld: Point | null = null;
  let hoveredRoomLabelId: string | null = null;
  let hoveredSelectableRoomId: string | null = null;
  let hoveredSelectableWall: SelectableWallHit | null = null;
  let hoveredOpening: { roomId: string; openingId: string } | null = null;
  let hoveredInteriorAsset: { roomId: string; assetId: string } | null = null;
  let hoveredInteriorAssetWallHandle: "left" | "right" | "top" | "bottom" | null = null;
  let hoveredInteriorAssetCornerHandle:
    | "top-left"
    | "top-right"
    | "bottom-right"
    | "bottom-left"
    | null = null;
  let hoveredOpeningWidthHandle:
    | {
        roomId: string;
        openingId: string;
        edge: "start" | "end";
        axis: "horizontal" | "vertical" | "diagonal";
      }
    | null = null;
  let currentCursor = "";
  let activeLabelDragSession: LabelDragSession | null = null;
  let activeOpeningDragSession: OpeningDragSession | null = null;
  let activeOpeningResizeSession: OpeningResizeSession | null = null;
  let activeInteriorAssetDragSession: InteriorAssetDragSession | null = null;
  let activeInteriorAssetResizeSession: InteriorAssetResizeSession | null = null;
  const commitRoomMove = store.getState().commitRoomMove;
  const commitOpeningMove = store.getState().commitOpeningMove;
  const commitOpeningResize = store.getState().commitOpeningResize;
  const commitInteriorAssetMove = store.getState().commitInteriorAssetMove;
  const commitInteriorAssetResize = store.getState().commitInteriorAssetResize;
  let clearTransformFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const toCanvasPoint = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const setHoveredRoomLabelId = (roomId: string | null) => {
    if (hoveredRoomLabelId === roomId) return;
    hoveredRoomLabelId = roomId;
    callbacks.onHoveredRoomLabelChange(roomId);
  };

  const setHoveredSelectableRoomId = (roomId: string | null) => {
    hoveredSelectableRoomId = roomId;
  };

  const setHoveredSelectableWall = (wallSelection: SelectableWallHit | null) => {
    if (
      hoveredSelectableWall?.roomId === wallSelection?.roomId &&
      hoveredSelectableWall?.wall === wallSelection?.wall
    ) {
      return;
    }
    hoveredSelectableWall = wallSelection;
    callbacks.onHoveredSelectableWallChange?.(wallSelection);
  };

  const setTransformFeedback = (feedback: TransformFeedback | null) => {
    callbacks.onTransformFeedbackChange?.(feedback);
    callbacks.requestRender();
  };

  const setSnapGuides = (guides: SnapGuides | null) => {
    callbacks.onSnapGuidesChange?.(guides);
    callbacks.requestRender();
  };

  const getDrawConstraintMode = (shiftOverride?: boolean): DrawConstraintMode =>
    shiftOverride ?? isShiftHeld ? "diagonal45" : "orthogonal";

  const syncDraftConstraintMode = (shiftOverride?: boolean) => {
    callbacks.onDraftConstraintModeChange?.(getDrawConstraintMode(shiftOverride));
    callbacks.requestRender();
  };

  const getShortDraftGuideSegment = (
    anchorPoint: Point,
    constrainedPoint: Point,
    pixelsPerMm: number
  ) => {
    const dx = constrainedPoint.x - anchorPoint.x;
    const dy = constrainedPoint.y - anchorPoint.y;
    const lengthMm = Math.hypot(dx, dy);
    if (lengthMm <= 0) return null;

    const visibleLengthMm = Math.min(lengthMm, DRAFT_GUIDE_TAIL_PX / pixelsPerMm);
    const unitX = dx / lengthMm;
    const unitY = dy / lengthMm;

    return {
      start: {
        x: constrainedPoint.x - unitX * visibleLengthMm,
        y: constrainedPoint.y - unitY * visibleLengthMm,
      },
      end: constrainedPoint,
    };
  };

  const getDraftSnapGuides = (
    state: Pick<RoomDrawStoreState, "document" | "camera" | "settings" | "roomDraft">,
    cursorWorld: Point,
    shiftOverride?: boolean
  ): SnapGuides => {
    const anchorPoint = state.roomDraft.points[state.roomDraft.points.length - 1] ?? null;
    const constraintMode = getDrawConstraintMode(shiftOverride);
    const guides =
      anchorPoint
        ? getPredictiveSnapGuides(state.document.rooms, cursorWorld, state.camera, {
            constraintMode,
            anchorPoint,
          })
        : null;

    const constrainedPoint =
      anchorPoint
        ? getConstrainedDrawPoint(
            anchorPoint,
            cursorWorld,
            getActiveSnapStepMm(state.camera),
            null,
            constraintMode
          )
        : cursorWorld;
    const fallbackSegment = anchorPoint
      ? getShortDraftGuideSegment(anchorPoint, constrainedPoint, state.camera.pixelsPerMm)
      : null;

    return guides ?? {
      point: cursorWorld,
      showVertical: false,
      showHorizontal: false,
      diagonalLine: null,
      segments: fallbackSegment ? [fallbackSegment] : [],
      constraintMode,
      diagonalGuideSegments: [],
    };
  };

  const syncDraftSnapGuides = (shiftOverride?: boolean) => {
    const state = store.getState();
    if (state.roomDraft.points.length === 0 || !latestCursorWorld) {
      setSnapGuides(null);
      return;
    }

    const draftGuides = getDraftSnapGuides(state, latestCursorWorld, shiftOverride);
    if (!state.settings.showGuidelines) {
      setSnapGuides({
        ...draftGuides,
        segments: [],
      });
      return;
    }

    setSnapGuides(draftGuides);
  };

  const getInteriorAssetResizeCursorWorld = (
    session: InteriorAssetResizeSession,
    cursorWorld: Point
  ): Point => {
    const delta = {
      x: cursorWorld.x - session.startWorldPoint.x,
      y: cursorWorld.y - session.startWorldPoint.y,
    };
    const bounds = {
      minX: session.startAsset.xMm - session.startAsset.widthMm / 2,
      maxX: session.startAsset.xMm + session.startAsset.widthMm / 2,
      minY: session.startAsset.yMm - session.startAsset.depthMm / 2,
      maxY: session.startAsset.yMm + session.startAsset.depthMm / 2,
    };

    if (session.target.type === "wall") {
      if (session.target.wall === "left") {
        return { x: bounds.minX + delta.x, y: cursorWorld.y };
      }
      if (session.target.wall === "right") {
        return { x: bounds.maxX + delta.x, y: cursorWorld.y };
      }
      if (session.target.wall === "top") {
        return { x: cursorWorld.x, y: bounds.minY + delta.y };
      }
      return { x: cursorWorld.x, y: bounds.maxY + delta.y };
    }

    if (session.target.corner === "top-left") {
      return { x: bounds.minX + delta.x, y: bounds.minY + delta.y };
    }
    if (session.target.corner === "top-right") {
      return { x: bounds.maxX + delta.x, y: bounds.minY + delta.y };
    }
    if (session.target.corner === "bottom-right") {
      return { x: bounds.maxX + delta.x, y: bounds.maxY + delta.y };
    }
    return { x: bounds.minX + delta.x, y: bounds.maxY + delta.y };
  };

  const getMoveTransformFeedback = (
    roomId: string,
    originalPoints: Point[],
    previewPoints?: Point[],
    settlePoints?: Point[],
    phase: TransformFeedback["phase"] = "active"
  ) =>
    createTransformFeedback({
      roomId,
      mode: "move",
      phase,
      originalPoints,
      previewPoints,
      settleTarget: settlePoints ? createTransformFeedbackTargetFromPoints(settlePoints) : null,
    });

  const clearPendingTransformFeedbackTimeout = () => {
    if (!clearTransformFeedbackTimeoutId) return;
    clearTimeout(clearTransformFeedbackTimeoutId);
    clearTransformFeedbackTimeoutId = null;
  };

  const scheduleTransformFeedbackClear = () => {
    clearPendingTransformFeedbackTimeout();
    clearTransformFeedbackTimeoutId = setTimeout(() => {
      clearTransformFeedbackTimeoutId = null;
      setTransformFeedback(null);
    }, TRANSFORM_SETTLE_TOTAL_MS);
  };

  const setCursor = (nextCursor: string) => {
    if (currentCursor === nextCursor) return;
    currentCursor = nextCursor;
    canvas.style.cursor = nextCursor;
  };

  const updateCursor = () => {
    if (activeLabelDragSession?.didDrag) {
      setCursor("grabbing");
      return;
    }

    if (activeOpeningDragSession?.didDrag) {
      setCursor("grabbing");
      return;
    }

    if (activeInteriorAssetDragSession?.didDrag) {
      setCursor("grabbing");
      return;
    }

    if (activeInteriorAssetResizeSession) {
      if (activeInteriorAssetResizeSession.target.type === "wall") {
        setCursor(
          activeInteriorAssetResizeSession.target.wall === "left" ||
            activeInteriorAssetResizeSession.target.wall === "right"
            ? "ew-resize"
            : "ns-resize"
        );
      } else {
        setCursor(
          activeInteriorAssetResizeSession.target.corner === "top-left" ||
            activeInteriorAssetResizeSession.target.corner === "bottom-right"
            ? "nwse-resize"
            : "nesw-resize"
        );
      }
      return;
    }

    if (activeOpeningResizeSession?.didDrag) {
      setCursor("grabbing");
      return;
    }

    if (hoveredOpeningWidthHandle && !isSpaceHeld) {
      setCursor(
        hoveredOpeningWidthHandle.axis === "horizontal"
          ? "ew-resize"
          : hoveredOpeningWidthHandle.axis === "vertical"
            ? "ns-resize"
            : "nwse-resize"
      );
      return;
    }

    if (hoveredInteriorAssetCornerHandle && !isSpaceHeld) {
      setCursor(
        hoveredInteriorAssetCornerHandle === "top-left" ||
          hoveredInteriorAssetCornerHandle === "bottom-right"
          ? "nwse-resize"
          : "nesw-resize"
      );
      return;
    }

    if (hoveredInteriorAssetWallHandle && !isSpaceHeld) {
      setCursor(
        hoveredInteriorAssetWallHandle === "left" || hoveredInteriorAssetWallHandle === "right"
          ? "ew-resize"
          : "ns-resize"
      );
      return;
    }

    const isDrawingModeActive = store.getState().roomDraft.points.length > 0;
    if (!isSpaceHeld && isDrawingModeActive) {
      setCursor("crosshair");
      return;
    }

    if (
      !isSpaceHeld &&
      (
        hoveredRoomLabelId ||
        hoveredSelectableRoomId ||
        hoveredSelectableWall ||
        hoveredOpening ||
        hoveredInteriorAsset
      )
    ) {
      setCursor("pointer");
      return;
    }

    // Yield cursor ownership to pan/resize modules when not hovering a label.
    setCursor("");
  };

  const stopLabelDragSession = () => {
    if (!activeLabelDragSession) return;
    const pointerId = activeLabelDragSession.pointerId;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    activeLabelDragSession = null;
    store.getState().setCanvasInteractionActive(false);
    updateCursor();
  };

  const stopOpeningDragSession = () => {
    if (!activeOpeningDragSession) return;
    const pointerId = activeOpeningDragSession.pointerId;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    activeOpeningDragSession = null;
    store.getState().setCanvasInteractionActive(false);
    updateCursor();
  };

  const stopOpeningResizeSession = () => {
    if (!activeOpeningResizeSession) return;
    const pointerId = activeOpeningResizeSession.pointerId;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    activeOpeningResizeSession = null;
    store.getState().setCanvasInteractionActive(false);
    updateCursor();
  };

  const stopInteriorAssetDragSession = () => {
    if (!activeInteriorAssetDragSession) return;
    const pointerId = activeInteriorAssetDragSession.pointerId;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    activeInteriorAssetDragSession = null;
    store.getState().setCanvasInteractionActive(false);
    updateCursor();
  };

  const stopInteriorAssetResizeSession = () => {
    if (!activeInteriorAssetResizeSession) return;
    const pointerId = activeInteriorAssetResizeSession.pointerId;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    activeInteriorAssetResizeSession = null;
    store.getState().setCanvasInteractionActive(false);
    updateCursor();
  };

  const getSelectedInteriorAssetForHandles = () => {
    const state = store.getState();
    const selectedInteriorAsset = state.selectedInteriorAsset;
    if (!selectedInteriorAsset) return null;

    const room = state.document.rooms.find((candidate) => candidate.id === selectedInteriorAsset.roomId) ?? null;
    const asset = room?.interiorAssets.find((candidate) => candidate.id === selectedInteriorAsset.assetId) ?? null;
    if (!room || !asset) return null;

    return {
      room,
      asset,
      bounds: getInteriorAssetBoundsAsRectBounds(asset),
      camera: state.camera,
      viewport: state.viewport,
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    const screenPoint = toCanvasPoint(event);
    const state = store.getState();
    const cursorWorld = screenToWorld(screenPoint, state.camera, state.viewport);
    latestCursorWorld = cursorWorld;
    callbacks.onCursorWorldChange(cursorWorld);

    if (activeLabelDragSession) {
      const session = activeLabelDragSession;
      if (event.pointerId !== session.pointerId) return;

      const room = state.document.rooms.find((candidate) => candidate.id === session.roomId) ?? null;
      if (!room) {
        stopLabelDragSession();
        setHoveredRoomLabelId(null);
        setHoveredSelectableWall(null);
        setHoveredSelectableRoomId(null);
        setTransformFeedback(null);
        setSnapGuides(null);
        return;
      }

      if (!session.didDrag) {
        const dx = screenPoint.x - session.startScreenPoint.x;
        const dy = screenPoint.y - session.startScreenPoint.y;
        const dragThresholdSquared = ROOM_LABEL_DRAG_THRESHOLD_PX * ROOM_LABEL_DRAG_THRESHOLD_PX;
        if (dx * dx + dy * dy < dragThresholdSquared) {
          callbacks.requestRender();
          return;
        }

        session.didDrag = true;
        store.getState().setCanvasInteractionActive(true);
        clearPendingTransformFeedbackTimeout();
        setTransformFeedback(getMoveTransformFeedback(session.roomId, session.startPoints));
        updateCursor();
      }

      const activeSnapStepMm = getActiveSnapStepMm(state.camera);
      const visibleGuides = getPredictiveSnapGuides(state.document.rooms, cursorWorld, state.camera, {
        excludeRoomIds: new Set([session.roomId]),
      });
      const magneticGuides = getMagneticSnapGuidesForSettings(
        state.document.rooms,
        cursorWorld,
        state.camera,
        state.settings,
        {
          excludeRoomIds: new Set([session.roomId]),
        }
      );
      const resolvedCursorWorld = getSnappedPointFromGuides(
        cursorWorld,
        activeSnapStepMm,
        magneticGuides
      );
      const delta = getRoomTranslationDelta(session.startWorldPoint, resolvedCursorWorld);

      const nextPoints = translateRoomPointsOnGrid(session.startPoints, delta, activeSnapStepMm);
      session.latestPoints = nextPoints;
      setTransformFeedback(
        getMoveTransformFeedback(session.roomId, session.startPoints, nextPoints, nextPoints)
      );
      setSnapGuides(state.settings.showGuidelines ? visibleGuides : null);
      return;
    }

    if (activeOpeningDragSession) {
      const session = activeOpeningDragSession;
      if (event.pointerId !== session.pointerId) return;

      const dragThresholdSquared = ROOM_LABEL_DRAG_THRESHOLD_PX * ROOM_LABEL_DRAG_THRESHOLD_PX;
      const dx = screenPoint.x - session.startScreenPoint.x;
      const dy = screenPoint.y - session.startScreenPoint.y;
      if (!session.didDrag && dx * dx + dy * dy < dragThresholdSquared) {
        callbacks.requestRender();
        return;
      }

      const moveTarget = getOpeningMoveOffsetForCursor(session.roomId, session.openingId, cursorWorld);
      if (!moveTarget) {
        setSnapGuides(null);
        callbacks.requestRender();
        return;
      }

      session.didDrag = true;
      store.getState().setCanvasInteractionActive(true);
      session.latestOffsetMm = moveTarget.nextOffsetMm;
      store.getState().previewOpeningMove(session.roomId, session.openingId, moveTarget.nextOffsetMm);
      setSnapGuides(
        state.settings.showGuidelines
          ? getPredictiveSnapGuides(state.document.rooms, cursorWorld, state.camera)
          : null
      );
      updateCursor();
      return;
    }

    if (activeOpeningResizeSession) {
      const session = activeOpeningResizeSession;
      if (event.pointerId !== session.pointerId) return;

      const dragThresholdSquared = ROOM_LABEL_DRAG_THRESHOLD_PX * ROOM_LABEL_DRAG_THRESHOLD_PX;
      const dx = screenPoint.x - session.startScreenPoint.x;
      const dy = screenPoint.y - session.startScreenPoint.y;
      if (!session.didDrag && dx * dx + dy * dy < dragThresholdSquared) {
        callbacks.requestRender();
        return;
      }

      const resizeTarget = getOpeningResizeWidthForCursor(
        session.roomId,
        session.openingId,
        cursorWorld
      );
      if (!resizeTarget) {
        setSnapGuides(null);
        callbacks.requestRender();
        return;
      }

      session.didDrag = true;
      store.getState().setCanvasInteractionActive(true);
      session.latestWidthMm = resizeTarget.nextWidthMm;
      store
        .getState()
        .previewOpeningResize(session.roomId, session.openingId, resizeTarget.nextWidthMm);
      setSnapGuides(
        state.settings.showGuidelines
          ? getPredictiveSnapGuides(state.document.rooms, cursorWorld, state.camera)
          : null
      );
      updateCursor();
      return;
    }

    if (activeInteriorAssetResizeSession) {
      const session = activeInteriorAssetResizeSession;
      if (event.pointerId !== session.pointerId) return;

      const dragThresholdSquared = ROOM_LABEL_DRAG_THRESHOLD_PX * ROOM_LABEL_DRAG_THRESHOLD_PX;
      const dx = screenPoint.x - session.startScreenPoint.x;
      const dy = screenPoint.y - session.startScreenPoint.y;
      if (!session.didDrag && dx * dx + dy * dy < dragThresholdSquared) {
        callbacks.requestRender();
        return;
      }

      const resizeTarget =
        session.target.type === "wall"
          ? getInteriorAssetResizeFromWallForCursor(
              session.roomId,
              session.assetId,
              session.target.wall,
              getInteriorAssetResizeCursorWorld(session, cursorWorld)
            )
          : getInteriorAssetResizeFromCornerForCursor(
              session.roomId,
              session.assetId,
              session.target.corner,
              getInteriorAssetResizeCursorWorld(session, cursorWorld)
            );
      if (!resizeTarget) {
        setSnapGuides(null);
        callbacks.requestRender();
        return;
      }

      session.didDrag = true;
      store.getState().setCanvasInteractionActive(true);
      session.latestAsset = {
        widthMm: resizeTarget.nextAsset.widthMm,
        depthMm: resizeTarget.nextAsset.depthMm,
        xMm: resizeTarget.nextAsset.xMm,
        yMm: resizeTarget.nextAsset.yMm,
      };
      store.getState().previewInteriorAssetResize(session.roomId, session.assetId, session.latestAsset);
      setSnapGuides(
        state.settings.showGuidelines
          ? getPredictiveSnapGuides(state.document.rooms, cursorWorld, state.camera)
          : null
      );
      updateCursor();
      return;
    }

    if (activeInteriorAssetDragSession) {
      const session = activeInteriorAssetDragSession;
      if (event.pointerId !== session.pointerId) return;

      const dragThresholdSquared = ROOM_LABEL_DRAG_THRESHOLD_PX * ROOM_LABEL_DRAG_THRESHOLD_PX;
      const dx = screenPoint.x - session.startScreenPoint.x;
      const dy = screenPoint.y - session.startScreenPoint.y;
      if (!session.didDrag && dx * dx + dy * dy < dragThresholdSquared) {
        callbacks.requestRender();
        return;
      }

      const moveTarget = getInteriorAssetMoveCenterForCursor(
        session.roomId,
        session.assetId,
        cursorWorld,
        {
          x: session.startCenter.x - session.startWorldPoint.x,
          y: session.startCenter.y - session.startWorldPoint.y,
        }
      );
      if (!moveTarget) {
        setSnapGuides(null);
        callbacks.requestRender();
        return;
      }

      session.didDrag = true;
      store.getState().setCanvasInteractionActive(true);
      session.latestCenter = moveTarget.nextCenter;
      store.getState().previewInteriorAssetMove(session.roomId, session.assetId, moveTarget.nextCenter);
      setSnapGuides(
        state.settings.showGuidelines
          ? getPredictiveSnapGuides(state.document.rooms, cursorWorld, state.camera)
          : null
      );
      updateCursor();
      return;
    }

    if (!isSpaceHeld && state.roomDraft.points.length === 0) {
      const hoveredRoom = findRoomLabelAtScreenPoint(
        state.document.rooms,
        screenPoint,
        state.camera,
        state.viewport
      );
      setHoveredRoomLabelId(hoveredRoom?.id ?? null);
      if (!hoveredRoom) {
        const selectedInteriorAsset = getSelectedInteriorAssetForHandles();
        hoveredInteriorAssetCornerHandle = selectedInteriorAsset
          ? hitTestCornerHandle(
              getCornerHandleLayouts(
                selectedInteriorAsset.bounds,
                selectedInteriorAsset.camera,
                selectedInteriorAsset.viewport
              ),
              screenPoint
            )
          : null;
        hoveredInteriorAssetWallHandle =
          selectedInteriorAsset && hoveredInteriorAssetCornerHandle === null
            ? (hitTestWallHandle(
                getWallHandleLayouts(
                  selectedInteriorAsset.bounds,
                  selectedInteriorAsset.camera,
                  selectedInteriorAsset.viewport
                ),
                screenPoint
              ) as "left" | "right" | "top" | "bottom" | null)
            : null;
        hoveredOpeningWidthHandle = findSelectedOpeningWidthHandleAtScreenPoint(
          state.document.rooms,
          state.selectedOpening,
          screenPoint,
          state.camera,
          state.viewport
        );
        hoveredOpening = findOpeningAtScreenPoint(
          state.document.rooms,
          screenPoint,
          state.camera,
          state.viewport
        );
        hoveredInteriorAsset = findInteriorAssetAtScreenPoint(
          state.document.rooms,
          screenPoint,
          state.camera,
          state.viewport
        );
        const hoveredWall = findSelectableWallAtScreenPoint(state, screenPoint, cursorWorld);
        setHoveredSelectableWall(hoveredWall);
        const hoveredBodyRoom = findSelectableRoomAtScreenPoint(state, cursorWorld);
        setHoveredSelectableRoomId(
          selectedInteriorAsset?.room.id ??
          hoveredOpeningWidthHandle?.roomId ??
            hoveredOpening?.roomId ??
            hoveredInteriorAsset?.roomId ??
            hoveredWall?.roomId ??
            hoveredBodyRoom?.id ??
            null
        );
      } else {
        hoveredInteriorAssetCornerHandle = null;
        hoveredInteriorAssetWallHandle = null;
        hoveredOpeningWidthHandle = null;
        hoveredOpening = null;
        hoveredInteriorAsset = null;
        setHoveredSelectableWall(null);
        setHoveredSelectableRoomId(null);
      }
    } else {
      setHoveredRoomLabelId(null);
      hoveredInteriorAssetCornerHandle = null;
      hoveredInteriorAssetWallHandle = null;
      hoveredOpeningWidthHandle = null;
      hoveredOpening = null;
      hoveredInteriorAsset = null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
    }
    if (state.roomDraft.points.length > 0) {
      syncDraftSnapGuides(event.shiftKey);
      syncDraftConstraintMode(event.shiftKey);
    } else {
      setSnapGuides(null);
    }
    updateCursor();
    callbacks.requestRender();
  };

  const onPointerLeave = () => {
    if (
      activeLabelDragSession ||
      activeOpeningDragSession ||
      activeOpeningResizeSession ||
      activeInteriorAssetDragSession
      || activeInteriorAssetResizeSession
    ) {
      return;
    }
    callbacks.onCursorWorldChange(null);
    latestCursorWorld = null;
    setSnapGuides(null);
    setHoveredRoomLabelId(null);
    hoveredOpeningWidthHandle = null;
    hoveredOpening = null;
    hoveredInteriorAsset = null;
    hoveredInteriorAssetCornerHandle = null;
    hoveredInteriorAssetWallHandle = null;
    setHoveredSelectableWall(null);
    setHoveredSelectableRoomId(null);
    updateCursor();
    callbacks.requestRender();
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length > 1) {
      event.preventDefault();
      // Cancel drawing if multi-touch starts
      if (store.getState().roomDraft.points.length > 0) {
        store.getState().resetDraft();
        setSnapGuides(null);
        updateCursor();
      }
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (activePointerCount > 0) {
      // Cancel drawing if multi-touch starts
      if (store.getState().roomDraft.points.length > 0) {
        store.getState().resetDraft();
        setSnapGuides(null);
        updateCursor();
      }
      return;
    }

    const state = store.getState();

    if (event.button === 2) {
      if (state.roomDraft.points.length > 0) {
        event.preventDefault();
        shouldSuppressNextContextMenu = true;
        state.resetDraft();
        setSnapGuides(null);
        updateCursor();
      }
      activePointerCount++;
      return;
    }

    if (event.button !== 0 || isSpaceHeld) {
      activePointerCount++;
      return;
    }

    activePointerCount++;

    const screenPoint = toCanvasPoint(event);
    const cursorWorld = screenToWorld(screenPoint, state.camera, state.viewport);
    const selectedInteriorAsset = getSelectedInteriorAssetForHandles();
    const selectedInteriorAssetHit = selectedInteriorAsset
      ? findInteriorAssetAtScreenPoint(
          [selectedInteriorAsset.room],
          screenPoint,
          state.camera,
          state.viewport
        )
      : null;
    const labelHitRoom = findRoomLabelAtScreenPoint(
      state.document.rooms,
      screenPoint,
      state.camera,
      state.viewport
    );

    if (state.roomDraft.points.length > 0) {
      state.placeDraftPointFromCursor(cursorWorld, {
        constraintMode: event.shiftKey || isShiftHeld ? "diagonal45" : "orthogonal",
      });
      syncDraftSnapGuides();
      updateCursor();
      return;
    }

    if (
      labelHitRoom &&
      !(
        selectedInteriorAssetHit &&
        selectedInteriorAssetHit.roomId === selectedInteriorAsset?.room.id &&
        selectedInteriorAssetHit.assetId === selectedInteriorAsset.asset.id
      )
    ) {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      const startWorldPoint = getSnappedPointFromGuides(
        cursorWorld,
        getActiveSnapStepMm(state.camera),
        getMagneticSnapGuidesForSettings(
          state.document.rooms,
          cursorWorld,
          state.camera,
          state.settings,
          {
            excludeRoomIds: new Set([labelHitRoom.id]),
          }
        )
      );

      const didChangeSelection = state.selectedRoomId !== labelHitRoom.id;
      state.selectRoomById(labelHitRoom.id);
      activeLabelDragSession = {
        pointerId: event.pointerId,
        roomId: labelHitRoom.id,
        startScreenPoint: screenPoint,
        startWorldPoint,
        startPoints: labelHitRoom.points.map((point) => ({ ...point })),
        latestPoints: null,
        didDrag: false,
      };
      setHoveredRoomLabelId(labelHitRoom.id);
      updateCursor();
      if (didChangeSelection) {
        callbacks.onRoomLabelSelected?.(labelHitRoom.id);
      }
      return;
    }

    const openingWidthHandleHit = findSelectedOpeningWidthHandleAtScreenPoint(
      state.document.rooms,
      state.selectedOpening,
      screenPoint,
      state.camera,
      state.viewport
    );
    if (openingWidthHandleHit) {
      event.preventDefault();
      state.selectOpeningById(openingWidthHandleHit.roomId, openingWidthHandleHit.openingId);
      hoveredOpeningWidthHandle = openingWidthHandleHit;
      hoveredOpening = { roomId: openingWidthHandleHit.roomId, openingId: openingWidthHandleHit.openingId };
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(openingWidthHandleHit.roomId);
      const room =
        state.document.rooms.find((candidate) => candidate.id === openingWidthHandleHit.roomId) ?? null;
      const opening =
        room?.openings.find((candidate) => candidate.id === openingWidthHandleHit.openingId) ?? null;
      if (room && opening) {
        canvas.setPointerCapture(event.pointerId);
        activeOpeningResizeSession = {
          pointerId: event.pointerId,
          roomId: openingWidthHandleHit.roomId,
          openingId: openingWidthHandleHit.openingId,
          startScreenPoint: screenPoint,
          startWidthMm: opening.widthMm,
          latestWidthMm: null,
          didDrag: false,
        };
      }
      updateCursor();
      return;
    }

    const interiorAssetCornerHandleHit = selectedInteriorAsset
      ? hitTestCornerHandle(
          getCornerHandleLayouts(
            selectedInteriorAsset.bounds,
            selectedInteriorAsset.camera,
            selectedInteriorAsset.viewport
          ),
          screenPoint
        )
      : null;
    const interiorAssetWallHandleHit =
      selectedInteriorAsset && interiorAssetCornerHandleHit === null
        ? (hitTestWallHandle(
            getWallHandleLayouts(
              selectedInteriorAsset.bounds,
              selectedInteriorAsset.camera,
              selectedInteriorAsset.viewport
            ),
            screenPoint
          ) as "left" | "right" | "top" | "bottom" | null)
        : null;
    if (selectedInteriorAsset && (interiorAssetCornerHandleHit || interiorAssetWallHandleHit)) {
      event.preventDefault();
      state.selectInteriorAssetById(selectedInteriorAsset.room.id, selectedInteriorAsset.asset.id);
      canvas.setPointerCapture(event.pointerId);
        activeInteriorAssetResizeSession = {
          pointerId: event.pointerId,
          roomId: selectedInteriorAsset.room.id,
          assetId: selectedInteriorAsset.asset.id,
          startScreenPoint: screenPoint,
          startWorldPoint: cursorWorld,
          startAsset: {
            widthMm: selectedInteriorAsset.asset.widthMm,
            depthMm: selectedInteriorAsset.asset.depthMm,
            xMm: selectedInteriorAsset.asset.xMm,
            yMm: selectedInteriorAsset.asset.yMm,
        },
        latestAsset: null,
        didDrag: false,
        target: interiorAssetCornerHandleHit
          ? { type: "corner", corner: interiorAssetCornerHandleHit }
          : { type: "wall", wall: interiorAssetWallHandleHit! },
      };
      hoveredInteriorAsset = {
        roomId: selectedInteriorAsset.room.id,
        assetId: selectedInteriorAsset.asset.id,
      };
      hoveredInteriorAssetCornerHandle = interiorAssetCornerHandleHit;
      hoveredInteriorAssetWallHandle = interiorAssetWallHandleHit;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(selectedInteriorAsset.room.id);
      updateCursor();
      return;
    }

    const openingHit = findOpeningAtScreenPoint(
      state.document.rooms,
      screenPoint,
      state.camera,
      state.viewport
    );
    if (openingHit) {
      event.preventDefault();
      state.selectOpeningById(openingHit.roomId, openingHit.openingId);
      hoveredOpening = openingHit;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(openingHit.roomId);
      const room = state.document.rooms.find((candidate) => candidate.id === openingHit.roomId) ?? null;
      const opening = room?.openings.find((candidate) => candidate.id === openingHit.openingId) ?? null;
      if (room && opening) {
        canvas.setPointerCapture(event.pointerId);
        activeOpeningDragSession = {
          pointerId: event.pointerId,
          roomId: openingHit.roomId,
          openingId: openingHit.openingId,
          startScreenPoint: screenPoint,
          startOffsetMm: opening.offsetMm,
          latestOffsetMm: null,
          didDrag: false,
        };
      }
      updateCursor();
      return;
    }

    const interiorAssetHit = findInteriorAssetAtScreenPoint(
      state.document.rooms,
      screenPoint,
      state.camera,
      state.viewport
    );
    if (interiorAssetHit) {
      event.preventDefault();
      state.selectInteriorAssetById(interiorAssetHit.roomId, interiorAssetHit.assetId);
      hoveredInteriorAsset = interiorAssetHit;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(interiorAssetHit.roomId);
      const room = state.document.rooms.find((candidate) => candidate.id === interiorAssetHit.roomId) ?? null;
      const asset = room?.interiorAssets.find((candidate) => candidate.id === interiorAssetHit.assetId) ?? null;
      if (room && asset) {
        canvas.setPointerCapture(event.pointerId);
        activeInteriorAssetDragSession = {
          pointerId: event.pointerId,
          roomId: interiorAssetHit.roomId,
          assetId: interiorAssetHit.assetId,
          startScreenPoint: screenPoint,
          startWorldPoint: cursorWorld,
          startCenter: { x: asset.xMm, y: asset.yMm },
          latestCenter: null,
          didDrag: false,
        };
      }
      updateCursor();
      return;
    }

    const wallHit = findSelectableWallAtScreenPoint(state, screenPoint, cursorWorld);
    if (wallHit) {
      const didChangeSelectedWall =
        state.selectedWall?.roomId !== wallHit.roomId || state.selectedWall.wall !== wallHit.wall;

      state.selectWallByRoomId(wallHit.roomId, wallHit.wall);
      setHoveredSelectableWall(wallHit);
      setHoveredSelectableRoomId(wallHit.roomId);
      if (didChangeSelectedWall) {
        track(ANALYTICS_EVENTS.wallSelected, {
          selectionKind: wallHit.candidateCount > 1 ? "shared" : "single",
        });
        if (wallHit.candidateCount > 1) {
          track(ANALYTICS_EVENTS.sharedWallDisambiguationUsed, {
            optionCount: wallHit.candidateCount,
          });
        }
      }
      updateCursor();
      return;
    }

    const bodyHitRoom = findSelectableRoomAtScreenPoint(state, cursorWorld);
    if (bodyHitRoom) {
      state.selectRoomById(bodyHitRoom.id);
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(bodyHitRoom.id);
      updateCursor();
      return;
    }

    if (state.selectedRoomId) {
      const selectedRoom =
        state.document.rooms.find((room) => room.id === state.selectedRoomId) ?? null;
      const clickedInsideSelectedRoom =
        selectedRoom !== null && isPointInPolygon(cursorWorld, selectedRoom.points);

      if (!clickedInsideSelectedRoom) {
        state.clearRoomSelection();
        return;
      }

      state.selectRoomById(selectedRoom.id);
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(selectedRoom.id);
      updateCursor();
      return;
    }

    state.placeDraftPointFromCursor(cursorWorld, {
      constraintMode: event.shiftKey || isShiftHeld ? "diagonal45" : "orthogonal",
    });
    syncDraftSnapGuides();
    updateCursor();
  };

  const onPointerUp = (event: PointerEvent) => {
    activePointerCount--;
    const screenPoint = toCanvasPoint(event);

    if (activeOpeningDragSession && event.pointerId === activeOpeningDragSession.pointerId) {
      const session = activeOpeningDragSession;
      if (session.didDrag) {
        const nextOffsetMm = session.latestOffsetMm ?? session.startOffsetMm;
        if (nextOffsetMm !== session.startOffsetMm) {
          commitOpeningMove(
            session.roomId,
            session.openingId,
            session.startOffsetMm,
            nextOffsetMm
          );
        }
      }
      stopOpeningDragSession();
      setSnapGuides(null);

      const state = store.getState();
      const hoveredRoom =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findRoomLabelAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      setHoveredRoomLabelId(hoveredRoom?.id ?? null);
      hoveredOpening =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findOpeningAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
      callbacks.requestRender();
      return;
    }

    if (activeOpeningResizeSession && event.pointerId === activeOpeningResizeSession.pointerId) {
      const session = activeOpeningResizeSession;
      if (session.didDrag) {
        const nextWidthMm = session.latestWidthMm ?? session.startWidthMm;
        if (nextWidthMm !== session.startWidthMm) {
          commitOpeningResize(session.roomId, session.openingId, session.startWidthMm, nextWidthMm);
        }
      }
      stopOpeningResizeSession();
      setSnapGuides(null);

      const state = store.getState();
      const hoveredRoom =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findRoomLabelAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      setHoveredRoomLabelId(hoveredRoom?.id ?? null);
      hoveredOpeningWidthHandle =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findSelectedOpeningWidthHandleAtScreenPoint(
              state.document.rooms,
              state.selectedOpening,
              screenPoint,
              state.camera,
              state.viewport
            )
          : null;
      hoveredOpening =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findOpeningAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
      callbacks.requestRender();
      return;
    }

    if (activeInteriorAssetDragSession && event.pointerId === activeInteriorAssetDragSession.pointerId) {
      const session = activeInteriorAssetDragSession;
      if (session.didDrag) {
        const nextCenter = session.latestCenter ?? session.startCenter;
        if (nextCenter.x !== session.startCenter.x || nextCenter.y !== session.startCenter.y) {
          commitInteriorAssetMove(
            session.roomId,
            session.assetId,
            session.startCenter,
            nextCenter
          );
        }
      }
      stopInteriorAssetDragSession();
      setSnapGuides(null);

      const state = store.getState();
      const hoveredRoom =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findRoomLabelAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      setHoveredRoomLabelId(hoveredRoom?.id ?? null);
      hoveredInteriorAsset =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findInteriorAssetAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      hoveredOpening =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findOpeningAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
      callbacks.requestRender();
      return;
    }

    if (activeInteriorAssetResizeSession && event.pointerId === activeInteriorAssetResizeSession.pointerId) {
      const session = activeInteriorAssetResizeSession;
      if (session.didDrag) {
        const nextAsset = session.latestAsset ?? session.startAsset;
        if (
          nextAsset.widthMm !== session.startAsset.widthMm ||
          nextAsset.depthMm !== session.startAsset.depthMm ||
          nextAsset.xMm !== session.startAsset.xMm ||
          nextAsset.yMm !== session.startAsset.yMm
        ) {
          commitInteriorAssetResize(session.roomId, session.assetId, session.startAsset, nextAsset);
        }
      }
      stopInteriorAssetResizeSession();
      setSnapGuides(null);

      const state = store.getState();
      const hoveredRoom =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findRoomLabelAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      setHoveredRoomLabelId(hoveredRoom?.id ?? null);
      hoveredInteriorAsset =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findInteriorAssetAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      hoveredInteriorAssetCornerHandle = null;
      hoveredInteriorAssetWallHandle = null;
      hoveredOpening =
        !isSpaceHeld && state.roomDraft.points.length === 0
          ? findOpeningAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
          : null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
      callbacks.requestRender();
      return;
    }

    if (!activeLabelDragSession || event.pointerId !== activeLabelDragSession.pointerId) return;

    const session = activeLabelDragSession;
    if (session.didDrag) {
      const nextPoints = session.latestPoints ?? session.startPoints;
      if (arePointListsEqual(session.startPoints, nextPoints)) {
        setTransformFeedback(null);
      } else {
        setTransformFeedback(
          getMoveTransformFeedback(
            session.roomId,
            session.startPoints,
            nextPoints,
            nextPoints,
            "settling"
          )
        );
        commitRoomMove(session.roomId, session.startPoints, nextPoints);
        scheduleTransformFeedbackClear();
      }
    } else {
      setTransformFeedback(null);
    }
    stopLabelDragSession();
    setSnapGuides(null);

    const state = store.getState();
    const hoveredRoom =
      !isSpaceHeld && state.roomDraft.points.length === 0
        ? findRoomLabelAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
        : null;
    setHoveredRoomLabelId(hoveredRoom?.id ?? null);
    hoveredOpening =
      !isSpaceHeld && state.roomDraft.points.length === 0
        ? findOpeningAtScreenPoint(state.document.rooms, screenPoint, state.camera, state.viewport)
        : null;
    setHoveredSelectableWall(null);
    setHoveredSelectableRoomId(null);
    callbacks.requestRender();
  };

  const onPointerCancel = (event: PointerEvent) => {
    activePointerCount--;
    if (activeOpeningDragSession && event.pointerId === activeOpeningDragSession.pointerId) {
      if (activeOpeningDragSession.didDrag) {
        store
          .getState()
          .previewOpeningMove(
            activeOpeningDragSession.roomId,
            activeOpeningDragSession.openingId,
            activeOpeningDragSession.startOffsetMm
          );
      }

      stopOpeningDragSession();
      setSnapGuides(null);
      setHoveredRoomLabelId(null);
      hoveredInteriorAssetCornerHandle = null;
      hoveredInteriorAssetWallHandle = null;
      hoveredOpeningWidthHandle = null;
      hoveredOpening = null;
      hoveredInteriorAsset = null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
      callbacks.requestRender();
      return;
    }

    if (activeOpeningResizeSession && event.pointerId === activeOpeningResizeSession.pointerId) {
      if (activeOpeningResizeSession.didDrag) {
        store
          .getState()
          .previewOpeningResize(
            activeOpeningResizeSession.roomId,
            activeOpeningResizeSession.openingId,
            activeOpeningResizeSession.startWidthMm
          );
      }

      stopOpeningResizeSession();
      setSnapGuides(null);
      setHoveredRoomLabelId(null);
      hoveredOpeningWidthHandle = null;
      hoveredOpening = null;
      hoveredInteriorAsset = null;
      hoveredInteriorAssetCornerHandle = null;
      hoveredInteriorAssetWallHandle = null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
      callbacks.requestRender();
      return;
    }

    if (activeInteriorAssetDragSession && event.pointerId === activeInteriorAssetDragSession.pointerId) {
      if (activeInteriorAssetDragSession.didDrag) {
        store
          .getState()
          .previewInteriorAssetMove(
            activeInteriorAssetDragSession.roomId,
            activeInteriorAssetDragSession.assetId,
            activeInteriorAssetDragSession.startCenter
          );
      }

      stopInteriorAssetDragSession();
      setSnapGuides(null);
      setHoveredRoomLabelId(null);
      hoveredOpeningWidthHandle = null;
      hoveredOpening = null;
      hoveredInteriorAsset = null;
      hoveredInteriorAssetCornerHandle = null;
      hoveredInteriorAssetWallHandle = null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
      callbacks.requestRender();
      return;
    }

    if (activeInteriorAssetResizeSession && event.pointerId === activeInteriorAssetResizeSession.pointerId) {
      if (activeInteriorAssetResizeSession.didDrag) {
        store.getState().previewInteriorAssetResize(
          activeInteriorAssetResizeSession.roomId,
          activeInteriorAssetResizeSession.assetId,
          activeInteriorAssetResizeSession.startAsset
        );
      }

      stopInteriorAssetResizeSession();
      setSnapGuides(null);
      setHoveredRoomLabelId(null);
      hoveredOpeningWidthHandle = null;
      hoveredOpening = null;
      hoveredInteriorAsset = null;
      hoveredInteriorAssetCornerHandle = null;
      hoveredInteriorAssetWallHandle = null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
      callbacks.requestRender();
      return;
    }

    if (!activeLabelDragSession || event.pointerId !== activeLabelDragSession.pointerId) return;

    if (activeLabelDragSession.didDrag) {
      clearPendingTransformFeedbackTimeout();
    }

    setTransformFeedback(null);
    stopLabelDragSession();
    setSnapGuides(null);
    setHoveredRoomLabelId(null);
    hoveredInteriorAssetCornerHandle = null;
    hoveredInteriorAssetWallHandle = null;
    hoveredOpening = null;
    setHoveredSelectableWall(null);
    setHoveredSelectableRoomId(null);
    callbacks.requestRender();
  };

  const onContextMenu = (event: MouseEvent) => {
    if (shouldSuppressNextContextMenu) {
      shouldSuppressNextContextMenu = false;
      event.preventDefault();
      return;
    }

    if (store.getState().roomDraft.points.length > 0) {
      event.preventDefault();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;

    if (event.code === "Space") {
      isSpaceHeld = true;
      updateCursor();
      return;
    }

    if (event.key === "Shift") {
      isShiftHeld = true;
      syncDraftConstraintMode(true);
      syncDraftSnapGuides();
      return;
    }

    if (event.code === "Escape") {
      const state = store.getState();
      if (state.roomDraft.points.length > 0) {
        state.resetDraft();
        setSnapGuides(null);
        updateCursor();
      } else {
        state.clearRoomSelection();
        hoveredOpening = null;
        hoveredInteriorAsset = null;
        hoveredInteriorAssetCornerHandle = null;
        hoveredInteriorAssetWallHandle = null;
        setHoveredSelectableWall(null);
        setHoveredSelectableRoomId(null);
      }
      return;
    }

    if (event.code === "Backspace" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const state = store.getState();
      if (state.roomDraft.points.length === 0) return;

      event.preventDefault();
      state.stepBackDraft();
      syncDraftSnapGuides();
      updateCursor();
      callbacks.requestRender();
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;

    if (event.code === "Space") {
      isSpaceHeld = false;
      updateCursor();
      return;
    }

    if (event.key === "Shift") {
      isShiftHeld = false;
      syncDraftConstraintMode(false);
      syncDraftSnapGuides(false);
    }
  };

  const onWindowBlur = () => {
    isSpaceHeld = false;
    isShiftHeld = false;
    latestCursorWorld = null;
    syncDraftConstraintMode();
    if (activeLabelDragSession?.didDrag) {
      clearPendingTransformFeedbackTimeout();
    }
    if (activeOpeningDragSession?.didDrag) {
      store
        .getState()
        .previewOpeningMove(
          activeOpeningDragSession.roomId,
          activeOpeningDragSession.openingId,
          activeOpeningDragSession.startOffsetMm
        );
    }
    if (activeOpeningResizeSession?.didDrag) {
      store
        .getState()
        .previewOpeningResize(
          activeOpeningResizeSession.roomId,
          activeOpeningResizeSession.openingId,
          activeOpeningResizeSession.startWidthMm
        );
    }
    if (activeInteriorAssetDragSession?.didDrag) {
      store
        .getState()
        .previewInteriorAssetMove(
          activeInteriorAssetDragSession.roomId,
          activeInteriorAssetDragSession.assetId,
          activeInteriorAssetDragSession.startCenter
        );
    }
    if (activeInteriorAssetResizeSession?.didDrag) {
      store.getState().previewInteriorAssetResize(
        activeInteriorAssetResizeSession.roomId,
        activeInteriorAssetResizeSession.assetId,
        activeInteriorAssetResizeSession.startAsset
      );
    }
    setTransformFeedback(null);
    stopLabelDragSession();
    stopOpeningDragSession();
    stopOpeningResizeSession();
    stopInteriorAssetDragSession();
    stopInteriorAssetResizeSession();
    setSnapGuides(null);
    setHoveredRoomLabelId(null);
    hoveredInteriorAssetCornerHandle = null;
    hoveredInteriorAssetWallHandle = null;
    hoveredOpeningWidthHandle = null;
    hoveredOpening = null;
    hoveredInteriorAsset = null;
    setHoveredSelectableWall(null);
    setHoveredSelectableRoomId(null);
    updateCursor();
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onWindowBlur);

  return () => {
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
    clearPendingTransformFeedbackTimeout();
    setTransformFeedback(null);
    stopLabelDragSession();
    stopOpeningDragSession();
    stopOpeningResizeSession();
    stopInteriorAssetDragSession();
    stopInteriorAssetResizeSession();
    setSnapGuides(null);
    canvas.style.cursor = "";
  };
}

function findSelectableRoomAtScreenPoint(
  state: Pick<RoomDrawStoreState, "camera" | "viewport" | "document">,
  worldPoint: Point
): Room | null {
  return findRoomAtPoint(state.document.rooms, worldPoint);
}

function findSelectableWallAtScreenPoint(
  state: Pick<RoomDrawStoreState, "camera" | "viewport" | "document" | "selectedRoomId">,
  screenPoint: Point,
  worldPoint: Point
): SelectableWallHit | null {
  if (!state.selectedRoomId) {
    return null;
  }

  const selectedRoom = state.document.rooms.find((room) => room.id === state.selectedRoomId);
  if (!selectedRoom || !isAxisAlignedRectangle(selectedRoom.points)) {
    const nonRectWall = selectedRoom
      ? findRoomWallAtScreenPoint(selectedRoom, screenPoint, state.camera, state.viewport)
      : null;
    return nonRectWall === null
      ? null
      : {
          roomId: selectedRoom?.id ?? state.selectedRoomId!,
          wall: nonRectWall,
          candidateCount: 1,
        };
  }

  const candidates: Array<{
    roomId: string;
    wall: RectWall;
    clickCameFromInterior: boolean;
  }> = [];

  for (let index = state.document.rooms.length - 1; index >= 0; index -= 1) {
    const room = state.document.rooms[index];
    const bounds = getAxisAlignedRoomBounds(room);
    if (!bounds) continue;

    const wall = hitTestRoomWallEdge(bounds, screenPoint, state.camera, state.viewport);
    if (!wall) continue;

    candidates.push({
      roomId: room.id,
      wall,
      clickCameFromInterior: isPointOnInteriorSideOfRectWall(bounds, wall, worldPoint),
    });
  }

  if (candidates.length === 0) return null;

  const interiorCandidates = candidates.filter((candidate) => candidate.clickCameFromInterior);
  if (interiorCandidates.length === 1) {
    return { ...interiorCandidates[0], candidateCount: candidates.length };
  }

  if (state.selectedRoomId) {
    const selectedInteriorCandidate = interiorCandidates.find(
      (candidate) => candidate.roomId === state.selectedRoomId
    );
    if (selectedInteriorCandidate) {
      return { ...selectedInteriorCandidate, candidateCount: candidates.length };
    }

    const selectedCandidate = candidates.find((candidate) => candidate.roomId === state.selectedRoomId);
    if (selectedCandidate) {
      return { ...selectedCandidate, candidateCount: candidates.length };
    }
  }

  const resolvedCandidate = interiorCandidates[0] ?? candidates[0];
  return {
    ...resolvedCandidate,
    candidateCount: candidates.length,
  };
}

function isPointOnInteriorSideOfRectWall(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  wall: RectWall,
  point: Point
) {
  switch (wall) {
    case "top":
      return (
        point.x >= bounds.minX - WALL_INTERIOR_SIDE_EPSILON_MM &&
        point.x <= bounds.maxX + WALL_INTERIOR_SIDE_EPSILON_MM &&
        point.y >= bounds.minY - WALL_INTERIOR_SIDE_EPSILON_MM
      );
    case "right":
      return (
        point.y >= bounds.minY - WALL_INTERIOR_SIDE_EPSILON_MM &&
        point.y <= bounds.maxY + WALL_INTERIOR_SIDE_EPSILON_MM &&
        point.x <= bounds.maxX + WALL_INTERIOR_SIDE_EPSILON_MM
      );
    case "bottom":
      return (
        point.x >= bounds.minX - WALL_INTERIOR_SIDE_EPSILON_MM &&
        point.x <= bounds.maxX + WALL_INTERIOR_SIDE_EPSILON_MM &&
        point.y <= bounds.maxY + WALL_INTERIOR_SIDE_EPSILON_MM
      );
    case "left":
      return (
        point.y >= bounds.minY - WALL_INTERIOR_SIDE_EPSILON_MM &&
        point.y <= bounds.maxY + WALL_INTERIOR_SIDE_EPSILON_MM &&
        point.x >= bounds.minX - WALL_INTERIOR_SIDE_EPSILON_MM
      );
  }

  return false;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function arePointListsEqual(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index].x !== b[index].x || a[index].y !== b[index].y) return false;
  }
  return true;
}

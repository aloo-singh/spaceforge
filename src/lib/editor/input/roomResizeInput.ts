import { screenToWorld, worldToScreen } from "@/lib/editor/camera";
import { track } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import {
  getConstrainedVertexAdjustmentResult,
  getConstrainedVertexHandleLayouts,
  hitTestConstrainedVertexHandle,
  isNonRectangularOrthogonalRoom,
} from "@/lib/editor/constrainedVertexAdjustments";
import { getRoomWallSegment } from "@/lib/editor/openings";
import {
  getOrthogonalWallAdjustmentResult,
  getOrthogonalWallHandleLayouts,
  hitTestOrthogonalWallHandle,
} from "@/lib/editor/orthogonalWallResize";
import { getRoomDeclutterState } from "@/lib/editor/roomDeclutter";
import {
  getActiveSnapStepMm,
  getMagneticSnapGuidesForSettings,
  getPredictiveSnapGuides,
  getSnappedPointFromGuides,
  type SnapGuides,
} from "@/lib/editor/snapping";
import {
  getAxisAlignedRoomBounds,
  getCornerHandleLayouts,
  getRoomPointsFromBounds,
  getWallHandleLayouts,
  hitTestCornerHandle,
  hitTestWallHandle,
  MIN_ROOM_SIZE_MM,
  resizeBoundsForCornerDrag,
  resizeBoundsForWallDrag,
  type RectCorner,
  type RectWall,
  type RoomRectBounds,
} from "@/lib/editor/rectRoomResize";
import {
  createTransformFeedbackTargetFromPoints,
  createTransformFeedback,
  TRANSFORM_SETTLE_TOTAL_MS,
  type TransformFeedback,
} from "@/lib/editor/transformFeedback";
import { findSelectedOpeningWidthHandleAtScreenPoint } from "@/lib/editor/openings";
import type { Point, Room, RoomWall } from "@/lib/editor/types";

type RoomResizeStoreState = {
  camera: { xMm: number; yMm: number; pixelsPerMm: number; rotationDegrees: number };
  viewport: { width: number; height: number };
  settings: { showGuidelines: boolean; snappingEnabled: boolean };
  document: { rooms: Room[] };
  roomDraft: { points: Point[] };
  selectedRoomId: string | null;
  selectedOpening: { roomId: string; openingId: string } | null;
  selectWallByRoomId: (roomId: string, wall: RoomWall) => void;
  clearSelectedWall: () => void;
  previewRoomResize: (roomId: string, nextPoints: Point[]) => void;
  commitRoomResize: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
  setCanvasInteractionActive: (isActive: boolean) => void;
};

type RoomResizeStore = {
  getState: () => RoomResizeStoreState;
};

type RoomResizeInputCallbacks = {
  onCursorWorldChange?: (cursorWorld: Point | null) => void;
  onHandleStateChange: (state: {
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
  }) => void;
  onTransformFeedbackChange?: (feedback: TransformFeedback | null) => void;
  onSnapGuidesChange?: (guides: SnapGuides | null) => void;
  onRoomResizeCommitted?: (roomId: string) => void;
  requestRender: () => void;
};

type ResizeSession = {
  pointerId: number;
  roomId: string;
  target:
    | { type: "wall"; wall: RectWall }
    | { type: "corner"; corner: RectCorner }
    | { type: "vertex"; vertexIndex: number }
    | { type: "wall-segment"; wallSegmentIndex: number };
  startBounds: RoomRectBounds | null;
  startPoints: Point[];
  latestSnappedPoints: Point[] | null;
  latestPreviewPoints: Point[] | null;
};

const NWSE_RESIZE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 19L19 5'/%3E%3Cpath d='M14 5h5v5'/%3E%3Cpath d='M10 19H5v-5'/%3E%3C/g%3E%3Cg fill='none' stroke='%23000000' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 19L19 5'/%3E%3Cpath d='M14 5h5v5'/%3E%3Cpath d='M10 19H5v-5'/%3E%3C/g%3E%3C/svg%3E\") 12 12, nwse-resize";

const NESW_RESIZE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 5l14 14'/%3E%3Cpath d='M14 19h5v-5'/%3E%3Cpath d='M10 5H5v5'/%3E%3C/g%3E%3Cg fill='none' stroke='%23000000' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 5l14 14'/%3E%3Cpath d='M14 19h5v-5'/%3E%3Cpath d='M10 5H5v5'/%3E%3C/g%3E%3C/svg%3E\") 12 12, nesw-resize";

const NS_RESIZE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 4v16'/%3E%3Cpath d='M8 8l4-4 4 4'/%3E%3Cpath d='M8 16l4 4 4-4'/%3E%3C/g%3E%3Cg fill='none' stroke='%23000000' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 4v16'/%3E%3Cpath d='M8 8l4-4 4 4'/%3E%3Cpath d='M8 16l4 4 4-4'/%3E%3C/g%3E%3C/svg%3E\") 12 12, ns-resize";

const EW_RESIZE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 12h16'/%3E%3Cpath d='M8 8l-4 4 4 4'/%3E%3Cpath d='M16 8l4 4-4 4'/%3E%3C/g%3E%3Cg fill='none' stroke='%23000000' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 12h16'/%3E%3Cpath d='M8 8l-4 4 4 4'/%3E%3Cpath d='M16 8l4 4-4 4'/%3E%3C/g%3E%3C/svg%3E\") 12 12, ew-resize";

function getCursorForWall(wall: RectWall): string {
  return wall === "top" || wall === "bottom" ? NS_RESIZE_CURSOR : EW_RESIZE_CURSOR;
}

function getCursorForWallSegment(room: Room, wallSegmentIndex: number): string {
  const segment = getRoomWallSegment(room, wallSegmentIndex);
  if (!segment) return "";
  return segment.axis === "horizontal" ? NS_RESIZE_CURSOR : EW_RESIZE_CURSOR;
}

function getCursorForCorner(corner: RectCorner): string {
  return corner === "top-left" || corner === "bottom-right"
    ? NESW_RESIZE_CURSOR
    : NWSE_RESIZE_CURSOR;
}

function getCursorForConstrainedVertex(room: Room, vertexIndex: number): string {
  const pointCount = room.points.length;
  const point = room.points[vertexIndex];
  const previousPoint = room.points[(vertexIndex - 1 + pointCount) % pointCount];
  const nextPoint = room.points[(vertexIndex + 1) % pointCount];
  const hasLeft = previousPoint.x < point.x || nextPoint.x < point.x;
  const hasRight = previousPoint.x > point.x || nextPoint.x > point.x;
  const hasUp = previousPoint.y < point.y || nextPoint.y < point.y;
  const hasDown = previousPoint.y > point.y || nextPoint.y > point.y;

  return (hasLeft && hasUp) || (hasRight && hasDown)
    ? NESW_RESIZE_CURSOR
    : NWSE_RESIZE_CURSOR;
}

function hitTestRotatedHandleSegment(options: {
  point: Point;
  start: Point;
  end: Point;
  handleLengthPx: number;
  handleThicknessPx: number;
  hitPaddingPx: number;
}): boolean {
  const segmentDelta = {
    x: options.end.x - options.start.x,
    y: options.end.y - options.start.y,
  };
  const segmentLength = Math.hypot(segmentDelta.x, segmentDelta.y);
  if (segmentLength < 0.001) return false;

  const tangent = {
    x: segmentDelta.x / segmentLength,
    y: segmentDelta.y / segmentLength,
  };
  const normal = {
    x: -tangent.y,
    y: tangent.x,
  };
  const center = {
    x: (options.start.x + options.end.x) / 2,
    y: (options.start.y + options.end.y) / 2,
  };
  const relative = {
    x: options.point.x - center.x,
    y: options.point.y - center.y,
  };
  const tangentDistance = relative.x * tangent.x + relative.y * tangent.y;
  const normalDistance = relative.x * normal.x + relative.y * normal.y;
  const halfLength = options.handleLengthPx / 2 + options.hitPaddingPx;
  const halfThickness = options.handleThicknessPx / 2 + options.hitPaddingPx;

  return Math.abs(tangentDistance) <= halfLength && Math.abs(normalDistance) <= halfThickness;
}

function hitTestRectWallHandle(
  bounds: RoomRectBounds,
  wall: RectWall,
  point: Point,
  camera: RoomResizeStoreState["camera"],
  viewport: RoomResizeStoreState["viewport"]
): boolean {
  const topLeft = worldToScreen({ x: bounds.minX, y: bounds.minY }, camera, viewport);
  const topRight = worldToScreen({ x: bounds.maxX, y: bounds.minY }, camera, viewport);
  const bottomRight = worldToScreen({ x: bounds.maxX, y: bounds.maxY }, camera, viewport);
  const bottomLeft = worldToScreen({ x: bounds.minX, y: bounds.maxY }, camera, viewport);
  const [start, end] =
    wall === "top"
      ? [topLeft, topRight]
      : wall === "right"
        ? [topRight, bottomRight]
        : wall === "bottom"
          ? [bottomLeft, bottomRight]
          : [topLeft, bottomLeft];

  return hitTestRotatedHandleSegment({
    point,
    start,
    end,
    handleLengthPx: Math.min(40, Math.max(14, Math.hypot(end.x - start.x, end.y - start.y))),
    handleThicknessPx: 8,
    hitPaddingPx: 8,
  });
}

function hitTestOrthogonalWallSegmentHandle(
  room: Room,
  wallSegmentIndex: number,
  point: Point,
  camera: RoomResizeStoreState["camera"],
  viewport: RoomResizeStoreState["viewport"]
): boolean {
  const segment = getRoomWallSegment(room, wallSegmentIndex);
  if (!segment) return false;

  const start = worldToScreen(segment.originalStart, camera, viewport);
  const end = worldToScreen(segment.originalEnd, camera, viewport);

  return hitTestRotatedHandleSegment({
    point,
    start,
    end,
    handleLengthPx: Math.min(40, Math.max(14, Math.hypot(end.x - start.x, end.y - start.y))),
    handleThicknessPx: 8,
    hitPaddingPx: 8,
  });
}

function getHitRectWall(
  bounds: RoomRectBounds,
  point: Point,
  camera: RoomResizeStoreState["camera"],
  viewport: RoomResizeStoreState["viewport"]
): RectWall | null {
  const handles = getWallHandleLayouts(bounds, camera, viewport);

  for (const handle of handles) {
    if (hitTestRectWallHandle(bounds, handle.wall, point, camera, viewport)) {
      return handle.wall;
    }
  }

  return null;
}

function getHitOrthogonalWallSegment(
  room: Room,
  point: Point,
  camera: RoomResizeStoreState["camera"],
  viewport: RoomResizeStoreState["viewport"]
): number | null {
  const handles = getOrthogonalWallHandleLayouts(room, camera, viewport);

  for (const handle of handles) {
    if (hitTestOrthogonalWallSegmentHandle(room, handle.wallIndex, point, camera, viewport)) {
      return handle.wallIndex;
    }
  }

  return null;
}

export function attachRoomResizeInput(
  canvas: HTMLCanvasElement,
  store: RoomResizeStore,
  callbacks: RoomResizeInputCallbacks
) {
  let isSpaceHeld = false;
  let hoveredWall: RectWall | null = null;
  let hoveredCorner: RectCorner | null = null;
  let hoveredVertexIndex: number | null = null;
  let hoveredWallSegmentIndex: number | null = null;
  let activeSession: ResizeSession | null = null;
  let currentCursor: string = "";
  const commitRoomResize = store.getState().commitRoomResize;
  let clearTransformFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const setTransformFeedback = (feedback: TransformFeedback | null) => {
    callbacks.onTransformFeedbackChange?.(feedback);
    callbacks.requestRender();
  };

  const setSnapGuides = (guides: SnapGuides | null) => {
    callbacks.onSnapGuidesChange?.(guides);
    callbacks.requestRender();
  };

  const getResizeTransformFeedback = (
    roomId: string,
    originalPoints: Point[],
    previewPoints?: Point[],
    settlePoints?: Point[],
    phase: TransformFeedback["phase"] = "active"
  ) =>
    createTransformFeedback({
      roomId,
      mode: "resize",
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

  const previewRoomResize = (roomId: string, nextPoints: Point[]) => {
    const currentPreviewPoints = activeSession?.latestPreviewPoints ?? activeSession?.startPoints ?? [];
    if (arePointListsEqual(currentPreviewPoints, nextPoints)) return;

    if (activeSession?.roomId === roomId) {
      activeSession.latestPreviewPoints = nextPoints;
      setTransformFeedback(
        getResizeTransformFeedback(roomId, activeSession.startPoints, nextPoints, nextPoints)
      );
    }
  };

  const toCanvasPoint = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const getSelectedEditableRoom = () => {
    const state = store.getState();
    if (state.roomDraft.points.length > 0) return null;
    if (!state.selectedRoomId) return null;

    const room = state.document.rooms.find((candidate) => candidate.id === state.selectedRoomId);
    if (!room) return null;

    const declutter = getRoomDeclutterState(room, state.camera, state.viewport);
    if (!declutter.showSelectionControls) return null;

    const bounds = getAxisAlignedRoomBounds(room);
    const isConstrainedVertexRoom = isNonRectangularOrthogonalRoom(room);
    if (!bounds && !isConstrainedVertexRoom) return null;

    return { room, bounds, isConstrainedVertexRoom, state };
  };

  const hasSelectedOpeningResizeHandleHit = (screenPoint: Point) => {
    const state = store.getState();
    return (
      findSelectedOpeningWidthHandleAtScreenPoint(
        state.document.rooms,
        state.selectedOpening,
        screenPoint,
        state.camera,
        state.viewport
      ) !== null
    );
  };

  const publishHandleState = () => {
    callbacks.onHandleStateChange({
      hoveredWall,
      hoveredCorner,
      hoveredVertexIndex,
      hoveredWallSegmentIndex,
      hoveredRoomId:
        hoveredWall || hoveredCorner || hoveredVertexIndex !== null || hoveredWallSegmentIndex !== null
          ? getSelectedEditableRoom()?.room.id ?? null
          : null,
      activeWall: activeSession?.target.type === "wall" ? activeSession.target.wall : null,
      activeCorner: activeSession?.target.type === "corner" ? activeSession.target.corner : null,
      activeVertexIndex:
        activeSession?.target.type === "vertex" ? activeSession.target.vertexIndex : null,
      activeWallSegmentIndex:
        activeSession?.target.type === "wall-segment"
          ? activeSession.target.wallSegmentIndex
          : null,
      activeRoomId: activeSession?.roomId ?? null,
    });
  };

  const setCursor = (nextCursor: string) => {
    if (currentCursor === nextCursor) return;
    currentCursor = nextCursor;
    canvas.style.cursor = nextCursor;
    document.body.style.cursor = nextCursor;
  };

  const updateCursor = () => {
    if (activeSession) {
      if (activeSession.target.type === "corner") {
        setCursor(getCursorForCorner(activeSession.target.corner));
      } else if (activeSession.target.type === "vertex") {
        const selected = getSelectedEditableRoom();
        setCursor(
          selected ? getCursorForConstrainedVertex(selected.room, activeSession.target.vertexIndex) : ""
        );
      } else if (activeSession.target.type === "wall-segment") {
        const selected = getSelectedEditableRoom();
        setCursor(
          selected ? getCursorForWallSegment(selected.room, activeSession.target.wallSegmentIndex) : ""
        );
      } else {
        setCursor(getCursorForWall(activeSession.target.wall));
      }
      return;
    }

    if (hoveredCorner && !isSpaceHeld) {
      setCursor(getCursorForCorner(hoveredCorner));
      return;
    }

    if (hoveredVertexIndex !== null && !isSpaceHeld) {
      const selected = getSelectedEditableRoom();
      setCursor(selected ? getCursorForConstrainedVertex(selected.room, hoveredVertexIndex) : "");
      return;
    }

    if (hoveredWallSegmentIndex !== null && !isSpaceHeld) {
      const selected = getSelectedEditableRoom();
      setCursor(selected ? getCursorForWallSegment(selected.room, hoveredWallSegmentIndex) : "");
      return;
    }

    if (hoveredWall && !isSpaceHeld) {
      setCursor(getCursorForWall(hoveredWall));
      return;
    }

    // Revert to pan/draw module cursor ownership when not over resize affordances.
    setCursor("");
  };

  const setHoveredHandle = (next: {
    wall: RectWall | null;
    corner: RectCorner | null;
    vertexIndex: number | null;
    wallSegmentIndex: number | null;
  }) => {
    if (
      hoveredWall === next.wall &&
      hoveredCorner === next.corner &&
      hoveredVertexIndex === next.vertexIndex &&
      hoveredWallSegmentIndex === next.wallSegmentIndex
    ) {
      return;
    }
    hoveredWall = next.wall;
    hoveredCorner = next.corner;
    hoveredVertexIndex = next.vertexIndex;
    hoveredWallSegmentIndex = next.wallSegmentIndex;
    updateCursor();
    publishHandleState();
    callbacks.requestRender();
  };

  const stopSession = () => {
    if (!activeSession) return;
    const pointerId = activeSession.pointerId;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    activeSession = null;
    store.getState().setCanvasInteractionActive(false);
    hoveredWall = null;
    hoveredCorner = null;
    hoveredVertexIndex = null;
    hoveredWallSegmentIndex = null;
    updateCursor();
    publishHandleState();
    callbacks.requestRender();
  };

  const onPointerMove = (event: PointerEvent) => {
    const selected = getSelectedEditableRoom();
    const screenPoint = toCanvasPoint(event);

    if (activeSession) {
      if (event.pointerId !== activeSession.pointerId) return;
      const fallbackState = store.getState();
      const cursorWorld = screenToWorld(
        screenPoint,
        selected?.state.camera ?? fallbackState.camera,
        selected?.state.viewport ?? fallbackState.viewport
      );
      callbacks.onCursorWorldChange?.(cursorWorld);
      const activeState = selected?.state ?? fallbackState;
      const activeSnapStepMm = getActiveSnapStepMm(activeState.camera);
      const visibleGuides = getPredictiveSnapGuides(
        activeState.document.rooms,
        cursorWorld,
        activeState.camera,
        {
          excludeRoomIds: new Set([activeSession.roomId]),
        }
      );
      const magneticGuides = getMagneticSnapGuidesForSettings(
        activeState.document.rooms,
        cursorWorld,
        activeState.camera,
        activeState.settings,
        {
          excludeRoomIds: new Set([activeSession.roomId]),
        }
      );
      const resolvedCursorWorld = getSnappedPointFromGuides(
        cursorWorld,
        activeSnapStepMm,
        magneticGuides
      );
      if (activeSession.target.type === "vertex") {
        const nextPoints = getConstrainedVertexAdjustmentResult(
          activeSession.startPoints,
          activeSession.target.vertexIndex,
          resolvedCursorWorld
        );
        if (!nextPoints) return;

        activeSession.latestSnappedPoints = nextPoints;
        previewRoomResize(activeSession.roomId, nextPoints);
        setSnapGuides(activeState.settings.showGuidelines ? visibleGuides : null);
        return;
      }

      if (activeSession.target.type === "wall-segment") {
        const nextPoints = getOrthogonalWallAdjustmentResult(
          activeSession.startPoints,
          activeSession.target.wallSegmentIndex,
          resolvedCursorWorld,
          { gridSizeMm: 0 }
        );
        if (!nextPoints) return;

        activeSession.latestSnappedPoints = nextPoints;
        previewRoomResize(activeSession.roomId, nextPoints);
        setSnapGuides(activeState.settings.showGuidelines ? visibleGuides : null);
        return;
      }

      if (!activeSession.startBounds) return;
      const nextBounds =
        activeSession.target.type === "corner"
          ? resizeBoundsForCornerDrag(activeSession.startBounds, activeSession.target.corner, resolvedCursorWorld, {
              gridSizeMm: 0,
              minRoomSizeMm: MIN_ROOM_SIZE_MM,
            })
          : resizeBoundsForWallDrag(activeSession.startBounds, activeSession.target.wall, resolvedCursorWorld, {
              gridSizeMm: 0,
              minRoomSizeMm: MIN_ROOM_SIZE_MM,
            });
      const nextPoints = getRoomPointsFromBounds(nextBounds, activeSession.startPoints);
      activeSession.latestSnappedPoints = nextPoints;
      previewRoomResize(activeSession.roomId, nextPoints);
      setSnapGuides(activeState.settings.showGuidelines ? visibleGuides : null);
      return;
    }

    if (event.buttons !== 0) {
      callbacks.onCursorWorldChange?.(null);
      setHoveredHandle({ wall: null, corner: null, vertexIndex: null, wallSegmentIndex: null });
      return;
    }

    if (isSpaceHeld || !selected) {
      callbacks.onCursorWorldChange?.(null);
      setHoveredHandle({ wall: null, corner: null, vertexIndex: null, wallSegmentIndex: null });
      return;
    }

    if (hasSelectedOpeningResizeHandleHit(screenPoint)) {
      callbacks.onCursorWorldChange?.(null);
      setHoveredHandle({ wall: null, corner: null, vertexIndex: null, wallSegmentIndex: null });
      return;
    }

    callbacks.onCursorWorldChange?.(
      screenToWorld(screenPoint, selected.state.camera, selected.state.viewport)
    );

    if (selected.isConstrainedVertexRoom) {
      const vertexHandles = getConstrainedVertexHandleLayouts(
        selected.room,
        selected.state.camera,
        selected.state.viewport
      );
      const hitVertexIndex = hitTestConstrainedVertexHandle(vertexHandles, screenPoint);
      const wallHandles = getOrthogonalWallHandleLayouts(
        selected.room,
        selected.state.camera,
        selected.state.viewport
      );
      const hitWallSegmentIndex =
        hitVertexIndex === null
          ? getHitOrthogonalWallSegment(
              selected.room,
              screenPoint,
              selected.state.camera,
              selected.state.viewport
            ) ?? hitTestOrthogonalWallHandle(wallHandles, screenPoint)
          : null;
      setHoveredHandle({
        wall: null,
        corner: null,
        vertexIndex: hitVertexIndex,
        wallSegmentIndex: hitWallSegmentIndex,
      });
      return;
    }

    if (!selected.bounds) {
      setHoveredHandle({ wall: null, corner: null, vertexIndex: null, wallSegmentIndex: null });
      return;
    }

    const cornerHandles = getCornerHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    const handles = getWallHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    const hitCorner = hitTestCornerHandle(cornerHandles, screenPoint);
    if (hitCorner) {
      setHoveredHandle({ wall: null, corner: hitCorner, vertexIndex: null, wallSegmentIndex: null });
      return;
    }
    setHoveredHandle({
      wall:
        getHitRectWall(selected.bounds, screenPoint, selected.state.camera, selected.state.viewport) ??
        hitTestWallHandle(handles, screenPoint),
      corner: null,
      vertexIndex: null,
      wallSegmentIndex: null,
    });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || isSpaceHeld) return;
    if (activeSession) return;

    const selected = getSelectedEditableRoom();
    if (!selected) return;

    const screenPoint = toCanvasPoint(event);
    if (hasSelectedOpeningResizeHandleHit(screenPoint)) return;

    const hitVertexIndex = selected.isConstrainedVertexRoom
      ? hitTestConstrainedVertexHandle(
          getConstrainedVertexHandleLayouts(selected.room, selected.state.camera, selected.state.viewport),
          screenPoint
        )
      : null;
    const hitWallSegmentIndex =
      selected.isConstrainedVertexRoom && hitVertexIndex === null
        ? getHitOrthogonalWallSegment(
            selected.room,
            screenPoint,
            selected.state.camera,
            selected.state.viewport
          ) ??
          hitTestOrthogonalWallHandle(
            getOrthogonalWallHandleLayouts(selected.room, selected.state.camera, selected.state.viewport),
            screenPoint
          )
        : null;
    const cornerHandles =
      !selected.isConstrainedVertexRoom && selected.bounds
        ? getCornerHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport)
        : [];
    const hitCorner = hitVertexIndex === null ? hitTestCornerHandle(cornerHandles, screenPoint) : null;
    const wallHandles =
      hitVertexIndex === null && !hitCorner && selected.bounds
        ? getWallHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport)
        : [];
    const hitWall =
      hitVertexIndex === null && hitCorner === null && selected.bounds
        ? getHitRectWall(selected.bounds, screenPoint, selected.state.camera, selected.state.viewport) ??
          hitTestWallHandle(wallHandles, screenPoint)
        : null;
    if (hitVertexIndex === null && hitWallSegmentIndex === null && !hitCorner && !hitWall) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);

    activeSession = {
      pointerId: event.pointerId,
      roomId: selected.room.id,
      target:
        hitVertexIndex !== null
          ? { type: "vertex", vertexIndex: hitVertexIndex }
          : hitWallSegmentIndex !== null
            ? { type: "wall-segment", wallSegmentIndex: hitWallSegmentIndex }
          : hitCorner
            ? { type: "corner", corner: hitCorner }
            : { type: "wall", wall: hitWall! },
      startBounds: selected.bounds,
      startPoints: selected.room.points.map((point) => ({ ...point })),
      latestSnappedPoints: null,
      latestPreviewPoints: selected.room.points.map((point) => ({ ...point })),
    };
    selected.state.setCanvasInteractionActive(true);
    if (hitWall) {
      track(ANALYTICS_EVENTS.wallSelected, {
        selectionKind: "single",
      });
      selected.state.selectWallByRoomId(selected.room.id, hitWall);
    } else if (hitWallSegmentIndex !== null) {
      track(ANALYTICS_EVENTS.wallSelected, {
        selectionKind: "single",
      });
      selected.state.selectWallByRoomId(selected.room.id, hitWallSegmentIndex);
    } else {
      selected.state.clearSelectedWall();
    }
    clearPendingTransformFeedbackTimeout();
    setTransformFeedback(
      getResizeTransformFeedback(selected.room.id, selected.room.points, undefined, selected.room.points)
    );
    hoveredWall = hitWall;
    hoveredCorner = hitCorner;
    hoveredVertexIndex = hitVertexIndex;
    hoveredWallSegmentIndex = hitWallSegmentIndex;
    updateCursor();
    publishHandleState();
    callbacks.requestRender();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!activeSession || event.pointerId !== activeSession.pointerId) return;

    const session = activeSession;
    const nextPoints = session.latestSnappedPoints ?? session.startPoints;
    if (arePointListsEqual(session.startPoints, nextPoints)) {
      setTransformFeedback(null);
    } else {
      setTransformFeedback(
        getResizeTransformFeedback(
          session.roomId,
          session.startPoints,
          nextPoints,
          nextPoints,
          "settling"
        )
      );
      commitRoomResize(session.roomId, session.startPoints, nextPoints);
      scheduleTransformFeedbackClear();
      callbacks.onRoomResizeCommitted?.(session.roomId);
    }
    stopSession();
    setSnapGuides(null);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (!activeSession || event.pointerId !== activeSession.pointerId) return;
    clearPendingTransformFeedbackTimeout();
    setTransformFeedback(null);
    stopSession();
    callbacks.onCursorWorldChange?.(null);
    setSnapGuides(null);
  };

  const onPointerLeave = () => {
    if (activeSession) return;
    callbacks.onCursorWorldChange?.(null);
    setHoveredHandle({ wall: null, corner: null, vertexIndex: null, wallSegmentIndex: null });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    if (event.code === "Space") {
      isSpaceHeld = true;
      if (!activeSession) {
        setHoveredHandle({ wall: null, corner: null, vertexIndex: null, wallSegmentIndex: null });
      }
      updateCursor();
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    if (event.code === "Space") {
      isSpaceHeld = false;
      updateCursor();
    }
  };

  const onWindowBlur = () => {
    isSpaceHeld = false;
    if (activeSession) {
      clearPendingTransformFeedbackTimeout();
      setTransformFeedback(null);
      stopSession();
      callbacks.onCursorWorldChange?.(null);
      setSnapGuides(null);
      return;
    }
    setHoveredHandle({ wall: null, corner: null, vertexIndex: null, wallSegmentIndex: null });
    updateCursor();
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onWindowBlur);

  return () => {
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
    clearPendingTransformFeedbackTimeout();
    setTransformFeedback(null);
    callbacks.onCursorWorldChange?.(null);
    setSnapGuides(null);
    canvas.style.cursor = "";
    document.body.style.cursor = "";
  };
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

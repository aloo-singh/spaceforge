import { screenToWorld } from "@/lib/editor/camera";
import { track } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import {
  getConstrainedVertexAdjustmentResult,
  getConstrainedVertexHandleLayouts,
  hitTestConstrainedVertexHandle,
  isNonRectangularOrthogonalRoom,
} from "@/lib/editor/constrainedVertexAdjustments";
import { snapPointToGrid } from "@/lib/editor/geometry";
import { getRoomDeclutterState } from "@/lib/editor/roomDeclutter";
import { getActiveSnapStepMm } from "@/lib/editor/snapping";
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
import type { Point, Room } from "@/lib/editor/types";

type RoomResizeStoreState = {
  camera: { xMm: number; yMm: number; pixelsPerMm: number };
  viewport: { width: number; height: number };
  document: { rooms: Room[] };
  roomDraft: { points: Point[] };
  selectedRoomId: string | null;
  selectWallByRoomId: (roomId: string, wall: RectWall) => void;
  clearSelectedWall: () => void;
  previewRoomResize: (roomId: string, nextPoints: Point[]) => void;
  commitRoomResize: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
};

type RoomResizeStore = {
  getState: () => RoomResizeStoreState;
};

type RoomResizeInputCallbacks = {
  onHandleStateChange: (state: {
    hoveredWall: RectWall | null;
    hoveredCorner: RectCorner | null;
    hoveredVertexIndex: number | null;
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeVertexIndex: number | null;
    activeRoomId: string | null;
  }) => void;
  onTransformFeedbackChange?: (feedback: TransformFeedback | null) => void;
  onRoomResizeCommitted?: (roomId: string) => void;
  requestRender: () => void;
};

type ResizeSession = {
  pointerId: number;
  roomId: string;
  target:
    | { type: "wall"; wall: RectWall }
    | { type: "corner"; corner: RectCorner }
    | { type: "vertex"; vertexIndex: number };
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

function getCursorForCorner(corner: RectCorner): string {
  return corner === "top-left" || corner === "bottom-right"
    ? NESW_RESIZE_CURSOR
    : NWSE_RESIZE_CURSOR;
}

function getCursorForVertex(): string {
  return "move";
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
  let activeSession: ResizeSession | null = null;
  let currentCursor: string = "";
  const commitRoomResize = store.getState().commitRoomResize;
  let clearTransformFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const setTransformFeedback = (feedback: TransformFeedback | null) => {
    callbacks.onTransformFeedbackChange?.(feedback);
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

  const publishHandleState = () => {
    callbacks.onHandleStateChange({
      hoveredWall,
      hoveredCorner,
      hoveredVertexIndex,
      hoveredRoomId:
        hoveredWall || hoveredCorner || hoveredVertexIndex !== null
          ? getSelectedEditableRoom()?.room.id ?? null
          : null,
      activeWall: activeSession?.target.type === "wall" ? activeSession.target.wall : null,
      activeCorner: activeSession?.target.type === "corner" ? activeSession.target.corner : null,
      activeVertexIndex:
        activeSession?.target.type === "vertex" ? activeSession.target.vertexIndex : null,
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
        setCursor(getCursorForVertex());
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
      setCursor(getCursorForVertex());
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
  }) => {
    if (
      hoveredWall === next.wall &&
      hoveredCorner === next.corner &&
      hoveredVertexIndex === next.vertexIndex
    ) {
      return;
    }
    hoveredWall = next.wall;
    hoveredCorner = next.corner;
    hoveredVertexIndex = next.vertexIndex;
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
    hoveredWall = null;
    hoveredCorner = null;
    hoveredVertexIndex = null;
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
      const activeSnapStepMm = getActiveSnapStepMm(selected?.state.camera ?? fallbackState.camera);
      if (activeSession.target.type === "vertex") {
        const snappedCursor = snapPointToGrid(cursorWorld, activeSnapStepMm);
        const nextPoints = getConstrainedVertexAdjustmentResult(
          activeSession.startPoints,
          activeSession.target.vertexIndex,
          snappedCursor
        );
        if (!nextPoints) return;

        activeSession.latestSnappedPoints = nextPoints;
        previewRoomResize(activeSession.roomId, nextPoints);
        return;
      }

      if (!activeSession.startBounds) return;
      const nextBounds =
        activeSession.target.type === "corner"
          ? resizeBoundsForCornerDrag(activeSession.startBounds, activeSession.target.corner, cursorWorld, {
              gridSizeMm: activeSnapStepMm,
              minRoomSizeMm: MIN_ROOM_SIZE_MM,
            })
          : resizeBoundsForWallDrag(activeSession.startBounds, activeSession.target.wall, cursorWorld, {
              gridSizeMm: activeSnapStepMm,
              minRoomSizeMm: MIN_ROOM_SIZE_MM,
            });
      const nextPoints = getRoomPointsFromBounds(nextBounds, activeSession.startPoints);
      activeSession.latestSnappedPoints = nextPoints;
      previewRoomResize(activeSession.roomId, nextPoints);
      return;
    }

    if (event.buttons !== 0) {
      setHoveredHandle({ wall: null, corner: null, vertexIndex: null });
      return;
    }

    if (isSpaceHeld || !selected) {
      setHoveredHandle({ wall: null, corner: null, vertexIndex: null });
      return;
    }

    if (selected.isConstrainedVertexRoom) {
      const vertexHandles = getConstrainedVertexHandleLayouts(
        selected.room,
        selected.state.camera,
        selected.state.viewport
      );
      const hitVertexIndex = hitTestConstrainedVertexHandle(vertexHandles, screenPoint);
      setHoveredHandle({ wall: null, corner: null, vertexIndex: hitVertexIndex });
      return;
    }

    if (!selected.bounds) {
      setHoveredHandle({ wall: null, corner: null, vertexIndex: null });
      return;
    }

    const cornerHandles = getCornerHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    const handles = getWallHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    const hitCorner = hitTestCornerHandle(cornerHandles, screenPoint);
    if (hitCorner) {
      setHoveredHandle({ wall: null, corner: hitCorner, vertexIndex: null });
      return;
    }
    setHoveredHandle({ wall: hitTestWallHandle(handles, screenPoint), corner: null, vertexIndex: null });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || isSpaceHeld) return;
    if (activeSession) return;

    const selected = getSelectedEditableRoom();
    if (!selected) return;

    const screenPoint = toCanvasPoint(event);
    const hitVertexIndex = selected.isConstrainedVertexRoom
      ? hitTestConstrainedVertexHandle(
          getConstrainedVertexHandleLayouts(selected.room, selected.state.camera, selected.state.viewport),
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
    const hitWall = hitVertexIndex === null && hitCorner === null ? hitTestWallHandle(wallHandles, screenPoint) : null;
    if (hitVertexIndex === null && !hitCorner && !hitWall) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);

    activeSession = {
      pointerId: event.pointerId,
      roomId: selected.room.id,
      target:
        hitVertexIndex !== null
          ? { type: "vertex", vertexIndex: hitVertexIndex }
          : hitCorner
            ? { type: "corner", corner: hitCorner }
            : { type: "wall", wall: hitWall! },
      startBounds: selected.bounds,
      startPoints: selected.room.points.map((point) => ({ ...point })),
      latestSnappedPoints: null,
      latestPreviewPoints: selected.room.points.map((point) => ({ ...point })),
    };
    if (hitWall) {
      track(ANALYTICS_EVENTS.wallSelected, {
        selectionKind: "single",
      });
      selected.state.selectWallByRoomId(selected.room.id, hitWall);
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
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (!activeSession || event.pointerId !== activeSession.pointerId) return;
    clearPendingTransformFeedbackTimeout();
    setTransformFeedback(null);
    stopSession();
  };

  const onPointerLeave = () => {
    if (activeSession) return;
    setHoveredHandle({ wall: null, corner: null, vertexIndex: null });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    if (event.code === "Space") {
      isSpaceHeld = true;
      if (!activeSession) {
        setHoveredHandle({ wall: null, corner: null, vertexIndex: null });
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
      return;
    }
    setHoveredHandle({ wall: null, corner: null, vertexIndex: null });
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

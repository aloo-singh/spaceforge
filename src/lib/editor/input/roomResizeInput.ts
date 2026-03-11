import { screenToWorld } from "@/lib/editor/camera";
import { GRID_SIZE_MM } from "@/lib/editor/constants";
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
import type { Point, Room } from "@/lib/editor/types";

type RoomResizeStoreState = {
  camera: { xMm: number; yMm: number; pixelsPerMm: number };
  viewport: { width: number; height: number };
  document: { rooms: Room[] };
  roomDraft: { points: Point[] };
  selectedRoomId: string | null;
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
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeCorner: RectCorner | null;
    activeRoomId: string | null;
  }) => void;
  requestRender: () => void;
};

type ResizeSession = {
  pointerId: number;
  roomId: string;
  target:
    | { type: "wall"; wall: RectWall }
    | { type: "corner"; corner: RectCorner };
  startBounds: RoomRectBounds;
  startPoints: Point[];
};

const NWSE_RESIZE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 19L19 5'/%3E%3Cpath d='M14 5h5v5'/%3E%3Cpath d='M10 19H5v-5'/%3E%3C/g%3E%3Cg fill='none' stroke='%23000000' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 19L19 5'/%3E%3Cpath d='M14 5h5v5'/%3E%3Cpath d='M10 19H5v-5'/%3E%3C/g%3E%3C/svg%3E\") 12 12, nwse-resize";

const NESW_RESIZE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 5l14 14'/%3E%3Cpath d='M14 19h5v-5'/%3E%3Cpath d='M10 5H5v5'/%3E%3C/g%3E%3Cg fill='none' stroke='%23000000' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 5l14 14'/%3E%3Cpath d='M14 19h5v-5'/%3E%3Cpath d='M10 5H5v5'/%3E%3C/g%3E%3C/svg%3E\") 12 12, nesw-resize";

function getCursorForWall(wall: RectWall): string {
  return wall === "top" || wall === "bottom" ? "row-resize" : "col-resize";
}

function getCursorForCorner(corner: RectCorner): string {
  return corner === "top-left" || corner === "bottom-right"
    ? NESW_RESIZE_CURSOR
    : NWSE_RESIZE_CURSOR;
}

export function attachRoomResizeInput(
  canvas: HTMLCanvasElement,
  store: RoomResizeStore,
  callbacks: RoomResizeInputCallbacks
) {
  let isSpaceHeld = false;
  let hoveredWall: RectWall | null = null;
  let hoveredCorner: RectCorner | null = null;
  let activeSession: ResizeSession | null = null;
  let currentCursor: string = "";

  const toCanvasPoint = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const getSelectedRoomBounds = () => {
    const state = store.getState();
    if (state.roomDraft.points.length > 0) return null;
    if (!state.selectedRoomId) return null;

    const room = state.document.rooms.find((candidate) => candidate.id === state.selectedRoomId);
    if (!room) return null;

    const bounds = getAxisAlignedRoomBounds(room);
    if (!bounds) return null;

    return { room, bounds, state };
  };

  const publishHandleState = () => {
    callbacks.onHandleStateChange({
      hoveredWall,
      hoveredCorner,
      hoveredRoomId: hoveredWall || hoveredCorner ? getSelectedRoomBounds()?.room.id ?? null : null,
      activeWall: activeSession?.target.type === "wall" ? activeSession.target.wall : null,
      activeCorner: activeSession?.target.type === "corner" ? activeSession.target.corner : null,
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
      } else {
        setCursor(getCursorForWall(activeSession.target.wall));
      }
      return;
    }

    if (hoveredCorner && !isSpaceHeld) {
      setCursor(getCursorForCorner(hoveredCorner));
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
  }) => {
    if (hoveredWall === next.wall && hoveredCorner === next.corner) return;
    hoveredWall = next.wall;
    hoveredCorner = next.corner;
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
    updateCursor();
    publishHandleState();
    callbacks.requestRender();
  };

  const onPointerMove = (event: PointerEvent) => {
    const selected = getSelectedRoomBounds();
    const screenPoint = toCanvasPoint(event);

    if (activeSession) {
      if (event.pointerId !== activeSession.pointerId) return;
      const fallbackState = store.getState();
      const cursorWorld = screenToWorld(
        screenPoint,
        selected?.state.camera ?? fallbackState.camera,
        selected?.state.viewport ?? fallbackState.viewport
      );
      const nextBounds =
        activeSession.target.type === "corner"
          ? resizeBoundsForCornerDrag(activeSession.startBounds, activeSession.target.corner, cursorWorld, {
              gridSizeMm: GRID_SIZE_MM,
              minRoomSizeMm: MIN_ROOM_SIZE_MM,
            })
          : resizeBoundsForWallDrag(activeSession.startBounds, activeSession.target.wall, cursorWorld, {
              gridSizeMm: GRID_SIZE_MM,
              minRoomSizeMm: MIN_ROOM_SIZE_MM,
            });
      const nextPoints = getRoomPointsFromBounds(nextBounds);
      store.getState().previewRoomResize(activeSession.roomId, nextPoints);
      callbacks.requestRender();
      return;
    }

    if (event.buttons !== 0) {
      setHoveredHandle({ wall: null, corner: null });
      return;
    }

    if (isSpaceHeld || !selected) {
      setHoveredHandle({ wall: null, corner: null });
      return;
    }

    const cornerHandles = getCornerHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    const handles = getWallHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    const hitCorner = hitTestCornerHandle(cornerHandles, screenPoint);
    if (hitCorner) {
      setHoveredHandle({ wall: null, corner: hitCorner });
      return;
    }
    setHoveredHandle({ wall: hitTestWallHandle(handles, screenPoint), corner: null });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || isSpaceHeld) return;
    if (activeSession) return;

    const selected = getSelectedRoomBounds();
    if (!selected) return;

    const screenPoint = toCanvasPoint(event);
    const cornerHandles = getCornerHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    const hitCorner = hitTestCornerHandle(cornerHandles, screenPoint);
    const wallHandles = getWallHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    const hitWall = hitCorner ? null : hitTestWallHandle(wallHandles, screenPoint);
    if (!hitCorner && !hitWall) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);

    activeSession = {
      pointerId: event.pointerId,
      roomId: selected.room.id,
      target: hitCorner ? { type: "corner", corner: hitCorner } : { type: "wall", wall: hitWall! },
      startBounds: selected.bounds,
      startPoints: selected.room.points.map((point) => ({ ...point })),
    };
    hoveredWall = hitWall;
    hoveredCorner = hitCorner;
    updateCursor();
    publishHandleState();
    callbacks.requestRender();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!activeSession || event.pointerId !== activeSession.pointerId) return;

    const session = activeSession;
    const room = store
      .getState()
      .document.rooms.find((candidate) => candidate.id === session.roomId);
    const nextPoints = room ? room.points : session.startPoints;
    store.getState().commitRoomResize(session.roomId, session.startPoints, nextPoints);
    stopSession();
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (!activeSession || event.pointerId !== activeSession.pointerId) return;
    store.getState().previewRoomResize(activeSession.roomId, activeSession.startPoints);
    stopSession();
  };

  const onPointerLeave = () => {
    if (activeSession) return;
    setHoveredHandle({ wall: null, corner: null });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    if (event.code === "Space") {
      isSpaceHeld = true;
      if (!activeSession) {
        setHoveredHandle({ wall: null, corner: null });
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
      store.getState().previewRoomResize(activeSession.roomId, activeSession.startPoints);
      stopSession();
      return;
    }
    setHoveredHandle({ wall: null, corner: null });
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
    canvas.style.cursor = "";
    document.body.style.cursor = "";
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

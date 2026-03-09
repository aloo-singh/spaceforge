import { screenToWorld } from "@/lib/editor/camera";
import { GRID_SIZE_MM } from "@/lib/editor/constants";
import {
  getAxisAlignedRoomBounds,
  getRoomPointsFromBounds,
  getWallHandleLayouts,
  hitTestWallHandle,
  MIN_ROOM_SIZE_MM,
  resizeBoundsForWallDrag,
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
    hoveredRoomId: string | null;
    activeWall: RectWall | null;
    activeRoomId: string | null;
  }) => void;
  requestRender: () => void;
};

type ResizeSession = {
  pointerId: number;
  roomId: string;
  wall: RectWall;
  startBounds: RoomRectBounds;
  startPoints: Point[];
};

export function attachRoomResizeInput(
  canvas: HTMLCanvasElement,
  store: RoomResizeStore,
  callbacks: RoomResizeInputCallbacks
) {
  let isSpaceHeld = false;
  let hoveredWall: RectWall | null = null;
  let activeSession: ResizeSession | null = null;

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
      hoveredRoomId: hoveredWall ? getSelectedRoomBounds()?.room.id ?? null : null,
      activeWall: activeSession?.wall ?? null,
      activeRoomId: activeSession?.roomId ?? null,
    });
  };

  const setHoveredWall = (next: RectWall | null) => {
    if (hoveredWall === next) return;
    hoveredWall = next;
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
      const nextBounds = resizeBoundsForWallDrag(activeSession.startBounds, activeSession.wall, cursorWorld, {
        gridSizeMm: GRID_SIZE_MM,
        minRoomSizeMm: MIN_ROOM_SIZE_MM,
      });
      const nextPoints = getRoomPointsFromBounds(nextBounds);
      store.getState().previewRoomResize(activeSession.roomId, nextPoints);
      callbacks.requestRender();
      return;
    }

    if (isSpaceHeld || !selected) {
      setHoveredWall(null);
      return;
    }

    const handles = getWallHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    setHoveredWall(hitTestWallHandle(handles, screenPoint));
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || isSpaceHeld) return;
    if (activeSession) return;

    const selected = getSelectedRoomBounds();
    if (!selected) return;

    const screenPoint = toCanvasPoint(event);
    const handles = getWallHandleLayouts(selected.bounds, selected.state.camera, selected.state.viewport);
    const hitWall = hitTestWallHandle(handles, screenPoint);
    if (!hitWall) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);

    activeSession = {
      pointerId: event.pointerId,
      roomId: selected.room.id,
      wall: hitWall,
      startBounds: selected.bounds,
      startPoints: selected.room.points.map((point) => ({ ...point })),
    };
    hoveredWall = hitWall;
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
    setHoveredWall(null);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    if (event.code === "Space") {
      isSpaceHeld = true;
      if (!activeSession) {
        setHoveredWall(null);
      }
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    if (event.code === "Space") {
      isSpaceHeld = false;
    }
  };

  const onWindowBlur = () => {
    isSpaceHeld = false;
    if (activeSession) {
      store.getState().previewRoomResize(activeSession.roomId, activeSession.startPoints);
      stopSession();
      return;
    }
    setHoveredWall(null);
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
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

import { screenToWorld } from "@/lib/editor/camera";
import { findRoomLabelAtScreenPoint } from "@/lib/editor/roomLabel";
import { isPointInPolygon } from "@/lib/editor/roomGeometry";
import type { Point, Room } from "@/lib/editor/types";

type RoomDrawStoreState = {
  camera: { xMm: number; yMm: number; pixelsPerMm: number };
  viewport: { width: number; height: number };
  document: { rooms: Room[] };
  roomDraft: { points: Point[] };
  selectedRoomId: string | null;
  placeDraftPointFromCursor: (cursorWorld: Point) => void;
  resetDraft: () => void;
  selectRoomById: (roomId: string | null) => void;
  clearRoomSelection: () => void;
};

type RoomDrawStore = {
  getState: () => RoomDrawStoreState;
};

type RoomDrawInputCallbacks = {
  onCursorWorldChange: (cursorWorld: Point | null) => void;
  onHoveredRoomLabelChange: (roomId: string | null) => void;
  onRoomLabelSelected?: (roomId: string) => void;
  requestRender: () => void;
};

/**
 * Handles room drawing interactions:
 * - left click places points while drafting
 * - room labels are the selection affordance when not drafting
 * - first click outside an active selection clears it without starting draw
 * - right click cancels active draft
 * - escape cancels active draft or clears room selection
 * Rendering stays in EditorCanvas.
 */
export function attachRoomDrawInput(
  canvas: HTMLCanvasElement,
  store: RoomDrawStore,
  callbacks: RoomDrawInputCallbacks
) {
  let isSpaceHeld = false;
  let shouldSuppressNextContextMenu = false;
  let hoveredRoomLabelId: string | null = null;
  let currentCursor = "";

  const toCanvasPoint = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const setHoveredRoomLabelId = (roomId: string | null) => {
    if (hoveredRoomLabelId === roomId) return;
    hoveredRoomLabelId = roomId;
    callbacks.onHoveredRoomLabelChange(roomId);
  };

  const setCursor = (nextCursor: string) => {
    if (currentCursor === nextCursor) return;
    currentCursor = nextCursor;
    canvas.style.cursor = nextCursor;
  };

  const updateCursor = () => {
    const isDrawingModeActive = store.getState().roomDraft.points.length > 0;
    if (!isSpaceHeld && isDrawingModeActive) {
      setCursor("crosshair");
      return;
    }

    if (!isSpaceHeld && hoveredRoomLabelId) {
      setCursor("pointer");
      return;
    }

    // Yield cursor ownership to pan/resize modules when not hovering a label.
    setCursor("");
  };

  const onPointerMove = (event: PointerEvent) => {
    const screenPoint = toCanvasPoint(event);
    const state = store.getState();
    callbacks.onCursorWorldChange(screenToWorld(screenPoint, state.camera, state.viewport));
    if (!isSpaceHeld && state.roomDraft.points.length === 0) {
      const hoveredRoom = findRoomLabelAtScreenPoint(
        state.document.rooms,
        screenPoint,
        state.camera,
        state.viewport
      );
      setHoveredRoomLabelId(hoveredRoom?.id ?? null);
    } else {
      setHoveredRoomLabelId(null);
    }
    updateCursor();
    callbacks.requestRender();
  };

  const onPointerLeave = () => {
    callbacks.onCursorWorldChange(null);
    setHoveredRoomLabelId(null);
    updateCursor();
    callbacks.requestRender();
  };

  const onPointerDown = (event: PointerEvent) => {
    const state = store.getState();

    if (event.button === 2) {
      if (state.roomDraft.points.length > 0) {
        event.preventDefault();
        shouldSuppressNextContextMenu = true;
        state.resetDraft();
        updateCursor();
      }
      return;
    }

    if (event.button !== 0 || isSpaceHeld) return;

    const screenPoint = toCanvasPoint(event);
    const cursorWorld = screenToWorld(screenPoint, state.camera, state.viewport);
    const labelHitRoom = findRoomLabelAtScreenPoint(
      state.document.rooms,
      screenPoint,
      state.camera,
      state.viewport
    );

    if (state.roomDraft.points.length > 0) {
      state.placeDraftPointFromCursor(cursorWorld);
      updateCursor();
      return;
    }

    if (labelHitRoom) {
      const didChangeSelection = state.selectedRoomId !== labelHitRoom.id;
      state.selectRoomById(labelHitRoom.id);
      if (didChangeSelection) {
        callbacks.onRoomLabelSelected?.(labelHitRoom.id);
      }
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

      // Keep selection when clicking inside the selected room body.
      return;
    }

    state.placeDraftPointFromCursor(cursorWorld);
    updateCursor();
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

    if (event.code === "Escape") {
      const state = store.getState();
      if (state.roomDraft.points.length > 0) {
        state.resetDraft();
        updateCursor();
      } else {
        state.clearRoomSelection();
      }
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
    setHoveredRoomLabelId(null);
    updateCursor();
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onWindowBlur);

  return () => {
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
    canvas.style.cursor = "";
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

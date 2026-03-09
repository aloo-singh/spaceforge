import { screenToWorld } from "@/lib/editor/camera";
import { findRoomAtPoint } from "@/lib/editor/roomGeometry";
import type { Point, Room } from "@/lib/editor/types";

type RoomDrawStoreState = {
  camera: { xMm: number; yMm: number; pixelsPerMm: number };
  viewport: { width: number; height: number };
  document: { rooms: Room[] };
  roomDraft: { points: Point[] };
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
  requestRender: () => void;
};

/**
 * Handles room drawing interactions:
 * - left click places points while drafting, otherwise selects rooms
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

  const toCanvasPoint = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerMove = (event: PointerEvent) => {
    const screenPoint = toCanvasPoint(event);
    const state = store.getState();
    callbacks.onCursorWorldChange(screenToWorld(screenPoint, state.camera, state.viewport));
    callbacks.requestRender();
  };

  const onPointerLeave = () => {
    callbacks.onCursorWorldChange(null);
    callbacks.requestRender();
  };

  const onPointerDown = (event: PointerEvent) => {
    const state = store.getState();

    if (event.button === 2) {
      if (state.roomDraft.points.length > 0) {
        event.preventDefault();
        shouldSuppressNextContextMenu = true;
        state.resetDraft();
      }
      return;
    }

    if (event.button !== 0 || isSpaceHeld) return;

    const screenPoint = toCanvasPoint(event);
    const cursorWorld = screenToWorld(screenPoint, state.camera, state.viewport);

    if (state.roomDraft.points.length === 0) {
      const hitRoom = findRoomAtPoint(state.document.rooms, cursorWorld);
      if (hitRoom) {
        state.selectRoomById(hitRoom.id);
        return;
      }

      // Preserve existing draw flow: clicking empty space starts a new draft.
      // Also clear any previous selection before beginning the new room.
      state.clearRoomSelection();
      state.placeDraftPointFromCursor(cursorWorld);
      return;
    }

    state.placeDraftPointFromCursor(cursorWorld);
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
      return;
    }

    if (event.code === "Escape") {
      const state = store.getState();
      if (state.roomDraft.points.length > 0) {
        state.resetDraft();
      } else {
        state.clearRoomSelection();
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
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

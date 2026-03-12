import { ZOOM_STEP } from "@/lib/editor/constants";
import type { ScreenPoint } from "@/lib/editor/types";

type PanZoomStoreState = {
  panCameraByPx: (delta: ScreenPoint) => void;
  zoomAtScreenPoint: (screenPoint: ScreenPoint, scaleFactor: number) => void;
};

type PanZoomStore = {
  getState: () => PanZoomStoreState;
};

type PanZoomInputCallbacks = {
  onPan?: () => void;
};

/**
 * Handles editor camera pan/zoom input and cursor feedback.
 * Rendering remains the responsibility of the canvas component.
 */
export function attachPanZoomInput(
  canvas: HTMLCanvasElement,
  store: PanZoomStore,
  callbacks: PanZoomInputCallbacks = {}
) {
  // Space-to-pan is a core editor affordance; add this to onboarding/tutorial later.
  let isSpaceHeld = false;
  let isPanning = false;
  let activePointerId: number | null = null;
  let lastPointer: ScreenPoint = { x: 0, y: 0 };

  const updateCursor = () => {
    if (isPanning) {
      canvas.style.cursor = "grabbing";
      return;
    }

    canvas.style.cursor = isSpaceHeld ? "grab" : "default";
  };

  const canStartPan = (button: number) => {
    const isMiddleButton = button === 1;
    const isSpaceLeftButton = button === 0 && isSpaceHeld;
    return isMiddleButton || isSpaceLeftButton;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!canStartPan(event.button)) return;
    event.preventDefault();
    isPanning = true;
    activePointerId = event.pointerId;
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    updateCursor();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isPanning || activePointerId !== event.pointerId) return;
    const nextPointer = { x: event.clientX, y: event.clientY };

    store.getState().panCameraByPx({
      x: nextPointer.x - lastPointer.x,
      y: nextPointer.y - lastPointer.y,
    });
    if (nextPointer.x !== lastPointer.x || nextPointer.y !== lastPointer.y) {
      callbacks.onPan?.();
    }

    lastPointer = nextPointer;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) return;
    isPanning = false;
    activePointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    updateCursor();
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cursorInCanvas = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const scaleFactor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    store.getState().zoomAtScreenPoint(cursorInCanvas, scaleFactor);
  };

  const isTypingTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== "Space" || isTypingTarget(event.target)) return;
    event.preventDefault();
    if (!isSpaceHeld) {
      isSpaceHeld = true;
      updateCursor();
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code !== "Space" || isTypingTarget(event.target)) return;
    event.preventDefault();
    isSpaceHeld = false;
    updateCursor();
  };

  const onWindowBlur = () => {
    isSpaceHeld = false;
    isPanning = false;
    activePointerId = null;
    updateCursor();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  // Future keyboard shortcuts (draw/select/etc.) should hook into this same lifecycle.
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onWindowBlur);
  updateCursor();

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
  };
}

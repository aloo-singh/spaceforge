import { ZOOM_STEP } from "@/lib/editor/constants";
import type { ScreenPoint } from "@/lib/editor/types";
import {
  CANVAS_ROTATION_SNAP_FINE_DEGREES,
  normalizeCanvasRotationDegrees,
  snapCanvasRotationDegrees,
} from "@/lib/editor/canvasRotation";

type PanZoomStoreState = {
  camera: { rotationDegrees: number };
  viewport: { width: number; height: number };
  panCameraByPx: (delta: ScreenPoint) => void;
  zoomAtScreenPoint: (screenPoint: ScreenPoint, scaleFactor: number) => void;
  previewCanvasRotationDegrees: (degrees: number) => void;
  commitCanvasRotationDegrees: (previousDegrees: number, nextDegrees: number) => void;
  setCanvasInteractionActive: (isActive: boolean) => void;
};

type PanZoomStore = {
  getState: () => PanZoomStoreState;
};

type PanZoomInputCallbacks = {
  onPan?: () => void;
  canStartRotation?: (screenPoint: ScreenPoint) => boolean;
  onRotationPreview?: (degrees: number, pointer: ScreenPoint | null) => void;
  onRotationEnd?: () => void;
};

type ActiveRotationSession =
  | {
      type: "pointer";
      pointerId: number;
      startRotationDegrees: number;
      currentRotationDegrees: number;
      startAngleDegrees: number;
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
  let activeRotationSession: ActiveRotationSession | null = null;
  let shouldSuppressNextContextMenu = false;

  const getViewportCenter = () => {
    const { viewport } = store.getState();
    return {
      x: viewport.width / 2,
      y: viewport.height / 2,
    };
  };

  const getPointerAngleDegrees = (pointer: ScreenPoint) => {
    const center = getViewportCenter();
    return (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI;
  };

  const updateCursor = () => {
    if (isPanning || activeRotationSession?.type === "pointer") {
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

  const canStartRotation = (button: number, screenPoint: ScreenPoint) => {
    return (
      button === 2 &&
      !isSpaceHeld &&
      !isPanning &&
      activeRotationSession === null &&
      (callbacks.canStartRotation?.(screenPoint) ?? true)
    );
  };

  const getCanvasPointFromClientPoint = (clientX: number, clientY: number): ScreenPoint => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const updateRotationPreview = (degrees: number, pointer: ScreenPoint | null, shouldSnap: boolean) => {
    const nextDegrees = shouldSnap
      ? snapCanvasRotationDegrees(degrees, CANVAS_ROTATION_SNAP_FINE_DEGREES)
      : normalizeCanvasRotationDegrees(degrees);
    store.getState().previewCanvasRotationDegrees(nextDegrees);
    callbacks.onRotationPreview?.(nextDegrees, pointer);
    return nextDegrees;
  };

  const finishRotation = (options?: { pointerId?: number; cancel?: boolean }) => {
    const session = activeRotationSession;
    if (!session) return;

    if (session.type === "pointer" && options?.pointerId !== undefined && session.pointerId !== options.pointerId) {
      return;
    }

    if (!options?.cancel && session.currentRotationDegrees !== session.startRotationDegrees) {
      store
        .getState()
        .commitCanvasRotationDegrees(session.startRotationDegrees, session.currentRotationDegrees);
    } else if (options?.cancel) {
      store.getState().previewCanvasRotationDegrees(session.startRotationDegrees);
      callbacks.onRotationPreview?.(session.startRotationDegrees, null);
    }

    if (session.type === "pointer" && canvas.hasPointerCapture(session.pointerId)) {
      canvas.releasePointerCapture(session.pointerId);
    }

    activeRotationSession = null;
    store.getState().setCanvasInteractionActive(false);
    callbacks.onRotationEnd?.();
    updateCursor();
  };

  const onPointerDown = (event: PointerEvent) => {
    const screenPoint = getCanvasPointFromClientPoint(event.clientX, event.clientY);

    if (canStartRotation(event.button, screenPoint)) {
      event.preventDefault();
      shouldSuppressNextContextMenu = true;
      const startRotationDegrees = normalizeCanvasRotationDegrees(store.getState().camera.rotationDegrees);
      activeRotationSession = {
        type: "pointer",
        pointerId: event.pointerId,
        startRotationDegrees,
        currentRotationDegrees: startRotationDegrees,
        startAngleDegrees: getPointerAngleDegrees(screenPoint),
      };
      store.getState().setCanvasInteractionActive(true);
      canvas.setPointerCapture(event.pointerId);
      callbacks.onRotationPreview?.(startRotationDegrees, screenPoint);
      updateCursor();
      return;
    }

    if (!canStartPan(event.button)) return;
    event.preventDefault();
    isPanning = true;
    activePointerId = event.pointerId;
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    updateCursor();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (activeRotationSession?.type === "pointer" && activeRotationSession.pointerId === event.pointerId) {
      const rect = canvas.getBoundingClientRect();
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const deltaDegrees = normalizeCanvasRotationDegrees(
        getPointerAngleDegrees(screenPoint) - activeRotationSession.startAngleDegrees
      );
      const nextDegrees = updateRotationPreview(
        activeRotationSession.startRotationDegrees + deltaDegrees,
        screenPoint,
        event.shiftKey
      );
      activeRotationSession.currentRotationDegrees = nextDegrees;
      return;
    }

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
    if (activeRotationSession?.type === "pointer") {
      finishRotation({ pointerId: event.pointerId });
      return;
    }

    if (activePointerId !== event.pointerId) return;
    isPanning = false;
    activePointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    updateCursor();
  };

  const onWheel = (event: WheelEvent) => {
    const pointer = getCanvasPointFromClientPoint(event.clientX, event.clientY);
    event.preventDefault();
    const scaleFactor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    store.getState().zoomAtScreenPoint(pointer, scaleFactor);
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
    finishRotation({ cancel: true });
    updateCursor();
  };

  const onContextMenu = (event: MouseEvent) => {
    if (!shouldSuppressNextContextMenu) return;
    shouldSuppressNextContextMenu = false;
    event.preventDefault();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);
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
    canvas.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
  };
}

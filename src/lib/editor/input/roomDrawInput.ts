import { findOpeningAtScreenPoint } from "@/lib/editor/openings";
import { findRoomWallAtScreenPoint } from "@/lib/editor/openings";
import { screenToWorld } from "@/lib/editor/camera";
import { track } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { GRID_SIZE_MM } from "@/lib/editor/constants";
import { findRoomLabelAtScreenPoint } from "@/lib/editor/roomLabel";
import {
  findRoomAtPoint,
  isAxisAlignedRectangle,
  isPointInPolygon,
} from "@/lib/editor/roomGeometry";
import {
  getAxisAlignedRoomBounds,
  hitTestRoomWallEdge,
  type RectWall,
} from "@/lib/editor/rectRoomResize";
import {
  getSnappedRoomTranslationDelta,
  translateRoomPoints,
} from "@/lib/editor/roomTranslation";
import type { Point, Room } from "@/lib/editor/types";
import type { RoomWall } from "@/lib/editor/types";
import { getOpeningMoveOffsetForCursor } from "@/stores/editorStore";
import {
  createTransformFeedbackTargetFromPoints,
  createTransformFeedback,
  TRANSFORM_SETTLE_TOTAL_MS,
  type TransformFeedback,
} from "@/lib/editor/transformFeedback";

type RoomDrawStoreState = {
  camera: { xMm: number; yMm: number; pixelsPerMm: number };
  viewport: { width: number; height: number };
  document: { rooms: Room[] };
  roomDraft: { points: Point[] };
  selectedRoomId: string | null;
  selectedWall: { roomId: string; wall: RoomWall } | null;
  selectedOpening: { roomId: string; openingId: string } | null;
  placeDraftPointFromCursor: (cursorWorld: Point) => void;
  stepBackDraft: () => void;
  resetDraft: () => void;
  selectRoomById: (roomId: string | null) => void;
  selectWallByRoomId: (roomId: string, wall: RoomWall) => void;
  selectOpeningById: (roomId: string, openingId: string) => void;
  clearRoomSelection: () => void;
  previewOpeningMove: (roomId: string, openingId: string, nextOffsetMm: number) => void;
  commitOpeningMove: (
    roomId: string,
    openingId: string,
    previousOffsetMm: number,
    nextOffsetMm: number
  ) => void;
  previewRoomMove: (roomId: string, nextPoints: Point[]) => void;
  commitRoomMove: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
};

type RoomDrawStore = {
  getState: () => RoomDrawStoreState;
};

type RoomDrawInputCallbacks = {
  onCursorWorldChange: (cursorWorld: Point | null) => void;
  onHoveredRoomLabelChange: (roomId: string | null) => void;
  onHoveredSelectableWallChange?: (wallSelection: { roomId: string; wall: RoomWall } | null) => void;
  onTransformFeedbackChange?: (feedback: TransformFeedback | null) => void;
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

type SelectableWallHit = {
  roomId: string;
  wall: RoomWall;
  candidateCount: number;
};

const ROOM_LABEL_DRAG_THRESHOLD_PX = 6;
const WALL_INTERIOR_SIDE_EPSILON_MM = 0.001;

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
  let shouldSuppressNextContextMenu = false;
  let hoveredRoomLabelId: string | null = null;
  let hoveredSelectableRoomId: string | null = null;
  let hoveredSelectableWall: SelectableWallHit | null = null;
  let hoveredOpening: { roomId: string; openingId: string } | null = null;
  let currentCursor = "";
  let activeLabelDragSession: LabelDragSession | null = null;
  let activeOpeningDragSession: OpeningDragSession | null = null;
  const commitRoomMove = store.getState().commitRoomMove;
  const commitOpeningMove = store.getState().commitOpeningMove;
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

    const isDrawingModeActive = store.getState().roomDraft.points.length > 0;
    if (!isSpaceHeld && isDrawingModeActive) {
      setCursor("crosshair");
      return;
    }

    if (
      !isSpaceHeld &&
      (hoveredRoomLabelId || hoveredSelectableRoomId || hoveredSelectableWall || hoveredOpening)
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
    updateCursor();
  };

  const stopOpeningDragSession = () => {
    if (!activeOpeningDragSession) return;
    const pointerId = activeOpeningDragSession.pointerId;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    activeOpeningDragSession = null;
    updateCursor();
  };

  const onPointerMove = (event: PointerEvent) => {
    const screenPoint = toCanvasPoint(event);
    const state = store.getState();
    const cursorWorld = screenToWorld(screenPoint, state.camera, state.viewport);
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
        callbacks.requestRender();
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
        clearPendingTransformFeedbackTimeout();
        setTransformFeedback(getMoveTransformFeedback(session.roomId, session.startPoints));
        updateCursor();
      }

      const delta = getSnappedRoomTranslationDelta(
        session.startWorldPoint,
        cursorWorld,
        GRID_SIZE_MM
      );

      const nextPoints = translateRoomPoints(session.startPoints, delta);
      session.latestPoints = nextPoints;
      setTransformFeedback(
        getMoveTransformFeedback(session.roomId, session.startPoints, nextPoints, nextPoints)
      );
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
        callbacks.requestRender();
        return;
      }

      session.didDrag = true;
      session.latestOffsetMm = moveTarget.nextOffsetMm;
      store.getState().previewOpeningMove(session.roomId, session.openingId, moveTarget.nextOffsetMm);
      updateCursor();
      callbacks.requestRender();
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
        hoveredOpening = findOpeningAtScreenPoint(
          state.document.rooms,
          screenPoint,
          state.camera,
          state.viewport
        );
        const hoveredWall = findSelectableWallAtScreenPoint(state, screenPoint, cursorWorld);
        setHoveredSelectableWall(hoveredWall);
        const hoveredBodyRoom = findSelectableRoomAtScreenPoint(state, cursorWorld);
        setHoveredSelectableRoomId(
          hoveredOpening?.roomId ?? hoveredWall?.roomId ?? hoveredBodyRoom?.id ?? null
        );
      } else {
        hoveredOpening = null;
        setHoveredSelectableWall(null);
        setHoveredSelectableRoomId(null);
      }
    } else {
      setHoveredRoomLabelId(null);
      hoveredOpening = null;
      setHoveredSelectableWall(null);
      setHoveredSelectableRoomId(null);
    }
    updateCursor();
    callbacks.requestRender();
  };

  const onPointerLeave = () => {
    if (activeLabelDragSession || activeOpeningDragSession) return;
    callbacks.onCursorWorldChange(null);
    setHoveredRoomLabelId(null);
    hoveredOpening = null;
    setHoveredSelectableWall(null);
    setHoveredSelectableRoomId(null);
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
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);

      const didChangeSelection = state.selectedRoomId !== labelHitRoom.id;
      state.selectRoomById(labelHitRoom.id);
      activeLabelDragSession = {
        pointerId: event.pointerId,
        roomId: labelHitRoom.id,
        startScreenPoint: screenPoint,
        startWorldPoint: cursorWorld,
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

    state.placeDraftPointFromCursor(cursorWorld);
    updateCursor();
  };

  const onPointerUp = (event: PointerEvent) => {
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
      setHoveredRoomLabelId(null);
      hoveredOpening = null;
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
    setHoveredRoomLabelId(null);
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

    if (event.code === "Escape") {
      const state = store.getState();
      if (state.roomDraft.points.length > 0) {
        state.resetDraft();
        updateCursor();
      } else {
        state.clearRoomSelection();
        hoveredOpening = null;
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
      updateCursor();
      callbacks.requestRender();
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
    setTransformFeedback(null);
    stopLabelDragSession();
    stopOpeningDragSession();
    setHoveredRoomLabelId(null);
    hoveredOpening = null;
    setHoveredSelectableWall(null);
    setHoveredSelectableRoomId(null);
    updateCursor();
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
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
    canvas.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
    clearPendingTransformFeedbackTimeout();
    setTransformFeedback(null);
    stopLabelDragSession();
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

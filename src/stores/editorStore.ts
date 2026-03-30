import { create } from "zustand";
import { GRID_SIZE_MM, INITIAL_PIXELS_PER_MM } from "@/lib/editor/constants";
import {
  applyEditorCommand,
  type EditorCommand,
  type EditorDocumentState,
} from "@/lib/editor/history";
import {
  panCameraByScreenDelta,
  zoomCameraToScreenPoint,
} from "@/lib/editor/camera";
import { getCameraFitTarget, getDrawingAwareMinPixelsPerMm } from "@/lib/editor/cameraFit";
import { getLayoutBoundsFromRooms } from "@/lib/editor/exportLayoutBounds";
import {
  easeResetCameraTransition,
  interpolateCamera,
  RESET_CAMERA_TRANSITION_DURATION_MS,
} from "@/lib/editor/cameraTransition";
import {
  applyCandidatePointToDraftPath,
  getDraftLoopClosureResultFromPath,
  getOrthogonalSegmentAxis,
  getOrthogonalSnappedPoint,
  normalizeDraftPointChain,
  isZeroLengthSegment,
  pointsEqual,
  snapPointToGrid,
} from "@/lib/editor/geometry";
import {
  isOrthogonalPointPath,
  isSimplePolygon,
} from "@/lib/editor/roomGeometry";
import { translateRoomPoints } from "@/lib/editor/roomTranslation";
import {
  PERSISTED_HISTORY_STATE_LIMIT,
  loadEditorSnapshotForHydration,
  saveEditorSnapshot,
} from "@/lib/editor/editorPersistence";
import {
  areEditorExportPreferencesEqual,
  cloneEditorExportPreferences,
  DEFAULT_EDITOR_EXPORT_PREFERENCES,
  type EditorExportPreferences,
} from "@/lib/editor/exportPreferences";
import {
  areEditorSettingsEqual,
  cloneEditorSettings,
  DEFAULT_EDITOR_SETTINGS,
  type EditorSettings,
} from "@/lib/editor/settings";
import {
  buildPersistedHistorySnapshot,
  type PersistedHistorySnapshot,
  hydrateCommandHistoryFromSnapshots,
  areDocumentsEqual,
  cloneDocumentState,
} from "@/lib/editor/persistedHistory";
import {
  canPlaceDefaultStairInRoom,
  cloneRoomInteriorAsset,
  cloneRoomInteriorAssets,
  constrainInteriorAssetCenter,
  createCenteredDefaultStair,
  getResizedStairForCornerDrag,
  getResizedStairForWallDrag,
} from "@/lib/editor/interiorAssets";
import {
  areRoomOpeningsEqual,
  cloneRoomOpening,
  cloneRoomOpenings,
  getUpdatedOpeningForWidth,
  createCenteredRoomOpening,
  getSymmetricOpeningWidthForWorldPoint,
  getRoomWallSegment,
  getOpeningOffsetForWorldPoint,
} from "@/lib/editor/openings";
import { getActiveSnapStepMm } from "@/lib/editor/snapping";
import { normalizeProjectExportConfig } from "@/lib/projects/exportConfig";
import type {
  CameraState,
  DoorHingeSide,
  DoorOpeningSide,
  OpeningType,
  Point,
  Room,
  RoomInteriorAssetSelection,
  RoomOpening,
  RoomOpeningSelection,
  RoomWallSelection,
  ScreenPoint,
  ViewportSize,
} from "@/lib/editor/types";

declare global {
  interface Window {
    __spaceforgeEditorAutosaveCleanup__?: () => void;
  }
}

type RoomDraftState = {
  points: Point[];
  history: Point[][];
};

type DocumentState = EditorDocumentState;

type RenameSessionState = {
  roomId: string;
  initialName: string;
} | null;

type EditorState = {
  document: DocumentState;
  camera: CameraState;
  pendingProjectOpenCameraFit: boolean;
  settings: EditorSettings;
  exportPreferences: EditorExportPreferences;
  isDimensionsVisibilityOverrideActive: boolean;
  viewport: ViewportSize;
  roomDraft: RoomDraftState;
  selectedRoomId: string | null;
  selectedWall: RoomWallSelection | null;
  selectedOpening: RoomOpeningSelection | null;
  selectedInteriorAsset: RoomInteriorAssetSelection | null;
  shouldFocusSelectedRoomNameInput: boolean;
  renameSession: RenameSessionState;
  history: {
    past: EditorCommand[];
    future: EditorCommand[];
  };
  canUndo: boolean;
  canRedo: boolean;
  setDimensionsVisibilityOverrideActive: (isActive: boolean) => void;
  setViewport: (width: number, height: number) => void;
  updateSettings: (settings: Partial<EditorSettings>) => void;
  updateExportPreferences: (preferences: Partial<EditorExportPreferences>) => void;
  updateProjectExportConfig: (config: Partial<DocumentState["exportConfig"]>) => void;
  panCameraByPx: (delta: ScreenPoint) => void;
  zoomAtScreenPoint: (screenPoint: ScreenPoint, scaleFactor: number) => void;
  setCameraCenterMm: (xMm: number, yMm: number) => void;
  placeDraftPointFromCursor: (cursorWorld: Point) => void;
  stepBackDraft: () => void;
  resetDraft: () => void;
  selectRoomById: (roomId: string | null) => void;
  selectWallByRoomId: (roomId: string, wall: RoomWallSelection["wall"]) => void;
  selectOpeningById: (roomId: string, openingId: string) => void;
  selectInteriorAssetById: (roomId: string, assetId: string) => void;
  clearSelectedOpening: () => void;
  clearSelectedInteriorAsset: () => void;
  clearSelectedWall: () => void;
  clearRoomSelection: () => void;
  consumeSelectedRoomNameInputFocusRequest: () => void;
  startRoomRenameSession: (roomId: string) => void;
  updateRoomRenameDraft: (roomId: string, name: string) => void;
  commitRoomRenameSession: (options?: { deselectIfUnchanged?: boolean }) => void;
  cancelRoomRenameSession: () => void;
  deleteSelectedRoom: () => void;
  deleteSelectedOpening: () => void;
  deleteSelectedInteriorAsset: () => void;
  updateRoomName: (roomId: string, name: string) => void;
  insertDefaultDoorOnSelectedWall: () => void;
  insertDefaultWindowOnSelectedWall: () => void;
  insertDefaultStairInSelectedRoom: () => void;
  updateSelectedOpeningWidth: (widthMm: number) => void;
  updateSelectedDoorOpeningSide: (openingSide: DoorOpeningSide) => void;
  updateSelectedDoorHingeSide: (hingeSide: DoorHingeSide) => void;
  previewOpeningResize: (roomId: string, openingId: string, nextWidthMm: number) => void;
  commitOpeningResize: (
    roomId: string,
    openingId: string,
    previousWidthMm: number,
    nextWidthMm: number
  ) => void;
  previewOpeningMove: (roomId: string, openingId: string, nextOffsetMm: number) => void;
  commitOpeningMove: (
    roomId: string,
    openingId: string,
    previousOffsetMm: number,
    nextOffsetMm: number
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
  moveRoomByDelta: (roomId: string, delta: Point) => void;
  previewRoomMove: (roomId: string, nextPoints: Point[]) => void;
  commitRoomMove: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
  previewRoomResize: (roomId: string, nextPoints: Point[]) => void;
  commitRoomResize: (roomId: string, previousPoints: Point[], nextPoints: Point[]) => void;
  resetCamera: () => void;
  resetCanvas: () => void;
  undo: () => void;
  redo: () => void;
  fitCameraOnProjectOpen: () => void;
  loadProjectDocument: (document: DocumentState) => void;
};

const DOCUMENT_AUTOSAVE_DEBOUNCE_MS = 300;
const DEFAULT_DOCUMENT_STATE: DocumentState = {
  rooms: [],
  exportConfig: normalizeProjectExportConfig(null),
};
const DEFAULT_CAMERA_STATE: CameraState = {
  xMm: 0,
  yMm: 0,
  pixelsPerMm: INITIAL_PIXELS_PER_MM,
};
const EMPTY_ROOM_DRAFT: RoomDraftState = {
  points: [],
  history: [],
};
const HISTORY_LIMIT = PERSISTED_HISTORY_STATE_LIMIT - 1;

function pushToPast(past: EditorCommand[], command: EditorCommand): EditorCommand[] {
  const nextPast = [...past, command];
  if (nextPast.length <= HISTORY_LIMIT) return nextPast;
  return nextPast.slice(nextPast.length - HISTORY_LIMIT);
}

function createRoomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `room-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createOpeningId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `opening-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createInteriorAssetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `asset-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function updateRoomNameInDocument(document: DocumentState, roomId: string, name: string): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            name,
          }
        : room
    ),
  };
}

function updateRoomPointsInDocument(
  document: DocumentState,
  roomId: string,
  nextPoints: Point[]
): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            points: nextPoints.map((point) => ({ ...point })),
          }
        : room
    ),
  };
}

function updateMovedRoomInDocument(
  document: DocumentState,
  roomId: string,
  previousPoints: Point[],
  nextPoints: Point[]
): DocumentState {
  const delta = getRoomTranslationDelta(previousPoints, nextPoints);

  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            points: nextPoints.map((point) => ({ ...point })),
            interiorAssets: room.interiorAssets.map((asset) => ({
              ...cloneRoomInteriorAsset(asset),
              xMm: asset.xMm + delta.x,
              yMm: asset.yMm + delta.y,
            })),
          }
        : room
    ),
  };
}

function updateRoomOpeningOffsetInDocument(
  document: DocumentState,
  roomId: string,
  openingId: string,
  nextOffsetMm: number
): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            openings: room.openings.map((opening) =>
              opening.id === openingId
                ? {
                    ...cloneRoomOpening(opening),
                    offsetMm: nextOffsetMm,
                  }
                : opening
            ),
          }
        : room
    ),
  };
}

function updateRoomOpeningInDocument(
  document: DocumentState,
  roomId: string,
  nextOpening: RoomOpening
): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            openings: room.openings.map((opening) =>
              opening.id === nextOpening.id ? cloneRoomOpening(nextOpening) : opening
            ),
          }
        : room
    ),
  };
}

function updateRoomInteriorAssetPositionInDocument(
  document: DocumentState,
  roomId: string,
  assetId: string,
  nextCenter: Point
): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            interiorAssets: room.interiorAssets.map((asset) =>
              asset.id === assetId
                ? {
                    ...cloneRoomInteriorAsset(asset),
                    xMm: nextCenter.x,
                    yMm: nextCenter.y,
                  }
                : asset
            ),
          }
        : room
    ),
  };
}

function updateRoomInteriorAssetInDocument(
  document: DocumentState,
  roomId: string,
  nextAsset: { id: string; widthMm: number; depthMm: number; xMm: number; yMm: number }
): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            interiorAssets: room.interiorAssets.map((asset) =>
              asset.id === nextAsset.id
                ? {
                    ...cloneRoomInteriorAsset(asset),
                    widthMm: nextAsset.widthMm,
                    depthMm: nextAsset.depthMm,
                    xMm: nextAsset.xMm,
                    yMm: nextAsset.yMm,
                  }
                : asset
            ),
          }
        : room
    ),
  };
}

function updateRoomOpeningWidthInDocument(
  document: DocumentState,
  roomId: string,
  openingId: string,
  nextWidthMm: number
): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            openings: room.openings.map((opening) =>
              opening.id === openingId
                ? {
                    ...cloneRoomOpening(opening),
                    widthMm: nextWidthMm,
                  }
                : opening
            ),
          }
        : room
    ),
  };
}

function arePointListsEqual(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ ...point }));
}

function getRoomTranslationDelta(previousPoints: Point[], nextPoints: Point[]): Point {
  if (previousPoints.length === 0 || nextPoints.length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: nextPoints[0].x - previousPoints[0].x,
    y: nextPoints[0].y - previousPoints[0].y,
  };
}

function areCamerasEqual(a: CameraState, b: CameraState): boolean {
  return a.xMm === b.xMm && a.yMm === b.yMm && a.pixelsPerMm === b.pixelsPerMm;
}

function getSelectionIfRoomExists(roomId: string | null, document: DocumentState): string | null {
  if (!roomId) return null;
  return document.rooms.some((room) => room.id === roomId) ? roomId : null;
}

function getSelectedWallIfRoomExists(
  selectedWall: RoomWallSelection | null,
  document: DocumentState
): RoomWallSelection | null {
  if (!selectedWall) return null;
  const room = document.rooms.find((candidate) => candidate.id === selectedWall.roomId);
  if (!room) return null;
  return getRoomWallSegment(room, selectedWall.wall) ? selectedWall : null;
}

function getSelectedOpeningIfExists(
  selectedOpening: RoomOpeningSelection | null,
  document: DocumentState
): RoomOpeningSelection | null {
  if (!selectedOpening) return null;
  const room = document.rooms.find((candidate) => candidate.id === selectedOpening.roomId);
  if (!room) return null;
  return room.openings.some((opening) => opening.id === selectedOpening.openingId)
    ? selectedOpening
    : null;
}

function getSelectedInteriorAssetIfExists(
  selectedInteriorAsset: RoomInteriorAssetSelection | null,
  document: DocumentState
): RoomInteriorAssetSelection | null {
  if (!selectedInteriorAsset) return null;
  const room = document.rooms.find((candidate) => candidate.id === selectedInteriorAsset.roomId);
  if (!room) return null;
  return room.interiorAssets.some((asset) => asset.id === selectedInteriorAsset.assetId)
    ? selectedInteriorAsset
    : null;
}

function getSelectedWallHostRoom(
  document: DocumentState,
  selectedWall: RoomWallSelection | null
): Room | null {
  if (!selectedWall) return null;
  const room = document.rooms.find((candidate) => candidate.id === selectedWall.roomId);
  if (!room || !getRoomWallSegment(room, selectedWall.wall)) return null;
  return room;
}

function insertOpeningOnSelectedWall(
  state: Pick<EditorState, "document" | "selectedWall" | "history">,
  type: OpeningType
) {
  const hostRoom = getSelectedWallHostRoom(state.document, state.selectedWall);
  if (!hostRoom || !state.selectedWall) return null;

  const opening = createCenteredRoomOpening(
    hostRoom,
    state.selectedWall.wall,
    type,
    createOpeningId()
  );
  if (!opening) return null;

  const command: EditorCommand = {
    type: "add-opening",
    roomId: hostRoom.id,
    opening,
  };

  return {
    document: applyEditorCommand(state.document, command, "redo"),
    selectedOpening: { roomId: hostRoom.id, openingId: opening.id },
    selectedInteriorAsset: null,
    history: {
      past: pushToPast(state.history.past, command),
      future: [],
    },
    canUndo: true,
    canRedo: false,
  };
}

function insertDefaultStairOnSelectedRoom(
  state: Pick<EditorState, "document" | "selectedRoomId" | "history">
) {
  if (!state.selectedRoomId) return null;
  const room = state.document.rooms.find((candidate) => candidate.id === state.selectedRoomId);
  if (!room) return null;

  const asset = createCenteredDefaultStair(room, createInteriorAssetId());
  if (!asset) return null;

  const command: EditorCommand = {
    type: "add-interior-asset",
    roomId: room.id,
    asset,
  };

  return {
    document: applyEditorCommand(state.document, command, "redo"),
    selectedInteriorAsset: { roomId: room.id, assetId: asset.id },
    selectedOpening: null,
    selectedWall: null,
    history: {
      past: pushToPast(state.history.past, command),
      future: [],
    },
    canUndo: true,
    canRedo: false,
  };
}

function resolveOpeningMoveOffset(
  document: DocumentState,
  roomId: string,
  openingId: string,
  cursorWorld: Point,
  gridSizeMm: number
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const opening = room?.openings.find((candidate) => candidate.id === openingId);
  if (!room || !opening) return null;

  const nextOffsetMm = getOpeningOffsetForWorldPoint(room, opening, cursorWorld, {
    gridSizeMm,
  });
  if (nextOffsetMm === null) return null;

  return {
    room,
    opening,
    nextOffsetMm,
  };
}

function resolveOpeningResizeWidth(
  document: DocumentState,
  roomId: string,
  openingId: string,
  cursorWorld: Point,
  gridSizeMm: number
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const opening = room?.openings.find((candidate) => candidate.id === openingId);
  if (!room || !opening) return null;

  const nextWidthMm = getSymmetricOpeningWidthForWorldPoint(room, opening, cursorWorld, {
    gridSizeMm,
  });
  if (nextWidthMm === null) return null;

  return {
    room,
    opening,
    nextWidthMm,
  };
}

function resolveInteriorAssetMoveCenter(
  document: DocumentState,
  roomId: string,
  assetId: string,
  cursorWorld: Point,
  gridSizeMm: number
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
  if (!room || !asset) return null;

  const nextCenter = constrainInteriorAssetCenter(room, asset, cursorWorld, {
    gridSizeMm,
  });
  if (!nextCenter) return null;

  return {
    room,
    asset,
    nextCenter,
  };
}

function resolveInteriorAssetResizeFromWall(
  document: DocumentState,
  roomId: string,
  assetId: string,
  wall: "left" | "right" | "top" | "bottom",
  cursorWorld: Point
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
  if (!room || !asset) return null;

  const nextAsset = getResizedStairForWallDrag(room, asset, wall, cursorWorld);
  if (!nextAsset) return null;

  return {
    room,
    asset,
    nextAsset,
  };
}

function resolveInteriorAssetResizeFromCorner(
  document: DocumentState,
  roomId: string,
  assetId: string,
  corner: "top-left" | "top-right" | "bottom-right" | "bottom-left",
  cursorWorld: Point
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
  if (!room || !asset) return null;

  const nextAsset = getResizedStairForCornerDrag(room, asset, corner, cursorWorld);
  if (!nextAsset) return null;

  return {
    room,
    asset,
    nextAsset,
  };
}

function updateSelectedOpening(
  state: Pick<EditorState, "document" | "selectedOpening" | "history">,
  updater: (room: Room, opening: RoomOpening) => RoomOpening | null
) {
  const selectedOpening = state.selectedOpening;
  if (!selectedOpening) return null;

  const room = state.document.rooms.find((candidate) => candidate.id === selectedOpening.roomId);
  const opening = room?.openings.find((candidate) => candidate.id === selectedOpening.openingId);
  if (!room || !opening) return null;

  const nextOpening = updater(room, opening);
  if (!nextOpening || areRoomOpeningsEqual([opening], [nextOpening])) return null;

  const command: EditorCommand = {
    type: "update-opening",
    roomId: room.id,
    previousOpening: cloneRoomOpening(opening),
    nextOpening: cloneRoomOpening(nextOpening),
  };

  return {
    document: updateRoomOpeningInDocument(state.document, room.id, nextOpening),
    history: {
      past: pushToPast(state.history.past, command),
      future: [],
    },
    canUndo: true,
    canRedo: false,
  };
}

function getSafePersistedHistorySnapshot(
  document: DocumentState,
  history: EditorState["history"]
): PersistedHistorySnapshot {
  return (
    buildPersistedHistorySnapshot(document, history, PERSISTED_HISTORY_STATE_LIMIT) ?? {
      historyStack: [
        {
          exportConfig: {
            title: document.exportConfig.title,
            description: document.exportConfig.description,
            titlePosition: document.exportConfig.titlePosition,
            descriptionPosition: document.exportConfig.descriptionPosition,
          },
          rooms: document.rooms.map((room) => ({
            id: room.id,
            name: room.name,
            points: room.points.map((point) => ({ ...point })),
            openings: cloneRoomOpenings(room.openings),
            interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
          })),
        },
      ],
      historyIndex: 0,
    }
  );
}

const hydrationSnapshot = loadEditorSnapshotForHydration();
const hydratedHistoryState =
  hydrationSnapshot?.historyStack && typeof hydrationSnapshot.historyIndex === "number"
    ? hydrateCommandHistoryFromSnapshots(
        {
          historyStack: hydrationSnapshot.historyStack,
          historyIndex: hydrationSnapshot.historyIndex,
        },
        hydrationSnapshot.document,
        PERSISTED_HISTORY_STATE_LIMIT
      ) ?? { past: [], future: [] }
    : { past: [], future: [] };
// Manual QA after persistence changes:
// 1. Edit, undo, refresh, redo.
// 2. Edit, undo, refresh, make a new edit, confirm redo stays unavailable.
// 3. Exceed the history cap, refresh, and confirm undo only reaches the retained window.
// 4. Corrupt stored history manually, refresh, and confirm layout/camera restore without history.

function createInitialDocumentState(): DocumentState {
  return hydrationSnapshot?.document ?? DEFAULT_DOCUMENT_STATE;
}

function createInitialCameraState(): CameraState {
  return hydrationSnapshot?.camera ?? DEFAULT_CAMERA_STATE;
}

function createInitialEditorSettings(): EditorSettings {
  return hydrationSnapshot?.settings ?? cloneEditorSettings(DEFAULT_EDITOR_SETTINGS);
}

function createInitialEditorExportPreferences(): EditorExportPreferences {
  return hydrationSnapshot?.exportPreferences ?? cloneEditorExportPreferences(DEFAULT_EDITOR_EXPORT_PREFERENCES);
}

function isViewportReadyForProjectOpenCameraFit(viewport: ViewportSize): boolean {
  return viewport.width > 1 && viewport.height > 1;
}

function getProjectOpenCamera(document: DocumentState, viewport: ViewportSize): CameraState {
  return getCameraFitTarget({
    rooms: document.rooms,
    viewport,
    emptyLayoutCamera: DEFAULT_CAMERA_STATE,
  }).camera;
}

type ActiveResetCameraAnimation = {
  frameId: number;
  sequence: number;
  targetCamera: CameraState;
};

let activeResetCameraAnimation: ActiveResetCameraAnimation | null = null;
let nextResetCameraAnimationSequence = 0;

function stopResetCameraAnimation() {
  nextResetCameraAnimationSequence += 1;

  if (!activeResetCameraAnimation || typeof window === "undefined") {
    activeResetCameraAnimation = null;
    return;
  }

  window.cancelAnimationFrame(activeResetCameraAnimation.frameId);
  activeResetCameraAnimation = null;
}

function hasActiveResetCameraAnimationTarget(targetCamera: CameraState): boolean {
  return (
    activeResetCameraAnimation !== null &&
    areCamerasEqual(activeResetCameraAnimation.targetCamera, targetCamera)
  );
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createInitialDocumentState(),
  camera: createInitialCameraState(),
  pendingProjectOpenCameraFit: false,
  settings: createInitialEditorSettings(),
  exportPreferences: createInitialEditorExportPreferences(),
  isDimensionsVisibilityOverrideActive: false,
  viewport: {
    width: 1,
    height: 1,
  },
  roomDraft: EMPTY_ROOM_DRAFT,
  selectedRoomId: null,
  selectedWall: null,
  selectedOpening: null,
  selectedInteriorAsset: null,
  shouldFocusSelectedRoomNameInput: false,
  renameSession: null,
  history: {
    past: hydratedHistoryState.past,
    future: hydratedHistoryState.future,
  },
  canUndo: hydratedHistoryState.past.length > 0,
  canRedo: hydratedHistoryState.future.length > 0,
  setDimensionsVisibilityOverrideActive: (isActive) =>
    set((state) => {
      if (state.isDimensionsVisibilityOverrideActive === isActive) return state;

      return {
        isDimensionsVisibilityOverrideActive: isActive,
      };
    }),
  setViewport: (width, height) =>
    set((state) => {
      const nextViewport = { width, height };
      const didViewportChange =
        state.viewport.width !== nextViewport.width || state.viewport.height !== nextViewport.height;

      if (!didViewportChange && !state.pendingProjectOpenCameraFit) {
        return state;
      }

      if (
        !state.pendingProjectOpenCameraFit ||
        !isViewportReadyForProjectOpenCameraFit(nextViewport)
      ) {
        return {
          viewport: nextViewport,
        };
      }

      stopResetCameraAnimation();

      return {
        viewport: nextViewport,
        camera: getProjectOpenCamera(state.document, nextViewport),
        pendingProjectOpenCameraFit: false,
      };
    }),
  updateSettings: (settings) =>
    set((state) => {
      const nextSettings: EditorSettings = {
        ...state.settings,
        ...settings,
      };
      if (areEditorSettingsEqual(state.settings, nextSettings)) return state;

      return {
        settings: nextSettings,
      };
    }),
  updateExportPreferences: (preferences) =>
    set((state) => {
      const nextPreferences: EditorExportPreferences = {
        ...state.exportPreferences,
        ...preferences,
      };
      if (areEditorExportPreferencesEqual(state.exportPreferences, nextPreferences)) return state;

      return {
        exportPreferences: nextPreferences,
      };
    }),
  updateProjectExportConfig: (config) =>
    set((state) => {
      const nextExportConfig = normalizeProjectExportConfig({
        ...state.document.exportConfig,
        ...config,
      });
      if (
        state.document.exportConfig.title === nextExportConfig.title &&
        state.document.exportConfig.description === nextExportConfig.description &&
        state.document.exportConfig.titlePosition === nextExportConfig.titlePosition &&
        state.document.exportConfig.descriptionPosition === nextExportConfig.descriptionPosition
      ) {
        return state;
      }

      return {
        document: {
          ...state.document,
          exportConfig: nextExportConfig,
        },
      };
    }),
  panCameraByPx: (delta) => {
    stopResetCameraAnimation();
    set((state) => ({
      camera: panCameraByScreenDelta(state.camera, delta),
    }));
  },
  zoomAtScreenPoint: (screenPoint, scaleFactor) => {
    stopResetCameraAnimation();
    set((state) => {
      const layoutBounds = getLayoutBoundsFromRooms(state.document.rooms);
      const minimumPixelsPerMm = getDrawingAwareMinPixelsPerMm({
        layoutBounds,
        viewport: state.viewport,
      });

      return {
        camera: zoomCameraToScreenPoint(
          state.camera,
          state.viewport,
          screenPoint,
          state.camera.pixelsPerMm * scaleFactor,
          minimumPixelsPerMm
        ),
      };
    });
  },
  setCameraCenterMm: (xMm, yMm) => {
    stopResetCameraAnimation();
    set((state) => ({
      camera: {
        ...state.camera,
        xMm,
        yMm,
      },
    }));
  },
  placeDraftPointFromCursor: (cursorWorld) =>
    set((state) => {
      const draftPoints = normalizeDraftPointChain(state.roomDraft.points);
      const activeSnapStepMm = getActiveSnapStepMm(state.camera);

      if (draftPoints.length === 0) {
        return {
          roomDraft: {
            points: [snapPointToGrid(cursorWorld, activeSnapStepMm)],
            history: [],
          },
        };
      }

      const lastPoint = draftPoints[draftPoints.length - 1];
      const nextPoint = getOrthogonalSnappedPoint(lastPoint, cursorWorld, activeSnapStepMm);

      if (isZeroLengthSegment(lastPoint, nextPoint)) return state;

      const startPoint = draftPoints[0];
      if (pointsEqual(nextPoint, startPoint)) {
        if (draftPoints.length < 4) return state;
        if (!isValidDraftRoomClosure(draftPoints)) return state;
        return completeDraftRoom(state, draftPoints);
      }

      const nextDraftPoints = applyCandidatePointToDraftPath(draftPoints, nextPoint);
      const loopClosure = getDraftLoopClosureResultFromPath(nextDraftPoints);
      if (loopClosure && !pointsEqual(nextPoint, startPoint)) {
        return completeDraftRoom(state, loopClosure.committedLoop);
      }

      if (!isValidDraftPathProgression(draftPoints, nextDraftPoints, nextPoint)) {
        return state;
      }

      if (arePointListsEqual(draftPoints, nextDraftPoints)) return state;

      return {
        roomDraft: {
          points: nextDraftPoints,
          history: [...state.roomDraft.history, clonePoints(draftPoints)],
        },
      };
    }),
  stepBackDraft: () =>
    set((state) => {
      if (state.roomDraft.points.length === 0) return state;

      const previousDraftPoints = state.roomDraft.history[state.roomDraft.history.length - 1] ?? null;
      if (!previousDraftPoints) {
        return {
          roomDraft: EMPTY_ROOM_DRAFT,
        };
      }

      return {
        roomDraft: {
          points: clonePoints(previousDraftPoints),
          history: state.roomDraft.history
            .slice(0, -1)
            .map((snapshot) => clonePoints(snapshot)),
        },
      };
    }),
  resetDraft: () =>
    set({
      roomDraft: EMPTY_ROOM_DRAFT,
    }),
  selectRoomById: (roomId) =>
    set((state) => {
      if (
        state.selectedRoomId === roomId &&
        state.selectedWall === null &&
        state.selectedOpening === null &&
        state.selectedInteriorAsset === null
      ) {
        return state;
      }

      return {
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  selectWallByRoomId: (roomId, wall) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (!getRoomWallSegment(room, wall)) {
        return {
          selectedRoomId: roomId,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: null,
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
        };
      }

      if (
        state.selectedRoomId === roomId &&
        state.selectedWall?.roomId === roomId &&
        state.selectedWall.wall === wall
      ) {
        return state;
      }

      return {
        selectedRoomId: roomId,
        selectedWall: { roomId, wall },
        selectedOpening: null,
        selectedInteriorAsset: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  selectOpeningById: (roomId, openingId) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (!room.openings.some((opening) => opening.id === openingId)) return state;
      if (
        state.selectedRoomId === roomId &&
        state.selectedOpening?.roomId === roomId &&
        state.selectedOpening.openingId === openingId
      ) {
        return state;
      }

      return {
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: { roomId, openingId },
        selectedInteriorAsset: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  selectInteriorAssetById: (roomId, assetId) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (!room.interiorAssets.some((asset) => asset.id === assetId)) return state;
      if (
        state.selectedRoomId === roomId &&
        state.selectedInteriorAsset?.roomId === roomId &&
        state.selectedInteriorAsset.assetId === assetId
      ) {
        return state;
      }

      return {
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: { roomId, assetId },
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  clearSelectedOpening: () =>
    set((state) => {
      if (state.selectedOpening === null) return state;
      return {
        selectedOpening: null,
      };
    }),
  clearSelectedInteriorAsset: () =>
    set((state) => {
      if (state.selectedInteriorAsset === null) return state;
      return {
        selectedInteriorAsset: null,
      };
    }),
  clearSelectedWall: () =>
    set((state) => {
      if (state.selectedWall === null) return state;
      return {
        selectedWall: null,
      };
    }),
  clearRoomSelection: () =>
    set({
      selectedRoomId: null,
      selectedWall: null,
      selectedOpening: null,
      selectedInteriorAsset: null,
      shouldFocusSelectedRoomNameInput: false,
      renameSession: null,
    }),
  consumeSelectedRoomNameInputFocusRequest: () =>
    set((state) => {
      if (!state.shouldFocusSelectedRoomNameInput) return state;
      return {
        shouldFocusSelectedRoomNameInput: false,
      };
    }),
  startRoomRenameSession: (roomId) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (state.renameSession?.roomId === roomId) return state;

      return {
        renameSession: {
          roomId,
          initialName: room.name,
        },
      };
    }),
  updateRoomRenameDraft: (roomId, name) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;

      const renameSession =
        state.renameSession?.roomId === roomId
          ? state.renameSession
          : {
              roomId,
              initialName: room.name,
            };

      if (room.name === name && state.renameSession?.roomId === roomId) return state;

      return {
        document: updateRoomNameInDocument(state.document, roomId, name),
        renameSession,
      };
    }),
  commitRoomRenameSession: (options) =>
    set((state) => {
      const deselectIfUnchanged = options?.deselectIfUnchanged ?? true;
      const renameSession = state.renameSession;
      if (!renameSession) {
        if (!state.selectedRoomId) return state;
        if (!deselectIfUnchanged) return state;
        return {
          selectedRoomId: null,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: null,
        };
      }

      const room = state.document.rooms.find((candidate) => candidate.id === renameSession.roomId);
      if (!room) {
        return {
          selectedRoomId: null,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: null,
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
        };
      }

      const didNameChange = room.name !== renameSession.initialName;
      if (!didNameChange) {
        if (!deselectIfUnchanged) {
          return {
            renameSession: null,
          };
        }
        return {
          selectedRoomId: null,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: null,
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
        };
      }

      const command: EditorCommand = {
        type: "rename-room",
        roomId: renameSession.roomId,
        previousName: renameSession.initialName,
        nextName: room.name,
      };

      return {
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  cancelRoomRenameSession: () =>
    set((state) => {
      const renameSession = state.renameSession;
      if (!renameSession) {
        if (!state.selectedRoomId) return state;
        return {
          selectedRoomId: null,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: null,
          shouldFocusSelectedRoomNameInput: false,
        };
      }

      const room = state.document.rooms.find((candidate) => candidate.id === renameSession.roomId);
      const nextDocument =
        room && room.name !== renameSession.initialName
          ? updateRoomNameInDocument(state.document, renameSession.roomId, renameSession.initialName)
          : state.document;

    return {
      document: nextDocument,
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
      };
    }),
  deleteSelectedRoom: () =>
    set((state) => {
      const selectedRoomId = state.selectedRoomId;
      if (!selectedRoomId) return state;

      const previousIndex = state.document.rooms.findIndex((room) => room.id === selectedRoomId);
      if (previousIndex < 0) {
        return {
          selectedRoomId: null,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: null,
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
        };
      }

      const room = state.document.rooms[previousIndex];
      const command: EditorCommand = {
        type: "delete-room",
        room: {
          id: room.id,
          name: room.name,
          points: room.points.map((point) => ({ ...point })),
          openings: cloneRoomOpenings(room.openings),
          interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
        },
        previousIndex,
      };
      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  deleteSelectedOpening: () =>
    set((state) => {
      const selectedOpening = state.selectedOpening;
      if (!selectedOpening) return state;

      const room = state.document.rooms.find((candidate) => candidate.id === selectedOpening.roomId);
      const opening = room?.openings.find((candidate) => candidate.id === selectedOpening.openingId);
      if (!room || !opening) {
        return {
          selectedOpening: null,
        };
      }

      const command: EditorCommand = {
        type: "delete-opening",
        roomId: room.id,
        opening: cloneRoomOpening(opening),
      };
      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        selectedOpening: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  deleteSelectedInteriorAsset: () =>
    set((state) => {
      const selectedInteriorAsset = state.selectedInteriorAsset;
      if (!selectedInteriorAsset) return state;

      const room = state.document.rooms.find((candidate) => candidate.id === selectedInteriorAsset.roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === selectedInteriorAsset.assetId);
      if (!room || !asset) {
        return {
          selectedInteriorAsset: null,
        };
      }

      const command: EditorCommand = {
        type: "delete-interior-asset",
        roomId: room.id,
        asset: cloneRoomInteriorAsset(asset),
      };
      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        selectedInteriorAsset: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  updateRoomName: (roomId, name) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room || room.name === name) return state;

      const command: EditorCommand = {
        type: "rename-room",
        roomId,
        previousName: room.name,
        nextName: name,
      };
      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  insertDefaultDoorOnSelectedWall: () =>
    set((state) => {
      const nextState = insertOpeningOnSelectedWall(state, "door");
      return nextState ?? state;
    }),
  insertDefaultWindowOnSelectedWall: () =>
    set((state) => {
      const nextState = insertOpeningOnSelectedWall(state, "window");
      return nextState ?? state;
    }),
  insertDefaultStairInSelectedRoom: () =>
    set((state) => {
      const nextState = insertDefaultStairOnSelectedRoom(state);
      return nextState ?? state;
    }),
  updateSelectedOpeningWidth: (widthMm) =>
    set((state) => {
      const nextState = updateSelectedOpening(state, (room, opening) =>
        getUpdatedOpeningForWidth(room, opening, widthMm, {
          gridSizeMm: GRID_SIZE_MM,
        })
      );
      return nextState ?? state;
    }),
  updateSelectedDoorOpeningSide: (openingSide) =>
    set((state) => {
      const nextState = updateSelectedOpening(state, (_, opening) => {
        if (opening.type !== "door" || opening.openingSide === openingSide) return null;

        return {
          ...cloneRoomOpening(opening),
          openingSide,
        };
      });
      return nextState ?? state;
    }),
  updateSelectedDoorHingeSide: (hingeSide) =>
    set((state) => {
      const nextState = updateSelectedOpening(state, (_, opening) => {
        if (opening.type !== "door" || opening.hingeSide === hingeSide) return null;

        return {
          ...cloneRoomOpening(opening),
          hingeSide,
        };
      });
      return nextState ?? state;
    }),
  previewOpeningResize: (roomId, openingId, nextWidthMm) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const opening = room?.openings.find((candidate) => candidate.id === openingId);
      if (!room || !opening) return state;
      if (opening.widthMm === nextWidthMm) return state;

      return {
        document: updateRoomOpeningWidthInDocument(state.document, roomId, openingId, nextWidthMm),
      };
    }),
  commitOpeningResize: (roomId, openingId, previousWidthMm, nextWidthMm) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const opening = room?.openings.find((candidate) => candidate.id === openingId);
      if (!room || !opening) return state;
      if (previousWidthMm === nextWidthMm) return state;

      const command: EditorCommand = {
        type: "update-opening",
        roomId,
        previousOpening: {
          ...cloneRoomOpening(opening),
          widthMm: previousWidthMm,
        },
        nextOpening: {
          ...cloneRoomOpening(opening),
          widthMm: nextWidthMm,
        },
      };

      return {
        document: updateRoomOpeningWidthInDocument(state.document, roomId, openingId, nextWidthMm),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  previewOpeningMove: (roomId, openingId, nextOffsetMm) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const opening = room?.openings.find((candidate) => candidate.id === openingId);
      if (!room || !opening) return state;
      if (opening.offsetMm === nextOffsetMm) return state;

      return {
        document: updateRoomOpeningOffsetInDocument(state.document, roomId, openingId, nextOffsetMm),
      };
    }),
  commitOpeningMove: (roomId, openingId, previousOffsetMm, nextOffsetMm) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const opening = room?.openings.find((candidate) => candidate.id === openingId);
      if (!room || !opening) return state;
      if (previousOffsetMm === nextOffsetMm) return state;

      const command: EditorCommand = {
        type: "move-opening",
        roomId,
        openingId,
        previousOffsetMm,
        nextOffsetMm,
      };

      return {
        document: updateRoomOpeningOffsetInDocument(state.document, roomId, openingId, nextOffsetMm),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  previewInteriorAssetMove: (roomId, assetId, nextCenter) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!room || !asset) return state;
      if (asset.xMm === nextCenter.x && asset.yMm === nextCenter.y) return state;

      return {
        document: updateRoomInteriorAssetPositionInDocument(state.document, roomId, assetId, nextCenter),
      };
    }),
  commitInteriorAssetMove: (roomId, assetId, previousCenter, nextCenter) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!room || !asset) return state;
      if (previousCenter.x === nextCenter.x && previousCenter.y === nextCenter.y) return state;

      const command: EditorCommand = {
        type: "move-interior-asset",
        roomId,
        assetId,
        previousXmm: previousCenter.x,
        previousYmm: previousCenter.y,
        nextXmm: nextCenter.x,
        nextYmm: nextCenter.y,
      };

      return {
        document: updateRoomInteriorAssetPositionInDocument(state.document, roomId, assetId, nextCenter),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  previewInteriorAssetResize: (roomId, assetId, nextAsset) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!room || !asset) return state;
      if (
        asset.widthMm === nextAsset.widthMm &&
        asset.depthMm === nextAsset.depthMm &&
        asset.xMm === nextAsset.xMm &&
        asset.yMm === nextAsset.yMm
      ) {
        return state;
      }

      return {
        document: updateRoomInteriorAssetInDocument(state.document, roomId, {
          ...nextAsset,
          id: assetId,
        }),
      };
    }),
  commitInteriorAssetResize: (roomId, assetId, previousAsset, nextAsset) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!room || !asset) return state;
      if (
        previousAsset.widthMm === nextAsset.widthMm &&
        previousAsset.depthMm === nextAsset.depthMm &&
        previousAsset.xMm === nextAsset.xMm &&
        previousAsset.yMm === nextAsset.yMm
      ) {
        return state;
      }

      const command: EditorCommand = {
        type: "update-interior-asset",
        roomId,
        previousAsset: {
          ...cloneRoomInteriorAsset(asset),
          widthMm: previousAsset.widthMm,
          depthMm: previousAsset.depthMm,
          xMm: previousAsset.xMm,
          yMm: previousAsset.yMm,
        },
        nextAsset: {
          ...cloneRoomInteriorAsset(asset),
          widthMm: nextAsset.widthMm,
          depthMm: nextAsset.depthMm,
          xMm: nextAsset.xMm,
          yMm: nextAsset.yMm,
        },
      };

      return {
        document: updateRoomInteriorAssetInDocument(state.document, roomId, {
          ...nextAsset,
          id: assetId,
        }),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  moveRoomByDelta: (roomId, delta) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (delta.x === 0 && delta.y === 0) return state;

      const nextPoints = translateRoomPoints(room.points, delta);
      const command: EditorCommand = {
        type: "move-room",
        roomId,
        previousPoints: room.points.map((point) => ({ ...point })),
        nextPoints: nextPoints.map((point) => ({ ...point })),
      };
      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  previewRoomMove: (roomId, nextPoints) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(room.points, nextPoints)) return state;

      return {
        document: updateMovedRoomInDocument(state.document, roomId, room.points, nextPoints),
      };
    }),
  commitRoomMove: (roomId, previousPoints, nextPoints) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(previousPoints, nextPoints)) return state;

      const command: EditorCommand = {
        type: "move-room",
        roomId,
        previousPoints: previousPoints.map((point) => ({ ...point })),
        nextPoints: nextPoints.map((point) => ({ ...point })),
      };

      return {
        document: updateMovedRoomInDocument(state.document, roomId, previousPoints, nextPoints),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  previewRoomResize: (roomId, nextPoints) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(room.points, nextPoints)) return state;

      return {
        document: updateRoomPointsInDocument(state.document, roomId, nextPoints),
      };
    }),
  commitRoomResize: (roomId, previousPoints, nextPoints) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(previousPoints, nextPoints)) return state;

      const command: EditorCommand = {
        type: "resize-room",
        roomId,
        previousPoints: previousPoints.map((point) => ({ ...point })),
        nextPoints: nextPoints.map((point) => ({ ...point })),
      };

      return {
        document: updateRoomPointsInDocument(state.document, roomId, nextPoints),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  resetCamera: () => {
    const state = get();
    const targetCamera = getCameraFitTarget({
      rooms: state.document.rooms,
      viewport: state.viewport,
      emptyLayoutCamera: DEFAULT_CAMERA_STATE,
    }).camera;

    if (areCamerasEqual(state.camera, targetCamera)) return;
    if (hasActiveResetCameraAnimationTarget(targetCamera)) return;

    stopResetCameraAnimation();

    if (typeof window === "undefined") {
      set({ camera: targetCamera });
      return;
    }

    const startCamera = state.camera;
    const startTime = window.performance.now();
    const sequence = nextResetCameraAnimationSequence;

    const step = (now: number) => {
      if (activeResetCameraAnimation?.sequence !== sequence) return;

      const elapsedMs = now - startTime;
      const progress = Math.min(1, elapsedMs / RESET_CAMERA_TRANSITION_DURATION_MS);
      const easedProgress = easeResetCameraTransition(progress);
      const nextCamera =
        progress >= 1
          ? targetCamera
          : interpolateCamera(startCamera, targetCamera, easedProgress);

      set({ camera: nextCamera });

      if (progress >= 1) {
        activeResetCameraAnimation = null;
        return;
      }

      activeResetCameraAnimation = {
        frameId: window.requestAnimationFrame(step),
        sequence,
        targetCamera,
      };
    };

    activeResetCameraAnimation = {
      frameId: window.requestAnimationFrame(step),
      sequence,
      targetCamera,
    };
  },
  resetCanvas: () => {
    stopResetCameraAnimation();
    set((state) => ({
      document: cloneDocumentState(DEFAULT_DOCUMENT_STATE),
      camera: { ...DEFAULT_CAMERA_STATE },
      pendingProjectOpenCameraFit: false,
      roomDraft: {
        points: [],
        history: [],
      },
      selectedRoomId: null,
      selectedWall: null,
      selectedOpening: null,
      selectedInteriorAsset: null,
      shouldFocusSelectedRoomNameInput: false,
      renameSession: null,
      history: {
        past: [],
        future: [],
      },
      canUndo: false,
      canRedo: false,
      viewport: state.viewport,
    }));
  },
  undo: () =>
    set((state) => {
      const command = state.history.past[state.history.past.length - 1];
      if (!command) return state;
      const nextDocument = applyEditorCommand(state.document, command, "undo");
      const nextPast = state.history.past.slice(0, -1);
      const nextFuture = [command, ...state.history.future];

      return {
        document: nextDocument,
        selectedRoomId: getSelectionIfRoomExists(state.selectedRoomId, nextDocument),
        selectedWall: getSelectedWallIfRoomExists(state.selectedWall, nextDocument),
        selectedOpening: getSelectedOpeningIfExists(state.selectedOpening, nextDocument),
        selectedInteriorAsset: getSelectedInteriorAssetIfExists(
          state.selectedInteriorAsset,
          nextDocument
        ),
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        history: {
          past: nextPast,
          future: nextFuture,
        },
        canUndo: nextPast.length > 0,
        canRedo: true,
      };
    }),
  redo: () =>
    set((state) => {
      const [command, ...remainingFuture] = state.history.future;
      if (!command) return state;
      const nextDocument = applyEditorCommand(state.document, command, "redo");
      const nextPast = pushToPast(state.history.past, command);

      return {
        document: nextDocument,
        selectedRoomId: getSelectionIfRoomExists(state.selectedRoomId, nextDocument),
        selectedWall: getSelectedWallIfRoomExists(state.selectedWall, nextDocument),
        selectedOpening: getSelectedOpeningIfExists(state.selectedOpening, nextDocument),
        selectedInteriorAsset: getSelectedInteriorAssetIfExists(
          state.selectedInteriorAsset,
          nextDocument
        ),
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        history: {
          past: nextPast,
          future: remainingFuture,
        },
        canUndo: true,
        canRedo: remainingFuture.length > 0,
      };
    }),
  fitCameraOnProjectOpen: () =>
    set((state) => {
      const shouldDeferCameraFit = !isViewportReadyForProjectOpenCameraFit(state.viewport);

      stopResetCameraAnimation();

      if (shouldDeferCameraFit) {
        if (state.pendingProjectOpenCameraFit) {
          return state;
        }

        return {
          pendingProjectOpenCameraFit: true,
        };
      }

      const targetCamera = getProjectOpenCamera(state.document, state.viewport);
      if (!state.pendingProjectOpenCameraFit && areCamerasEqual(state.camera, targetCamera)) {
        return state;
      }

      return {
        camera: targetCamera,
        pendingProjectOpenCameraFit: false,
      };
    }),
  loadProjectDocument: (document) =>
    set((state) => {
      const nextDocument = cloneDocumentState(document);
      if (areDocumentsEqual(state.document, nextDocument)) {
        return state;
      }

      stopResetCameraAnimation();
      const shouldDeferCameraFit = !isViewportReadyForProjectOpenCameraFit(state.viewport);

      return {
        document: nextDocument,
        camera: shouldDeferCameraFit
          ? state.camera
          : getProjectOpenCamera(nextDocument, state.viewport),
        pendingProjectOpenCameraFit: shouldDeferCameraFit,
        roomDraft: EMPTY_ROOM_DRAFT,
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        history: {
          past: [],
          future: [],
        },
        canUndo: false,
        canRedo: false,
      };
    }),
}));

if (typeof window !== "undefined") {
  window.__spaceforgeEditorAutosaveCleanup__?.();

  let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastSavedPersistedSignature = JSON.stringify((() => {
    const state = useEditorStore.getState();
    const historySnapshot = getSafePersistedHistorySnapshot(state.document, state.history);

    return {
      document: state.document,
      camera: state.camera,
      settings: state.settings,
      exportPreferences: state.exportPreferences,
      historyStack: historySnapshot.historyStack,
      historyIndex: historySnapshot.historyIndex,
    };
  })());

  const flushAutosave = () => {
    autosaveTimeout = null;
    const state = useEditorStore.getState();
    const historySnapshot = getSafePersistedHistorySnapshot(state.document, state.history);
    const nextPersistedSignature = JSON.stringify({
      document: state.document,
      camera: state.camera,
      settings: state.settings,
      exportPreferences: state.exportPreferences,
      historyStack: historySnapshot.historyStack,
      historyIndex: historySnapshot.historyIndex,
    });
    if (nextPersistedSignature === lastSavedPersistedSignature) return;

    const didSave = saveEditorSnapshot({
      document: state.document,
      camera: state.camera,
      settings: state.settings,
      exportPreferences: state.exportPreferences,
      historyStack: historySnapshot.historyStack,
      historyIndex: historySnapshot.historyIndex,
    });
    if (didSave) {
      lastSavedPersistedSignature = nextPersistedSignature;
    }
  };

  const flushPendingAutosave = () => {
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
      autosaveTimeout = null;
    }
    flushAutosave();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flushPendingAutosave();
    }
  };
  const onPageHide = () => {
    flushPendingAutosave();
  };
  const onBeforeUnload = () => {
    flushPendingAutosave();
  };

  // Autosave only when persisted fields change.
  const unsubscribe = useEditorStore.subscribe((state, previousState) => {
    const didDocumentChange = state.document !== previousState.document;
    const didCameraChange = !areCamerasEqual(state.camera, previousState.camera);
    const didSettingsChange = !areEditorSettingsEqual(state.settings, previousState.settings);
    const didExportPreferencesChange = !areEditorExportPreferencesEqual(
      state.exportPreferences,
      previousState.exportPreferences
    );
    const didPastChange = state.history.past !== previousState.history.past;
    const didFutureChange = state.history.future !== previousState.history.future;
    if (
      !didDocumentChange &&
      !didCameraChange &&
      !didSettingsChange &&
      !didExportPreferencesChange &&
      !didPastChange &&
      !didFutureChange
    ) {
      return;
    }

    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
    }

    autosaveTimeout = setTimeout(flushAutosave, DOCUMENT_AUTOSAVE_DEBOUNCE_MS);
  });

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onBeforeUnload);

  window.__spaceforgeEditorAutosaveCleanup__ = () => {
    stopResetCameraAnimation();
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
      autosaveTimeout = null;
    }
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}

function isValidDraftRoomClosure(points: Point[]): boolean {
  return isOrthogonalPointPath(points, { closed: true }) && isSimplePolygon(points);
}

function completeDraftRoom(state: EditorState, draftPoints: Point[]) {
  const normalizedRoomPoints = normalizeDraftPointChain(draftPoints);
  if (normalizedRoomPoints.length < 4) return state;
  if (!isValidDraftRoomClosure(normalizedRoomPoints)) return state;

  const room: Room = {
    id: createRoomId(),
    name: `Room ${state.document.rooms.length + 1}`,
    points: normalizedRoomPoints.map((point) => ({ ...point })),
    openings: [],
    interiorAssets: [],
  };
  const command: EditorCommand = {
    type: "complete-room",
    room,
  };
  const nextDocument = applyEditorCommand(state.document, command, "redo");

  return {
    document: nextDocument,
    roomDraft: {
      points: [],
      history: [],
    },
    selectedRoomId: room.id,
    selectedWall: null,
    selectedOpening: null,
    selectedInteriorAsset: null,
    shouldFocusSelectedRoomNameInput: true,
    renameSession: null,
    history: {
      past: pushToPast(state.history.past, command),
      future: [],
    },
    canUndo: true,
    canRedo: false,
  };
}

export function getOpeningMoveOffsetForCursor(
  roomId: string,
  openingId: string,
  cursorWorld: Point
) {
  const state = useEditorStore.getState();
  return resolveOpeningMoveOffset(
    state.document,
    roomId,
    openingId,
    cursorWorld,
    getActiveSnapStepMm(state.camera)
  );
}

export function getOpeningResizeWidthForCursor(
  roomId: string,
  openingId: string,
  cursorWorld: Point
) {
  const state = useEditorStore.getState();
  return resolveOpeningResizeWidth(
    state.document,
    roomId,
    openingId,
    cursorWorld,
    getActiveSnapStepMm(state.camera)
  );
}

export function getInteriorAssetMoveCenterForCursor(
  roomId: string,
  assetId: string,
  cursorWorld: Point
) {
  const state = useEditorStore.getState();
  return resolveInteriorAssetMoveCenter(
    state.document,
    roomId,
    assetId,
    cursorWorld,
    getActiveSnapStepMm(state.camera)
  );
}

export function getInteriorAssetResizeFromWallForCursor(
  roomId: string,
  assetId: string,
  wall: "left" | "right" | "top" | "bottom",
  cursorWorld: Point
) {
  const state = useEditorStore.getState();
  return resolveInteriorAssetResizeFromWall(state.document, roomId, assetId, wall, cursorWorld);
}

export function getInteriorAssetResizeFromCornerForCursor(
  roomId: string,
  assetId: string,
  corner: "top-left" | "top-right" | "bottom-right" | "bottom-left",
  cursorWorld: Point
) {
  const state = useEditorStore.getState();
  return resolveInteriorAssetResizeFromCorner(state.document, roomId, assetId, corner, cursorWorld);
}

export function canInsertDefaultStairInSelectedRoom() {
  const state = useEditorStore.getState();
  if (!state.selectedRoomId) return false;
  const room = state.document.rooms.find((candidate) => candidate.id === state.selectedRoomId);
  if (!room) return false;
  return canPlaceDefaultStairInRoom(room);
}

function isValidDraftPathProgression(
  previousDraftPoints: Point[],
  nextDraftPoints: Point[],
  rawNextPoint: Point
): boolean {
  if (nextDraftPoints.length === 0) return false;
  if (nextDraftPoints.length === 1) return true;

  const terminalPreviousPoint = nextDraftPoints[nextDraftPoints.length - 2];
  const terminalPoint = nextDraftPoints[nextDraftPoints.length - 1];
  if (pointsEqual(terminalPreviousPoint, terminalPoint)) {
    return false;
  }

  const isTailAdjustment = nextDraftPoints.length === previousDraftPoints.length;
  if (isTailAdjustment) {
    return !nextDraftPoints
      .slice(0, -1)
      .some((point, index) => index !== 0 && pointsEqual(point, terminalPoint));
  }

  if (previousDraftPoints.length < 2) {
    return true;
  }

  const previousPoint = previousDraftPoints[previousDraftPoints.length - 2];
  const currentPoint = previousDraftPoints[previousDraftPoints.length - 1];
  const previousAxis = getOrthogonalSegmentAxis(previousPoint, currentPoint);
  const nextAxis = getOrthogonalSegmentAxis(currentPoint, rawNextPoint);

  if (!previousAxis || !nextAxis) return false;
  if (previousAxis === nextAxis) return false;

  return !nextDraftPoints
    .slice(0, -1)
    .some((point, index) => index !== 0 && pointsEqual(point, terminalPoint));
}

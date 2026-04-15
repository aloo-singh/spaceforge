import { createElement } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import {
  GRID_SIZE_MM,
  INITIAL_PIXELS_PER_MM,
} from "@/lib/editor/constants";
import {
  applyEditorCommand,
  createEmptyEditorDocumentState,
  getNormalizedActiveFloorId,
  getRoomFloorId,
  getRoomsForActiveFloor,
  type EditorCommand,
  type EditorDocumentState,
} from "@/lib/editor/history";
import {
  panCameraByScreenDelta,
  zoomCameraToScreenPoint,
} from "@/lib/editor/camera";
import {
  DEFAULT_CANVAS_ROTATION_DEGREES,
  normalizeCanvasRotationDegrees,
} from "@/lib/editor/canvasRotation";
import { getCameraFitTarget, getDrawingAwareMinPixelsPerMm } from "@/lib/editor/cameraFit";
import { getLayoutBoundsFromRooms } from "@/lib/editor/exportLayoutBounds";
import {
  easeResetCameraTransition,
  interpolateCamera,
  RESET_CAMERA_TRANSITION_DURATION_MS,
} from "@/lib/editor/cameraTransition";
import {
  getDraftLoopClosureResultFromPath,
  normalizeDraftPointChain,
  isZeroLengthSegment,
  pointsEqual,
} from "@/lib/editor/geometry";
import {
  isSimplePolygon,
} from "@/lib/editor/roomGeometry";
import { translateRoomPointsOnGrid } from "@/lib/editor/roomTranslation";
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
import { normalizeNorthBearingDegrees } from "@/lib/editor/north";
import {
  buildPersistedHistorySnapshot,
  type PersistedHistorySnapshot,
  hydrateCommandHistoryFromSnapshots,
  areDocumentsEqual,
  cloneDocumentState,
} from "@/lib/editor/persistedHistory";
import {
  areRoomInteriorAssetsEqual,
  canPlaceDefaultStairInRoom,
  cloneRoomInteriorAsset,
  cloneRoomInteriorAssets,
  constrainInteriorAssetCenter,
  createCenteredDefaultStair,
  DEFAULT_STAIR_NAME,
  getAdjustedInteriorAssetForRoomResize,
  getRotatedInteriorAssetForRoom,
  getResizedStairForCornerDrag,
  getResizedStairForWallDrag,
  isInteriorAssetWithinRoom,
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
import {
  getActiveSnapStepMm,
  getConstrainedDrawPoint,
  getSupportedDrawSegmentDirection,
  getMagneticSnapGuidesForSettings,
  isSupportedDrawPointPath,
  getSnappedPointFromGuides,
  type DrawConstraintMode,
} from "@/lib/editor/snapping";
import { normalizeProjectExportConfig } from "@/lib/projects/exportConfig";
import { ConnectedFloorPromptToast } from "@/components/editor/ConnectedFloorPromptToast";
import type {
  CameraState,
  DoorHingeSide,
  DoorOpeningSide,
  Floor,
  OpeningType,
  Point,
  Room,
  RoomInteriorAsset,
  RoomInteriorAssetSelection,
  RoomOpening,
  RoomOpeningSelection,
  RoomWallSelection,
  ScreenPoint,
  SharedSelectionItem,
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

type InteriorAssetRenameSessionState = {
  roomId: string;
  assetId: string;
  initialName: string;
} | null;

type InteriorAssetArrowLabelSessionState = {
  roomId: string;
  assetId: string;
  initialArrowLabel: string;
} | null;

type FloorRenameSessionState = {
  floorId: string;
  initialName: string;
} | null;

type ClipboardData =
  | { type: "room"; source: "copy" | "cut"; rooms: Room[] }
  | { type: "stair"; source: "copy" | "cut"; asset: RoomInteriorAsset; sourceRoomId: string }
  | null;

type EditorState = {
  document: DocumentState;
  camera: CameraState;
  pendingProjectOpenCameraFit: boolean;
  pendingProjectOpenEmptyLayoutPixelsPerMm: number | null;
  settings: EditorSettings;
  keyboardShortcutFeedbackEnabled: boolean;
  exportPreferences: EditorExportPreferences;
  isDimensionsVisibilityOverrideActive: boolean;
  viewport: ViewportSize;
  maxFloors: number;
  setMaxFloors: (maxFloors: number) => void;
  roomDraft: RoomDraftState;
  selectedNorthIndicator: boolean;
  selectedRoomId: string | null;
  selectedWall: RoomWallSelection | null;
  selectedOpening: RoomOpeningSelection | null;
  selectedInteriorAsset: RoomInteriorAssetSelection | null;
  /** Shared selection model: single source of truth for all selections */
  selection: SharedSelectionItem[];
  isCanvasInteractionActive: boolean;
  shouldFocusSelectedRoomNameInput: boolean;
  renameSession: RenameSessionState;
  interiorAssetRenameSession: InteriorAssetRenameSessionState;
  interiorAssetArrowLabelSession: InteriorAssetArrowLabelSessionState;
  floorRenameSession: FloorRenameSessionState;
  clipboard: ClipboardData;
  history: {
    past: EditorCommand[];
    future: EditorCommand[];
  };
  canUndo: boolean;
  canRedo: boolean;
  setDimensionsVisibilityOverrideActive: (isActive: boolean) => void;
  setViewport: (width: number, height: number) => void;
  updateSettings: (settings: Partial<EditorSettings>) => void;
  setKeyboardShortcutFeedbackEnabled: (isEnabled: boolean) => void;
  updateExportPreferences: (preferences: Partial<EditorExportPreferences>) => void;
  updateProjectExportConfig: (config: Partial<DocumentState["exportConfig"]>) => void;
  selectNorthIndicator: () => void;
  clearNorthIndicatorSelection: () => void;
  previewCanvasRotationDegrees: (degrees: number) => void;
  commitCanvasRotationDegrees: (previousDegrees: number, nextDegrees: number) => void;
  updateCanvasRotationDegrees: (degrees: number) => void;
  resetCanvasRotation: () => void;
  previewNorthBearingDegrees: (degrees: number) => void;
  commitNorthBearingDegrees: (previousDegrees: number, nextDegrees: number) => void;
  updateNorthBearingDegrees: (degrees: number) => void;
  addFloor: () => void;
  selectFloorById: (floorId: string) => void;
  panCameraByPx: (delta: ScreenPoint) => void;
  zoomAtScreenPoint: (screenPoint: ScreenPoint, scaleFactor: number) => void;
  setCameraCenterMm: (xMm: number, yMm: number) => void;
  placeDraftPointFromCursor: (
    cursorWorld: Point,
    options?: { constraintMode?: DrawConstraintMode }
  ) => void;
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
  /** Shared selection model actions */
  selectItems: (items: SharedSelectionItem[]) => void;
  clearSelection: () => void;
  addToSelection: (item: SharedSelectionItem) => void;
  removeFromSelection: (item: SharedSelectionItem) => void;
  /** Copy selected room(s) or stair(s) to clipboard */
  copySelection: () => void;
  /** Paste item(s) from clipboard to current floor */
  pasteSelection: () => void;
  /** Cut selected room(s) or stair(s) to clipboard (remove from location) */
  cutSelection: () => void;
  /** Duplicate selected room(s) or stair(s) with smart naming and offset placement */
  duplicateSelection: () => void;
  /** Move selected room(s) and stair(s) to a different floor */
  moveSelectionToFloor: (targetFloorId: string) => void;
  /** Reorder a room within its floor */
  reorderRoomInFloor: (roomId: string, targetIndex: number) => void;
  setCanvasInteractionActive: (isActive: boolean) => void;
  consumeSelectedRoomNameInputFocusRequest: () => void;
  startRoomRenameSession: (roomId: string) => void;
  updateRoomRenameDraft: (roomId: string, name: string) => void;
  commitRoomRenameSession: (options?: { deselectIfUnchanged?: boolean }) => void;
  cancelRoomRenameSession: () => void;
  startInteriorAssetRenameSession: (roomId: string, assetId: string) => void;
  updateInteriorAssetRenameDraft: (roomId: string, assetId: string, name: string) => void;
  commitInteriorAssetRenameSession: () => void;
  cancelInteriorAssetRenameSession: () => void;
  startInteriorAssetArrowLabelSession: (roomId: string, assetId: string) => void;
  updateInteriorAssetArrowLabelDraft: (roomId: string, assetId: string, label: string) => void;
  commitInteriorAssetArrowLabelSession: () => void;
  cancelInteriorAssetArrowLabelSession: () => void;
  startFloorRename: (floorId: string) => void;
  updateFloorRenameDraft: (floorId: string, name: string) => void;
  commitFloorRenameSession: () => void;
  cancelFloorRename: () => void;
  deleteFloor: (floorId: string) => void;
  deleteSelectedRoom: () => void;
  deleteSelectedOpening: () => void;
  deleteSelectedInteriorAsset: () => void;
  bulkDeleteSelection: () => void;
  updateRoomName: (roomId: string, name: string) => void;
  insertDefaultDoorOnSelectedWall: () => void;
  insertDefaultWindowOnSelectedWall: () => void;
  insertDefaultStairInSelectedRoom: () => void;
  promptConnectedFloorForSelectedStair: () => void;
  addConnectedFloorAboveFromSelectedStair: () => void;
  addConnectedFloorBelowFromSelectedStair: () => void;
  createConnectedFloorFromStair: (
    roomId: string,
    assetId: string,
    direction: "above" | "below"
  ) => void;
  updateSelectedInteriorAssetName: (name: string) => void;
  rotateSelectedInteriorAsset: (deltaDegrees: number) => void;
  setSelectedInteriorAssetArrowEnabled: (isEnabled: boolean) => void;
  swapSelectedInteriorAssetArrowDirection: () => void;
  updateSelectedInteriorAssetArrowLabel: (label: string) => void;
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
  commitInteriorAssetMoveToRoom: (
    fromRoomId: string,
    toRoomId: string,
    assetId: string,
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
  fitCameraOnProjectOpen: (options?: { emptyLayoutPixelsPerMm?: number }) => void;
  loadProjectDocument: (document: DocumentState, options?: { emptyLayoutPixelsPerMm?: number }) => void;
};

let activeStairsAdjustedToast:
  | {
      id: string | number;
      roomId: string;
      nextPoints: Point[];
    }
  | null = null;
let activeConnectedFloorPromptToastId: string | number | null = null;
let activeFloorRenameToastId: string | number | null = null;
let activeDeleteFloorToastId: string | number | null = null;

const DOCUMENT_AUTOSAVE_DEBOUNCE_MS = 300;
const DEFAULT_DOCUMENT_STATE: DocumentState = createEmptyEditorDocumentState();
const DEFAULT_CAMERA_STATE: CameraState = {
  xMm: 0,
  yMm: 0,
  pixelsPerMm: INITIAL_PIXELS_PER_MM,
  rotationDegrees: DEFAULT_CANVAS_ROTATION_DEGREES,
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

function createFloorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `floor-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createStairConnectionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `stair-connection-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/**
 * Generate a duplicate name with smart incrementing.
 * E.g., "Living Room" -> "Copy of Living Room" -> "Copy of Living Room 2" -> "Copy of Living Room 3"
 */
function generateDuplicateName(baseName: string, existingNames: Set<string>): string {
  const copyPrefix = "Copy of ";
  const candidateName = `${copyPrefix}${baseName}`;

  if (!existingNames.has(candidateName)) {
    return candidateName;
  }

  let counter = 2;
  while (existingNames.has(`${copyPrefix}${baseName} ${counter}`)) {
    counter++;
  }

  return `${copyPrefix}${baseName} ${counter}`;
}

function getConnectedFloorAvailability(document: DocumentState, floorId: string) {
  const floors = document.floors;
  const activeFloorIndex = floors.findIndex((floor) => floor.id === floorId);

  return {
    canCreateAbove: activeFloorIndex === floors.length - 1,
    canCreateBelow: activeFloorIndex === 0,
  };
}

function getConnectedFloorPromptState(
  document: DocumentState,
  roomId: string,
  assetId: string
): {
  room: Room;
  asset: RoomInteriorAsset;
  activeFloorId: string;
  activeFloorName: string;
  canCreateAbove: boolean;
  canCreateBelow: boolean;
} | null {
  const activeFloorId = getNormalizedActiveFloorId(document);
  const activeFloor = document.floors.find((floor) => floor.id === activeFloorId) ?? null;
  const room = document.rooms.find((candidate) => candidate.id === roomId) ?? null;
  const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId) ?? null;

  if (!activeFloor || !room || !asset || (room.floorId ?? activeFloorId) !== activeFloorId) {
    return null;
  }

  const availability = getConnectedFloorAvailability(document, activeFloorId);

  return {
    room,
    asset,
    activeFloorId,
    activeFloorName: activeFloor.name,
    canCreateAbove: availability.canCreateAbove,
    canCreateBelow: availability.canCreateBelow,
  };
}

function buildConnectedFloorDocument(
  document: DocumentState,
  room: Room,
  asset: RoomInteriorAsset,
  direction: "above" | "below"
): {
  nextDocument: DocumentState;
  createdFloorId: string;
  createdRoomId: string;
  createdAssetId: string;
} | null {
  const activeFloorId = getNormalizedActiveFloorId(document);
  const { canCreateAbove, canCreateBelow } = getConnectedFloorAvailability(document, activeFloorId);
  if ((direction === "above" && !canCreateAbove) || (direction === "below" && !canCreateBelow)) {
    return null;
  }

  const createdFloorId = createFloorId();
  const createdRoomId = createRoomId();
  const createdAssetId = createInteriorAssetId();
  const connectionId = asset.connectionId ?? createStairConnectionId();
  const sourceArrowLabel = direction === "above" ? "UP" : "DOWN";
  const connectedArrowLabel = direction === "above" ? "DOWN" : "UP";
  const createdFloor: Floor = {
    id: createdFloorId,
    name: direction === "below" ? "Floor 1" : `Floor ${document.floors.length + 1}`,
  };
  const nextFloors =
    direction === "below"
      ? [
          createdFloor,
          ...document.floors.map((floor, index) => ({
            ...floor,
            name: `Floor ${index + 2}`,
          })),
        ]
      : [...document.floors, createdFloor];
  const connectedRoom: Room = {
    id: createdRoomId,
    floorId: createdFloorId,
    name: room.name,
    points: room.points.map((point) => ({ ...point })),
    openings: [],
    interiorAssets: [
      {
        ...cloneRoomInteriorAsset(asset),
        id: createdAssetId,
        connectionId,
        arrowEnabled: true,
        arrowLabel: connectedArrowLabel,
        arrowDirection: asset.arrowDirection === "forward" ? "reverse" : "forward",
      },
    ],
  };
  const nextRooms = document.rooms.map((candidate) =>
    candidate.id === room.id
      ? {
          ...cloneRoom(candidate),
          interiorAssets: candidate.interiorAssets.map((candidateAsset) =>
            candidateAsset.id === asset.id
              ? {
                  ...cloneRoomInteriorAsset(candidateAsset),
                  connectionId,
                  arrowEnabled: true,
                  arrowLabel: sourceArrowLabel,
                }
              : cloneRoomInteriorAsset(candidateAsset)
          ),
        }
      : cloneRoom(candidate)
  );

  return {
    nextDocument: {
      ...cloneDocumentState(document),
      floors: nextFloors,
      activeFloorId: createdFloorId,
      rooms: [...nextRooms, connectedRoom],
    },
    createdFloorId,
    createdRoomId,
    createdAssetId,
  };
}

function cloneRoom(room: Room): Room {
  return {
    id: room.id,
    floorId: room.floorId,
    name: room.name,
    points: room.points.map((point) => ({ ...point })),
    openings: cloneRoomOpenings(room.openings),
    interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
  };
}

function getConnectedStairPeer(
  document: DocumentState,
  asset: RoomInteriorAsset
): { roomId: string; asset: RoomInteriorAsset } | null {
  const connectionId = asset.connectionId ?? null;
  if (!connectionId) return null;

  for (const room of document.rooms) {
    for (const candidate of room.interiorAssets) {
      if (candidate.id === asset.id) continue;
      if ((candidate.connectionId ?? null) !== connectionId) continue;
      return {
        roomId: room.id,
        asset: candidate,
      };
    }
  }

  return null;
}

function showConnectedFloorPrompt(roomId: string, assetId: string) {
  const promptState = getConnectedFloorPromptState(useEditorStore.getState().document, roomId, assetId);
  if (!promptState) {
    return;
  }

  if (activeConnectedFloorPromptToastId !== null) {
    toast.dismiss(activeConnectedFloorPromptToastId);
  }

  if (!promptState.canCreateAbove && !promptState.canCreateBelow) {
    activeConnectedFloorPromptToastId = toast("Connected floors already exist above and below this stair.", {
      duration: 3200,
      onDismiss: () => {
        activeConnectedFloorPromptToastId = null;
      },
    });
    return;
  }

  activeConnectedFloorPromptToastId = toast.custom(
    (toastId) =>
      createElement(ConnectedFloorPromptToast, {
        currentFloorName: promptState.activeFloorName,
        canCreateAbove: promptState.canCreateAbove,
        canCreateBelow: promptState.canCreateBelow,
        onChoose: (direction: "above" | "below") => {
          useEditorStore.getState().createConnectedFloorFromStair(roomId, assetId, direction);
          toast.dismiss(toastId);
        },
        onCancel: () => {
          toast.dismiss(toastId);
        },
      }),
    {
      duration: Infinity,
      onDismiss: () => {
        activeConnectedFloorPromptToastId = null;
      },
    }
  );
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

function updateFloorNameInDocument(document: DocumentState, floorId: string, name: string): DocumentState {
  return {
    ...document,
    floors: document.floors.map((floor) =>
      floor.id === floorId
        ? {
            ...floor,
            name,
          }
        : floor
    ),
  };
}

function updateInteriorAssetNameInDocument(
  document: DocumentState,
  roomId: string,
  assetId: string,
  name: string
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
                    name,
                  }
                : asset
            ),
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

function updateResizedRoomInDocument(
  document: DocumentState,
  roomId: string,
  nextPoints: Point[],
  nextInteriorAssets?: Room["interiorAssets"]
): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            points: nextPoints.map((point) => ({ ...point })),
            interiorAssets: nextInteriorAssets
              ? cloneRoomInteriorAssets(nextInteriorAssets)
              : room.interiorAssets,
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
  const nextDocument = {
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

  const room = nextDocument.rooms.find((candidate) => candidate.id === roomId) ?? null;
  const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId) ?? null;
  const connectedPeer = asset ? getConnectedStairPeer(nextDocument, asset) : null;
  if (!connectedPeer) {
    return nextDocument;
  }

  return {
    ...nextDocument,
    rooms: nextDocument.rooms.map((candidateRoom) =>
      candidateRoom.id === connectedPeer.roomId
        ? {
            ...candidateRoom,
            interiorAssets: candidateRoom.interiorAssets.map((candidateAsset) =>
              candidateAsset.id === connectedPeer.asset.id
                ? {
                    ...cloneRoomInteriorAsset(candidateAsset),
                    xMm: nextCenter.x,
                    yMm: nextCenter.y,
                  }
                : candidateAsset
            ),
          }
        : candidateRoom
    ),
  };
}

function updateRoomInteriorAssetInDocument(
  document: DocumentState,
  roomId: string,
  nextAsset: {
    id: string;
    widthMm: number;
    depthMm: number;
    xMm: number;
    yMm: number;
    rotationDegrees?: number;
    arrowEnabled?: boolean;
    arrowDirection?: Room["interiorAssets"][number]["arrowDirection"];
    arrowLabel?: string;
  }
): DocumentState {
  const clonedAssetDefaults = (asset: Room["interiorAssets"][number]) => cloneRoomInteriorAsset(asset);
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            interiorAssets: room.interiorAssets.map((asset) =>
              asset.id === nextAsset.id
                ? {
                    ...clonedAssetDefaults(asset),
                    widthMm: nextAsset.widthMm,
                    depthMm: nextAsset.depthMm,
                    xMm: nextAsset.xMm,
                    yMm: nextAsset.yMm,
                    rotationDegrees:
                      nextAsset.rotationDegrees ?? clonedAssetDefaults(asset).rotationDegrees,
                    arrowEnabled:
                      nextAsset.arrowEnabled ?? clonedAssetDefaults(asset).arrowEnabled,
                    arrowDirection:
                      nextAsset.arrowDirection ?? clonedAssetDefaults(asset).arrowDirection,
                    arrowLabel: nextAsset.arrowLabel ?? clonedAssetDefaults(asset).arrowLabel,
                  }
                : asset
            ),
          }
        : room
    ),
  };
}

function syncConnectedStairTransformInDocument(
  document: DocumentState,
  roomId: string,
  assetId: string,
  deltaDegrees?: number
): DocumentState {
  const room = document.rooms.find((candidate) => candidate.id === roomId) ?? null;
  const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId) ?? null;
  const connectedPeer = asset ? getConnectedStairPeer(document, asset) : null;

  if (!asset || !connectedPeer) {
    return document;
  }

  if (deltaDegrees && deltaDegrees !== 0) {
    // Rotation sync: apply the rotation transformation to the peer in its own room
    const peerRoom = document.rooms.find((candidate) => candidate.id === connectedPeer.roomId) ?? null;
    if (!peerRoom) {
      return document;
    }

    const rotatedPeerAsset = getRotatedInteriorAssetForRoom(peerRoom, connectedPeer.asset, deltaDegrees);
    if (!rotatedPeerAsset) {
      return document;
    }

    return {
      ...document,
      rooms: document.rooms.map((candidateRoom) =>
        candidateRoom.id === connectedPeer.roomId
          ? {
              ...candidateRoom,
              interiorAssets: candidateRoom.interiorAssets.map((candidateAsset) =>
                candidateAsset.id === connectedPeer.asset.id
                  ? rotatedPeerAsset
                  : candidateAsset
              ),
            }
          : candidateRoom
      ),
    };
  } else {
    // Position/arrow sync: copy position and sync arrow direction (opposite) from primary to peer
    return {
      ...document,
      rooms: document.rooms.map((candidateRoom) =>
        candidateRoom.id === connectedPeer.roomId
          ? {
              ...candidateRoom,
              interiorAssets: candidateRoom.interiorAssets.map((candidateAsset) =>
                candidateAsset.id === connectedPeer.asset.id
                  ? {
                      ...cloneRoomInteriorAsset(candidateAsset),
                      xMm: asset.xMm,
                      yMm: asset.yMm,
                      arrowDirection: asset.arrowDirection === "forward" ? "reverse" : "forward",
                    }
                  : candidateAsset
              ),
            }
          : candidateRoom
      ),
    };
  }
}

function updateSelectedInteriorAsset(
  state: Pick<EditorState, "document" | "selectedInteriorAsset" | "history">,
  updater: (room: Room, asset: Room["interiorAssets"][number]) => Room["interiorAssets"][number] | null
) {
  const selectedInteriorAsset = state.selectedInteriorAsset;
  if (!selectedInteriorAsset) return null;

  const room = state.document.rooms.find((candidate) => candidate.id === selectedInteriorAsset.roomId);
  const asset = room?.interiorAssets.find((candidate) => candidate.id === selectedInteriorAsset.assetId);
  if (!room || !asset) return null;

  const nextAsset = updater(room, asset);
  if (!nextAsset || areRoomInteriorAssetsEqual([asset], [nextAsset])) return null;

  const didTransformConnectedStair =
    (asset.connectionId ?? null) !== null &&
    (asset.xMm !== nextAsset.xMm ||
      asset.yMm !== nextAsset.yMm ||
      asset.rotationDegrees !== nextAsset.rotationDegrees ||
      asset.arrowDirection !== nextAsset.arrowDirection);

  if (didTransformConnectedStair) {
    const updatedDocument = updateRoomInteriorAssetInDocument(state.document, room.id, nextAsset);
    const nextDocument = syncConnectedStairTransformInDocument(updatedDocument, room.id, nextAsset.id);
    const command: EditorCommand = {
      type: "sync-connected-stairs",
      previousDocument: cloneDocumentState(state.document),
      nextDocument: cloneDocumentState(nextDocument),
    };

    return {
      document: nextDocument,
      history: {
        past: pushToPast(state.history.past, command),
        future: [],
      },
      canUndo: true,
      canRedo: false,
    };
  }

  const command: EditorCommand = {
    type: "update-interior-asset",
    roomId: room.id,
    previousAsset: cloneRoomInteriorAsset(asset),
    nextAsset: cloneRoomInteriorAsset(nextAsset),
  };

  return {
    document: updateRoomInteriorAssetInDocument(state.document, room.id, nextAsset),
    history: {
      past: pushToPast(state.history.past, command),
      future: [],
    },
    canUndo: true,
    canRedo: false,
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

function getAdjustedInteriorAssetsForRoomResize(room: Room, nextPoints: Point[]) {
  const resizedRoom = {
    ...room,
    points: clonePoints(nextPoints),
  };
  const nextInteriorAssets = room.interiorAssets.flatMap((asset) => {
    const adjustedAsset = getAdjustedInteriorAssetForRoomResize(resizedRoom, asset);
    return adjustedAsset ? [adjustedAsset] : [];
  });

  return {
    nextInteriorAssets,
    didAdjust: !areRoomInteriorAssetsEqual(room.interiorAssets, nextInteriorAssets),
  };
}

function showStairsAdjustedToast(roomId: string, nextPoints: Point[]) {
  if (activeStairsAdjustedToast) {
    toast.dismiss(activeStairsAdjustedToast.id);
  }

  const id = toast("Stairs adjusted to fit", {
    duration: 5000,
    onDismiss: () => {
      if (
        activeStairsAdjustedToast?.roomId === roomId &&
        arePointListsEqual(activeStairsAdjustedToast.nextPoints, nextPoints)
      ) {
        activeStairsAdjustedToast = null;
      }
    },
    action: {
      label: "Undo",
      onClick: () => {
        const state = useEditorStore.getState();
        const latestCommand = state.history.past[state.history.past.length - 1];
        if (
          latestCommand?.type !== "resize-room" ||
          latestCommand.roomId !== roomId ||
          !arePointListsEqual(latestCommand.nextPoints, nextPoints)
        ) {
          return;
        }

        state.undo();
      },
    },
  });

  activeStairsAdjustedToast = {
    id,
    roomId,
    nextPoints: clonePoints(nextPoints),
  };
}

function dismissStairsAdjustedToastForCommand(command: EditorCommand) {
  if (
    command.type !== "resize-room" ||
    !activeStairsAdjustedToast ||
    activeStairsAdjustedToast.roomId !== command.roomId ||
    !arePointListsEqual(activeStairsAdjustedToast.nextPoints, command.nextPoints)
  ) {
    return;
  }

  toast.dismiss(activeStairsAdjustedToast.id);
  activeStairsAdjustedToast = null;
}

function showFloorRenameToast(floorId: string, newName: string) {
  if (activeFloorRenameToastId !== null) {
    toast.dismiss(activeFloorRenameToastId);
  }

  const id = toast(`Floor renamed to "${newName}"`, {
    duration: 5000,
    onDismiss: () => {
      if (activeFloorRenameToastId === id) {
        activeFloorRenameToastId = null;
      }
    },
    action: {
      label: "Undo",
      onClick: () => {
        const state = useEditorStore.getState();
        const latestCommand = state.history.past[state.history.past.length - 1];
        if (latestCommand?.type !== "rename-floor" || latestCommand.floorId !== floorId) {
          return;
        }

        state.undo();
      },
    },
  });

  activeFloorRenameToastId = id;
}

function dismissFloorRenameToastForCommand(command: EditorCommand) {
  if (command.type !== "rename-floor" || activeFloorRenameToastId === null) {
    return;
  }

  toast.dismiss(activeFloorRenameToastId);
  activeFloorRenameToastId = null;
}

function showDeleteFloorToast(floorName: string, floorId: string) {
  if (activeDeleteFloorToastId !== null) {
    toast.dismiss(activeDeleteFloorToastId);
  }

  const id = toast(`Floor "${floorName}" deleted`, {
    duration: 5000,
    onDismiss: () => {
      if (activeDeleteFloorToastId === id) {
        activeDeleteFloorToastId = null;
      }
    },
    action: {
      label: "Undo",
      onClick: () => {
        const state = useEditorStore.getState();
        const latestCommand = state.history.past[state.history.past.length - 1];
        if (latestCommand?.type !== "delete-floor" || latestCommand.floor.id !== floorId) {
          return;
        }

        state.undo();
      },
    },
  });

  activeDeleteFloorToastId = id;
}

function dismissDeleteFloorToastForCommand(command: EditorCommand) {
  if (command.type !== "delete-floor" || activeDeleteFloorToastId === null) {
    return;
  }

  toast.dismiss(activeDeleteFloorToastId);
  activeDeleteFloorToastId = null;
}

function areCamerasEqual(a: CameraState, b: CameraState): boolean {
  return (
    a.xMm === b.xMm &&
    a.yMm === b.yMm &&
    a.pixelsPerMm === b.pixelsPerMm &&
    normalizeCanvasRotationDegrees(a.rotationDegrees) ===
      normalizeCanvasRotationDegrees(b.rotationDegrees)
  );
}

function syncCameraRotationToDocument(camera: CameraState, document: DocumentState): CameraState {
  const nextRotationDegrees = normalizeCanvasRotationDegrees(document.canvasRotationDegrees);
  if (normalizeCanvasRotationDegrees(camera.rotationDegrees) === nextRotationDegrees) {
    return camera;
  }

  return {
    ...camera,
    rotationDegrees: nextRotationDegrees,
  };
}

function getSelectionIfRoomExists(roomId: string | null, document: DocumentState): string | null {
  if (!roomId) return null;
  return getRoomsForActiveFloor(document).some((room) => room.id === roomId) ? roomId : null;
}

function getSelectedWallIfRoomExists(
  selectedWall: RoomWallSelection | null,
  document: DocumentState
): RoomWallSelection | null {
  if (!selectedWall) return null;
  const room = getRoomsForActiveFloor(document).find((candidate) => candidate.id === selectedWall.roomId);
  if (!room) return null;
  return getRoomWallSegment(room, selectedWall.wall) ? selectedWall : null;
}

function getSelectedOpeningIfExists(
  selectedOpening: RoomOpeningSelection | null,
  document: DocumentState
): RoomOpeningSelection | null {
  if (!selectedOpening) return null;
  const room = getRoomsForActiveFloor(document).find(
    (candidate) => candidate.id === selectedOpening.roomId
  );
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
  const room = getRoomsForActiveFloor(document).find(
    (candidate) => candidate.id === selectedInteriorAsset.roomId
  );
  if (!room) return null;
  return room.interiorAssets.some((asset) => asset.id === selectedInteriorAsset.assetId)
    ? selectedInteriorAsset
    : null;
}

function getSelectedRoomIdAfterHistoryCommand(
  selectedRoomId: string | null,
  nextDocument: DocumentState,
  command: EditorCommand,
  direction: "undo" | "redo"
): string | null {
  if (command.type === "create-connected-floor") {
    return direction === "redo" ? command.createdRoomId : null;
  }

  return getSelectionIfRoomExists(selectedRoomId, nextDocument);
}

function getSelectedInteriorAssetAfterHistoryCommand(
  selectedInteriorAsset: RoomInteriorAssetSelection | null,
  nextDocument: DocumentState,
  command: EditorCommand,
  direction: "undo" | "redo"
): RoomInteriorAssetSelection | null {
  if (command.type === "create-connected-floor") {
    return direction === "redo"
      ? {
          roomId: command.createdRoomId,
          assetId: command.createdAssetId,
        }
      : null;
  }

  return getSelectedInteriorAssetIfExists(selectedInteriorAsset, nextDocument);
}

/**
 * Returns the floor the user should be viewing immediately after applying a history command,
 * so the modified item is visible. Returns null if no floor switch is needed.
 */
function getTargetFloorForHistoryCommand(
  command: EditorCommand,
  documentAfterCommand: DocumentState,
  direction: "undo" | "redo"
): string | null {
  const findFloorForRoom = (roomId: string): string | null => {
    const room = documentAfterCommand.rooms.find((r) => r.id === roomId);
    return room ? getRoomFloorId(room, documentAfterCommand) : null;
  };

  switch (command.type) {
    case "complete-room":
      // Room removed by undo — floor was recorded on the room at creation time.
      return command.room.floorId ?? null;

    case "delete-room":
      if (direction === "redo") {
        // Room is removed again on redo, so rely on recorded room floor.
        return command.room.floorId ?? null;
      }
      // Room restored by undo — find it in post-undo document.
      return findFloorForRoom(command.room.id) ?? command.room.floorId ?? null;

    case "rename-room":
    case "resize-room":
    case "move-room":
      return findFloorForRoom(command.roomId);

    case "add-opening":
    case "delete-opening":
    case "move-opening":
    case "update-opening":
    case "add-interior-asset":
    case "delete-interior-asset":
    case "move-interior-asset":
    case "update-interior-asset":
      return findFloorForRoom(command.roomId);

    case "paste-rooms":
      return command.floorId;

    case "paste-interior-asset":
      return findFloorForRoom(command.targetRoomId);

    case "cut-rooms": {
      if (command.cutRooms.length === 0) return null;
      return findFloorForRoom(command.cutRooms[0].id) ?? command.cutRooms[0].floorId ?? null;
    }

    case "cut-interior-asset":
      return findFloorForRoom(command.roomId);

    case "move-interior-asset-to-room":
      return findFloorForRoom(direction === "undo" ? command.fromRoomId : command.toRoomId);

    case "bulk-delete": {
      for (const sub of command.deleteCommands) {
        if (sub.type === "delete-room") {
          return findFloorForRoom(sub.room.id) ?? sub.room.floorId ?? null;
        }
      }
      for (const sub of command.deleteCommands) {
        if (sub.type !== "delete-room") {
          const floor = findFloorForRoom(sub.roomId);
          if (floor) return floor;
        }
      }
      return null;
    }

    case "bulk-duplicate": {
      if (command.duplicatedRooms.length > 0) return command.duplicatedRooms[0].floorId ?? null;
      if (command.duplicatedAssets.length > 0) {
        return findFloorForRoom(command.duplicatedAssets[0].roomId);
      }
      return null;
    }

    case "move-selection-to-floor":
      if (command.movedRooms.length > 0) {
        return direction === "undo" ? command.movedRooms[0].previousFloorId : command.targetFloorId;
      }
      if (command.movedAssets.length > 0) {
        if (direction === "redo") return command.targetFloorId;
        return findFloorForRoom(command.movedAssets[0].roomId);
      }
      return null;

    case "reorder-rooms-in-floor":
      return command.floorId;

    default:
      return null;
  }
}

function getSelectedWallHostRoom(
  document: DocumentState,
  selectedWall: RoomWallSelection | null
): Room | null {
  if (!selectedWall) return null;
  const room = getRoomsForActiveFloor(document).find((candidate) => candidate.id === selectedWall.roomId);
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
    selectedWall: null,
    selectedOpening: { roomId: hostRoom.id, openingId: opening.id },
    selectedInteriorAsset: null,
    selection: [{ type: "opening" as const, roomId: hostRoom.id, id: opening.id }],
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
    selection: [{ type: "stair" as const, roomId: room.id, id: asset.id }],
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
  gridSizeMm: number | null
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const opening = room?.openings.find((candidate) => candidate.id === openingId);
  if (!room || !opening) return null;

  const nextOffsetMm = getOpeningOffsetForWorldPoint(
    room,
    opening,
    cursorWorld,
    gridSizeMm ? { gridSizeMm } : undefined
  );
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
  gridSizeMm: number | null
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const opening = room?.openings.find((candidate) => candidate.id === openingId);
  if (!room || !opening) return null;

  const nextWidthMm = getSymmetricOpeningWidthForWorldPoint(
    room,
    opening,
    cursorWorld,
    gridSizeMm ? { gridSizeMm } : undefined
  );
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
  gridSizeMm: number | null
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
  if (!room || !asset) return null;

  const nextCenter = constrainInteriorAssetCenter(
    room,
    asset,
    cursorWorld,
    gridSizeMm ? { gridSizeMm } : undefined
  );
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
  cursorWorld: Point,
  gridSizeMm: number | null
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
  if (!room || !asset) return null;

  const nextAsset = getResizedStairForWallDrag(
    room,
    asset,
    wall,
    cursorWorld,
    gridSizeMm ? { gridSizeMm } : undefined
  );
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
  cursorWorld: Point,
  gridSizeMm: number | null
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
  if (!room || !asset) return null;

  const nextAsset = getResizedStairForCornerDrag(
    room,
    asset,
    corner,
    cursorWorld,
    gridSizeMm ? { gridSizeMm } : undefined
  );
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
          floors: document.floors.map((floor) => ({
            id: floor.id,
            name: floor.name,
          })),
          activeFloorId: document.activeFloorId,
          exportConfig: {
            title: document.exportConfig.title,
            description: document.exportConfig.description,
            titlePosition: document.exportConfig.titlePosition,
            descriptionPosition: document.exportConfig.descriptionPosition,
            includeNorthIndicator: document.exportConfig.includeNorthIndicator,
          },
          canvasRotationDegrees: document.canvasRotationDegrees,
          northBearingDegrees: document.northBearingDegrees,
          rooms: document.rooms.map((room) => ({
            id: room.id,
            floorId: room.floorId,
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
  if (hydrationSnapshot?.camera) {
    return {
      ...hydrationSnapshot.camera,
      rotationDegrees: normalizeCanvasRotationDegrees(
        hydrationSnapshot.camera.rotationDegrees ?? hydrationSnapshot.document.canvasRotationDegrees
      ),
    };
  }

  return {
    ...DEFAULT_CAMERA_STATE,
    rotationDegrees: normalizeCanvasRotationDegrees(
      hydrationSnapshot?.document.canvasRotationDegrees ?? DEFAULT_CANVAS_ROTATION_DEGREES
    ),
  };
}

function createInitialEditorSettings(): EditorSettings {
  if (hydrationSnapshot?.settings) {
    return hydrationSnapshot.settings;
  }

  // No persisted settings - check if mobile and default HUD elements to off
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  if (isMobile) {
    return {
      ...cloneEditorSettings(DEFAULT_EDITOR_SETTINGS),
      showCanvasHud: false,
      showMiniMap: false,
    };
  }

  return cloneEditorSettings(DEFAULT_EDITOR_SETTINGS);
}

function createInitialEditorExportPreferences(): EditorExportPreferences {
  return hydrationSnapshot?.exportPreferences ?? cloneEditorExportPreferences(DEFAULT_EDITOR_EXPORT_PREFERENCES);
}

function isViewportReadyForProjectOpenCameraFit(viewport: ViewportSize): boolean {
  return viewport.width > 1 && viewport.height > 1;
}

function getProjectOpenCamera(
  document: DocumentState,
  viewport: ViewportSize,
  options?: { emptyLayoutPixelsPerMm?: number }
): CameraState {
  return getCameraFitTarget({
    rooms: getRoomsForActiveFloor(document),
    viewport,
    emptyLayoutCamera: {
      ...DEFAULT_CAMERA_STATE,
      pixelsPerMm: options?.emptyLayoutPixelsPerMm ?? DEFAULT_CAMERA_STATE.pixelsPerMm,
      rotationDegrees: normalizeCanvasRotationDegrees(document.canvasRotationDegrees),
    },
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

function getEffectiveSnapStepMm(
  state: Pick<EditorState, "camera" | "settings">
): number {
  return getActiveSnapStepMm(state.camera);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createInitialDocumentState(),
  camera: createInitialCameraState(),
  pendingProjectOpenCameraFit: false,
  pendingProjectOpenEmptyLayoutPixelsPerMm: null,
  settings: createInitialEditorSettings(),
  keyboardShortcutFeedbackEnabled: true,
  exportPreferences: createInitialEditorExportPreferences(),
  isDimensionsVisibilityOverrideActive: false,
  viewport: {
    width: 1,
    height: 1,
  },
  maxFloors: 10,
  setMaxFloors: (maxFloors) =>
    set((state) => {
      if (state.maxFloors === maxFloors) return state;
      return {
        maxFloors,
      };
    }),
  roomDraft: EMPTY_ROOM_DRAFT,
  selectedNorthIndicator: false,
  selectedRoomId: null,
  selectedWall: null,
  selectedOpening: null,
  selectedInteriorAsset: null,
  selection: [],
  isCanvasInteractionActive: false,
  shouldFocusSelectedRoomNameInput: false,
  renameSession: null,
  interiorAssetRenameSession: null,
  interiorAssetArrowLabelSession: null,
  floorRenameSession: null,
  clipboard: null,
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
        camera: getProjectOpenCamera(state.document, nextViewport, {
          emptyLayoutPixelsPerMm: state.pendingProjectOpenEmptyLayoutPixelsPerMm ?? undefined,
        }),
        pendingProjectOpenCameraFit: false,
        pendingProjectOpenEmptyLayoutPixelsPerMm: null,
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
  setKeyboardShortcutFeedbackEnabled: (isEnabled) =>
    set((state) => {
      if (state.keyboardShortcutFeedbackEnabled === isEnabled) return state;

      return {
        keyboardShortcutFeedbackEnabled: isEnabled,
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
        state.document.exportConfig.descriptionPosition === nextExportConfig.descriptionPosition &&
        state.document.exportConfig.includeNorthIndicator === nextExportConfig.includeNorthIndicator
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
  selectNorthIndicator: () =>
    set((state) => {
      if (
        state.selectedNorthIndicator &&
        state.selectedRoomId === null &&
        state.selectedWall === null &&
        state.selectedOpening === null &&
        state.selectedInteriorAsset === null
      ) {
        return state;
      }

      return {
        selectedNorthIndicator: true,
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      };
    }),
  clearNorthIndicatorSelection: () =>
    set((state) => {
      if (!state.selectedNorthIndicator) return state;
      return {
        selectedNorthIndicator: false,
      };
    }),
  previewCanvasRotationDegrees: (degrees) =>
    set((state) => {
      const nextCanvasRotationDegrees = normalizeCanvasRotationDegrees(degrees);
      if (state.document.canvasRotationDegrees === nextCanvasRotationDegrees) return state;

      return {
        document: {
          ...state.document,
          canvasRotationDegrees: nextCanvasRotationDegrees,
        },
        camera: {
          ...state.camera,
          rotationDegrees: nextCanvasRotationDegrees,
        },
      };
    }),
  commitCanvasRotationDegrees: (previousDegrees, nextDegrees) =>
    set((state) => {
      const previousRotationDegrees = normalizeCanvasRotationDegrees(previousDegrees);
      const nextRotationDegrees = normalizeCanvasRotationDegrees(nextDegrees);
      if (previousRotationDegrees === nextRotationDegrees) return state;

      return {
        history: {
          past: pushToPast(state.history.past, {
            type: "update-canvas-rotation",
            previousRotationDegrees,
            nextRotationDegrees,
          }),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  updateCanvasRotationDegrees: (degrees) =>
    set((state) => {
      const previousRotationDegrees = normalizeCanvasRotationDegrees(
        state.document.canvasRotationDegrees
      );
      const nextRotationDegrees = normalizeCanvasRotationDegrees(degrees);
      if (previousRotationDegrees === nextRotationDegrees) return state;

      return {
        document: {
          ...state.document,
          canvasRotationDegrees: nextRotationDegrees,
        },
        camera: {
          ...state.camera,
          rotationDegrees: nextRotationDegrees,
        },
        history: {
          past: pushToPast(state.history.past, {
            type: "update-canvas-rotation",
            previousRotationDegrees,
            nextRotationDegrees,
          }),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  resetCanvasRotation: () => {
    const state = get();
    const previousRotationDegrees = normalizeCanvasRotationDegrees(
      state.document.canvasRotationDegrees
    );
    const nextRotationDegrees = DEFAULT_CANVAS_ROTATION_DEGREES;
    if (previousRotationDegrees === nextRotationDegrees) return;

    const targetCamera: CameraState = {
      ...state.camera,
      rotationDegrees: nextRotationDegrees,
    };

    stopResetCameraAnimation();

    if (typeof window === "undefined") {
      set((currentState) => ({
        document: {
          ...currentState.document,
          canvasRotationDegrees: nextRotationDegrees,
        },
        camera: targetCamera,
        history: {
          past: pushToPast(currentState.history.past, {
            type: "update-canvas-rotation",
            previousRotationDegrees,
            nextRotationDegrees,
          }),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      }));
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

      set((currentState) => ({
        document: {
          ...currentState.document,
          canvasRotationDegrees: nextCamera.rotationDegrees,
        },
        camera: nextCamera,
        ...(progress >= 1
          ? {
              history: {
                past: pushToPast(currentState.history.past, {
                  type: "update-canvas-rotation",
                  previousRotationDegrees,
                  nextRotationDegrees,
                }),
                future: [],
              },
              canUndo: true,
              canRedo: false,
            }
          : null),
      }));

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
  previewNorthBearingDegrees: (degrees) =>
    set((state) => {
      const nextNorthBearingDegrees = normalizeNorthBearingDegrees(degrees);
      if (state.document.northBearingDegrees === nextNorthBearingDegrees) return state;

      return {
        document: {
          ...state.document,
          northBearingDegrees: nextNorthBearingDegrees,
        },
      };
    }),
  commitNorthBearingDegrees: (previousDegrees, nextDegrees) =>
    set((state) => {
      const previousBearingDegrees = normalizeNorthBearingDegrees(previousDegrees);
      const nextBearingDegrees = normalizeNorthBearingDegrees(nextDegrees);
      if (previousBearingDegrees === nextBearingDegrees) return state;

      return {
        history: {
          past: pushToPast(state.history.past, {
            type: "update-north-bearing",
            previousBearingDegrees,
            nextBearingDegrees,
          }),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  updateNorthBearingDegrees: (degrees) =>
    set((state) => {
      const previousBearingDegrees = normalizeNorthBearingDegrees(state.document.northBearingDegrees);
      const nextBearingDegrees = normalizeNorthBearingDegrees(degrees);
      if (previousBearingDegrees === nextBearingDegrees) return state;

      return {
        document: {
          ...state.document,
          northBearingDegrees: nextBearingDegrees,
        },
        history: {
          past: pushToPast(state.history.past, {
            type: "update-north-bearing",
            previousBearingDegrees,
            nextBearingDegrees,
          }),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  addFloor: () =>
    set((state) => {
      if (state.document.floors.length >= state.maxFloors) {
        console.warn(`Cannot add floor: project is already at the maximum of ${state.maxFloors} floors.`);
        return state;
      }

      const nextFloorNumber = state.document.floors.length + 1;
      const floor: Floor = {
        id: createFloorId(),
        name: `Floor ${nextFloorNumber}`,
      };
      const command: EditorCommand = {
        type: "add-floor",
        floor,
        previousActiveFloorId: state.document.activeFloorId,
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
  selectFloorById: (floorId) =>
    set((state) => {
      const nextActiveFloorId = getNormalizedActiveFloorId({
        floors: state.document.floors,
        activeFloorId: floorId,
      });
      const previousActiveFloorId = getNormalizedActiveFloorId(state.document);
      if (nextActiveFloorId === previousActiveFloorId) return state;

      // Floor switches are not undoable — update activeFloorId directly without history entry.
      const nextDocument = { ...state.document, activeFloorId: nextActiveFloorId };

      return {
        document: nextDocument,
        selectedRoomId: getSelectionIfRoomExists(state.selectedRoomId, nextDocument),
        selectedWall: getSelectedWallIfRoomExists(state.selectedWall, nextDocument),
        selectedOpening: getSelectedOpeningIfExists(state.selectedOpening, nextDocument),
        selectedInteriorAsset: getSelectedInteriorAssetIfExists(
          state.selectedInteriorAsset,
          nextDocument
        ),
        selection: [{ type: "floor" as const, id: nextActiveFloorId }],
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
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
      const layoutBounds = getLayoutBoundsFromRooms(getRoomsForActiveFloor(state.document));
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
  placeDraftPointFromCursor: (cursorWorld, options) =>
    set((state) => {
      const draftPoints = normalizeDraftPointChain(state.roomDraft.points);
      const activeSnapStepMm = getEffectiveSnapStepMm(state);
      const constraintMode = options?.constraintMode ?? "orthogonal";
      const predictiveGuides = getMagneticSnapGuidesForSettings(
        getRoomsForActiveFloor(state.document),
        cursorWorld,
        state.camera,
        state.settings,
        { constraintMode }
      );
      const resolvedCursorWorld = getSnappedPointFromGuides(
        cursorWorld,
        activeSnapStepMm,
        predictiveGuides
      );

      if (draftPoints.length === 0) {
        return {
          roomDraft: {
            points: [resolvedCursorWorld],
            history: [],
          },
        };
      }

      const lastPoint = draftPoints[draftPoints.length - 1];
      const nextPoint = getConstrainedDrawPoint(
        lastPoint,
        resolvedCursorWorld,
        activeSnapStepMm,
        null,
        constraintMode
      );

      if (isZeroLengthSegment(lastPoint, nextPoint)) return state;

      const startPoint = draftPoints[0];
      if (pointsEqual(nextPoint, startPoint)) {
        if (draftPoints.length < 4) return state;
        if (!isValidDraftRoomClosure(draftPoints)) return state;
        return completeDraftRoom(state, draftPoints);
      }

      const nextDraftPoints = applyDraftCandidatePointToPath(draftPoints, nextPoint);
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
      if (roomId && !getRoomsForActiveFloor(state.document).some((room) => room.id === roomId)) {
        return state;
      }
      if (
        state.selectedRoomId === roomId &&
        state.selectedWall === null &&
        state.selectedOpening === null &&
        state.selectedInteriorAsset === null
      ) {
        return state;
      }

      return {
        selectedNorthIndicator: false,
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        selection: roomId ? [{ type: "room" as const, id: roomId }] : [],
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      };
    }),
  selectWallByRoomId: (roomId, wall) =>
    set((state) => {
      const room = getRoomsForActiveFloor(state.document).find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (!getRoomWallSegment(room, wall)) {
        return {
          selectedNorthIndicator: false,
          selectedRoomId: roomId,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: null,
          selection: [{ type: "room" as const, id: roomId }],
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
          interiorAssetRenameSession: null,
          interiorAssetArrowLabelSession: null,
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
        selectedNorthIndicator: false,
        selectedRoomId: roomId,
        selectedWall: { roomId, wall },
        selectedOpening: null,
        selectedInteriorAsset: null,
        selection: [{ type: "wall" as const, roomId, wall }],
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      };
    }),
  selectOpeningById: (roomId, openingId) =>
    set((state) => {
      const room = getRoomsForActiveFloor(state.document).find((candidate) => candidate.id === roomId);
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
        selectedNorthIndicator: false,
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: { roomId, openingId },
        selectedInteriorAsset: null,
        selection: [{ type: "opening" as const, roomId, id: openingId }],
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      };
    }),
  selectInteriorAssetById: (roomId, assetId) =>
    set((state) => {
      const room = getRoomsForActiveFloor(state.document).find((candidate) => candidate.id === roomId);
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
        selectedNorthIndicator: false,
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: { roomId, assetId },
        selection: [{ type: "stair" as const, roomId, id: assetId }],
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      };
    }),
  clearSelectedOpening: () =>
    set((state) => {
      if (state.selectedOpening === null) return state;
      return {
        selectedOpening: null,
        selection: state.selectedRoomId ? [{ type: "room" as const, id: state.selectedRoomId }] : [],
      };
    }),
  clearSelectedInteriorAsset: () =>
    set((state) => {
      if (state.selectedInteriorAsset === null) return state;
      return {
        selectedInteriorAsset: null,
        selection: state.selectedRoomId ? [{ type: "room" as const, id: state.selectedRoomId }] : [],
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      };
    }),
  clearSelectedWall: () =>
    set((state) => {
      if (state.selectedWall === null) return state;
      return {
        selectedWall: null,
        selection: state.selectedRoomId ? [{ type: "room" as const, id: state.selectedRoomId }] : [],
      };
    }),
  clearRoomSelection: () =>
    set({
      selectedNorthIndicator: false,
      selectedRoomId: null,
      selectedWall: null,
      selectedOpening: null,
      selectedInteriorAsset: null,
      selection: [],
      shouldFocusSelectedRoomNameInput: false,
      renameSession: null,
      interiorAssetRenameSession: null,
      interiorAssetArrowLabelSession: null,
    }),
  selectItems: (items) =>
    set((state) => {
      if (
        state.selection.length === items.length &&
        state.selection.every((existing, index) => {
          const item = items[index];
          if (existing.type !== item.type) return false;
          if (existing.type === "room" && item.type === "room") return existing.id === item.id;
          if (existing.type === "wall" && item.type === "wall") {
            return existing.roomId === item.roomId && existing.wall === item.wall;
          }
          if (existing.type === "opening" && item.type === "opening") {
            return existing.roomId === item.roomId && existing.id === item.id;
          }
          if (existing.type === "stair" && item.type === "stair") {
            return existing.roomId === item.roomId && existing.id === item.id;
          }
          if (existing.type === "floor" && item.type === "floor") return existing.id === item.id;
          return false;
        })
      ) {
        return state;
      }
      return {
        selection: items,
      };
    }),
  clearSelection: () =>
    set((state) => {
      if (state.selection.length === 0) return state;
      return {
        selection: [],
      };
    }),
  addToSelection: (item) =>
    set((state) => {
      const exists = state.selection.some((existing) => {
        if (existing.type !== item.type) return false;
        if (existing.type === "room" && item.type === "room") return existing.id === item.id;
        if (existing.type === "wall" && item.type === "wall") {
          return existing.roomId === item.roomId && existing.wall === item.wall;
        }
        if (existing.type === "opening" && item.type === "opening") {
          return existing.roomId === item.roomId && existing.id === item.id;
        }
        if (existing.type === "stair" && item.type === "stair") {
          return existing.roomId === item.roomId && existing.id === item.id;
        }
        if (existing.type === "floor" && item.type === "floor") return existing.id === item.id;
        return false;
      });
      if (exists) return state;
      return {
        selection: [...state.selection, item],
      };
    }),
  removeFromSelection: (item) =>
    set((state) => {
      const nextSelection = state.selection.filter((existing) => {
        if (existing.type !== item.type) return true;
        if (existing.type === "room" && item.type === "room") return existing.id !== item.id;
        if (existing.type === "wall" && item.type === "wall") {
          return !(existing.roomId === item.roomId && existing.wall === item.wall);
        }
        if (existing.type === "opening" && item.type === "opening") {
          return !(existing.roomId === item.roomId && existing.id === item.id);
        }
        if (existing.type === "stair" && item.type === "stair") {
          return !(existing.roomId === item.roomId && existing.id === item.id);
        }
        if (existing.type === "floor" && item.type === "floor") return existing.id !== item.id;
        return true;
      });
      if (nextSelection.length === state.selection.length) return state;
      return {
        selection: nextSelection,
      };
    }),
  copySelection: () =>
    set((state) => {
      if (state.selection.length === 0) return state;

      // Only support copying single items for now
      const item = state.selection[0];
      if (!item) return state;

      if (item.type === "room") {
        const room = state.document.rooms.find((r) => r.id === item.id);
        if (!room) return state;
        return {
          clipboard: {
            type: "room",
            source: "copy" as const,
            rooms: [cloneRoom(room)],
          },
        };
      }

      if (item.type === "stair") {
        const room = state.document.rooms.find((r) => r.id === item.roomId);
        const asset = room?.interiorAssets.find((a) => a.id === item.id);
        if (!room || !asset) return state;
        return {
          clipboard: {
            type: "stair",
            source: "copy" as const,
            asset: cloneRoomInteriorAsset(asset),
            sourceRoomId: item.roomId,
          },
        };
      }

      return state;
    }),
  pasteSelection: () =>
    set((state) => {
      if (!state.clipboard) return state;

      const activeFloorId = getNormalizedActiveFloorId(state.document);
      const PASTE_OFFSET_MM = 500; // Offset new items 500mm from originals

      if (state.clipboard.type === "room") {
        // Paste rooms with offset; apply smart naming only for copies
        const isCopy = state.clipboard.source === "copy";
        const existingRoomNames = isCopy
          ? new Set(state.document.rooms.map((r) => r.name))
          : null;
        let stairsWereAdjusted = false;
        const pastedRooms: Room[] = [];

        for (const room of state.clipboard.rooms) {
          const newId = createRoomId();
          let pasteName = room.name;
          if (isCopy && existingRoomNames) {
            pasteName = generateDuplicateName(room.name, existingRoomNames);
            existingRoomNames.add(pasteName);
          }
          const points = isCopy
            ? room.points.map((p) => ({ x: p.x + PASTE_OFFSET_MM, y: p.y + PASTE_OFFSET_MM }))
            : room.points.map((p) => ({ ...p }));

          const pastedRoom: Room = {
            ...cloneRoom(room),
            id: newId,
            name: pasteName,
            floorId: activeFloorId,
            points,
          };

          for (const asset of pastedRoom.interiorAssets) {
            if (isInteriorAssetWithinRoom(pastedRoom, asset)) continue;

            const constrained = constrainInteriorAssetCenter(pastedRoom, asset, {
              x: asset.xMm,
              y: asset.yMm,
            });

            if (!constrained) {
              toast("Stairs don't fit in that room.");
              return state;
            }

            asset.xMm = constrained.x;
            asset.yMm = constrained.y;
            stairsWereAdjusted = true;
          }

          pastedRooms.push(pastedRoom);
        }

        if (stairsWereAdjusted) {
          toast("Stairs adjusted to fit room.", {
            duration: 5000,
            action: { label: "Undo", onClick: () => useEditorStore.getState().undo() },
          });
        }

        const command: EditorCommand = {
          type: "paste-rooms",
          pastedRooms,
          floorId: activeFloorId,
        };

        return {
          document: applyEditorCommand(state.document, command, "redo"),
          selectedRoomId: pastedRooms[0]?.id ?? null,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: null,
          selection: pastedRooms[0] ? [{ type: "room" as const, id: pastedRooms[0].id }] : [],
          history: {
            past: pushToPast(state.history.past, command),
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      if (state.clipboard.type === "stair") {
        // Paste stair into the selected room (or first room on active floor)
        let targetRoomId = state.selectedRoomId;
        if (!targetRoomId) {
          const roomsOnFloor = getRoomsForActiveFloor(state.document);
          targetRoomId = roomsOnFloor[0]?.id;
        }

        if (!targetRoomId) return state;

        const targetRoom = state.document.rooms.find((r) => r.id === targetRoomId);
        if (!targetRoom) return state;

        // Create offset asset; apply smart naming only for copies
        const newAssetId = createInteriorAssetId();
        let pasteName = state.clipboard.asset.name;
        if (state.clipboard.source === "copy") {
          const existingAssetNames = new Set(
            targetRoom.interiorAssets.map((a) => a.name)
          );
          pasteName = generateDuplicateName(
            state.clipboard.asset.name,
            existingAssetNames
          );
        }
        const isCopyStair = state.clipboard.source === "copy";
        let pastedAsset: RoomInteriorAsset = {
          ...cloneRoomInteriorAsset(state.clipboard.asset),
          id: newAssetId,
          name: pasteName,
          xMm: isCopyStair ? state.clipboard.asset.xMm + PASTE_OFFSET_MM : state.clipboard.asset.xMm,
          yMm: isCopyStair ? state.clipboard.asset.yMm + PASTE_OFFSET_MM : state.clipboard.asset.yMm,
        };

        // Bounds check: nudge into room if out of bounds
        let wasAdjusted = false;
        if (!isInteriorAssetWithinRoom(targetRoom, pastedAsset)) {
          const constrained = constrainInteriorAssetCenter(
            targetRoom,
            pastedAsset,
            { x: pastedAsset.xMm, y: pastedAsset.yMm }
          );
          if (constrained) {
            pastedAsset = { ...pastedAsset, xMm: constrained.x, yMm: constrained.y };
            wasAdjusted = true;
          } else {
            // Room is too small — abort and notify
            toast("Stairs don't fit in that room.");
            return state;
          }
        }

        if (wasAdjusted) {
          toast("Stairs adjusted to fit room.", {
            duration: 5000,
            action: { label: "Undo", onClick: () => useEditorStore.getState().undo() },
          });
        }

        const command: EditorCommand = {
          type: "paste-interior-asset",
          pastedAsset,
          targetRoomId,
          sourceRoomId: state.clipboard.sourceRoomId,
        };

        return {
          document: applyEditorCommand(state.document, command, "redo"),
          selectedRoomId: targetRoomId,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: { roomId: targetRoomId, assetId: newAssetId },
          selection: [{ type: "stair" as const, roomId: targetRoomId, id: newAssetId }],
          history: {
            past: pushToPast(state.history.past, command),
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      return state;
    }),
  cutSelection: () =>
    set((state) => {
      if (state.selection.length === 0) return state;

      const item = state.selection[0];
      if (!item) return state;

      if (item.type === "room") {
        const roomIndex = state.document.rooms.findIndex((r) => r.id === item.id);
        const room = state.document.rooms[roomIndex];
        if (!room || roomIndex === -1) return state;

        const command: EditorCommand = {
          type: "cut-rooms",
          cutRooms: [cloneRoom(room)],
          previousIndex: roomIndex,
        };

        return {
          clipboard: {
            type: "room",
            source: "cut" as const,
            rooms: [cloneRoom(room)],
          },
          document: applyEditorCommand(state.document, command, "redo"),
          selectedRoomId: null,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset: null,
          selection: [],
          history: {
            past: pushToPast(state.history.past, command),
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      if (item.type === "stair") {
        const room = state.document.rooms.find((r) => r.id === item.roomId);
        const assetIndex = room?.interiorAssets.findIndex((a) => a.id === item.id);
        const asset = room?.interiorAssets[assetIndex ?? -1];
        if (!room || !asset || assetIndex === undefined || assetIndex === -1) return state;

        const command: EditorCommand = {
          type: "cut-interior-asset",
          cutAsset: cloneRoomInteriorAsset(asset),
          roomId: item.roomId,
        };

        return {
          clipboard: {
            type: "stair",
            source: "cut" as const,
            asset: cloneRoomInteriorAsset(asset),
            sourceRoomId: item.roomId,
          },
          document: applyEditorCommand(state.document, command, "redo"),
          selectedRoomId: item.roomId,
          selectedInteriorAsset: null,
          selection: [{ type: "room" as const, id: item.roomId }],
          history: {
            past: pushToPast(state.history.past, command),
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      return state;
    }),
  duplicateSelection: () =>
    set((state) => {
      if (state.selection.length === 0) return state;

      const activeFloorId = getNormalizedActiveFloorId(state.document);
      const DUPLICATE_OFFSET_MM = 500; // Offset duplicates 500mm from originals

      // Collect all existing names for smart naming
      const existingRoomNames = new Set(state.document.rooms.map((r) => r.name));
      const existingAssetNames = new Map<string, Set<string>>();
      for (const room of state.document.rooms) {
        existingAssetNames.set(
          room.id,
          new Set(room.interiorAssets.map((a) => a.name))
        );
      }

      const duplicatedRooms: Room[] = [];
      const duplicatedAssets: Array<{ roomId: string; asset: RoomInteriorAsset }> = [];
      const newSelection: SharedSelectionItem[] = [];

      // Process each item in selection
      for (const item of state.selection) {
        if (item.type === "room") {
          const sourceRoom = state.document.rooms.find((r) => r.id === item.id);
          if (!sourceRoom) continue;

          // Create duplicate with new ID and smart name
          const duplicateName = generateDuplicateName(sourceRoom.name, existingRoomNames);
          existingRoomNames.add(duplicateName);

          const newRoomId = createRoomId();
          const offsetPoints = sourceRoom.points.map((p) => ({
            x: p.x + DUPLICATE_OFFSET_MM,
            y: p.y + DUPLICATE_OFFSET_MM,
          }));

          const duplicateRoom: Room = {
            ...cloneRoom(sourceRoom),
            id: newRoomId,
            name: duplicateName,
            floorId: sourceRoom.floorId ?? activeFloorId,
            points: offsetPoints,
          };

          duplicatedRooms.push(duplicateRoom);
          newSelection.push({ type: "room" as const, id: newRoomId });
        }

        if (item.type === "stair") {
          const sourceRoom = state.document.rooms.find((r) => r.id === item.roomId);
          const sourceAsset = sourceRoom?.interiorAssets.find((a) => a.id === item.id);
          if (!sourceRoom || !sourceAsset) continue;

          // Create duplicate with new ID and smart name
          const roomAssetNames = existingAssetNames.get(sourceRoom.id) ?? new Set();
          const duplicateName = generateDuplicateName(sourceAsset.name, roomAssetNames);
          roomAssetNames.add(duplicateName);
          existingAssetNames.set(sourceRoom.id, roomAssetNames);

          const newAssetId = createInteriorAssetId();
          const duplicateAsset: RoomInteriorAsset = {
            ...cloneRoomInteriorAsset(sourceAsset),
            id: newAssetId,
            name: duplicateName,
            xMm: sourceAsset.xMm + DUPLICATE_OFFSET_MM,
            yMm: sourceAsset.yMm + DUPLICATE_OFFSET_MM,
          };

          duplicatedAssets.push({
            roomId: sourceRoom.id,
            asset: duplicateAsset,
          });
          newSelection.push({ type: "stair" as const, roomId: sourceRoom.id, id: newAssetId });
        }
      }

      // If nothing was duplicated, return unchanged state
      if (duplicatedRooms.length === 0 && duplicatedAssets.length === 0) {
        return state;
      }

      const command: EditorCommand = {
        type: "bulk-duplicate",
        duplicatedRooms,
        duplicatedAssets,
      };

      return {
        document: applyEditorCommand(state.document, command, "redo"),
        selectedRoomId: duplicatedRooms[0]?.id ?? state.selectedRoomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset:
          duplicatedAssets[0] && duplicatedAssets[0].roomId
            ? {
                roomId: duplicatedAssets[0].roomId,
                assetId: duplicatedAssets[0].asset.id,
              }
            : null,
        selection: newSelection.length > 0 ? newSelection : [],
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  moveSelectionToFloor: (targetFloorId) =>
    set((state) => {
      if (state.selection.length === 0) return state;

      const targetFloor = state.document.floors.find((f) => f.id === targetFloorId);
      if (!targetFloor) return state;

      const movedRooms: Array<{ room: Room; previousFloorId: string }> = [];
      const movedAssets: Array<{ roomId: string; asset: RoomInteriorAsset; previousRoomId: string }> = [];

      // Process each item in selection
      for (const item of state.selection) {
        if (item.type === "room") {
          const room = state.document.rooms.find((r) => r.id === item.id);
          if (!room) continue;

          // Only move if the floor is different
          if (room.floorId === targetFloorId) continue;

          movedRooms.push({
            room: cloneRoom(room),
            previousFloorId: room.floorId,
          });
        }

        if (item.type === "stair") {
          const room = state.document.rooms.find((r) => r.id === item.roomId);
          const asset = room?.interiorAssets.find((a) => a.id === item.id);
          if (!room || !asset) continue;

          movedAssets.push({
            roomId: item.roomId,
            asset: cloneRoomInteriorAsset(asset),
            previousRoomId: item.roomId,
          });
        }
      }

      // If nothing was moved, return unchanged state
      if (movedRooms.length === 0 && movedAssets.length === 0) {
        return state;
      }

      const command: EditorCommand = {
        type: "move-selection-to-floor",
        targetFloorId,
        movedRooms,
        movedAssets,
      };

      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        selectedRoomId: movedRooms[0]?.room.id ?? state.selectedRoomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        selection: state.selection,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  reorderRoomInFloor: (roomId, targetIndex) =>
    set((state) => {
      const room = state.document.rooms.find((r) => r.id === roomId);
      if (!room) return state;

      // Get rooms for this floor
      const floorRooms = state.document.rooms.filter((r) => r.floorId === room.floorId);
      
      // Find current index of room within floor
      const currentIndex = floorRooms.findIndex((r) => r.id === roomId);
      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= floorRooms.length) {
        return state;
      }

      // If already at target, no-op
      if (currentIndex === targetIndex) return state;

      const command: EditorCommand = {
        type: "reorder-rooms-in-floor",
        floorId: room.floorId,
        roomId,
        fromIndex: currentIndex,
        toIndex: targetIndex,
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
  setCanvasInteractionActive: (isActive) =>
    set((state) => {
      if (state.isCanvasInteractionActive === isActive) return state;
      return {
        isCanvasInteractionActive: isActive,
      };
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
      if (state.isCanvasInteractionActive || state.roomDraft.points.length > 0) return state;
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
      if (state.isCanvasInteractionActive || state.roomDraft.points.length > 0) return state;
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
  startInteriorAssetRenameSession: (roomId, assetId) =>
    set((state) => {
      if (state.isCanvasInteractionActive || state.roomDraft.points.length > 0) return state;
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!room || !asset) return state;
      if (
        state.interiorAssetRenameSession?.roomId === roomId &&
        state.interiorAssetRenameSession.assetId === assetId
      ) {
        return state;
      }

      return {
        interiorAssetRenameSession: {
          roomId,
          assetId,
          initialName: asset.name,
        },
      };
    }),
  updateInteriorAssetRenameDraft: (roomId, assetId, name) =>
    set((state) => {
      if (state.isCanvasInteractionActive || state.roomDraft.points.length > 0) return state;
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!room || !asset) return state;

      const trimmedName = name.trim();
      const nextName = trimmedName.length > 0 ? trimmedName : DEFAULT_STAIR_NAME;
      const interiorAssetRenameSession =
        state.interiorAssetRenameSession?.roomId === roomId &&
        state.interiorAssetRenameSession.assetId === assetId
          ? state.interiorAssetRenameSession
          : {
              roomId,
              assetId,
              initialName: asset.name,
            };

      if (
        asset.name === nextName &&
        state.interiorAssetRenameSession?.roomId === roomId &&
        state.interiorAssetRenameSession.assetId === assetId
      ) {
        return state;
      }

      return {
        document: updateInteriorAssetNameInDocument(state.document, roomId, assetId, nextName),
        interiorAssetRenameSession,
      };
    }),
  commitInteriorAssetRenameSession: () =>
    set((state) => {
      const renameSession = state.interiorAssetRenameSession;
      if (!renameSession) return state;

      const room = state.document.rooms.find((candidate) => candidate.id === renameSession.roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === renameSession.assetId);
      if (!room || !asset) {
        return {
          interiorAssetRenameSession: null,
        };
      }

      if (asset.name === renameSession.initialName) {
        return {
          interiorAssetRenameSession: null,
        };
      }

      const command: EditorCommand = {
        type: "update-interior-asset",
        roomId: room.id,
        previousAsset: {
          ...cloneRoomInteriorAsset(asset),
          name: renameSession.initialName,
        },
        nextAsset: cloneRoomInteriorAsset(asset),
      };

      return {
        interiorAssetRenameSession: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  cancelInteriorAssetRenameSession: () =>
    set((state) => {
      const renameSession = state.interiorAssetRenameSession;
      if (!renameSession) return state;

      const room = state.document.rooms.find((candidate) => candidate.id === renameSession.roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === renameSession.assetId);
      const nextDocument =
        room && asset && asset.name !== renameSession.initialName
          ? updateInteriorAssetNameInDocument(
              state.document,
              renameSession.roomId,
              renameSession.assetId,
              renameSession.initialName
            )
          : state.document;

      return {
        document: nextDocument,
        interiorAssetRenameSession: null,
      };
    }),
  startInteriorAssetArrowLabelSession: (roomId, assetId) =>
    set((state) => {
      if (state.isCanvasInteractionActive || state.roomDraft.points.length > 0) return state;
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!room || !asset) return state;
      if (
        state.interiorAssetArrowLabelSession?.roomId === roomId &&
        state.interiorAssetArrowLabelSession.assetId === assetId
      ) {
        return state;
      }

      return {
        interiorAssetArrowLabelSession: {
          roomId,
          assetId,
          initialArrowLabel: asset.arrowLabel,
        },
      };
    }),
  updateInteriorAssetArrowLabelDraft: (roomId, assetId, label) =>
    set((state) => {
      if (state.isCanvasInteractionActive || state.roomDraft.points.length > 0) return state;
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!room || !asset) return state;

      const nextLabel = label.trim();
      const interiorAssetArrowLabelSession =
        state.interiorAssetArrowLabelSession?.roomId === roomId &&
        state.interiorAssetArrowLabelSession.assetId === assetId
          ? state.interiorAssetArrowLabelSession
          : {
              roomId,
              assetId,
              initialArrowLabel: asset.arrowLabel,
            };

      if (
        asset.arrowLabel === nextLabel &&
        state.interiorAssetArrowLabelSession?.roomId === roomId &&
        state.interiorAssetArrowLabelSession.assetId === assetId
      ) {
        return state;
      }

      return {
        document: updateRoomInteriorAssetInDocument(state.document, roomId, {
          ...cloneRoomInteriorAsset(asset),
          arrowLabel: nextLabel,
        }),
        interiorAssetArrowLabelSession,
      };
    }),
  commitInteriorAssetArrowLabelSession: () =>
    set((state) => {
      const labelSession = state.interiorAssetArrowLabelSession;
      if (!labelSession) return state;

      const room = state.document.rooms.find((candidate) => candidate.id === labelSession.roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === labelSession.assetId);
      if (!room || !asset) {
        return {
          interiorAssetArrowLabelSession: null,
        };
      }

      if (asset.arrowLabel === labelSession.initialArrowLabel) {
        return {
          interiorAssetArrowLabelSession: null,
        };
      }

      const command: EditorCommand = {
        type: "update-interior-asset",
        roomId: room.id,
        previousAsset: {
          ...cloneRoomInteriorAsset(asset),
          arrowLabel: labelSession.initialArrowLabel,
        },
        nextAsset: cloneRoomInteriorAsset(asset),
      };

      return {
        interiorAssetArrowLabelSession: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  cancelInteriorAssetArrowLabelSession: () =>
    set((state) => {
      const labelSession = state.interiorAssetArrowLabelSession;
      if (!labelSession) return state;

      const room = state.document.rooms.find((candidate) => candidate.id === labelSession.roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === labelSession.assetId);
      const nextDocument =
        room && asset && asset.arrowLabel !== labelSession.initialArrowLabel
          ? updateRoomInteriorAssetInDocument(state.document, labelSession.roomId, {
              ...cloneRoomInteriorAsset(asset),
              arrowLabel: labelSession.initialArrowLabel,
            })
          : state.document;

      return {
        document: nextDocument,
        interiorAssetArrowLabelSession: null,
      };
    }),
  startFloorRename: (floorId) =>
    set((state) => {
      if (state.isCanvasInteractionActive || state.roomDraft.points.length > 0) return state;
      const floor = state.document.floors.find((candidate) => candidate.id === floorId);
      if (!floor) return state;
      if (state.floorRenameSession?.floorId === floorId) return state;

      return {
        floorRenameSession: {
          floorId,
          initialName: floor.name,
        },
      };
    }),
  updateFloorRenameDraft: (floorId, name) =>
    set((state) => {
      if (state.isCanvasInteractionActive || state.roomDraft.points.length > 0) return state;
      const floor = state.document.floors.find((candidate) => candidate.id === floorId);
      if (!floor) return state;

      const floorRenameSession =
        state.floorRenameSession?.floorId === floorId
          ? state.floorRenameSession
          : {
              floorId,
              initialName: floor.name,
            };

      if (floor.name === name && state.floorRenameSession?.floorId === floorId) return state;

      return {
        document: updateFloorNameInDocument(state.document, floorId, name),
        floorRenameSession,
      };
    }),
  commitFloorRenameSession: () =>
    set((state) => {
      const floorRenameSession = state.floorRenameSession;
      if (!floorRenameSession) return state;

      const floor = state.document.floors.find((candidate) => candidate.id === floorRenameSession.floorId);
      if (!floor) {
        return {
          floorRenameSession: null,
        };
      }

      const didNameChange = floor.name !== floorRenameSession.initialName;
      if (!didNameChange) {
        return {
          floorRenameSession: null,
        };
      }

      const command: EditorCommand = {
        type: "rename-floor",
        floorId: floorRenameSession.floorId,
        previousName: floorRenameSession.initialName,
        nextName: floor.name,
      };

      showFloorRenameToast(floorRenameSession.floorId, floor.name);

      return {
        floorRenameSession: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  cancelFloorRename: () =>
    set((state) => {
      const floorRenameSession = state.floorRenameSession;
      if (!floorRenameSession) return state;

      const floor = state.document.floors.find((candidate) => candidate.id === floorRenameSession.floorId);
      const nextDocument =
        floor && floor.name !== floorRenameSession.initialName
          ? updateFloorNameInDocument(state.document, floorRenameSession.floorId, floorRenameSession.initialName)
          : state.document;

      return {
        document: nextDocument,
        floorRenameSession: null,
      };
    }),
  deleteFloor: (floorId) =>
    set((state) => {
      const floor = state.document.floors.find((candidate) => candidate.id === floorId);
      if (!floor) return state;

      const previousFloorIndex = state.document.floors.findIndex((f) => f.id === floorId);
      const roomsToDelete = state.document.rooms.filter((room) => room.floorId === floorId);

      const roomsToDeleteWithIndex = roomsToDelete.map((room) => {
        const previousIndex = state.document.rooms.findIndex((r) => r.id === room.id);
        return {
          room: {
            id: room.id,
            floorId: room.floorId,
            name: room.name,
            points: room.points.map((point) => ({ ...point })),
            openings: cloneRoomOpenings(room.openings),
            interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
          },
          previousIndex,
        };
      });

      const command: EditorCommand = {
        type: "delete-floor",
        floor: {
          id: floor.id,
          name: floor.name,
        },
        previousFloorIndex,
        roomsToDelete: roomsToDeleteWithIndex,
      };

      showDeleteFloorToast(floor.name, floor.id);

      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        floorRenameSession: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
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
          selection: [],
          shouldFocusSelectedRoomNameInput: false,
          renameSession: null,
        };
      }

      const room = state.document.rooms[previousIndex];
      const command: EditorCommand = {
        type: "delete-room",
        room: {
          id: room.id,
          floorId: room.floorId,
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
        selection: [],
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
          selection: state.selectedRoomId ? [{ type: "room" as const, id: state.selectedRoomId }] : [],
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
        selection: [{ type: "room" as const, id: room.id }],
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
          selection: state.selectedRoomId ? [{ type: "room" as const, id: state.selectedRoomId }] : [],
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
        selection: [{ type: "room" as const, id: room.id }],
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  bulkDeleteSelection: () =>
    set((state) => {
      if (state.selection.length === 0) return state;

      // If only one item selected, route to specific delete functions
      if (state.selection.length === 1) {
        return state; // Caller should handle single-item delete
      }

      // Collect all delete commands from selection
      const deleteCommands: EditorCommand[] = [];
      const roomsToDelete = new Set<string>();
      let roomCount = 0;
      let openingCount = 0;
      let stairCount = 0;

      for (const item of state.selection) {
        if (item.type === "room") {
          const roomIndex = state.document.rooms.findIndex((r) => r.id === item.id);
          if (roomIndex >= 0) {
            const room = state.document.rooms[roomIndex];
            deleteCommands.push({
              type: "delete-room",
              room: {
                id: room.id,
                floorId: room.floorId,
                name: room.name,
                points: room.points.map((p) => ({ ...p })),
                openings: cloneRoomOpenings(room.openings),
                interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
              },
              previousIndex: roomIndex,
            } as EditorCommand);
            roomsToDelete.add(room.id);
            roomCount++;
          }
        } else if (item.type === "opening" && item.roomId && item.id) {
          // Only delete openings from rooms that aren't being deleted
          if (!roomsToDelete.has(item.roomId)) {
            const room = state.document.rooms.find((r) => r.id === item.roomId);
            const opening = room?.openings.find((o) => o.id === item.id);
            if (room && opening) {
              deleteCommands.push({
                type: "delete-opening",
                roomId: room.id,
                opening: cloneRoomOpening(opening),
              } as EditorCommand);
              openingCount++;
            }
          }
        } else if (item.type === "stair" && item.roomId && item.id) {
          // Only delete stairs from rooms that aren't being deleted
          if (!roomsToDelete.has(item.roomId)) {
            const room = state.document.rooms.find((r) => r.id === item.roomId);
            const asset = room?.interiorAssets.find((a) => a.id === item.id);
            if (room && asset) {
              deleteCommands.push({
                type: "delete-interior-asset",
                roomId: room.id,
                asset: cloneRoomInteriorAsset(asset),
              } as EditorCommand);
              stairCount++;
            }
          }
        }
      }

      if (deleteCommands.length === 0) return state;

      // Build bulk delete command
      const command: EditorCommand = {
        type: "bulk-delete",
        deleteCommands,
      } as EditorCommand;

      const nextDocument = applyEditorCommand(state.document, command, "redo");

      // Show confirmation toast with counts
      const parts = [];
      if (roomCount > 0) parts.push(`${roomCount} room${roomCount > 1 ? "s" : ""}`);
      if (openingCount > 0) parts.push(`${openingCount} opening${openingCount > 1 ? "s" : ""}`);
      if (stairCount > 0) parts.push(`${stairCount} stair${stairCount > 1 ? "s" : ""}`);
      const confirmationText = parts.join(" and ");

      toast(`Deleted ${confirmationText}`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            const currentState = useEditorStore.getState();
            const latestCommand = currentState.history.past[currentState.history.past.length - 1];
            if (latestCommand?.type !== "bulk-delete") {
              return;
            }
            currentState.undo();
          },
        },
      });

      return {
        document: nextDocument,
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        selection: [],
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
  insertDefaultStairInSelectedRoom: () => {
    let promptRoomId: string | null = null;
    let promptAssetId: string | null = null;
    set((state) => {
      const nextState = insertDefaultStairOnSelectedRoom(state);
      if (nextState?.selectedInteriorAsset) {
        promptRoomId = nextState.selectedInteriorAsset.roomId;
        promptAssetId = nextState.selectedInteriorAsset.assetId;
      }
      return nextState ?? state;
    });

    if (promptRoomId && promptAssetId) {
      showConnectedFloorPrompt(promptRoomId, promptAssetId);
    }
  },
  promptConnectedFloorForSelectedStair: () => {
    const state = useEditorStore.getState();
    const selectedInteriorAsset = state.selectedInteriorAsset;
    if (!selectedInteriorAsset) return;
    showConnectedFloorPrompt(selectedInteriorAsset.roomId, selectedInteriorAsset.assetId);
  },
  addConnectedFloorAboveFromSelectedStair: () => {
    const state = useEditorStore.getState();
    const selectedInteriorAsset = state.selectedInteriorAsset;
    if (!selectedInteriorAsset) return;
    state.createConnectedFloorFromStair(
      selectedInteriorAsset.roomId,
      selectedInteriorAsset.assetId,
      "above"
    );
  },
  addConnectedFloorBelowFromSelectedStair: () => {
    const state = useEditorStore.getState();
    const selectedInteriorAsset = state.selectedInteriorAsset;
    if (!selectedInteriorAsset) return;
    state.createConnectedFloorFromStair(
      selectedInteriorAsset.roomId,
      selectedInteriorAsset.assetId,
      "below"
    );
  },
  createConnectedFloorFromStair: (roomId, assetId, direction) =>
    set((state) => {
      const promptState = getConnectedFloorPromptState(state.document, roomId, assetId);
      if (!promptState) return state;

      const creationResult = buildConnectedFloorDocument(
        state.document,
        promptState.room,
        promptState.asset,
        direction
      );
      if (!creationResult) {
        toast(
          direction === "above"
            ? "A floor already exists above this stair."
            : "A floor already exists below this stair."
        );
        return state;
      }

      const command: EditorCommand = {
        type: "create-connected-floor",
        previousDocument: cloneDocumentState(state.document),
        nextDocument: cloneDocumentState(creationResult.nextDocument),
        createdFloorId: creationResult.createdFloorId,
        createdRoomId: creationResult.createdRoomId,
        createdAssetId: creationResult.createdAssetId,
      };

      return {
        document: creationResult.nextDocument,
        selectedRoomId: creationResult.createdRoomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: {
          roomId: creationResult.createdRoomId,
          assetId: creationResult.createdAssetId,
        },
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  updateSelectedInteriorAssetName: (name) =>
    set((state) => {
      const trimmedName = name.trim();
      const nextState = updateSelectedInteriorAsset(state, (_, asset) => {
        const nextName = trimmedName.length > 0 ? trimmedName : DEFAULT_STAIR_NAME;
        if (asset.name === nextName) return null;

        return {
          ...cloneRoomInteriorAsset(asset),
          name: nextName,
        };
      });
      return nextState ?? state;
    }),
  rotateSelectedInteriorAsset: (deltaDegrees) =>
    set((state) => {
      const selectedAsset = state.selectedInteriorAsset;
      if (!selectedAsset) return state;

      const room = state.document.rooms.find((candidate) => candidate.id === selectedAsset.roomId);
      const asset = room?.interiorAssets.find((candidate) => candidate.id === selectedAsset.assetId);
      if (!room || !asset) return state;

      const nextAsset = getRotatedInteriorAssetForRoom(room, asset, deltaDegrees);
      if (!nextAsset) return state;

      const updatedDocument = updateRoomInteriorAssetInDocument(state.document, room.id, nextAsset);
      const nextDocument = syncConnectedStairTransformInDocument(updatedDocument, room.id, nextAsset.id, deltaDegrees);

      const command: EditorCommand = {
        type: "update-interior-asset",
        roomId: room.id,
        previousAsset: cloneRoomInteriorAsset(asset),
        nextAsset: cloneRoomInteriorAsset(nextAsset),
      };

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
  setSelectedInteriorAssetArrowEnabled: (isEnabled) =>
    set((state) => {
      const nextState = updateSelectedInteriorAsset(state, (_, asset) => {
        if (asset.arrowEnabled === isEnabled) return null;
        return {
          ...cloneRoomInteriorAsset(asset),
          arrowEnabled: isEnabled,
        };
      });
      return nextState ?? state;
    }),
  swapSelectedInteriorAssetArrowDirection: () =>
    set((state) => {
      const nextState = updateSelectedInteriorAsset(state, (_, asset) => ({
        ...cloneRoomInteriorAsset(asset),
        arrowDirection: asset.arrowDirection === "reverse" ? "forward" : "reverse",
      }));
      return nextState ?? state;
    }),
  updateSelectedInteriorAssetArrowLabel: (label) =>
    set((state) => {
      const nextLabel = label.trim();
      const nextState = updateSelectedInteriorAsset(state, (_, asset) => {
        if (asset.arrowLabel === nextLabel) return null;
        return {
          ...cloneRoomInteriorAsset(asset),
          arrowLabel: nextLabel,
        };
      });
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

      if ((asset.connectionId ?? null) !== null) {
        const updatedDocument = updateRoomInteriorAssetPositionInDocument(
          state.document,
          roomId,
          assetId,
          nextCenter
        );
        const nextDocument = syncConnectedStairTransformInDocument(updatedDocument, roomId, assetId);
        const command: EditorCommand = {
          type: "sync-connected-stairs",
          previousDocument: cloneDocumentState(state.document),
          nextDocument: cloneDocumentState(nextDocument),
        };

        return {
          document: nextDocument,
          history: {
            past: pushToPast(state.history.past, command),
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

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
  commitInteriorAssetMoveToRoom: (fromRoomId, toRoomId, assetId, nextCenter) =>
    set((state) => {
      const fromRoom = state.document.rooms.find((candidate) => candidate.id === fromRoomId);
      const toRoom = state.document.rooms.find((candidate) => candidate.id === toRoomId);
      const asset = fromRoom?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!fromRoom || !toRoom || !asset) return state;

      let finalCenter = nextCenter;

      // Bounds check: if the asset center would land outside the target room, nudge it in
      const candidateAsset: RoomInteriorAsset = {
        ...cloneRoomInteriorAsset(asset),
        xMm: nextCenter.x,
        yMm: nextCenter.y,
      };
      if (!isInteriorAssetWithinRoom(toRoom, candidateAsset)) {
        const constrained = constrainInteriorAssetCenter(toRoom, candidateAsset, nextCenter);
        if (constrained) {
          finalCenter = constrained;
          toast("Stairs adjusted to fit room.", {
            action: { label: "Undo", onClick: () => useEditorStore.getState().undo() },
          });
        } else {
          toast("Stairs don't fit in that room.", {
            description: "Try a smaller stair block or a larger room.",
          });
          return state;
        }
      }

      const movedAsset: RoomInteriorAsset = {
        ...cloneRoomInteriorAsset(asset),
        xMm: finalCenter.x,
        yMm: finalCenter.y,
      };

      const command: EditorCommand = {
        type: "move-interior-asset-to-room",
        assetId,
        fromRoomId,
        toRoomId,
        asset: movedAsset,
      };

      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        selectedRoomId: toRoomId,
        selectedInteriorAsset: { roomId: toRoomId, assetId },
        selection: [{ type: "stair" as const, roomId: toRoomId, id: assetId }],
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

      const nextPoints = translateRoomPointsOnGrid(
        room.points,
        delta,
        getEffectiveSnapStepMm(state)
      );
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
      const { nextInteriorAssets, didAdjust } = getAdjustedInteriorAssetsForRoomResize(
        room,
        nextPoints
      );

      const command: EditorCommand = {
        type: "resize-room",
        roomId,
        previousPoints: previousPoints.map((point) => ({ ...point })),
        nextPoints: nextPoints.map((point) => ({ ...point })),
        previousInteriorAssets: didAdjust ? cloneRoomInteriorAssets(room.interiorAssets) : undefined,
        nextInteriorAssets: didAdjust ? cloneRoomInteriorAssets(nextInteriorAssets) : undefined,
      };
      const nextDocument = updateResizedRoomInDocument(
        state.document,
        roomId,
        nextPoints,
        didAdjust ? nextInteriorAssets : undefined
      );

      if (didAdjust) {
        showStairsAdjustedToast(roomId, nextPoints);
      }

      return {
        document: nextDocument,
        selectedInteriorAsset: getSelectedInteriorAssetIfExists(
          state.selectedInteriorAsset,
          nextDocument
        ),
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
    const isLandscape = state.viewport.width > state.viewport.height;
    const isMobile = state.viewport.height < 600;
    const paddingPx = isLandscape && !isMobile ? 48 : 96;
    const targetCamera = getCameraFitTarget({
      rooms: getRoomsForActiveFloor(state.document),
      viewport: state.viewport,
      emptyLayoutCamera: syncCameraRotationToDocument(DEFAULT_CAMERA_STATE, state.document),
      paddingPx,
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
      camera: syncCameraRotationToDocument({ ...DEFAULT_CAMERA_STATE }, DEFAULT_DOCUMENT_STATE),
      pendingProjectOpenCameraFit: false,
      pendingProjectOpenEmptyLayoutPixelsPerMm: null,
      roomDraft: {
        points: [],
        history: [],
      },
      selectedNorthIndicator: false,
      selectedRoomId: null,
      selectedWall: null,
      selectedOpening: null,
      selectedInteriorAsset: null,
      shouldFocusSelectedRoomNameInput: false,
      renameSession: null,
      interiorAssetRenameSession: null,
      interiorAssetArrowLabelSession: null,
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
      dismissStairsAdjustedToastForCommand(command);
      dismissFloorRenameToastForCommand(command);
      dismissDeleteFloorToastForCommand(command);
      const nextDocument = applyEditorCommand(state.document, command, "undo");
      const nextPast = state.history.past.slice(0, -1);
      const nextFuture = [command, ...state.history.future];

      // If the command happened on a different floor than the one currently viewed,
      // restore the view to that floor so the user sees the undone change.
      const targetFloor = getTargetFloorForHistoryCommand(command, nextDocument, "undo");
      const currentFloor = getNormalizedActiveFloorId(state.document);
      const restoredDocument =
        targetFloor !== null && targetFloor !== currentFloor
          ? { ...nextDocument, activeFloorId: targetFloor }
          : nextDocument;

      return {
        document: restoredDocument,
        camera: syncCameraRotationToDocument(state.camera, restoredDocument),
        selectedNorthIndicator: state.selectedNorthIndicator,
        selectedRoomId: getSelectedRoomIdAfterHistoryCommand(
          state.selectedRoomId,
          restoredDocument,
          command,
          "undo"
        ),
        selectedWall: getSelectedWallIfRoomExists(state.selectedWall, restoredDocument),
        selectedOpening: getSelectedOpeningIfExists(state.selectedOpening, restoredDocument),
        selectedInteriorAsset: getSelectedInteriorAssetAfterHistoryCommand(
          state.selectedInteriorAsset,
          restoredDocument,
          command,
          "undo"
        ),
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
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

      const targetFloor = getTargetFloorForHistoryCommand(command, nextDocument, "redo");
      const currentFloor = getNormalizedActiveFloorId(state.document);
      const restoredDocument =
        targetFloor !== null && targetFloor !== currentFloor
          ? { ...nextDocument, activeFloorId: targetFloor }
          : nextDocument;

      return {
        document: restoredDocument,
        camera: syncCameraRotationToDocument(state.camera, restoredDocument),
        selectedNorthIndicator: state.selectedNorthIndicator,
        selectedRoomId: getSelectedRoomIdAfterHistoryCommand(
          state.selectedRoomId,
          restoredDocument,
          command,
          "redo"
        ),
        selectedWall: getSelectedWallIfRoomExists(state.selectedWall, restoredDocument),
        selectedOpening: getSelectedOpeningIfExists(state.selectedOpening, restoredDocument),
        selectedInteriorAsset: getSelectedInteriorAssetAfterHistoryCommand(
          state.selectedInteriorAsset,
          restoredDocument,
          command,
          "redo"
        ),
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
        history: {
          past: nextPast,
          future: remainingFuture,
        },
        canUndo: true,
        canRedo: remainingFuture.length > 0,
      };
    }),
  fitCameraOnProjectOpen: (options) =>
    set((state) => {
      const shouldDeferCameraFit = !isViewportReadyForProjectOpenCameraFit(state.viewport);
      const emptyLayoutPixelsPerMm = options?.emptyLayoutPixelsPerMm;

      stopResetCameraAnimation();

      if (shouldDeferCameraFit) {
        if (
          state.pendingProjectOpenCameraFit &&
          state.pendingProjectOpenEmptyLayoutPixelsPerMm === (emptyLayoutPixelsPerMm ?? null)
        ) {
          return state;
        }

        return {
          pendingProjectOpenCameraFit: true,
          pendingProjectOpenEmptyLayoutPixelsPerMm: emptyLayoutPixelsPerMm ?? null,
        };
      }

      const targetCamera = getProjectOpenCamera(state.document, state.viewport, {
        emptyLayoutPixelsPerMm,
      });
      if (!state.pendingProjectOpenCameraFit && areCamerasEqual(state.camera, targetCamera)) {
        return state;
      }

      return {
        camera: targetCamera,
        pendingProjectOpenCameraFit: false,
        pendingProjectOpenEmptyLayoutPixelsPerMm: null,
      };
    }),
  loadProjectDocument: (document, options) =>
    set((state) => {
      const nextDocument = cloneDocumentState(document);
      if (areDocumentsEqual(state.document, nextDocument)) {
        return state;
      }

      stopResetCameraAnimation();
      const shouldDeferCameraFit = !isViewportReadyForProjectOpenCameraFit(state.viewport);
      const emptyLayoutPixelsPerMm = options?.emptyLayoutPixelsPerMm;

      return {
        document: nextDocument,
        camera: shouldDeferCameraFit
          ? syncCameraRotationToDocument(state.camera, nextDocument)
          : getProjectOpenCamera(nextDocument, state.viewport, {
              emptyLayoutPixelsPerMm,
            }),
        pendingProjectOpenCameraFit: shouldDeferCameraFit,
        pendingProjectOpenEmptyLayoutPixelsPerMm: shouldDeferCameraFit
          ? emptyLayoutPixelsPerMm ?? null
          : null,
        roomDraft: EMPTY_ROOM_DRAFT,
        selectedNorthIndicator: false,
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        selection: [],
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
        clipboard: null,
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
  return isSupportedDrawPointPath(points, { closed: true }) && isSimplePolygon(points);
}

function completeDraftRoom(state: EditorState, draftPoints: Point[]) {
  const normalizedRoomPoints = normalizeDraftPointChain(draftPoints);
  if (normalizedRoomPoints.length < 4) return state;
  if (!isValidDraftRoomClosure(normalizedRoomPoints)) return state;

  const room: Room = {
    id: createRoomId(),
    floorId: getNormalizedActiveFloorId(state.document),
    name: `Room ${getRoomsForActiveFloor(state.document).length + 1}`,
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
  const activeSnapStepMm = getEffectiveSnapStepMm(state);
  const predictiveGuides = getMagneticSnapGuidesForSettings(
    getRoomsForActiveFloor(state.document),
    cursorWorld,
    state.camera,
    state.settings
  );
  const resolvedCursorWorld = getSnappedPointFromGuides(cursorWorld, activeSnapStepMm, predictiveGuides);
  return resolveOpeningMoveOffset(
    state.document,
    roomId,
    openingId,
    resolvedCursorWorld,
    null
  );
}

export function getOpeningResizeWidthForCursor(
  roomId: string,
  openingId: string,
  cursorWorld: Point
) {
  const state = useEditorStore.getState();
  const activeSnapStepMm = getEffectiveSnapStepMm(state);
  const predictiveGuides = getMagneticSnapGuidesForSettings(
    getRoomsForActiveFloor(state.document),
    cursorWorld,
    state.camera,
    state.settings
  );
  const resolvedCursorWorld = getSnappedPointFromGuides(cursorWorld, activeSnapStepMm, predictiveGuides);
  return resolveOpeningResizeWidth(
    state.document,
    roomId,
    openingId,
    resolvedCursorWorld,
    null
  );
}

export function getInteriorAssetMoveCenterForCursor(
  roomId: string,
  assetId: string,
  cursorWorld: Point,
  dragAnchorOffset?: Point
) {
  const state = useEditorStore.getState();
  const activeSnapStepMm = getEffectiveSnapStepMm(state);
  const predictiveGuides = getMagneticSnapGuidesForSettings(
    getRoomsForActiveFloor(state.document),
    cursorWorld,
    state.camera,
    state.settings
  );
  const resolvedCursorWorld = getSnappedPointFromGuides(cursorWorld, activeSnapStepMm, predictiveGuides);
  return resolveInteriorAssetMoveCenter(
    state.document,
    roomId,
    assetId,
    dragAnchorOffset
      ? {
          x: resolvedCursorWorld.x + dragAnchorOffset.x,
          y: resolvedCursorWorld.y + dragAnchorOffset.y,
        }
      : resolvedCursorWorld,
    activeSnapStepMm
  );
}

export function getInteriorAssetResizeFromWallForCursor(
  roomId: string,
  assetId: string,
  wall: "left" | "right" | "top" | "bottom",
  cursorWorld: Point
) {
  const state = useEditorStore.getState();
  const activeSnapStepMm = getEffectiveSnapStepMm(state);
  const predictiveGuides = getMagneticSnapGuidesForSettings(
    getRoomsForActiveFloor(state.document),
    cursorWorld,
    state.camera,
    state.settings
  );
  const resolvedCursorWorld = getSnappedPointFromGuides(cursorWorld, activeSnapStepMm, predictiveGuides);
  return resolveInteriorAssetResizeFromWall(
    state.document,
    roomId,
    assetId,
    wall,
    resolvedCursorWorld,
    null
  );
}

export function getInteriorAssetResizeFromCornerForCursor(
  roomId: string,
  assetId: string,
  corner: "top-left" | "top-right" | "bottom-right" | "bottom-left",
  cursorWorld: Point
) {
  const state = useEditorStore.getState();
  const activeSnapStepMm = getEffectiveSnapStepMm(state);
  const predictiveGuides = getMagneticSnapGuidesForSettings(
    getRoomsForActiveFloor(state.document),
    cursorWorld,
    state.camera,
    state.settings
  );
  const resolvedCursorWorld = getSnappedPointFromGuides(cursorWorld, activeSnapStepMm, predictiveGuides);
  return resolveInteriorAssetResizeFromCorner(
    state.document,
    roomId,
    assetId,
    corner,
    resolvedCursorWorld,
    null
  );
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
  const previousAxis = getSupportedDrawSegmentDirection(previousPoint, currentPoint);
  const nextAxis = getSupportedDrawSegmentDirection(currentPoint, rawNextPoint);

  if (!previousAxis || !nextAxis) return false;
  if (previousAxis === nextAxis) return false;

  return !nextDraftPoints
    .slice(0, -1)
    .some((point, index) => index !== 0 && pointsEqual(point, terminalPoint));
}

function applyDraftCandidatePointToPath(points: Point[], nextPoint: Point): Point[] {
  const normalizedPoints = normalizeDraftPointChain(points);
  if (normalizedPoints.length === 0) return [{ ...nextPoint }];
  if (normalizedPoints.length === 1) {
    return normalizeDraftPointChain([...normalizedPoints, nextPoint]);
  }

  const previousPoint = normalizedPoints[normalizedPoints.length - 2];
  const currentPoint = normalizedPoints[normalizedPoints.length - 1];
  const previousDirection = getSupportedDrawSegmentDirection(previousPoint, currentPoint);
  const nextDirection = getSupportedDrawSegmentDirection(currentPoint, nextPoint);

  if (previousDirection && nextDirection && previousDirection === nextDirection) {
    return normalizeDraftPointChain([...normalizedPoints.slice(0, -1), nextPoint]);
  }

  return normalizeDraftPointChain([...normalizedPoints, nextPoint]);
}

import { createElement } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import {
  GRID_MINOR_SIZE_MM,
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
import { loadGlobalSettings, saveGlobalSettings } from "@/lib/editor/globalSettings";
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
  createCenteredDefaultBed,
  createCenteredDefaultSofa,
  createCenteredDefaultWardrobe,
  createCenteredDefaultDiningTable,
  createCenteredDefaultKitchenUnit,
  createCenteredDefaultKitchenAppliance,
  createCenteredDefaultHob,
  createCenteredDefaultSink,
  createCenteredDefaultToilet,
  createCenteredDefaultShower,
  createCenteredDefaultBath,
  createCenteredDefaultBasin,
  createCenteredDefaultDesk,
  DEFAULT_STAIR_NAME,
  getAdjustedInteriorAssetForRoomResize,
  getRotatedInteriorAssetForRoom,
  getResizedStairForCornerDrag,
  getResizedStairForWallDrag,
  getInteriorAssetDisplayName,
  isInteriorAssetWithinRoom,
} from "@/lib/editor/interiorAssets";
import {
  areRoomOpeningsEqual,
  cloneRoomOpening,
  cloneRoomOpenings,
  constrainOpeningOffset,
  getUpdatedOpeningForWidth,
  createCenteredRoomOpening,
  getSymmetricOpeningWidthForWorldPoint,
  getHandleAnchoredOpeningWidthAndOffsetForWorldPoint,
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
import {
  getWallSplitResult,
  type WallSplitResult,
} from "@/lib/editor/wallSplit";
import {
  ROOM_PRESET_OTHER_COLOR,
  getRegionalRoomPresetBaseName,
  getRoomPresetById,
  getSmartRoomName,
  type RoomPresetId,
} from "@/lib/editor/roomPresets";
import { normalizeRoomHeightMm } from "@/lib/editor/roomHeight";
import {
  cloneRoomWallSegments,
  createExternalRoomWallSegments,
  getRoomPointsWithInternalWallSpacing,
  reconcileSharedRoomWallSegments,
} from "@/lib/editor/wallThickness";
import { normalizeProjectExportConfig } from "@/lib/projects/exportConfig";
import { normalizeProjectRegion, normalizeUnitOrigin, type ProjectRegion, type UnitOrigin } from "@/lib/projects/region";
import { getTierConfig, type SubscriptionTier, AVAILABLE_TIERS } from "@/lib/subscription/tiers";
import { ConnectedFloorPromptToast } from "@/components/editor/ConnectedFloorPromptToast";
import type {
  CameraState,
  DoorHingeSide,
  DoorOpeningSide,
  Floor,
  InteriorAssetType,
  OpeningType,
  Point,
  Room,
  RoomInteriorAsset,
  RoomInteriorAssetSelection,
  RoomOpening,
  RoomOpeningSelection,
  RoomWallSelection,
  RulerMeasurement,
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

type RulerDraftState = {
  start: Point | null;
  end: Point | null;
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

type RulerRenameSessionState = {
  rulerId: string;
  initialName: string;
} | null;

type ClipboardData =
  | { type: "room"; source: "copy" | "cut"; rooms: Room[] }
  | {
      type: "asset";
      source: "copy" | "cut";
      asset: RoomInteriorAsset;
      sourceRoomId: string;
      assets?: Array<{ asset: RoomInteriorAsset; sourceRoomId: string }>;
    }
  | {
      type: "opening";
      source: "copy" | "cut";
      opening: RoomOpening;
      sourceRoomId: string;
      openings?: Array<{ opening: RoomOpening; sourceRoomId: string }>;
    }
  | null;

type AddFloorOptions = {
  targetFloorId?: string;
  position?: "above" | "below";
};

type EditorState = {
  document: DocumentState;
  camera: CameraState;
  pendingProjectOpenCameraFit: boolean;
  pendingProjectOpenEmptyLayoutPixelsPerMm: number | null;
  settings: EditorSettings;
  keyboardShortcutFeedbackEnabled: boolean;
  is45DegreeDrawingEnabled: boolean;
  setIs45DegreeDrawingEnabled: (enabled: boolean) => void;
  exportPreferences: EditorExportPreferences;
  isDimensionsVisibilityOverrideActive: boolean;
  viewport: ViewportSize;
  maxFloors: number;
  setMaxFloors: (maxFloors: number) => void;
  /**
   * Dev subscription mode: allows testing different subscription tiers locally.
   * Controlled by NEXT_PUBLIC_DEV_SUBSCRIPTION_MODE env var.
   * ⚠️ CRITICAL: This flag must NEVER be enabled in production builds.
   */
  isDevSubscriptionModeEnabled: boolean;
  /**
   * Currently selected subscription tier in dev mode (session-only, not persisted).
   * Only used when isDevSubscriptionModeEnabled is true. Defaults to "Free".
   */
  devSubscriptionTier: SubscriptionTier;
  setDevSubscriptionTier: (tier: SubscriptionTier) => void;
  roomDraft: RoomDraftState;
  isRulerMode: boolean;
  rulerDraft: RulerDraftState;
  selectedRulerId: string | null;
  selectedNorthIndicator: boolean;
  selectedRoomId: string | null;
  focusedRoomId: string | null;
  selectedWall: RoomWallSelection | null;
  selectedOpening: RoomOpeningSelection | null;
  selectedInteriorAsset: RoomInteriorAssetSelection | null;
  roomPresetPickerRoomId: string | null;
  /** Shared selection model: single source of truth for all selections */
  selection: SharedSelectionItem[];
  isCanvasInteractionActive: boolean;
  shouldFocusSelectedRoomNameInput: boolean;
  renameSession: RenameSessionState;
  interiorAssetRenameSession: InteriorAssetRenameSessionState;
  interiorAssetArrowLabelSession: InteriorAssetArrowLabelSessionState;
  floorRenameSession: FloorRenameSessionState;
  rulerRenameSession: RulerRenameSessionState;
  clipboard: ClipboardData;
  /**
   * Undo history policy:
   * - Include geometry/structural document changes only.
   * - Exclude selection, focus/hover/UI state, and floor navigation.
   */
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
  updateProjectRegion: (region: ProjectRegion) => void;
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
  addFloor: (options?: AddFloorOptions) => void;
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
  setRulerMode: (isActive: boolean) => void;
  startOrCommitRulerFromCursor: (
    cursorWorld: Point,
    options?: { constraintMode?: DrawConstraintMode }
  ) => void;
  updateRulerPreviewFromCursor: (
    cursorWorld: Point,
    options?: { constraintMode?: DrawConstraintMode }
  ) => void;
  resetRulerDraft: () => void;
  selectRulerById: (rulerId: string | null) => void;
  previewRulerMeasurement: (ruler: RulerMeasurement) => void;
  commitRulerMeasurementUpdate: (
    previousRuler: RulerMeasurement,
    nextRuler: RulerMeasurement
  ) => void;
  updateRulerMeasurement: (ruler: RulerMeasurement) => void;
  toggleRulerHidden: (rulerId: string) => void;
  deleteRulerMeasurement: (rulerId: string) => void;
  clearRulerMeasurements: () => void;
  setFocusedRoomId: (roomId: string | null) => void;
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
  requestRoomPresetPicker: (roomId: string) => void;
  clearRoomPresetPicker: () => void;
  /** Copy selected room(s) or stair(s) to clipboard */
  copySelection: () => void;
  /** Paste item(s) from clipboard to current floor */
  pasteSelection: () => void;
  /** Cut selected room(s) or stair(s) to clipboard (remove from location) */
  cutSelection: () => void;
  /** Duplicate selected room(s) or stair(s) with smart naming and offset placement */
  duplicateSelection: (options?: { isMirror?: boolean }) => void;
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
  startRulerRenameSession: (rulerId: string) => void;
  updateRulerRenameDraft: (rulerId: string, name: string) => void;
  commitRulerRenameSession: () => void;
  cancelRulerRenameSession: () => void;
  deleteFloor: (floorId: string) => void;
  deleteSelectedRoom: () => void;
  deleteSelectedOpening: () => void;
  deleteSelectedInteriorAsset: () => void;
  bulkDeleteSelection: () => void;
  updateRoomName: (roomId: string, name: string) => void;
  applyRoomPreset: (roomId: string, presetId: RoomPresetId) => void;
  applyOtherRoomPreset: (roomId: string) => void;
  insertDefaultDoorOnSelectedWall: () => void;
  insertDefaultWindowOnSelectedWall: () => void;
  insertDefaultStairInSelectedRoom: () => void;
  placeAssetInSelectedRoom: (assetType: InteriorAssetType) => void;
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
  setSelectedInteriorAssetDoorType: (doorType: "swing" | "sliding") => void;
  setSelectedInteriorAssetShape: (shape: "rectangular" | "round") => void;
  setSinkBowlType: (bowlType: "single" | "1.5") => void;
  setSinkHasDefaultDrainer: (hasDefaultDrainer: boolean) => void;
  setSelectedHobBurnerCount: (burnerCount: 2 | 4 | 5 | 6) => void;
  setSelectedBedSizePreset: (widthMm: number, depthMm: number, presetName: string) => void;
  setSelectedShowerSizePreset: (widthMm: number, depthMm: number, presetName: string) => void;
  setSelectedBathPlugHolePosition: (widthMm: number, depthMm: number, presetName: string) => void;
  updateSelectedOpeningWidth: (widthMm: number) => void;
  updateSelectedDoorOpeningSide: (openingSide: DoorOpeningSide) => void;
  updateSelectedDoorHingeSide: (hingeSide: DoorHingeSide) => void;
  previewOpeningResize: (roomId: string, openingId: string, nextWidthMm: number, nextOffsetMm?: number) => void;
  commitOpeningResize: (
    roomId: string,
    openingId: string,
    previousWidthMm: number,
    nextWidthMm: number,
    previousOffsetMm?: number,
    nextOffsetMm?: number
  ) => void;
  previewOpeningMove: (roomId: string, openingId: string, nextOffsetMm: number) => void;
  commitOpeningMove: (
    roomId: string,
    openingId: string,
    previousOffsetMm: number,
    nextOffsetMm: number
  ) => void;
  commitBulkOpeningMove: (
    moves: Array<{
      roomId: string;
      openingId: string;
      previousOffsetMm: number;
      nextOffsetMm: number;
    }>
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
    previousCenter: Point,
    nextCenter: Point
  ) => void;
  commitBulkInteriorAssetMove: (
    moves: Array<{ roomId: string; assetId: string; previousCenter: Point; nextCenter: Point }>
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
  commitBulkRoomMove: (
    moves: Array<{ roomId: string; previousPoints: Point[]; nextPoints: Point[] }>
  ) => void;
  previewRoomResize: (roomId: string, nextPoints: Point[]) => void;
  commitRoomResize: (
    roomId: string,
    previousPoints: Point[],
    nextPoints: Point[],
    options?: { editKind?: "wall-split" | "vertex-delete" }
  ) => void;
  splitWallAtPoint: (roomId: string, worldPoint: Point) => WallSplitResult | null;
  resetCamera: () => void;
  fitCameraToSelectedRoom: () => void;
  resetCanvas: () => void;
  undo: () => void;
  redo: () => void;
  undoBatch: (steps: number) => void;
  redoBatch: (steps: number) => void;
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
let activeWallSplitToast:
  | {
      id: string | number;
      roomId: string;
      nextPoints: Point[];
    }
  | null = null;
let activeVertexDeleteToast:
  | {
      id: string | number;
      roomId: string;
      nextPoints: Point[];
    }
  | null = null;
let activeConnectedFloorPromptToastId: string | number | null = null;
let activeFloorRenameToastId: string | number | null = null;
let activeDeleteFloorToastId: string | number | null = null;
let activeDeleteRulerToastId: string | number | null = null;
let activeClearRulersToastId: string | number | null = null;
let activeRulerRenameToastId: string | number | null = null;
let activeAddRulerToastId: string | number | null = null;

const DOCUMENT_AUTOSAVE_DEBOUNCE_MS = 300;
const DEV_SUBSCRIPTION_TIER_STORAGE_KEY = "spaceforge_dev_subscription_tier";

/**
 * Load dev subscription tier from localStorage.
 * Only loads if dev mode is enabled via env var.
 * Returns "Free" if not found or invalid.
 */
function loadDevSubscriptionTierFromStorage(): SubscriptionTier {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_DEV_SUBSCRIPTION_MODE !== "true") {
    return "Free";
  }

  try {
    const stored = window.localStorage.getItem(DEV_SUBSCRIPTION_TIER_STORAGE_KEY);
    if (stored && AVAILABLE_TIERS.includes(stored as SubscriptionTier)) {
      return stored as SubscriptionTier;
    }
  } catch {
    // localStorage may be unavailable in some environments
  }

  return "Free";
}

/**
 * Save dev subscription tier to localStorage.
 * Only saves if dev mode is enabled via env var.
 */
function saveDevSubscriptionTierToStorage(tier: SubscriptionTier): void {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_DEV_SUBSCRIPTION_MODE !== "true") {
    return;
  }

  try {
    window.localStorage.setItem(DEV_SUBSCRIPTION_TIER_STORAGE_KEY, tier);
  } catch {
    // localStorage may be unavailable in some environments
  }
}

/**
 * Get the effective subscription tier for gating logic.
 * If dev mode is enabled, uses the selected dev tier.
 * Otherwise defaults to Free (non-paying user baseline).
 */
function getEffectiveSubscriptionTier(
  isDevMode: boolean,
  devTier: SubscriptionTier
): SubscriptionTier {
  return isDevMode ? devTier : "Free";
}

/**
 * Get the effective max floors for the current user/tier.
 * Respects dev tier selection when dev mode is enabled.
 * Uses central tier configuration from @/lib/subscription/tiers.
 */
function getEffectiveMaxFloors(
  isDevMode: boolean,
  devTier: SubscriptionTier
): number {
  const effectiveTier = getEffectiveSubscriptionTier(isDevMode, devTier);
  const tierConfig = getTierConfig(effectiveTier);
  return tierConfig.maxFloors;
}

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
const EMPTY_RULER_DRAFT: RulerDraftState = {
  start: null,
  end: null,
};
const HISTORY_LIMIT = PERSISTED_HISTORY_STATE_LIMIT - 1;

function pushToPast(past: EditorCommand[], command: EditorCommand): EditorCommand[] {
  const nextPast = [...past, command];
  if (nextPast.length <= HISTORY_LIMIT) return nextPast;
  return nextPast.slice(nextPast.length - HISTORY_LIMIT);
}

function preserveHistoryForSelectionUpdate(
  state: EditorState,
  nextState: Partial<EditorState>
): Partial<EditorState> {
  const shouldClearFocusedRoom =
    !("focusedRoomId" in nextState) &&
    ("selectedNorthIndicator" in nextState ||
      "selectedRoomId" in nextState ||
      "selectedWall" in nextState ||
      "selectedOpening" in nextState ||
      "selectedInteriorAsset" in nextState ||
      "selection" in nextState);

  // Selection/focus/navigation updates are transient UI state and must never
  // create undo entries or alter canUndo/canRedo.
  return {
    ...nextState,
    ...(shouldClearFocusedRoom ? { focusedRoomId: null } : null),
    history: state.history,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  };
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

function createRulerMeasurementId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ruler-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/**
 * Generate a duplicate name with smart incrementing.
 * E.g., "Living Room" -> "Copy of Living Room" -> "Copy of Living Room 2" -> "Copy of Living Room 3"
 */
function generateDuplicateName(baseName: string, existingNames: Set<string>): string {
  const copyPrefix = "Copy of ";
  
  // Extract the original base name if this is already a copy
  let originalBase = baseName;
  if (baseName.startsWith(copyPrefix)) {
    // "Copy of Wardrobe 2" → extract "Wardrobe"
    originalBase = baseName.slice(copyPrefix.length);
    // Remove trailing number and space: "Wardrobe 2" → "Wardrobe"
    originalBase = originalBase.replace(/\s+\d+$/, "");
  }
  
  // Try "Copy of {originalBase}"
  const candidateName = `${copyPrefix}${originalBase}`;
  if (!existingNames.has(candidateName)) {
    return candidateName;
  }

  // Find next available number
  let counter = 2;
  while (existingNames.has(`${copyPrefix}${originalBase} ${counter}`)) {
    counter++;
  }

  return `${copyPrefix}${originalBase} ${counter}`;
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
    unitOrigin: getDocumentUnitOrigin(document),
    floorId: createdFloorId,
    name: room.name,
    roomType: room.roomType,
    roomColor: room.roomColor,
    heightMm: normalizeRoomHeightMm(room.heightMm, room.unitOrigin),
    points: room.points.map((point) => ({ ...point })),
    wallSegments: createExternalRoomWallSegments(room.points),
    openings: [],
    interiorAssets: [
      {
        ...cloneRoomInteriorAsset(asset),
        id: createdAssetId,
        unitOrigin: getDocumentUnitOrigin(document),
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
    unitOrigin: normalizeUnitOrigin(room.unitOrigin),
    floorId: room.floorId,
    name: room.name,
    roomType: room.roomType,
    roomColor: room.roomColor,
    heightMm: normalizeRoomHeightMm(room.heightMm, room.unitOrigin),
    points: room.points.map((point) => ({ ...point })),
    wallSegments: cloneRoomWallSegments(room.wallSegments),
    openings: cloneRoomOpenings(room.openings),
    interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
  };
}

function getDocumentUnitOrigin(document: Pick<DocumentState, "region">) {
  return normalizeUnitOrigin(document.region);
}

function getDuplicatedInteriorAssetCenter(
  room: Room,
  asset: RoomInteriorAsset,
  offsetMm: number
): Point | null {
  let duplicatedAsset = cloneRoomInteriorAsset(asset);

  const xOffsetCandidate: RoomInteriorAsset = {
    ...duplicatedAsset,
    xMm: duplicatedAsset.xMm + offsetMm,
  };
  if (isInteriorAssetWithinRoom(room, xOffsetCandidate)) {
    duplicatedAsset = xOffsetCandidate;
  }

  const yOffsetCandidate: RoomInteriorAsset = {
    ...duplicatedAsset,
    yMm: duplicatedAsset.yMm + offsetMm,
  };
  if (isInteriorAssetWithinRoom(room, yOffsetCandidate)) {
    duplicatedAsset = yOffsetCandidate;
  }

  if (isInteriorAssetWithinRoom(room, duplicatedAsset)) {
    return {
      x: duplicatedAsset.xMm,
      y: duplicatedAsset.yMm,
    };
  }

  return constrainInteriorAssetCenter(room, duplicatedAsset, {
    x: duplicatedAsset.xMm,
    y: duplicatedAsset.yMm,
  });
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

function getSmartRoomNameForFloor(
  document: DocumentState,
  baseName: string,
  room: Room
): string {
  return getSmartRoomName(baseName, document.rooms, {
    floorId: room.floorId ?? getNormalizedActiveFloorId(document),
    excludeRoomId: room.id,
  });
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
  nextPoints: Point[],
  unitOrigin?: UnitOrigin
): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            unitOrigin: normalizeUnitOrigin(unitOrigin ?? room.unitOrigin),
            points: nextPoints.map((point) => ({ ...point })),
          }
        : room
    ),
  };
}

function updateResizedRoomInDocument(
  document: DocumentState,
  roomId: string,
  previousPoints: Point[],
  nextPoints: Point[],
  nextInteriorAssets?: Room["interiorAssets"],
  unitOrigin?: UnitOrigin
): DocumentState {
  const adjustedPoints = getRoomPointsWithInternalWallSpacing(
    document.rooms,
    roomId,
    nextPoints,
    previousPoints
  );
  const rooms = document.rooms.map((room) =>
    room.id === roomId
      ? {
          ...room,
          unitOrigin: normalizeUnitOrigin(unitOrigin ?? room.unitOrigin),
          points: adjustedPoints.map((point) => ({ ...point })),
          interiorAssets: nextInteriorAssets
            ? cloneRoomInteriorAssets(nextInteriorAssets)
            : room.interiorAssets,
        }
      : room
  );

  return {
    ...document,
    rooms: reconcileSharedRoomWallSegments(rooms),
  };
}

function updateMovedRoomInDocument(
  document: DocumentState,
  roomId: string,
  previousPoints: Point[],
  nextPoints: Point[],
  unitOrigin?: UnitOrigin
): DocumentState {
  const adjustedPoints = getRoomPointsWithInternalWallSpacing(
    document.rooms,
    roomId,
    nextPoints,
    previousPoints
  );
  const delta = getRoomTranslationDelta(previousPoints, adjustedPoints);
  const rooms = document.rooms.map((room) =>
    room.id === roomId
      ? {
          ...room,
          unitOrigin: normalizeUnitOrigin(unitOrigin ?? room.unitOrigin),
          points: adjustedPoints.map((point) => ({ ...point })),
          interiorAssets: room.interiorAssets.map((asset) => ({
            ...cloneRoomInteriorAsset(asset),
            xMm: asset.xMm + delta.x,
            yMm: asset.yMm + delta.y,
          })),
        }
      : room
  );

  return {
    ...document,
    rooms: reconcileSharedRoomWallSegments(rooms),
  };
}

function updateRoomOpeningOffsetInDocument(
  document: DocumentState,
  roomId: string,
  openingId: string,
  nextOffsetMm: number,
  unitOrigin?: UnitOrigin
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
                    unitOrigin: normalizeUnitOrigin(unitOrigin ?? opening.unitOrigin),
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
  nextCenter: Point,
  unitOrigin?: UnitOrigin
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
                    unitOrigin: normalizeUnitOrigin(unitOrigin ?? asset.unitOrigin),
                    xMm: nextCenter.x,
                    yMm: nextCenter.y,
                  }
                : asset
            ),
          }
        : room
    ),
  };

  return syncConnectedStairTransformInDocument(nextDocument, roomId, assetId);
}

function moveInteriorAssetToRoomInDocument(
  document: DocumentState,
  fromRoomId: string,
  toRoomId: string,
  assetId: string,
  movedAsset: RoomInteriorAsset
): DocumentState {
  return {
    ...document,
    rooms: document.rooms.map((room) => {
      if (room.id === fromRoomId) {
        return {
          ...room,
          interiorAssets: room.interiorAssets.filter((asset) => asset.id !== assetId),
        };
      }
      if (room.id === toRoomId) {
        return {
          ...room,
          interiorAssets: [...room.interiorAssets, cloneRoomInteriorAsset(movedAsset)],
        };
      }
      return room;
    }),
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
    unitOrigin?: UnitOrigin;
    rotationDegrees?: number;
    arrowEnabled?: boolean;
    arrowDirection?: Room["interiorAssets"][number]["arrowDirection"];
    arrowLabel?: string;
    doorType?: "swing" | "sliding";
    doorConstraint?: number;
    shape?: "rectangular" | "round";
    sizePreset?: string;
    bowlType?: "single" | "1.5";
    hasDefaultDrainer?: boolean;
    drainerSide?: "depth" | "width";
    burnerCount?: 2 | 4 | 5 | 6;
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
                    unitOrigin: normalizeUnitOrigin(nextAsset.unitOrigin ?? clonedAssetDefaults(asset).unitOrigin),
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
                    doorType: nextAsset.doorType ?? clonedAssetDefaults(asset).doorType,
                    doorConstraint: nextAsset.doorConstraint ?? clonedAssetDefaults(asset).doorConstraint,
                    shape: nextAsset.shape ?? clonedAssetDefaults(asset).shape,
                    sizePreset: nextAsset.sizePreset ?? clonedAssetDefaults(asset).sizePreset,
                    ...(nextAsset.bowlType !== undefined && { bowlType: nextAsset.bowlType }),
                    ...(nextAsset.hasDefaultDrainer !== undefined && { hasDefaultDrainer: nextAsset.hasDefaultDrainer }),
                    ...(nextAsset.drainerSide !== undefined && { drainerSide: nextAsset.drainerSide }),
                    ...(nextAsset.burnerCount !== undefined && { burnerCount: nextAsset.burnerCount }),
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
                  ? {
                      ...rotatedPeerAsset,
                      unitOrigin: normalizeUnitOrigin(asset.unitOrigin),
                    }
                  : candidateAsset
              ),
            }
          : candidateRoom
      ),
    };
  } else {
    // Position/size/arrow sync: copy geometry and keep stair arrows opposed.
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
                      unitOrigin: normalizeUnitOrigin(asset.unitOrigin),
                      widthMm: asset.widthMm,
                      depthMm: asset.depthMm,
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

  const updatedAsset = updater(room, asset);
  if (!updatedAsset) return null;

  const nextAsset = {
    ...updatedAsset,
    unitOrigin: getDocumentUnitOrigin(state.document),
  };
  if (areRoomInteriorAssetsEqual([asset], [nextAsset])) return null;

  const didTransformConnectedStair =
    (asset.connectionId ?? null) !== null &&
    (asset.xMm !== nextAsset.xMm ||
      asset.yMm !== nextAsset.yMm ||
      asset.widthMm !== nextAsset.widthMm ||
      asset.depthMm !== nextAsset.depthMm ||
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
  nextWidthMm: number,
  unitOrigin?: UnitOrigin
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
                    unitOrigin: normalizeUnitOrigin(unitOrigin ?? opening.unitOrigin),
                    widthMm: nextWidthMm,
                  }
                : opening
            ),
          }
        : room
    ),
  };
}

function updateRoomOpeningWidthAndOffsetInDocument(
  document: DocumentState,
  roomId: string,
  openingId: string,
  nextWidthMm: number,
  nextOffsetMm: number,
  unitOrigin?: UnitOrigin
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
                    unitOrigin: normalizeUnitOrigin(unitOrigin ?? opening.unitOrigin),
                    widthMm: nextWidthMm,
                    offsetMm: nextOffsetMm,
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

function getRoomToastLabel(roomName: string | undefined): string {
  const label = roomName?.trim();
  return label ? label : "Room";
}

function showWallSplitToast(roomId: string, roomName: string, nextPoints: Point[]) {
  if (activeWallSplitToast) {
    toast.dismiss(activeWallSplitToast.id);
  }

  const message = `${getRoomToastLabel(roomName)} wall split`;
  const id = toast(message, {
    duration: 3200,
    onDismiss: () => {
      if (
        activeWallSplitToast?.roomId === roomId &&
        arePointListsEqual(activeWallSplitToast.nextPoints, nextPoints)
      ) {
        activeWallSplitToast = null;
      }
    },
    action: {
      label: "Undo",
      onClick: () => {
        const state = useEditorStore.getState();
        const latestCommand = state.history.past[state.history.past.length - 1];
        if (
          latestCommand?.type !== "resize-room" ||
          latestCommand.editKind !== "wall-split" ||
          latestCommand.roomId !== roomId ||
          !arePointListsEqual(latestCommand.nextPoints, nextPoints)
        ) {
          return;
        }

        state.undo();
        toast(`${getRoomToastLabel(latestCommand.roomName)} wall split undone`, { duration: 3200 });
      },
    },
  });

  activeWallSplitToast = {
    id,
    roomId,
    nextPoints: clonePoints(nextPoints),
  };
}

function dismissWallSplitToastForCommand(command: EditorCommand) {
  if (
    command.type !== "resize-room" ||
    command.editKind !== "wall-split" ||
    !activeWallSplitToast ||
    activeWallSplitToast.roomId !== command.roomId ||
    !arePointListsEqual(activeWallSplitToast.nextPoints, command.nextPoints)
  ) {
    return;
  }

  toast.dismiss(activeWallSplitToast.id);
  activeWallSplitToast = null;
}

function showVertexDeleteToast(roomId: string, roomName: string, nextPoints: Point[]) {
  if (activeVertexDeleteToast) {
    toast.dismiss(activeVertexDeleteToast.id);
  }

  const message = `${getRoomToastLabel(roomName)} corner removed`;
  const id = toast(message, {
    duration: 3200,
    onDismiss: () => {
      if (
        activeVertexDeleteToast?.roomId === roomId &&
        arePointListsEqual(activeVertexDeleteToast.nextPoints, nextPoints)
      ) {
        activeVertexDeleteToast = null;
      }
    },
    action: {
      label: "Undo",
      onClick: () => {
        const state = useEditorStore.getState();
        const latestCommand = state.history.past[state.history.past.length - 1];
        if (
          latestCommand?.type !== "resize-room" ||
          latestCommand.editKind !== "vertex-delete" ||
          latestCommand.roomId !== roomId ||
          !arePointListsEqual(latestCommand.nextPoints, nextPoints)
        ) {
          return;
        }

        state.undo();
        toast(`${getRoomToastLabel(latestCommand.roomName)} corner restored`, { duration: 3200 });
      },
    },
  });

  activeVertexDeleteToast = {
    id,
    roomId,
    nextPoints: clonePoints(nextPoints),
  };
}

function dismissVertexDeleteToastForCommand(command: EditorCommand) {
  if (
    command.type !== "resize-room" ||
    command.editKind !== "vertex-delete" ||
    !activeVertexDeleteToast ||
    activeVertexDeleteToast.roomId !== command.roomId ||
    !arePointListsEqual(activeVertexDeleteToast.nextPoints, command.nextPoints)
  ) {
    return;
  }

  toast.dismiss(activeVertexDeleteToast.id);
  activeVertexDeleteToast = null;
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

function getRulerToastLabel(name: string | undefined, fallbackIndex: number): string {
  const label = name?.trim();
  return label ? label : `Ruler ${fallbackIndex + 1}`;
}

function showAddRulerToast(rulerId: string, rulerIndex: number) {
  if (activeAddRulerToastId !== null) {
    toast.dismiss(activeAddRulerToastId);
  }
  const rulerLabel = `Ruler ${rulerIndex + 1}`;
  const id = toast(`Ruler "${rulerLabel}" added`, {
    duration: 5000,
    onDismiss: () => {
      if (activeAddRulerToastId === id) activeAddRulerToastId = null;
    },
    action: {
      label: "Undo",
      onClick: () => {
        const state = useEditorStore.getState();
        const latestCommand = state.history.past[state.history.past.length - 1];
        if (latestCommand?.type !== "add-ruler" || latestCommand.ruler.id !== rulerId) return;
        state.undo();
      },
    },
  });
  activeAddRulerToastId = id;
}

function dismissAddRulerToastForCommand(command: EditorCommand) {
  if (command.type !== "add-ruler" || activeAddRulerToastId === null) return;
  toast.dismiss(activeAddRulerToastId);
  activeAddRulerToastId = null;
}

function showDeleteRulerToast(rulerId: string, rulerLabel: string) {
  if (activeDeleteRulerToastId !== null) {
    toast.dismiss(activeDeleteRulerToastId);
  }
  const id = toast(`Ruler "${rulerLabel}" deleted`, {
    duration: 5000,
    onDismiss: () => {
      if (activeDeleteRulerToastId === id) activeDeleteRulerToastId = null;
    },
    action: {
      label: "Undo",
      onClick: () => {
        const state = useEditorStore.getState();
        const latestCommand = state.history.past[state.history.past.length - 1];
        if (latestCommand?.type !== "delete-ruler" || latestCommand.ruler.id !== rulerId) return;
        state.undo();
      },
    },
  });
  activeDeleteRulerToastId = id;
}

function dismissDeleteRulerToastForCommand(command: EditorCommand) {
  if (command.type !== "delete-ruler" || activeDeleteRulerToastId === null) return;
  toast.dismiss(activeDeleteRulerToastId);
  activeDeleteRulerToastId = null;
}

function showClearRulersToast(count: number) {
  if (activeClearRulersToastId !== null) {
    toast.dismiss(activeClearRulersToastId);
  }
  const id = toast(`${count} ruler${count !== 1 ? "s" : ""} cleared`, {
    duration: 5000,
    onDismiss: () => {
      if (activeClearRulersToastId === id) activeClearRulersToastId = null;
    },
    action: {
      label: "Undo",
      onClick: () => {
        const state = useEditorStore.getState();
        const latestCommand = state.history.past[state.history.past.length - 1];
        if (latestCommand?.type !== "bulk-delete") return;
        state.undo();
      },
    },
  });
  activeClearRulersToastId = id;
}

function dismissClearRulersToastForCommand(command: EditorCommand) {
  if (command.type !== "bulk-delete" || activeClearRulersToastId === null) return;
  toast.dismiss(activeClearRulersToastId);
  activeClearRulersToastId = null;
}

function showRulerRenameToast(rulerId: string, newName: string) {
  if (activeRulerRenameToastId !== null) {
    toast.dismiss(activeRulerRenameToastId);
  }
  const id = toast(`Ruler renamed to "${newName}"`, {
    duration: 5000,
    onDismiss: () => {
      if (activeRulerRenameToastId === id) activeRulerRenameToastId = null;
    },
    action: {
      label: "Undo",
      onClick: () => {
        const state = useEditorStore.getState();
        const latestCommand = state.history.past[state.history.past.length - 1];
        if (latestCommand?.type !== "update-ruler" || latestCommand.nextRuler.id !== rulerId) return;
        state.undo();
      },
    },
  });
  activeRulerRenameToastId = id;
}

function dismissRulerRenameToastForCommand(command: EditorCommand) {
  if (command.type !== "update-ruler" || activeRulerRenameToastId === null) return;
  toast.dismiss(activeRulerRenameToastId);
  activeRulerRenameToastId = null;
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

function getSelectedRulerIdAfterHistoryCommand(
  selectedRulerId: string | null,
  nextDocument: DocumentState,
  command: EditorCommand,
  direction: "undo" | "redo"
): string | null {
  const hasRuler = (rulerId: string | null) =>
    rulerId !== null && nextDocument.rulerMeasurements.some((ruler) => ruler.id === rulerId);

  if (command.type === "add-ruler") {
    return direction === "redo" ? command.ruler.id : null;
  }

  if (command.type === "delete-ruler") {
    return direction === "undo" ? command.ruler.id : null;
  }

  if (command.type === "update-ruler") {
    return command.nextRuler.id;
  }

  if (command.type === "bulk-delete") {
    const rulerCommands = command.deleteCommands.filter(
      (subCommand): subCommand is Extract<
        Extract<EditorCommand, { type: "bulk-delete" }>["deleteCommands"][number],
        { type: "delete-ruler" }
      > => subCommand.type === "delete-ruler"
    );
    if (rulerCommands.length === command.deleteCommands.length && rulerCommands.length > 0) {
      return direction === "undo" ? rulerCommands[0].ruler.id : null;
    }
  }

  return hasRuler(selectedRulerId) ? selectedRulerId : null;
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

    case "paste-interior-assets":
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
        if (sub.type === "delete-opening" || sub.type === "delete-interior-asset") {
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
    createOpeningId(),
    { unitOrigin: getDocumentUnitOrigin(state.document) }
  );
  if (!opening) return null;
  const openingWithUnitOrigin: RoomOpening = {
    ...opening,
    unitOrigin: getDocumentUnitOrigin(state.document),
  };

  const command: EditorCommand = {
    type: "add-opening",
    roomId: hostRoom.id,
    opening: openingWithUnitOrigin,
  };

  return {
    document: applyEditorCommand(state.document, command, "redo"),
    selectedWall: null,
    selectedOpening: { roomId: hostRoom.id, openingId: openingWithUnitOrigin.id },
    selectedInteriorAsset: null,
    selection: [{ type: "opening" as const, roomId: hostRoom.id, openingId: openingWithUnitOrigin.id }],
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

  const asset = createCenteredDefaultStair(room, createInteriorAssetId(), {
    unitOrigin: getDocumentUnitOrigin(state.document),
  });
  if (!asset) return null;
  const assetWithUnitOrigin: RoomInteriorAsset = {
    ...asset,
    unitOrigin: getDocumentUnitOrigin(state.document),
  };

  const command: EditorCommand = {
    type: "add-interior-asset",
    roomId: room.id,
    asset: assetWithUnitOrigin,
  };

  return {
    document: applyEditorCommand(state.document, command, "redo"),
    selectedInteriorAsset: { roomId: room.id, assetId: assetWithUnitOrigin.id },
    selectedOpening: null,
    selectedWall: null,
    selection: [{ type: "asset" as const, roomId: room.id, id: assetWithUnitOrigin.id }],
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
    nextOffsetMm: undefined, // Symmetric resize doesn't change offset
  };
}

function resolveOpeningResizeWidthFromHandle(
  document: DocumentState,
  roomId: string,
  openingId: string,
  draggedEdge: "start" | "end",
  cursorWorld: Point,
  gridSizeMm: number | null
) {
  const room = document.rooms.find((candidate) => candidate.id === roomId);
  const opening = room?.openings.find((candidate) => candidate.id === openingId);
  if (!room || !opening) return null;

  const result = getHandleAnchoredOpeningWidthAndOffsetForWorldPoint(
    room,
    opening,
    draggedEdge,
    cursorWorld,
    gridSizeMm ? { gridSizeMm } : undefined
  );
  if (!result) return null;

  return {
    room,
    opening,
    nextWidthMm: result.widthMm,
    nextOffsetMm: result.offsetMm,
    draggedEdge,
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

  const updatedOpening = updater(room, opening);
  if (!updatedOpening) return null;

  const nextOpening = {
    ...updatedOpening,
    unitOrigin: getDocumentUnitOrigin(state.document),
  };
  if (areRoomOpeningsEqual([opening], [nextOpening])) return null;

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
          region: document.region,
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
          rulerMeasurements: document.rulerMeasurements.map((ruler) => ({
            id: ruler.id,
            unitOrigin: normalizeUnitOrigin(ruler.unitOrigin),
            start: { ...ruler.start },
            end: { ...ruler.end },
            ...(ruler.hidden ? { hidden: true } : {}),
          })),
          rooms: document.rooms.map((room) => ({
            id: room.id,
            unitOrigin: normalizeUnitOrigin(room.unitOrigin),
            floorId: room.floorId,
            name: room.name,
            roomType: room.roomType,
            roomColor: room.roomColor,
            heightMm: normalizeRoomHeightMm(room.heightMm, room.unitOrigin),
            points: room.points.map((point) => ({ ...point })),
            wallSegments: cloneRoomWallSegments(room.wallSegments),
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
  // Start with hydrated settings from the project document
  let initialSettings: EditorSettings;
  
  if (hydrationSnapshot?.settings) {
    initialSettings = hydrationSnapshot.settings;
  } else {
    // No persisted settings - check if mobile and default HUD elements to off
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    if (isMobile) {
      initialSettings = {
        ...cloneEditorSettings(DEFAULT_EDITOR_SETTINGS),
        showCanvasHud: false,
        showMiniMap: false,
      };
    } else {
      initialSettings = cloneEditorSettings(DEFAULT_EDITOR_SETTINGS);
    }
  }

  // Apply global settings (sidebar density) to override project-specific value
  const globalSettings = loadGlobalSettings();
  return {
    ...initialSettings,
    sidebarDensity: globalSettings.sidebarDensity,
  };
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

function animateCameraToTarget(
  startCamera: CameraState,
  targetCamera: CameraState,
  setCamera: (camera: CameraState) => void
) {
  if (areCamerasEqual(startCamera, targetCamera)) return;
  if (hasActiveResetCameraAnimationTarget(targetCamera)) return;

  stopResetCameraAnimation();

  if (typeof window === "undefined") {
    setCamera(targetCamera);
    return;
  }

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

    setCamera(nextCamera);

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
}

function getEffectiveSnapStepMm(
  state: Pick<EditorState, "camera" | "settings">
): number {
  return getActiveSnapStepMm(state.camera);
}

function getResolvedRulerPointFromCursor(
  state: Pick<EditorState, "document" | "camera" | "settings" | "rulerDraft">,
  cursorWorld: Point,
  constraintMode: DrawConstraintMode
): Point {
  const activeSnapStepMm = getEffectiveSnapStepMm(state);

  // When placing the start point there is no anchor yet, so no magnetic wall
  // snapping — use pure grid snap, which matches the cursor HUD visual.
  if (!state.rulerDraft.start) {
    return getSnappedPointFromGuides(cursorWorld, activeSnapStepMm, null);
  }

  const magneticGuides = getMagneticSnapGuidesForSettings(
    getRoomsForActiveFloor(state.document),
    cursorWorld,
    state.camera,
    state.settings,
    { constraintMode }
  );
  const snappedCursorWorld = getSnappedPointFromGuides(
    cursorWorld,
    activeSnapStepMm,
    magneticGuides
  );

  return getConstrainedDrawPoint(
    state.rulerDraft.start,
    snappedCursorWorld,
    activeSnapStepMm,
    null,
    constraintMode
  );
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createInitialDocumentState(),
  camera: createInitialCameraState(),
  pendingProjectOpenCameraFit: false,
  pendingProjectOpenEmptyLayoutPixelsPerMm: null,
  settings: createInitialEditorSettings(),
  keyboardShortcutFeedbackEnabled: loadGlobalSettings().keyboardShortcutFeedbackEnabled,
  is45DegreeDrawingEnabled: false,
  setIs45DegreeDrawingEnabled: (enabled) =>
    set(() => ({ is45DegreeDrawingEnabled: enabled })),
  exportPreferences: createInitialEditorExportPreferences(),
  isDimensionsVisibilityOverrideActive: false,
  viewport: {
    width: 1,
    height: 1,
  },
  // Initial maxFloors respects subscription tier limits
  maxFloors: getEffectiveMaxFloors(
    process.env.NEXT_PUBLIC_DEV_SUBSCRIPTION_MODE === "true",
    loadDevSubscriptionTierFromStorage()
  ),
  setMaxFloors: (maxFloors) =>
    set((state) => {
      // Apply subscription tier limits: effective maxFloors is the minimum of
      // the project's maxFloors and the user's subscription tier limit
      const effectiveLimit = getEffectiveMaxFloors(
        state.isDevSubscriptionModeEnabled,
        state.devSubscriptionTier
      );
      const constrainedMaxFloors = Math.min(maxFloors, effectiveLimit);
      
      if (state.maxFloors === constrainedMaxFloors) return state;
      return {
        maxFloors: constrainedMaxFloors,
      };
    }),
  // Dev subscription mode flag: enabled only when NEXT_PUBLIC_DEV_SUBSCRIPTION_MODE="true"
  isDevSubscriptionModeEnabled: process.env.NEXT_PUBLIC_DEV_SUBSCRIPTION_MODE === "true",
  // Dev subscription tier: persisted to localStorage, defaults to Free
  devSubscriptionTier: loadDevSubscriptionTierFromStorage(),
  setDevSubscriptionTier: (tier) =>
    set((state) => {
      if (state.devSubscriptionTier === tier) return state;
      saveDevSubscriptionTierToStorage(tier);
      
      // When tier changes, always update maxFloors to match the new tier's limit
      const newMaxFloors = getEffectiveMaxFloors(state.isDevSubscriptionModeEnabled, tier);
      
      return {
        devSubscriptionTier: tier,
        maxFloors: newMaxFloors,
      };
    }),
  roomDraft: EMPTY_ROOM_DRAFT,
  isRulerMode: false,
  rulerDraft: EMPTY_RULER_DRAFT,
  selectedRulerId: null,
  selectedNorthIndicator: false,
  selectedRoomId: null,
  focusedRoomId: null,
  selectedWall: null,
  selectedOpening: null,
  selectedInteriorAsset: null,
  roomPresetPickerRoomId: null,
  selection: [],
  isCanvasInteractionActive: false,
  shouldFocusSelectedRoomNameInput: false,
  renameSession: null,
  interiorAssetRenameSession: null,
  interiorAssetArrowLabelSession: null,
  floorRenameSession: null,
  rulerRenameSession: null,
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

      // Use the same device-aware padding logic as the manual "fit view" button
      const isLandscape = nextViewport.width > nextViewport.height;
      const isMobile = nextViewport.height < 600;
      const paddingPx = isLandscape && !isMobile ? 48 : 96;

      return {
        viewport: nextViewport,
        camera: getCameraFitTarget({
          rooms: getRoomsForActiveFloor(state.document),
          viewport: nextViewport,
          emptyLayoutCamera: {
            ...DEFAULT_CAMERA_STATE,
            pixelsPerMm: state.pendingProjectOpenEmptyLayoutPixelsPerMm ?? DEFAULT_CAMERA_STATE.pixelsPerMm,
            rotationDegrees: normalizeCanvasRotationDegrees(state.document.canvasRotationDegrees),
          },
          paddingPx,
        }).camera,
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
      
      saveGlobalSettings({ keyboardShortcutFeedbackEnabled: isEnabled });

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
  updateProjectRegion: (region) =>
    set((state) => {
      const nextRegion = normalizeProjectRegion(region);
      if (normalizeProjectRegion(state.document.region) === nextRegion) {
        saveGlobalSettings({
          lastUsedProjectRegion: nextRegion,
          hasConfirmedProjectRegionPreference: true,
        });
        return state;
      }

      saveGlobalSettings({
        lastUsedProjectRegion: nextRegion,
        hasConfirmedProjectRegionPreference: true,
      });

      return {
        document: {
          ...state.document,
          region: nextRegion,
        },
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

      return preserveHistoryForSelectionUpdate(state, {
        isRulerMode: false,
        selectedRulerId: null,
        selectedNorthIndicator: true,
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      });
    }),
  clearNorthIndicatorSelection: () =>
    set((state) => {
      if (!state.selectedNorthIndicator) return state;
      return preserveHistoryForSelectionUpdate(state, {
        selectedNorthIndicator: false,
      });
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
  addFloor: (options) =>
    set((state) => {
      if (state.document.floors.length >= state.maxFloors) {
        console.warn(`Cannot add floor: project is already at the maximum of ${state.maxFloors} floors.`);
        return state;
      }

      const targetFloorIndex = options?.targetFloorId
        ? state.document.floors.findIndex((floor) => floor.id === options.targetFloorId)
        : -1;
      const insertIndex =
        targetFloorIndex === -1
          ? state.document.floors.length
          : options?.position === "above"
          ? targetFloorIndex
          : targetFloorIndex + 1;

      const nextFloorNumber = state.document.floors.length + 1;
      const floor: Floor = {
        id: createFloorId(),
        name: `Floor ${nextFloorNumber}`,
      };
      const command: EditorCommand = {
        type: "add-floor",
        floor,
        previousActiveFloorId: state.document.activeFloorId,
        insertIndex,
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
      
      // Check if we're just clearing selection on the same floor
      const isJustClearingSelection = 
        nextActiveFloorId === previousActiveFloorId && 
        (state.selectedRoomId !== null || state.selectedWall !== null || state.selectedOpening !== null || state.selectedInteriorAsset !== null);
      
      if (nextActiveFloorId === previousActiveFloorId && !isJustClearingSelection) return state;

      // Floor switches are not undoable — update activeFloorId directly without history entry.
      const nextDocument = nextActiveFloorId !== previousActiveFloorId 
        ? { ...state.document, activeFloorId: nextActiveFloorId }
        : state.document;

      return preserveHistoryForSelectionUpdate(state, {
        document: nextDocument,
        isRulerMode: false,
        selectedRulerId: null,
        selectedRoomId: null,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        selection: [{ type: "floor" as const, id: nextActiveFloorId }],
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      });
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
          isRulerMode: false,
          rulerDraft: EMPTY_RULER_DRAFT,
          selectedRulerId: null,
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
        isRulerMode: false,
        rulerDraft: EMPTY_RULER_DRAFT,
        selectedRulerId: null,
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
  setRulerMode: (isActive) =>
    set((state) => {
      if (state.isRulerMode === isActive) return state;

      return preserveHistoryForSelectionUpdate(state, {
        isRulerMode: isActive,
        roomDraft: isActive ? EMPTY_ROOM_DRAFT : state.roomDraft,
        rulerDraft: EMPTY_RULER_DRAFT,
        selectedRulerId: isActive ? state.selectedRulerId : null,
        selectedNorthIndicator: isActive ? false : state.selectedNorthIndicator,
        selectedRoomId: isActive ? null : state.selectedRoomId,
        selectedWall: isActive ? null : state.selectedWall,
        selectedOpening: isActive ? null : state.selectedOpening,
        selectedInteriorAsset: isActive ? null : state.selectedInteriorAsset,
        selection: isActive ? [] : state.selection,
        shouldFocusSelectedRoomNameInput: isActive ? false : state.shouldFocusSelectedRoomNameInput,
        renameSession: isActive ? null : state.renameSession,
        interiorAssetRenameSession: isActive ? null : state.interiorAssetRenameSession,
        interiorAssetArrowLabelSession: isActive ? null : state.interiorAssetArrowLabelSession,
        floorRenameSession: isActive ? null : state.floorRenameSession,
      });
    }),
  startOrCommitRulerFromCursor: (cursorWorld, options) =>
    set((state) => {
      if (!state.isRulerMode) return state;

      const constraintMode = options?.constraintMode ?? "orthogonal";
      const resolvedPoint = getResolvedRulerPointFromCursor(
        state,
        cursorWorld,
        constraintMode
      );

      if (!state.rulerDraft.start) {
        return preserveHistoryForSelectionUpdate(state, {
          rulerDraft: {
            start: { ...resolvedPoint },
            end: { ...resolvedPoint },
          },
        });
      }

      if (isZeroLengthSegment(state.rulerDraft.start, resolvedPoint)) {
        return state;
      }

      const ruler: RulerMeasurement = {
        id: createRulerMeasurementId(),
        unitOrigin: getDocumentUnitOrigin(state.document),
        start: { ...state.rulerDraft.start },
        end: { ...resolvedPoint },
      };
      const rulerIndex = state.document.rulerMeasurements.length;
      const command: EditorCommand = {
        type: "add-ruler",
        ruler,
        rulerIndex,
      };

      showAddRulerToast(ruler.id, rulerIndex);

      return {
        document: applyEditorCommand(state.document, command, "redo"),
        rulerDraft: EMPTY_RULER_DRAFT,
        selectedRulerId: ruler.id,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  updateRulerPreviewFromCursor: (cursorWorld, options) =>
    set((state) => {
      if (!state.isRulerMode || !state.rulerDraft.start) return state;

      const constraintMode = options?.constraintMode ?? "orthogonal";
      const resolvedPoint = getResolvedRulerPointFromCursor(
        state,
        cursorWorld,
        constraintMode
      );
      if (state.rulerDraft.end && pointsEqual(state.rulerDraft.end, resolvedPoint)) {
        return state;
      }

      return preserveHistoryForSelectionUpdate(state, {
        rulerDraft: {
          start: state.rulerDraft.start,
          end: { ...resolvedPoint },
        },
      });
    }),
  resetRulerDraft: () =>
    set((state) => {
      if (!state.rulerDraft.start && !state.rulerDraft.end) return state;
      return preserveHistoryForSelectionUpdate(state, {
        rulerDraft: EMPTY_RULER_DRAFT,
      });
    }),
  selectRulerById: (rulerId) =>
    set((state) => {
      if (rulerId !== null && !state.document.rulerMeasurements.some((ruler) => ruler.id === rulerId)) {
        return state;
      }
      if (state.selectedRulerId === rulerId) return state;

      return preserveHistoryForSelectionUpdate(state, {
        isRulerMode: true,
        selectedRulerId: rulerId,
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
        floorRenameSession: null,
        rulerRenameSession: null,
      });
    }),
  updateRulerMeasurement: (nextRuler) =>
    set((state) => {
      const previousRuler = state.document.rulerMeasurements.find((ruler) => ruler.id === nextRuler.id);
      if (!previousRuler) return state;
      if (
        previousRuler.start.x === nextRuler.start.x &&
        previousRuler.start.y === nextRuler.start.y &&
        previousRuler.end.x === nextRuler.end.x &&
        previousRuler.end.y === nextRuler.end.y &&
        Boolean(previousRuler.hidden) === Boolean(nextRuler.hidden)
      ) {
        return state;
      }

      const command: EditorCommand = {
        type: "update-ruler",
        previousRuler,
        nextRuler: {
          ...nextRuler,
          unitOrigin: getDocumentUnitOrigin(state.document),
        },
      };

      return {
        document: applyEditorCommand(state.document, command, "redo"),
        selectedRulerId: nextRuler.id,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  previewRulerMeasurement: (nextRuler) =>
    set((state) => {
      if (!state.document.rulerMeasurements.some((ruler) => ruler.id === nextRuler.id)) {
        return state;
      }

      return preserveHistoryForSelectionUpdate(state, {
        document: {
          ...state.document,
          rulerMeasurements: state.document.rulerMeasurements.map((ruler) =>
            ruler.id === nextRuler.id
              ? {
                  ...nextRuler,
                  start: { ...nextRuler.start },
                  end: { ...nextRuler.end },
                  ...(nextRuler.hidden ? { hidden: true } : {}),
                }
              : ruler
          ),
        },
      });
    }),
  commitRulerMeasurementUpdate: (previousRuler, nextRuler) =>
    set((state) => {
      if (!state.document.rulerMeasurements.some((ruler) => ruler.id === nextRuler.id)) {
        return state;
      }
      if (
        previousRuler.start.x === nextRuler.start.x &&
        previousRuler.start.y === nextRuler.start.y &&
        previousRuler.end.x === nextRuler.end.x &&
        previousRuler.end.y === nextRuler.end.y &&
        Boolean(previousRuler.hidden) === Boolean(nextRuler.hidden)
      ) {
        return state;
      }

      const command: EditorCommand = {
        type: "update-ruler",
        previousRuler,
        nextRuler: {
          ...nextRuler,
          unitOrigin: getDocumentUnitOrigin(state.document),
        },
      };

      return {
        document: applyEditorCommand(state.document, command, "redo"),
        selectedRulerId: nextRuler.id,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  toggleRulerHidden: (rulerId) =>
    set((state) => {
      const ruler = state.document.rulerMeasurements.find((candidate) => candidate.id === rulerId);
      if (!ruler) return state;

      const nextRuler: RulerMeasurement = {
        ...ruler,
        unitOrigin: normalizeUnitOrigin(ruler.unitOrigin),
        start: { ...ruler.start },
        end: { ...ruler.end },
        hidden: !ruler.hidden,
      };
      const command: EditorCommand = {
        type: "update-ruler",
        previousRuler: ruler,
        nextRuler,
      };

      return {
        document: applyEditorCommand(state.document, command, "redo"),
        selectedRulerId: rulerId,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  deleteRulerMeasurement: (rulerId) =>
    set((state) => {
      const previousIndex = state.document.rulerMeasurements.findIndex((ruler) => ruler.id === rulerId);
      if (previousIndex < 0) return state;

      const rulerToDelete = state.document.rulerMeasurements[previousIndex];
      const command: EditorCommand = {
        type: "delete-ruler",
        ruler: rulerToDelete,
        previousIndex,
      };

      showDeleteRulerToast(rulerId, getRulerToastLabel(rulerToDelete.name, previousIndex));

      return {
        document: applyEditorCommand(state.document, command, "redo"),
        selectedRulerId: state.selectedRulerId === rulerId ? null : state.selectedRulerId,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  clearRulerMeasurements: () =>
    set((state) => {
      if (state.document.rulerMeasurements.length === 0) return state;

      const rulerCount = state.document.rulerMeasurements.length;
      const command: EditorCommand = {
        type: "bulk-delete",
        deleteCommands: state.document.rulerMeasurements.map((ruler, previousIndex) => ({
          type: "delete-ruler",
          ruler: {
            ...ruler,
            start: { ...ruler.start },
            end: { ...ruler.end },
          },
          previousIndex,
        })),
      };

      showClearRulersToast(rulerCount);

      return {
        document: applyEditorCommand(state.document, command, "redo"),
        selectedRulerId: null,
        rulerDraft: EMPTY_RULER_DRAFT,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  setFocusedRoomId: (roomId) =>
    set((state) => {
      if (
        roomId !== null &&
        !getRoomsForActiveFloor(state.document).some((room) => room.id === roomId)
      ) {
        return state;
      }
      if (state.focusedRoomId === roomId) return state;

      return preserveHistoryForSelectionUpdate(state, {
        focusedRoomId: roomId,
      });
    }),
  selectRoomById: (roomId) =>
    set((state) => {
      const room = state.document.rooms.find((r) => r.id === roomId);
      
      // If room doesn't exist, do nothing
      if (roomId && !room) {
        return state;
      }
      
      const hasMatchingSelection = roomId
        ? state.selection.length === 1 &&
          state.selection[0]?.type === "room" &&
          state.selection[0].id === roomId
        : state.selection.length === 0;

      // If already in the correct state, return early
      if (
        state.selectedRoomId === roomId &&
        state.selectedWall === null &&
        state.selectedOpening === null &&
        state.selectedInteriorAsset === null &&
        hasMatchingSelection
      ) {
        return state;
      }

      // If the room is on a different floor, switch to that floor first
      const nextDocument = room && room.floorId !== state.document.activeFloorId
        ? { ...state.document, activeFloorId: room.floorId }
        : state.document;

      return preserveHistoryForSelectionUpdate(state, {
        document: nextDocument,
        isRulerMode: false,
        selectedRulerId: null,
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
      });
    }),
  selectWallByRoomId: (roomId, wall) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (!getRoomWallSegment(room, wall)) {
        // If wall doesn't exist, just select the room instead
        const nextDocument = room.floorId !== state.document.activeFloorId
          ? { ...state.document, activeFloorId: room.floorId }
          : state.document;
        return preserveHistoryForSelectionUpdate(state, {
          document: nextDocument,
          isRulerMode: false,
          selectedRulerId: null,
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
        });
      }

      if (
        state.selectedRoomId === roomId &&
        state.selectedWall?.roomId === roomId &&
        state.selectedWall.wall === wall
      ) {
        return state;
      }

      const nextDocument = room.floorId !== state.document.activeFloorId
        ? { ...state.document, activeFloorId: room.floorId }
        : state.document;

      return preserveHistoryForSelectionUpdate(state, {
        document: nextDocument,
        isRulerMode: false,
        selectedRulerId: null,
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
      });
    }),
  selectOpeningById: (roomId, openingId) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (!room.openings.some((opening) => opening.id === openingId)) return state;
      if (
        state.selectedRoomId === roomId &&
        state.selectedOpening?.roomId === roomId &&
        state.selectedOpening.openingId === openingId &&
        state.selection.some(
          (item) =>
            item.type === "opening" &&
            item.roomId === roomId &&
            item.openingId === openingId
        )
      ) {
        return state;
      }

      const nextDocument = room.floorId !== state.document.activeFloorId
        ? { ...state.document, activeFloorId: room.floorId }
        : state.document;

      return preserveHistoryForSelectionUpdate(state, {
        document: nextDocument,
        isRulerMode: false,
        selectedRulerId: null,
        selectedNorthIndicator: false,
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: { roomId, openingId },
        selectedInteriorAsset: null,
        selection: [{ type: "opening" as const, roomId, openingId }],
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      });
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

      const nextDocument = room.floorId !== state.document.activeFloorId
        ? { ...state.document, activeFloorId: room.floorId }
        : state.document;

      return preserveHistoryForSelectionUpdate(state, {
        document: nextDocument,
        isRulerMode: false,
        selectedRulerId: null,
        selectedNorthIndicator: false,
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: { roomId, assetId },
        selection: [{ type: "asset" as const, roomId, id: assetId }],
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      });
    }),
  clearSelectedOpening: () =>
    set((state) => {
      if (state.selectedOpening === null) return state;
      return preserveHistoryForSelectionUpdate(state, {
        isRulerMode: false,
        selectedRulerId: null,
        selectedOpening: null,
        selection: state.selectedRoomId ? [{ type: "room" as const, id: state.selectedRoomId }] : [],
      });
    }),
  clearSelectedInteriorAsset: () =>
    set((state) => {
      if (state.selectedInteriorAsset === null) return state;
      return preserveHistoryForSelectionUpdate(state, {
        isRulerMode: false,
        selectedRulerId: null,
        selectedInteriorAsset: null,
        selection: state.selectedRoomId ? [{ type: "room" as const, id: state.selectedRoomId }] : [],
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
      });
    }),
  clearSelectedWall: () =>
    set((state) => {
      if (state.selectedWall === null) return state;
      return preserveHistoryForSelectionUpdate(state, {
        isRulerMode: false,
        selectedRulerId: null,
        selectedWall: null,
        selection: state.selectedRoomId ? [{ type: "room" as const, id: state.selectedRoomId }] : [],
      });
    }),
  clearRoomSelection: () =>
    set((state) =>
      preserveHistoryForSelectionUpdate(state, {
        isRulerMode: false,
        selectedRulerId: null,
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
      })
    ),
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
            return existing.roomId === item.roomId && existing.openingId === item.openingId;
          }
          if (existing.type === "asset" && item.type === "asset") {
            return existing.roomId === item.roomId && existing.id === item.id;
          }
          if (existing.type === "floor" && item.type === "floor") return existing.id === item.id;
          return false;
        })
      ) {
        return state;
      }
      return preserveHistoryForSelectionUpdate(state, {
        selection: items,
      });
    }),
  clearSelection: () =>
    set((state) => {
      if (state.selection.length === 0) return state;
      return preserveHistoryForSelectionUpdate(state, {
        selection: [],
      });
    }),
  requestRoomPresetPicker: (roomId) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room || state.roomPresetPickerRoomId === roomId) return state;

      return preserveHistoryForSelectionUpdate(state, {
        roomPresetPickerRoomId: roomId,
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        selection: [{ type: "room" as const, id: roomId }],
        renameSession: null,
      });
    }),
  clearRoomPresetPicker: () =>
    set((state) => {
      if (state.roomPresetPickerRoomId === null) return state;
      return preserveHistoryForSelectionUpdate(state, {
        roomPresetPickerRoomId: null,
      });
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
          return existing.roomId === item.roomId && existing.openingId === item.openingId;
        }
        if (existing.type === "asset" && item.type === "asset") {
          return existing.roomId === item.roomId && existing.id === item.id;
        }
        if (existing.type === "floor" && item.type === "floor") return existing.id === item.id;
        return false;
      });
      if (exists) return state;
      return preserveHistoryForSelectionUpdate(state, {
        selection: [...state.selection, item],
      });
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
          return !(existing.roomId === item.roomId && existing.openingId === item.openingId);
        }
        if (existing.type === "asset" && item.type === "asset") {
          return !(existing.roomId === item.roomId && existing.id === item.id);
        }
        if (existing.type === "floor" && item.type === "floor") return existing.id !== item.id;
        return true;
      });
      if (nextSelection.length === state.selection.length) return state;
      return preserveHistoryForSelectionUpdate(state, {
        selection: nextSelection,
      });
    }),
  copySelection: () =>
    set((state) => {
      if (state.selection.length === 0) return state;

      const item = state.selection[0];
      if (!item) return state;

      if (item.type === "room") {
        const selectedRoomItems = state.selection.filter(
          (selectionItem): selectionItem is Extract<SharedSelectionItem, { type: "room" }> =>
            selectionItem.type === "room"
        );
        const rooms = selectedRoomItems
          .map((selectionItem) => state.document.rooms.find((r) => r.id === selectionItem.id))
          .filter((room): room is Room => Boolean(room))
          .map((room) => cloneRoom(room));
        if (rooms.length === 0) return state;

        return {
          clipboard: {
            type: "room",
            source: "copy" as const,
            rooms,
          },
        };
      }

      if (item.type === "asset") {
        const selectedAssetItems = state.selection.filter(
          (selectionItem): selectionItem is Extract<SharedSelectionItem, { type: "asset" }> =>
            selectionItem.type === "asset"
        );
        const assets = selectedAssetItems
          .map((selectionItem) => {
            const room = state.document.rooms.find((r) => r.id === selectionItem.roomId);
            const asset = room?.interiorAssets.find((a) => a.id === selectionItem.id);
            if (!room || !asset) return null;

            return {
              asset: cloneRoomInteriorAsset(asset),
              sourceRoomId: selectionItem.roomId,
            };
          })
          .filter((entry): entry is { asset: RoomInteriorAsset; sourceRoomId: string } =>
            Boolean(entry)
          );
        if (assets.length === 0) return state;

        const firstAsset = assets[0];
        if (!firstAsset) return state;

        return {
          clipboard: {
            type: "asset",
            source: "copy" as const,
            asset: firstAsset.asset,
            sourceRoomId: firstAsset.sourceRoomId,
            assets,
          },
        };
      }

      if (item.type === "opening") {
        const selectedOpeningItems = state.selection.filter(
          (selectionItem): selectionItem is Extract<SharedSelectionItem, { type: "opening" }> =>
            selectionItem.type === "opening"
        );
        const openings = selectedOpeningItems
          .map((selectionItem) => {
            const room = state.document.rooms.find((r) => r.id === selectionItem.roomId);
            const opening = room?.openings.find((o) => o.id === selectionItem.openingId);
            if (!room || !opening) return null;

            return {
              opening: cloneRoomOpening(opening),
              sourceRoomId: selectionItem.roomId,
            };
          })
          .filter((entry): entry is { opening: RoomOpening; sourceRoomId: string } =>
            Boolean(entry)
          );
        if (openings.length === 0) return state;

        const firstOpening = openings[0];
        if (!firstOpening) return state;

        // Show type-specific copy message
        const openingType = firstOpening.opening.type;
        const typeLabel = openingType === "door" ? "Door" : "Window";
        toast(`${typeLabel} copied to clipboard`);

        return {
          clipboard: {
            type: "opening",
            source: "copy" as const,
            opening: firstOpening.opening,
            sourceRoomId: firstOpening.sourceRoomId,
            openings,
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
        // Paste rooms with offset and smart naming for all inserted rooms
        const isCopy = state.clipboard.source === "copy";
        const existingRoomNames = new Set(state.document.rooms.map((r) => r.name));
        const pastedRooms: Room[] = [];

        for (const room of state.clipboard.rooms) {
          const newId = createRoomId();
          const pasteName = generateDuplicateName(room.name, existingRoomNames);
          existingRoomNames.add(pasteName);
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
          }

          pastedRooms.push(pastedRoom);
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
          selection: pastedRooms.map((room) => ({ type: "room" as const, id: room.id })),
          history: {
            past: pushToPast(state.history.past, command),
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      if (state.clipboard.type === "asset") {
        // Paste stair into the explicitly selected room on the active floor.
        const targetRoomId = state.selectedRoomId;

        if (!targetRoomId) {
          toast("Select a room on this floor first to paste here.");
          return state;
        }

        const targetRoom = state.document.rooms.find((r) => r.id === targetRoomId);
        if (!targetRoom || (targetRoom.floorId ?? activeFloorId) !== activeFloorId) {
          toast("Select a room on this floor first to paste here.");
          return state;
        }

        // Support both single-item and multi-item stair clipboard payloads
        // without requiring clipboard shape changes.
        const rawClipboard = state.clipboard as unknown as {
          asset?: RoomInteriorAsset | RoomInteriorAsset[];
          sourceRoomId?: string;
          assets?: Array<{ asset: RoomInteriorAsset; sourceRoomId: string }>;
        };
        const clipboardAssets = Array.isArray(rawClipboard.assets)
          ? rawClipboard.assets
          : Array.isArray(rawClipboard.asset)
            ? rawClipboard.asset.map((asset) => ({
                asset,
                sourceRoomId: rawClipboard.sourceRoomId ?? targetRoomId,
              }))
            : rawClipboard.asset
              ? [
                  {
                    asset: rawClipboard.asset,
                    sourceRoomId: rawClipboard.sourceRoomId ?? targetRoomId,
                  },
                ]
              : [];
        if (clipboardAssets.length === 0) return state;

        const existingAssetNames = new Set(targetRoom.interiorAssets.map((a) => a.name));
        const isCopyStair = state.clipboard.source === "copy";
        const pastedItems: Array<{ asset: RoomInteriorAsset; sourceRoomId: string }> = [];

        for (const stairClipboardItem of clipboardAssets) {
          const sourceAsset = stairClipboardItem.asset;
          const newAssetId = createInteriorAssetId();
          const pasteName = generateDuplicateName(sourceAsset.name, existingAssetNames);
          existingAssetNames.add(pasteName);

          let pastedAsset: RoomInteriorAsset = {
            ...cloneRoomInteriorAsset(sourceAsset),
            id: newAssetId,
            name: pasteName,
            xMm: isCopyStair ? sourceAsset.xMm + PASTE_OFFSET_MM : sourceAsset.xMm,
            yMm: isCopyStair ? sourceAsset.yMm + PASTE_OFFSET_MM : sourceAsset.yMm,
          };

          // Bounds check: nudge into room if out of bounds
          if (!isInteriorAssetWithinRoom(targetRoom, pastedAsset)) {
            const constrained = constrainInteriorAssetCenter(targetRoom, pastedAsset, {
              x: pastedAsset.xMm,
              y: pastedAsset.yMm,
            });
            if (constrained) {
              pastedAsset = { ...pastedAsset, xMm: constrained.x, yMm: constrained.y };
            } else {
              // Room is too small — abort and notify
              toast("Asset doesn't fit in that room.");
              return state;
            }
          }

          pastedItems.push({
            asset: pastedAsset,
            sourceRoomId: stairClipboardItem.sourceRoomId,
          });
        }

        const newSelection: SharedSelectionItem[] = [];
        for (const pastedItem of pastedItems) {
          newSelection.push({
            type: "asset" as const,
            roomId: targetRoomId,
            id: pastedItem.asset.id,
          });
        }

        const command: EditorCommand = {
          type: "paste-interior-assets",
          pastedAssets: pastedItems.map((item) => ({
            asset: cloneRoomInteriorAsset(item.asset),
            sourceRoomId: item.sourceRoomId,
          })),
          targetRoomId,
        };

        const nextDocument = applyEditorCommand(state.document, command, "redo");

        return {
          document: nextDocument,
          selectedRoomId: targetRoomId,
          selectedWall: null,
          selectedOpening: null,
          selectedInteriorAsset:
            pastedItems.length > 0
              ? { roomId: targetRoomId, assetId: pastedItems[pastedItems.length - 1].asset.id }
              : null,
          selection: newSelection,
          history: {
            past: pushToPast(state.history.past, command),
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      if (state.clipboard.type === "opening") {
        // Require a wall to be selected for opening paste
        if (!state.selectedWall) {
          toast("Select a wall to paste the opening here.");
          return state;
        }

        const targetRoomId = state.selectedWall.roomId;
        const targetRoom = state.document.rooms.find((r) => r.id === targetRoomId);
        if (!targetRoom || (targetRoom.floorId ?? activeFloorId) !== activeFloorId) {
          toast("Select a wall on this floor first to paste here.");
          return state;
        }

        // Validate target wall exists
        if (!getRoomWallSegment(targetRoom, state.selectedWall.wall)) {
          toast("The selected wall no longer exists.");
          return state;
        }

        const targetWall = state.selectedWall.wall;
        const targetWallSegment = getRoomWallSegment(targetRoom, targetWall);
        if (!targetWallSegment) return state;

        // Get all openings from clipboard (support both single and multi-opening payloads)
        const clipboardOpenings = state.clipboard.openings ?? [
          { opening: state.clipboard.opening, sourceRoomId: state.clipboard.sourceRoomId },
        ];
        if (clipboardOpenings.length === 0) return state;

        const isCopyOpening = state.clipboard.source === "copy";
        const pastedOpenings: RoomOpening[] = [];
        let nextDocument = state.document;
        let nextPast = state.history.past;

        for (const openingClipboardItem of clipboardOpenings) {
          const sourceOpening = openingClipboardItem.opening;
          const sourceRoomId = openingClipboardItem.sourceRoomId;
          const sourceRoom = state.document.rooms.find((r) => r.id === sourceRoomId);

          const newOpeningId = createOpeningId();

          // Calculate offset for paste:
          // - If pasting from same wall to same wall and it's a copy, try to offset
          // - Otherwise, use source offset (will be constrained to new wall)
          let pasteOffsetMm = sourceOpening.offsetMm;
          if (
            isCopyOpening &&
            sourceRoom &&
            sourceRoom.id === targetRoom.id &&
            sourceOpening.wall === targetWall
          ) {
            // Same wall, same room, copy — try to offset by PASTE_OFFSET_MM
            const candidateOffset = sourceOpening.offsetMm + PASTE_OFFSET_MM;
            pasteOffsetMm = candidateOffset;
          }

          // Constrain offset to valid range for target wall
          const constrainedOffsetMm = constrainOpeningOffset(
            { widthMm: sourceOpening.widthMm },
            pasteOffsetMm,
            targetWallSegment.lengthMm
          );

          const pastedOpening: RoomOpening = {
            ...cloneRoomOpening(sourceOpening),
            id: newOpeningId,
            wall: targetWall,
            offsetMm: constrainedOffsetMm,
          };

          // Create add-opening command with paste source
          const command: EditorCommand = {
            type: "add-opening",
            roomId: targetRoomId,
            opening: cloneRoomOpening(pastedOpening),
            source: "paste",
          };

          nextDocument = applyEditorCommand(nextDocument, command, "redo");
          nextPast = pushToPast(nextPast, command);
          pastedOpenings.push(pastedOpening);
        }

        // Build selection for all pasted openings
        const newSelection: SharedSelectionItem[] = pastedOpenings.map((opening) => ({
          type: "opening" as const,
          roomId: targetRoomId,
          openingId: opening.id,
        }));

        // Show calm message with type-awareness
        const messageCount = pastedOpenings.length;
        let message: string;
        if (messageCount === 1) {
          const openingType = pastedOpenings[0].type;
          const typeLabel = openingType === "door" ? "Door" : "Window";
          message = `${typeLabel} pasted`;
        } else {
          // Check if all openings are the same type
          const allDoors = pastedOpenings.every((o) => o.type === "door");
          const allWindows = pastedOpenings.every((o) => o.type === "window");
          if (allDoors) {
            message = `${messageCount} doors pasted`;
          } else if (allWindows) {
            message = `${messageCount} windows pasted`;
          } else {
            message = `${messageCount} openings pasted`;
          }
        }
        toast(message, { duration: 3200 });

        return {
          document: nextDocument,
          selectedRoomId: targetRoomId,
          selectedWall: null,
          selectedOpening:
            pastedOpenings.length > 0
              ? { roomId: targetRoomId, openingId: pastedOpenings[pastedOpenings.length - 1].id }
              : null,
          selectedInteriorAsset: null,
          selection: newSelection,
          history: {
            past: nextPast,
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

      if (item.type === "asset") {
        const selectedAssetItems = state.selection.filter(
          (selectionItem): selectionItem is Extract<SharedSelectionItem, { type: "asset" }> =>
            selectionItem.type === "asset"
        );
        const assetsToCut = selectedAssetItems
          .map((selectionItem) => {
            const room = state.document.rooms.find((r) => r.id === selectionItem.roomId);
            const asset = room?.interiorAssets.find((a) => a.id === selectionItem.id);
            if (!room || !asset) return null;

            return {
              asset: cloneRoomInteriorAsset(asset),
              sourceRoomId: selectionItem.roomId,
            };
          })
          .filter((entry): entry is { asset: RoomInteriorAsset; sourceRoomId: string } =>
            Boolean(entry)
          );
        if (assetsToCut.length === 0) return state;

        let nextDocument = state.document;
        let nextPast = state.history.past;
        for (const assetToCut of assetsToCut) {
          const command: EditorCommand = {
            type: "cut-interior-asset",
            cutAsset: cloneRoomInteriorAsset(assetToCut.asset),
            roomId: assetToCut.sourceRoomId,
          };
          nextDocument = applyEditorCommand(nextDocument, command, "redo");
          nextPast = pushToPast(nextPast, command);
        }

        const firstAsset = assetsToCut[0];
        if (!firstAsset) return state;

        return {
          clipboard: {
            type: "asset",
            source: "cut" as const,
            asset: cloneRoomInteriorAsset(firstAsset.asset),
            sourceRoomId: firstAsset.sourceRoomId,
            assets: assetsToCut.map((assetToCut) => ({
              asset: cloneRoomInteriorAsset(assetToCut.asset),
              sourceRoomId: assetToCut.sourceRoomId,
            })),
          },
          document: nextDocument,
          selectedRoomId: firstAsset.sourceRoomId,
          selectedInteriorAsset: null,
          selection: [{ type: "room" as const, id: firstAsset.sourceRoomId }],
          history: {
            past: nextPast,
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      if (item.type === "opening") {
        const selectedOpeningItems = state.selection.filter(
          (selectionItem): selectionItem is Extract<SharedSelectionItem, { type: "opening" }> =>
            selectionItem.type === "opening"
        );
        const openingsToCut = selectedOpeningItems
          .map((selectionItem) => {
            const room = state.document.rooms.find((r) => r.id === selectionItem.roomId);
            const opening = room?.openings.find((o) => o.id === selectionItem.openingId);
            if (!room || !opening) return null;

            return {
              opening: cloneRoomOpening(opening),
              sourceRoomId: selectionItem.roomId,
            };
          })
          .filter((entry): entry is { opening: RoomOpening; sourceRoomId: string } =>
            Boolean(entry)
          );
        if (openingsToCut.length === 0) return state;

        let nextDocument = state.document;
        let nextPast = state.history.past;
        for (const openingToCut of openingsToCut) {
          const command: EditorCommand = {
            type: "delete-opening",
            roomId: openingToCut.sourceRoomId,
            opening: cloneRoomOpening(openingToCut.opening),
          };
          nextDocument = applyEditorCommand(nextDocument, command, "redo");
          nextPast = pushToPast(nextPast, command);
        }

        const firstOpening = openingsToCut[0];
        if (!firstOpening) return state;

        // Show type-specific cut message
        const openingType = firstOpening.opening.type;
        const typeLabel = openingType === "door" ? "Door" : "Window";
        toast(`${typeLabel} cut to clipboard`);

        return {
          clipboard: {
            type: "opening",
            source: "cut" as const,
            opening: cloneRoomOpening(firstOpening.opening),
            sourceRoomId: firstOpening.sourceRoomId,
            openings: openingsToCut.map((openingToCut) => ({
              opening: cloneRoomOpening(openingToCut.opening),
              sourceRoomId: openingToCut.sourceRoomId,
            })),
          },
          document: nextDocument,
          selectedRoomId: firstOpening.sourceRoomId,
          selectedOpening: null,
          selection: [{ type: "room" as const, id: firstOpening.sourceRoomId }],
          history: {
            past: nextPast,
            future: [],
          },
          canUndo: true,
          canRedo: false,
        };
      }

      return state;
    }),
  duplicateSelection: (options?: { isMirror?: boolean }) =>
    set((state) => {
      if (state.selection.length === 0) return state;

      const isMirror = options?.isMirror ?? false;
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
      const duplicatedOpenings: Array<{ roomId: string; opening: RoomOpening }> = [];
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

        if (item.type === "asset") {
          const sourceRoom = state.document.rooms.find((r) => r.id === item.roomId);
          const sourceAsset = sourceRoom?.interiorAssets.find((a) => a.id === item.id);
          if (!sourceRoom || !sourceAsset) continue;

          // Create duplicate with new ID and smart name
          const roomAssetNames = existingAssetNames.get(sourceRoom.id) ?? new Set();
          const duplicateName = generateDuplicateName(sourceAsset.name, roomAssetNames);
          roomAssetNames.add(duplicateName);
          existingAssetNames.set(sourceRoom.id, roomAssetNames);

          const newAssetId = createInteriorAssetId();
          const duplicateCenter = getDuplicatedInteriorAssetCenter(
            sourceRoom,
            sourceAsset,
            DUPLICATE_OFFSET_MM
          );
          if (!duplicateCenter) continue;

          const duplicateAsset: RoomInteriorAsset = {
            ...cloneRoomInteriorAsset(sourceAsset),
            id: newAssetId,
            name: duplicateName,
            xMm: duplicateCenter.x,
            yMm: duplicateCenter.y,
          };

          duplicatedAssets.push({
            roomId: sourceRoom.id,
            asset: duplicateAsset,
          });
          newSelection.push({ type: "asset" as const, roomId: sourceRoom.id, id: newAssetId });
        }

        if (item.type === "opening") {
          const sourceRoom = state.document.rooms.find((r) => r.id === item.roomId);
          const sourceOpening = sourceRoom?.openings.find((o) => o.id === item.openingId);
          if (!sourceRoom || !sourceOpening) continue;

          // Get the wall segment for offset constraint
          const wallSegment = getRoomWallSegment(sourceRoom, sourceOpening.wall);
          if (!wallSegment) continue;

          const newOpeningId = createOpeningId();
          const candidateOffset = sourceOpening.offsetMm + DUPLICATE_OFFSET_MM;
          
          // Constrain offset to valid range on same wall
          const constrainedOffsetMm = constrainOpeningOffset(
            { widthMm: sourceOpening.widthMm },
            candidateOffset,
            wallSegment.lengthMm
          );

          // For mirror duplicate: flip hingeSide for doors, keep for windows
          let flippedHingeSide = sourceOpening.hingeSide;
          if (isMirror && sourceOpening.type === "door") {
            flippedHingeSide = sourceOpening.hingeSide === "start" ? "end" : "start";
          }

          const duplicateOpening: RoomOpening = {
            ...cloneRoomOpening(sourceOpening),
            id: newOpeningId,
            offsetMm: constrainedOffsetMm,
            hingeSide: flippedHingeSide,
          };

          duplicatedOpenings.push({
            roomId: sourceRoom.id,
            opening: duplicateOpening,
          });
          newSelection.push({
            type: "opening" as const,
            roomId: sourceRoom.id,
            openingId: newOpeningId,
          });
        }
      }

      // If nothing was duplicated, return unchanged state
      if (
        duplicatedRooms.length === 0 &&
        duplicatedAssets.length === 0 &&
        duplicatedOpenings.length === 0
      ) {
        if (state.selection.length > 0) {
          toast("Could not duplicate: selected items not found in document");
        }
        return state;
      }

      const command: EditorCommand = {
        type: "bulk-duplicate",
        duplicatedRooms,
        duplicatedAssets,
        duplicatedOpenings:
          duplicatedOpenings.length > 0 ? duplicatedOpenings : undefined,
        isMirror: isMirror || undefined,
      };

      const newDocument = applyEditorCommand(state.document, command, "redo");

      // Show success message with type-awareness
      if (duplicatedOpenings.length > 0 && duplicatedRooms.length === 0 && duplicatedAssets.length === 0) {
        if (isMirror) {
          // Mirror duplicate is doors-only
          const doorCount = duplicatedOpenings.length;
          toast(
            doorCount === 1
              ? "Door mirror duplicated"
              : `${doorCount} doors mirror duplicated`
          );
        } else {
          // Regular duplicate with type awareness
          const messageCount = duplicatedOpenings.length;
          let message: string;
          if (messageCount === 1) {
            const openingType = duplicatedOpenings[0].opening.type;
            const typeLabel = openingType === "door" ? "Door" : "Window";
            message = `${typeLabel} duplicated`;
          } else {
            // Check if all openings are the same type
            const allDoors = duplicatedOpenings.every((o) => o.opening.type === "door");
            const allWindows = duplicatedOpenings.every((o) => o.opening.type === "window");
            if (allDoors) {
              message = `${messageCount} doors duplicated`;
            } else if (allWindows) {
              message = `${messageCount} windows duplicated`;
            } else {
              message = `${messageCount} openings duplicated`;
            }
          }
          toast(message);
        }
      }

      return {
        ...state,
        document: newDocument,
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

      const hasAssetSelection = state.selection.some((item) => item.type === "asset");
      const selectedTargetRoom = state.selectedRoomId
        ? state.document.rooms.find((room) => room.id === state.selectedRoomId)
        : null;
      if (hasAssetSelection) {
        if (!selectedTargetRoom || selectedTargetRoom.floorId !== targetFloorId) {
          toast("Select a room on this floor first to paste here.");
          return state;
        }
      }

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

        if (item.type === "asset") {
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
        targetRoomId: selectedTargetRoom?.id ?? null,
        movedRooms,
        movedAssets,
      };

      const nextDocument = applyEditorCommand(state.document, command, "redo");
      const nextSelection = state.selection.map((item) => {
        if (item.type !== "asset") return item;
        if (!selectedTargetRoom) return item;
        return {
          type: "asset" as const,
          roomId: selectedTargetRoom.id,
          id: item.id,
        };
      });

      return {
        document: nextDocument,
        selectedRoomId: movedRooms[0]?.room.id ?? selectedTargetRoom?.id ?? state.selectedRoomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        selection: nextSelection,
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

      const nextName = name.length > 0 ? name : DEFAULT_STAIR_NAME;
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
          initialArrowLabel: asset.arrowLabel ?? "",
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
              initialArrowLabel: asset.arrowLabel ?? "",
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
  startRulerRenameSession: (rulerId) =>
    set((state) => {
      if (state.isCanvasInteractionActive) return state;
      const ruler = state.document.rulerMeasurements.find((r) => r.id === rulerId);
      if (!ruler) return state;
      if (state.rulerRenameSession?.rulerId === rulerId) return state;

      return {
        rulerRenameSession: {
          rulerId,
          initialName: ruler.name ?? "",
        },
      };
    }),
  updateRulerRenameDraft: (rulerId, name) =>
    set((state) => {
      if (state.isCanvasInteractionActive) return state;
      const ruler = state.document.rulerMeasurements.find((r) => r.id === rulerId);
      if (!ruler) return state;

      const rulerRenameSession =
        state.rulerRenameSession?.rulerId === rulerId
          ? state.rulerRenameSession
          : { rulerId, initialName: ruler.name ?? "" };

      return {
        document: {
          ...state.document,
          rulerMeasurements: state.document.rulerMeasurements.map((r) =>
            r.id === rulerId ? { ...r, name } : r
          ),
        },
        rulerRenameSession,
      };
    }),
  commitRulerRenameSession: () =>
    set((state) => {
      const session = state.rulerRenameSession;
      if (!session) return state;

      const ruler = state.document.rulerMeasurements.find((r) => r.id === session.rulerId);
      if (!ruler) return { rulerRenameSession: null };

      const didNameChange = (ruler.name ?? "") !== session.initialName;
      if (!didNameChange) return { rulerRenameSession: null };

      const previousRuler: RulerMeasurement = { ...ruler, name: session.initialName };
      const nextRuler: RulerMeasurement = {
        ...ruler,
        unitOrigin: getDocumentUnitOrigin(state.document),
      };
      const command: EditorCommand = {
        type: "update-ruler",
        previousRuler,
        nextRuler,
      };

      const displayName = (ruler.name ?? "").trim() || "Ruler";
      showRulerRenameToast(session.rulerId, displayName);

      return {
        rulerRenameSession: null,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  cancelRulerRenameSession: () =>
    set((state) => {
      const session = state.rulerRenameSession;
      if (!session) return state;

      const ruler = state.document.rulerMeasurements.find((r) => r.id === session.rulerId);
      const nextDocument =
        ruler && (ruler.name ?? "") !== session.initialName
          ? {
              ...state.document,
              rulerMeasurements: state.document.rulerMeasurements.map((r) =>
                r.id === session.rulerId ? { ...r, name: session.initialName } : r
              ),
            }
          : state.document;

      return {
        document: nextDocument,
        rulerRenameSession: null,
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
          room: cloneRoom(room),
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
        room: cloneRoom(room),
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

      // Capture asset type name for toast before deletion
      const assetTypeName = getInteriorAssetDisplayName(asset.type, asset.unitOrigin);

      // Show deletion toast on next tick with undo action
      setTimeout(() => {
        toast(`${assetTypeName} deleted`, {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              const currentState = useEditorStore.getState();
              const latestCommand = currentState.history.past[currentState.history.past.length - 1];
              if (latestCommand?.type !== "delete-interior-asset") return;
              currentState.undo();
            },
          },
        });
      }, 0);

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
                wallSegments: cloneRoomWallSegments(room.wallSegments),
                openings: cloneRoomOpenings(room.openings),
                interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
              },
              previousIndex: roomIndex,
            } as EditorCommand);
            roomsToDelete.add(room.id);
            roomCount++;
          }
        } else if (item.type === "opening" && item.roomId && item.openingId) {
          // Only delete openings from rooms that aren't being deleted
          if (!roomsToDelete.has(item.roomId)) {
            const room = state.document.rooms.find((r) => r.id === item.roomId);
            const opening = room?.openings.find((o) => o.id === item.openingId);
            if (room && opening) {
              deleteCommands.push({
                type: "delete-opening",
                roomId: room.id,
                opening: cloneRoomOpening(opening),
              } as EditorCommand);
            }
          }
        } else if (item.type === "asset" && item.roomId && item.id) {
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
      // Count door vs window deletions for opening-specific messaging
      let doorCount = 0;
      let windowCount = 0;
      for (const command of deleteCommands) {
        if (command.type === "delete-opening") {
          if (command.opening.type === "door") {
            doorCount++;
          } else {
            windowCount++;
          }
        }
      }

      const parts = [];
      if (roomCount > 0) parts.push(`${roomCount} room${roomCount > 1 ? "s" : ""}`);
      if (doorCount > 0) parts.push(`${doorCount} door${doorCount > 1 ? "s" : ""}`);
      if (windowCount > 0) parts.push(`${windowCount} window${windowCount > 1 ? "s" : ""}`);
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
  applyRoomPreset: (roomId, presetId) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const preset = getRoomPresetById(presetId);
      if (!room || !preset) return state;

      const baseName = getRegionalRoomPresetBaseName(preset, state.document.region);
      const nextName = getSmartRoomNameForFloor(state.document, baseName, room);
      const previousRoom = {
        name: room.name,
        roomType: room.roomType,
        roomColor: room.roomColor,
      };
      const nextRoom = {
        name: nextName,
        roomType: preset.id,
        roomColor: preset.color,
      };
      if (
        previousRoom.name === nextRoom.name &&
        previousRoom.roomType === nextRoom.roomType &&
        previousRoom.roomColor === nextRoom.roomColor
      ) {
        return state;
      }

      const command: EditorCommand = {
        type: "update-room-preset",
        roomId,
        previousRoom,
        nextRoom,
      };
      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        renameSession: null,
        roomPresetPickerRoomId: null,
        shouldFocusSelectedRoomNameInput: false,
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  applyOtherRoomPreset: (roomId) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;

      const nextName = getSmartRoomNameForFloor(state.document, "Room", room);
      const previousRoom = {
        name: room.name,
        roomType: room.roomType,
        roomColor: room.roomColor,
      };
      const nextRoom = {
        name: nextName,
        roomType: undefined,
        roomColor: ROOM_PRESET_OTHER_COLOR,
      };

      const command: EditorCommand = {
        type: "update-room-preset",
        roomId,
        previousRoom,
        nextRoom,
      };
      const nextDocument = applyEditorCommand(state.document, command, "redo");

      return {
        document: nextDocument,
        renameSession: null,
        roomPresetPickerRoomId: null,
        shouldFocusSelectedRoomNameInput: true,
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
  placeAssetInSelectedRoom: (assetType: InteriorAssetType) => {
    let placedAssetTypeName: string | null = null;
    
    set((state) => {
      if (!state.selectedRoomId) return state;
      const room = state.document.rooms.find((candidate) => candidate.id === state.selectedRoomId);
      if (!room) return state;

      let asset: RoomInteriorAsset | null = null;

      switch (assetType) {
        case "stairs":
          asset = createCenteredDefaultStair(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Stairs";
          break;
        case "bed":
          asset = createCenteredDefaultBed(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Bed";
          break;
        case "sofa":
          asset = createCenteredDefaultSofa(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Sofa";
          break;
        case "wardrobe":
          asset = createCenteredDefaultWardrobe(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Wardrobe";
          break;
        case "dining-table":
          asset = createCenteredDefaultDiningTable(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Table";
          break;
        case "kitchen-unit":
          asset = createCenteredDefaultKitchenUnit(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Kitchen unit";
          break;
        case "kitchen-appliance":
          asset = createCenteredDefaultKitchenAppliance(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Kitchen appliance";
          break;
        case "hob":
          asset = createCenteredDefaultHob(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Stove top";
          break;
        case "sink":
          asset = createCenteredDefaultSink(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Sink";
          break;
        case "toilet":
          asset = createCenteredDefaultToilet(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Toilet";
          break;
        case "shower":
          asset = createCenteredDefaultShower(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Shower";
          break;
        case "bath":
          asset = createCenteredDefaultBath(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Bath";
          break;
        case "basin":
          asset = createCenteredDefaultBasin(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Basin";
          break;
        case "desk":
          asset = createCenteredDefaultDesk(room, createInteriorAssetId(), {
            unitOrigin: getDocumentUnitOrigin(state.document),
          });
          placedAssetTypeName = "Desk";
          break;
      }

      if (!asset) return state;
      placedAssetTypeName = getInteriorAssetDisplayName(assetType, getDocumentUnitOrigin(state.document));
      const assetWithUnitOrigin: RoomInteriorAsset = {
        ...asset,
        unitOrigin: getDocumentUnitOrigin(state.document),
      };
      
      // Show toast on next tick to allow state update first
      if (placedAssetTypeName) {
        setTimeout(() => {
          toast(`${placedAssetTypeName} added`, { duration: 3200 });
        }, 0);
      }

      const command: EditorCommand = {
        type: "add-interior-asset",
        roomId: room.id,
        asset: assetWithUnitOrigin,
      };

      return {
        ...state,
        document: applyEditorCommand(state.document, command, "redo"),
        selectedInteriorAsset: { roomId: room.id, assetId: assetWithUnitOrigin.id },
        selectedOpening: null,
        selectedWall: null,
        selection: [{ type: "asset" as const, roomId: room.id, id: assetWithUnitOrigin.id }],
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    });
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
      const currentUnitOrigin = getDocumentUnitOrigin(state.document);
      const retaggedNextAsset: RoomInteriorAsset = {
        ...nextAsset,
        unitOrigin: currentUnitOrigin,
      };

      const updatedDocument = updateRoomInteriorAssetInDocument(state.document, room.id, retaggedNextAsset);
      const nextDocument = syncConnectedStairTransformInDocument(updatedDocument, room.id, retaggedNextAsset.id, deltaDegrees);

      // Show rotation toast on next tick
      const assetTypeName = getInteriorAssetDisplayName(asset.type, asset.unitOrigin);
      const direction = deltaDegrees > 0 ? "right" : "left";
      setTimeout(() => {
        toast(`${assetTypeName} rotated ${direction} 90°`, { duration: 3200 });
      }, 0);

      const command: EditorCommand = {
        type: "update-interior-asset",
        roomId: room.id,
        previousAsset: cloneRoomInteriorAsset(asset),
        nextAsset: cloneRoomInteriorAsset(retaggedNextAsset),
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
  setSelectedInteriorAssetDoorType: (doorType) =>
    set((state) => {
      const nextState = updateSelectedInteriorAsset(state, (_, asset) => {
        if (asset.doorType === doorType) return null;
        return {
          ...cloneRoomInteriorAsset(asset),
          doorType,
        };
      });
      return nextState ?? state;
    }),
  setSelectedInteriorAssetShape: (shape) =>
    set((state) => {
      const nextState = updateSelectedInteriorAsset(state, (_, asset) => {
        if (asset.shape === shape) return null;
        return {
          ...cloneRoomInteriorAsset(asset),
          shape,
        };
      });
      return nextState ?? state;
    }),
  setSinkBowlType: (bowlType) =>
    set((state) => {
      const nextState = updateSelectedInteriorAsset(state, (_, asset) => {
        if (asset.bowlType === bowlType) return null;
        return {
          ...cloneRoomInteriorAsset(asset),
          bowlType,
        };
      });
      return nextState ?? state;
    }),
  setSinkHasDefaultDrainer: (hasDefaultDrainer) =>
    set((state) => {
      const nextState = updateSelectedInteriorAsset(state, (_, asset) => {
        if (asset.type !== "sink") return null;
        const currentDrainer = (asset as any).hasDefaultDrainer ?? false;
        if (currentDrainer === hasDefaultDrainer) return null;
        
        // Adjust width and anchor to the left side (bowl side, away from drainer lines)
        const currentWidth = asset.widthMm;
        const leftEdge = asset.xMm - currentWidth / 2;
        
        // Calculate new width (halve when OFF, double when ON)
        const newWidth = hasDefaultDrainer 
          ? currentWidth * 2  // Double when turning ON
          : Math.floor(currentWidth / 2 / 50) * 50;  // Halve and round down to 50mm grid
        
        // Keep left edge fixed, adjust center position
        const newXMm = leftEdge + newWidth / 2;
        
        return {
          ...cloneRoomInteriorAsset(asset),
          hasDefaultDrainer,
          widthMm: newWidth,
          xMm: newXMm,
        };
      });
      return nextState ?? state;
    }),
  setSelectedHobBurnerCount: (burnerCount) =>
    set((state) => {
      const nextState = updateSelectedInteriorAsset(state, (_, asset) => {
        if (asset.type !== "hob") return null;
        const currentBurnerCount = (asset as any).burnerCount ?? 4;
        if (currentBurnerCount === burnerCount) return null;
        
        // Adjust depth: 4 burners = 600mm, 5 burners = 900mm
        const newDepth = burnerCount === 5 ? 900 : 600;
        const currentDepth = asset.depthMm;
        
        // If depth needs to change, adjust the Y center to keep top edge fixed
        let newAsset: any = {
          ...cloneRoomInteriorAsset(asset),
          burnerCount,
        };
        
        if (currentDepth !== newDepth) {
          const topEdge = asset.yMm - currentDepth / 2;
          newAsset.depthMm = newDepth;
          newAsset.yMm = topEdge + newDepth / 2;
        }
        
        return newAsset;
      });
      return nextState ?? state;
    }),
  setSelectedBedSizePreset: (widthMm, depthMm, presetName) =>
    set((state) => {
      const { selectedInteriorAsset } = state;
      if (!selectedInteriorAsset) return state;

      const room = state.document.rooms.find((r) => r.id === selectedInteriorAsset.roomId);
      const asset = room?.interiorAssets.find((a) => a.id === selectedInteriorAsset.assetId);
      if (!room || !asset) return state;

      // Account for rotation when applying preset size
      // When bed is rotated 90° or 270°, width and depth are swapped relative to original orientation
      const rotation = normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0);
      const isSideways = rotation === 90 || rotation === -90;
      const [appliedWidth, appliedDepth] = isSideways ? [depthMm, widthMm] : [widthMm, depthMm];

      if (asset.widthMm === appliedWidth && asset.depthMm === appliedDepth) return state;

      let nextAsset: RoomInteriorAsset = {
        ...cloneRoomInteriorAsset(asset),
        unitOrigin: getDocumentUnitOrigin(state.document),
        widthMm: appliedWidth,
        depthMm: appliedDepth,
        sizePreset: presetName,
      };

      if (!isInteriorAssetWithinRoom(room, nextAsset)) {
        const constrained = constrainInteriorAssetCenter(room, nextAsset, {
          x: nextAsset.xMm,
          y: nextAsset.yMm,
        });
        if (constrained) {
          nextAsset = { ...nextAsset, xMm: constrained.x, yMm: constrained.y };
          toast(`${presetName} bed moved to fit.`, { duration: 2500 });
        } else {
          toast(`${presetName} bed doesn't fit in this room.`, { duration: 3000 });
          return state;
        }
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
    }),
  setSelectedShowerSizePreset: (widthMm, depthMm, presetName) =>
    set((state) => {
      const { selectedInteriorAsset } = state;
      if (!selectedInteriorAsset) return state;

      const room = state.document.rooms.find((r) => r.id === selectedInteriorAsset.roomId);
      const asset = room?.interiorAssets.find((a) => a.id === selectedInteriorAsset.assetId);
      if (!room || !asset) return state;

      // Account for rotation when applying preset size
      // When shower is rotated 90° or 270°, width and depth are swapped relative to original orientation
      const rotation = normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0);
      const isSideways = rotation === 90 || rotation === -90;
      const [appliedWidth, appliedDepth] = isSideways ? [depthMm, widthMm] : [widthMm, depthMm];

      if (asset.widthMm === appliedWidth && asset.depthMm === appliedDepth) return state;

      // Calculate new center to resize from top-left corner
      // Keep top-left corner fixed while resize changes dimensions
      const topLeftX = asset.xMm - asset.widthMm / 2;
      const topLeftY = asset.yMm - asset.depthMm / 2;
      const newCenterX = topLeftX + appliedWidth / 2;
      const newCenterY = topLeftY + appliedDepth / 2;

      let nextAsset: RoomInteriorAsset = {
        ...cloneRoomInteriorAsset(asset),
        unitOrigin: getDocumentUnitOrigin(state.document),
        widthMm: appliedWidth,
        depthMm: appliedDepth,
        xMm: newCenterX,
        yMm: newCenterY,
        sizePreset: presetName,
      };

      if (!isInteriorAssetWithinRoom(room, nextAsset)) {
        const constrained = constrainInteriorAssetCenter(room, nextAsset, {
          x: nextAsset.xMm,
          y: nextAsset.yMm,
        });
        if (constrained) {
          nextAsset = { ...nextAsset, xMm: constrained.x, yMm: constrained.y };
          toast(`${presetName} shower moved to fit.`, { duration: 2500 });
        } else {
          toast(`${presetName} shower doesn't fit in this room.`, { duration: 3000 });
          return state;
        }
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
    }),
  setSelectedBathPlugHolePosition: (widthMm, depthMm, presetName) =>
    set((state) => {
      const { selectedInteriorAsset } = state;
      if (!selectedInteriorAsset) return state;

      const room = state.document.rooms.find((r) => r.id === selectedInteriorAsset.roomId);
      const asset = room?.interiorAssets.find((a) => a.id === selectedInteriorAsset.assetId);
      if (!room || !asset || asset.type !== "bath") return state;

      // Account for rotation when applying preset size
      const rotation = normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0);
      const isSideways = rotation === 90 || rotation === -90;
      const [appliedWidth, appliedDepth] = isSideways ? [depthMm, widthMm] : [widthMm, depthMm];

      if (asset.widthMm === appliedWidth && asset.depthMm === appliedDepth) return state;

      // Calculate new center to resize from top-left corner
      const topLeftX = asset.xMm - asset.widthMm / 2;
      const topLeftY = asset.yMm - asset.depthMm / 2;
      const newCenterX = topLeftX + appliedWidth / 2;
      const newCenterY = topLeftY + appliedDepth / 2;

      let nextAsset: RoomInteriorAsset = {
        ...cloneRoomInteriorAsset(asset),
        unitOrigin: getDocumentUnitOrigin(state.document),
        widthMm: appliedWidth,
        depthMm: appliedDepth,
        xMm: newCenterX,
        yMm: newCenterY,
        sizePreset: presetName,
      };

      if (!isInteriorAssetWithinRoom(room, nextAsset)) {
        const constrained = constrainInteriorAssetCenter(room, nextAsset, {
          x: nextAsset.xMm,
          y: nextAsset.yMm,
        });
        if (constrained) {
          nextAsset = { ...nextAsset, xMm: constrained.x, yMm: constrained.y };
          toast(`${presetName} bath moved to fit.`, { duration: 2500 });
        } else {
          toast(`${presetName} bath doesn't fit in this room.`, { duration: 3000 });
          return state;
        }
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
    }),
  updateSelectedOpeningWidth: (widthMm) =>
    set((state) => {
      let constrainedWidthMm: number | null = null;
      const nextState = updateSelectedOpening(state, (room, opening) => {
        const nextOpening = getUpdatedOpeningForWidth(room, opening, widthMm, {
          gridSizeMm: GRID_MINOR_SIZE_MM,
          minWidthMm: GRID_MINOR_SIZE_MM,
        });
        constrainedWidthMm = nextOpening?.widthMm ?? null;
        return nextOpening;
      });
      const requestedWidthMm = Math.round(widthMm / GRID_MINOR_SIZE_MM) * GRID_MINOR_SIZE_MM;
      if (constrainedWidthMm !== null && constrainedWidthMm < requestedWidthMm) {
        toast(`In this position, this wall only has room for ${constrainedWidthMm} mm.`, {
          duration: 5000,
        });
      }
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
  previewOpeningResize: (roomId, openingId, nextWidthMm, nextOffsetMm?) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const opening = room?.openings.find((candidate) => candidate.id === openingId);
      if (!room || !opening) return state;
      if (opening.widthMm === nextWidthMm && nextOffsetMm === undefined) return state;
      if (opening.widthMm === nextWidthMm && opening.offsetMm === nextOffsetMm) return state;

      const updatedDocument =
        nextOffsetMm !== undefined
          ? updateRoomOpeningWidthAndOffsetInDocument(
              state.document,
              roomId,
              openingId,
              nextWidthMm,
              nextOffsetMm
            )
          : updateRoomOpeningWidthInDocument(state.document, roomId, openingId, nextWidthMm);

      return {
        document: updatedDocument,
      };
    }),
  commitOpeningResize: (roomId, openingId, previousWidthMm, nextWidthMm, previousOffsetMm, nextOffsetMm) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      const opening = room?.openings.find((candidate) => candidate.id === openingId);
      if (!room || !opening) return state;
      if (previousWidthMm === nextWidthMm && previousOffsetMm === nextOffsetMm) return state;
      const currentUnitOrigin = getDocumentUnitOrigin(state.document);

      const command: EditorCommand = {
        type: "update-opening",
        roomId,
        previousOpening: {
          ...cloneRoomOpening(opening),
          widthMm: previousWidthMm,
          offsetMm: previousOffsetMm ?? opening.offsetMm,
        },
        nextOpening: {
          ...cloneRoomOpening(opening),
          unitOrigin: currentUnitOrigin,
          widthMm: nextWidthMm,
          offsetMm: nextOffsetMm ?? opening.offsetMm,
        },
      };

      const updatedDocument =
        nextOffsetMm !== undefined
          ? updateRoomOpeningWidthAndOffsetInDocument(
              state.document,
              roomId,
              openingId,
              nextWidthMm,
              nextOffsetMm,
              currentUnitOrigin
            )
          : updateRoomOpeningWidthInDocument(state.document, roomId, openingId, nextWidthMm, currentUnitOrigin);

      return {
        document: updatedDocument,
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
      const currentUnitOrigin = getDocumentUnitOrigin(state.document);

      const command: EditorCommand = {
        type: "move-opening",
        roomId,
        openingId,
        openingType: opening.type,
        previousOffsetMm,
        nextOffsetMm,
        previousUnitOrigin: normalizeUnitOrigin(opening.unitOrigin),
        nextUnitOrigin: currentUnitOrigin,
      };

      return {
        document: updateRoomOpeningOffsetInDocument(state.document, roomId, openingId, nextOffsetMm, currentUnitOrigin),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  commitBulkOpeningMove: (moves) =>
    set((state) => {
      const validMoves = moves.filter((move) => move.previousOffsetMm !== move.nextOffsetMm);
      if (validMoves.length === 0) return state;

      const currentUnitOrigin = getDocumentUnitOrigin(state.document);
      let previousDocument = state.document;
      let nextDocument = state.document;
      const movedOpenings: Extract<EditorCommand, { type: "bulk-move-openings" }>["movedOpenings"] = [];

      for (const move of validMoves) {
        const room = state.document.rooms.find((candidate) => candidate.id === move.roomId);
        const opening = room?.openings.find((candidate) => candidate.id === move.openingId);
        if (!room || !opening) continue;

        previousDocument = updateRoomOpeningOffsetInDocument(
          previousDocument,
          move.roomId,
          move.openingId,
          move.previousOffsetMm
        );
        nextDocument = updateRoomOpeningOffsetInDocument(
          nextDocument,
          move.roomId,
          move.openingId,
          move.nextOffsetMm,
          currentUnitOrigin
        );
        movedOpenings.push({
          roomId: move.roomId,
          openingId: move.openingId,
          openingType: opening.type,
          previousOffsetMm: move.previousOffsetMm,
          nextOffsetMm: move.nextOffsetMm,
        });
      }

      if (movedOpenings.length === 0) return state;

      const command: EditorCommand = {
        type: "bulk-move-openings",
        previousDocument: cloneDocumentState(previousDocument),
        nextDocument: cloneDocumentState(nextDocument),
        movedOpenings,
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
      const currentUnitOrigin = getDocumentUnitOrigin(state.document);

      if ((asset.connectionId ?? null) !== null) {
        const previousDocument = updateRoomInteriorAssetPositionInDocument(
          state.document,
          roomId,
          assetId,
          previousCenter
        );
        const nextDocument = updateRoomInteriorAssetPositionInDocument(
          state.document,
          roomId,
          assetId,
          nextCenter,
          currentUnitOrigin
        );
        const command: EditorCommand = {
          type: "sync-connected-stairs",
          previousDocument: cloneDocumentState(previousDocument),
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
        assetType: asset.type,
        previousXmm: previousCenter.x,
        previousYmm: previousCenter.y,
        nextXmm: nextCenter.x,
        nextYmm: nextCenter.y,
        previousUnitOrigin: normalizeUnitOrigin(asset.unitOrigin),
        nextUnitOrigin: currentUnitOrigin,
      };

      return {
        document: updateRoomInteriorAssetPositionInDocument(state.document, roomId, assetId, nextCenter, currentUnitOrigin),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  commitInteriorAssetMoveToRoom: (fromRoomId, toRoomId, assetId, previousCenter, nextCenter) =>
    set((state) => {
      const fromRoom = state.document.rooms.find((candidate) => candidate.id === fromRoomId);
      const toRoom = state.document.rooms.find((candidate) => candidate.id === toRoomId);
      const asset = fromRoom?.interiorAssets.find((candidate) => candidate.id === assetId);
      if (!fromRoom || !toRoom || !asset) return state;
      if (fromRoomId === toRoomId) return state;

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
        } else {
          toast("Stairs don't fit in that room.", {
            description: "Try a smaller stair block or a larger room.",
          });
          return state;
        }
      }

      const movedAsset: RoomInteriorAsset = {
        ...cloneRoomInteriorAsset(asset),
        unitOrigin: getDocumentUnitOrigin(state.document),
        xMm: finalCenter.x,
        yMm: finalCenter.y,
      };

      // During drag preview, the document tracks live pointer movement. Rebuild an exact
      // pre-move snapshot from the drag start center so undo restores the original position.
      const previousDocument = updateRoomInteriorAssetPositionInDocument(
        state.document,
        fromRoomId,
        assetId,
        previousCenter
      );

      const nextDocument = moveInteriorAssetToRoomInDocument(
        previousDocument,
        fromRoomId,
        toRoomId,
        assetId,
        movedAsset
      );

      const command: EditorCommand = {
        type: "move-interior-asset-to-room",
        assetId,
        fromRoomId,
        toRoomId,
        asset: movedAsset,
        previousDocument: cloneDocumentState(previousDocument),
        nextDocument: cloneDocumentState(nextDocument),
      };

      return {
        document: nextDocument,
        selectedRoomId: toRoomId,
        selectedInteriorAsset: { roomId: toRoomId, assetId },
        selection: [{ type: "asset" as const, roomId: toRoomId, id: assetId }],
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  commitBulkInteriorAssetMove: (moves: Array<{ roomId: string; assetId: string; previousCenter: Point; nextCenter: Point }>) =>
    set((state) => {
      if (moves.length === 0) return state;

      // Filter out moves that don't change position
      const validMoves = moves.filter(move => 
        move.previousCenter.x !== move.nextCenter.x || 
        move.previousCenter.y !== move.nextCenter.y
      );
      if (validMoves.length === 0) return state;
      const currentUnitOrigin = getDocumentUnitOrigin(state.document);

      // Build the bulk move command
      const movedAssets: Array<{
        roomId: string;
        assetId: string;
        assetType: InteriorAssetType;
        previousXmm: number;
        previousYmm: number;
        nextXmm: number;
        nextYmm: number;
        previousUnitOrigin?: UnitOrigin;
        nextUnitOrigin?: UnitOrigin;
      }> = [];
      let nextDocument = state.document;

      for (const move of validMoves) {
        const room = nextDocument.rooms.find((candidate) => candidate.id === move.roomId);
        const asset = room?.interiorAssets.find((candidate) => candidate.id === move.assetId);
        if (!room || !asset) continue;

        movedAssets.push({
          roomId: move.roomId,
          assetId: move.assetId,
          assetType: asset.type,
          previousXmm: move.previousCenter.x,
          previousYmm: move.previousCenter.y,
          nextXmm: move.nextCenter.x,
          nextYmm: move.nextCenter.y,
          previousUnitOrigin: normalizeUnitOrigin(asset.unitOrigin),
          nextUnitOrigin: currentUnitOrigin,
        });

        nextDocument = updateRoomInteriorAssetPositionInDocument(
          nextDocument,
          move.roomId,
          move.assetId,
          move.nextCenter,
          currentUnitOrigin
        );
      }

      if (movedAssets.length === 0) return state;

      const command: EditorCommand = {
        type: "bulk-move-interior-assets",
        movedAssets,
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

      const updatedDocument = updateRoomInteriorAssetInDocument(state.document, roomId, {
        ...nextAsset,
        id: assetId,
      });

      return {
        document:
          (asset.connectionId ?? null) !== null
            ? syncConnectedStairTransformInDocument(updatedDocument, roomId, assetId)
            : updatedDocument,
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

      if ((asset.connectionId ?? null) !== null) {
        const currentUnitOrigin = getDocumentUnitOrigin(state.document);
        const previousDocument = syncConnectedStairTransformInDocument(
          updateRoomInteriorAssetInDocument(state.document, roomId, {
            ...previousAsset,
            id: assetId,
          }),
          roomId,
          assetId
        );
        const nextDocument = syncConnectedStairTransformInDocument(
          updateRoomInteriorAssetInDocument(state.document, roomId, {
            ...nextAsset,
            id: assetId,
            unitOrigin: currentUnitOrigin,
          }),
          roomId,
          assetId
        );
        const command: EditorCommand = {
          type: "sync-connected-stairs",
          previousDocument: cloneDocumentState(previousDocument),
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
          unitOrigin: getDocumentUnitOrigin(state.document),
          widthMm: nextAsset.widthMm,
          depthMm: nextAsset.depthMm,
          xMm: nextAsset.xMm,
          yMm: nextAsset.yMm,
        },
      };

      // Show resize toast on next tick
      if (previousAsset.widthMm !== nextAsset.widthMm || previousAsset.depthMm !== nextAsset.depthMm) {
        setTimeout(() => {
          const assetTypeName = getInteriorAssetDisplayName(asset.type, asset.unitOrigin);
          toast(`${assetTypeName} resized`, { duration: 3200 });
        }, 0);
      }

      return {
        document: updateRoomInteriorAssetInDocument(state.document, roomId, {
          ...nextAsset,
          id: assetId,
          unitOrigin: getDocumentUnitOrigin(state.document),
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
        previousUnitOrigin: normalizeUnitOrigin(room.unitOrigin),
        nextUnitOrigin: getDocumentUnitOrigin(state.document),
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
      const adjustedNextPoints = getRoomPointsWithInternalWallSpacing(
        state.document.rooms,
        roomId,
        nextPoints,
        previousPoints
      );

      const command: EditorCommand = {
        type: "move-room",
        roomId,
        previousPoints: previousPoints.map((point) => ({ ...point })),
        nextPoints: adjustedNextPoints.map((point) => ({ ...point })),
        previousUnitOrigin: normalizeUnitOrigin(room.unitOrigin),
        nextUnitOrigin: getDocumentUnitOrigin(state.document),
      };

      return {
        document: updateMovedRoomInDocument(
          state.document,
          roomId,
          previousPoints,
          adjustedNextPoints,
          getDocumentUnitOrigin(state.document)
        ),
        history: {
          past: pushToPast(state.history.past, command),
          future: [],
        },
        canUndo: true,
        canRedo: false,
      };
    }),
  commitBulkRoomMove: (moves) =>
    set((state) => {
      const validMoves = moves.filter(
        (move) => !arePointListsEqual(move.previousPoints, move.nextPoints)
      );
      if (validMoves.length === 0) return state;

      let previousDocument = state.document;
      let nextDocument = state.document;
      const currentUnitOrigin = getDocumentUnitOrigin(state.document);
      const movedRooms: Extract<EditorCommand, { type: "bulk-move-rooms" }>["movedRooms"] = [];

      for (const move of validMoves) {
        const room = state.document.rooms.find((candidate) => candidate.id === move.roomId);
        if (!room) continue;

        previousDocument = updateMovedRoomInDocument(
          previousDocument,
          move.roomId,
          move.nextPoints,
          move.previousPoints
        );
        nextDocument = updateMovedRoomInDocument(
          nextDocument,
          move.roomId,
          move.previousPoints,
          move.nextPoints,
          currentUnitOrigin
        );
        movedRooms.push({
          roomId: move.roomId,
          previousPoints: move.previousPoints.map((point) => ({ ...point })),
          nextPoints: move.nextPoints.map((point) => ({ ...point })),
        });
      }

      if (movedRooms.length === 0) return state;

      const command: EditorCommand = {
        type: "bulk-move-rooms",
        previousDocument: cloneDocumentState(previousDocument),
        nextDocument: cloneDocumentState(nextDocument),
        movedRooms,
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
  previewRoomResize: (roomId, nextPoints) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(room.points, nextPoints)) return state;

      return {
        document: updateResizedRoomInDocument(state.document, roomId, room.points, nextPoints),
      };
    }),
  commitRoomResize: (roomId, previousPoints, nextPoints, options) =>
    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;
      if (arePointListsEqual(previousPoints, nextPoints)) return state;
      const adjustedNextPoints = getRoomPointsWithInternalWallSpacing(
        state.document.rooms,
        roomId,
        nextPoints,
        previousPoints
      );
      const isWallSplit = options?.editKind === "wall-split";
      const isVertexDelete = options?.editKind === "vertex-delete";
      const { nextInteriorAssets, didAdjust } = getAdjustedInteriorAssetsForRoomResize(
        room,
        adjustedNextPoints
      );

      const command: EditorCommand = {
        type: "resize-room",
        roomId,
        previousPoints: previousPoints.map((point) => ({ ...point })),
        nextPoints: adjustedNextPoints.map((point) => ({ ...point })),
        previousUnitOrigin: normalizeUnitOrigin(room.unitOrigin),
        nextUnitOrigin: getDocumentUnitOrigin(state.document),
        ...(isWallSplit ? { editKind: "wall-split" as const, roomName: room.name } : {}),
        ...(isVertexDelete ? { editKind: "vertex-delete" as const, roomName: room.name } : {}),
        previousInteriorAssets: didAdjust ? cloneRoomInteriorAssets(room.interiorAssets) : undefined,
        nextInteriorAssets: didAdjust ? cloneRoomInteriorAssets(nextInteriorAssets) : undefined,
      };
      const nextDocument = updateResizedRoomInDocument(
        state.document,
        roomId,
        previousPoints,
        adjustedNextPoints,
        didAdjust ? nextInteriorAssets : undefined,
        getDocumentUnitOrigin(state.document)
      );

      if (didAdjust) {
        showStairsAdjustedToast(roomId, adjustedNextPoints);
      }
      if (isWallSplit) {
        showWallSplitToast(roomId, room.name, adjustedNextPoints);
      }
      if (isVertexDelete) {
        showVertexDeleteToast(roomId, room.name, adjustedNextPoints);
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
  splitWallAtPoint: (roomId, worldPoint) => {
    let splitResult: WallSplitResult | null = null;

    set((state) => {
      const room = state.document.rooms.find((candidate) => candidate.id === roomId);
      if (!room) return state;

      const result = getWallSplitResult(room, worldPoint);
      if (!result) return state;
      splitResult = result;

      return {
        document: updateRoomPointsInDocument(state.document, roomId, result.nextPoints),
        selectedRoomId: roomId,
        selectedWall: null,
        selectedOpening: null,
        selectedInteriorAsset: null,
        selection: [{ type: "room" as const, id: roomId }],
      };
    });

    return splitResult;
  },
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

    animateCameraToTarget(state.camera, targetCamera, (camera) => set({ camera }));
  },
  fitCameraToSelectedRoom: () => {
    const state = get();
    const selectedRoomItems = state.selection.filter((item) => item.type === "room");
    if (state.selection.length !== 1 || selectedRoomItems.length !== 1) return;

    const room = getRoomsForActiveFloor(state.document).find(
      (candidate) => candidate.id === selectedRoomItems[0].id
    );
    if (!room) return;

    const targetCamera = getCameraFitTarget({
      rooms: [room],
      viewport: state.viewport,
      emptyLayoutCamera: syncCameraRotationToDocument(DEFAULT_CAMERA_STATE, state.document),
      paddingPx: 40,
    }).camera;

    animateCameraToTarget(state.camera, targetCamera, (camera) => set({ camera }));
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
      isRulerMode: false,
      rulerDraft: EMPTY_RULER_DRAFT,
      selectedRulerId: null,
      selectedNorthIndicator: false,
      selectedRoomId: null,
      focusedRoomId: null,
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
      dismissWallSplitToastForCommand(command);
      dismissVertexDeleteToastForCommand(command);
      dismissFloorRenameToastForCommand(command);
      dismissDeleteFloorToastForCommand(command);
      dismissDeleteRulerToastForCommand(command);
      dismissClearRulersToastForCommand(command);
      dismissRulerRenameToastForCommand(command);
      dismissAddRulerToastForCommand(command);
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
        focusedRoomId: getSelectionIfRoomExists(state.focusedRoomId, restoredDocument),
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
        selectedRulerId: getSelectedRulerIdAfterHistoryCommand(
          state.selectedRulerId,
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
        focusedRoomId: getSelectionIfRoomExists(state.focusedRoomId, restoredDocument),
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
        selectedRulerId: getSelectedRulerIdAfterHistoryCommand(
          state.selectedRulerId,
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
  undoBatch: (steps: number) =>
    set((state) => {
      if (steps <= 0 || state.history.past.length === 0) return state;
      const actualSteps = Math.min(steps, state.history.past.length);
      const commandsToUndo = state.history.past.slice(-actualSteps);
      const nextPast = state.history.past.slice(0, -actualSteps);
      
      // Apply all commands in reverse order (undo applies them backwards)
      let nextDocument = state.document;
      let lastCommand = null;
      for (const command of commandsToUndo.reverse()) {
        lastCommand = command;
        nextDocument = applyEditorCommand(nextDocument, command, "undo");
      }

      const nextFuture = [...commandsToUndo.reverse(), ...state.history.future];

      if (!lastCommand) return state;

      dismissStairsAdjustedToastForCommand(lastCommand);
      dismissWallSplitToastForCommand(lastCommand);
      dismissVertexDeleteToastForCommand(lastCommand);
      dismissFloorRenameToastForCommand(lastCommand);
      dismissDeleteFloorToastForCommand(lastCommand);

      const targetFloor = getTargetFloorForHistoryCommand(lastCommand, nextDocument, "undo");
      const currentFloor = getNormalizedActiveFloorId(state.document);
      const restoredDocument =
        targetFloor !== null && targetFloor !== currentFloor
          ? { ...nextDocument, activeFloorId: targetFloor }
          : nextDocument;

      return {
        document: restoredDocument,
        camera: syncCameraRotationToDocument(state.camera, restoredDocument),
        selectedNorthIndicator: state.selectedNorthIndicator,
        focusedRoomId: getSelectionIfRoomExists(state.focusedRoomId, restoredDocument),
        selectedRoomId: getSelectedRoomIdAfterHistoryCommand(
          state.selectedRoomId,
          restoredDocument,
          lastCommand,
          "undo"
        ),
        selectedWall: getSelectedWallIfRoomExists(state.selectedWall, restoredDocument),
        selectedOpening: getSelectedOpeningIfExists(state.selectedOpening, restoredDocument),
        selectedInteriorAsset: getSelectedInteriorAssetAfterHistoryCommand(
          state.selectedInteriorAsset,
          restoredDocument,
          lastCommand,
          "undo"
        ),
        selectedRulerId: getSelectedRulerIdAfterHistoryCommand(
          state.selectedRulerId,
          restoredDocument,
          lastCommand,
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
  redoBatch: (steps: number) =>
    set((state) => {
      if (steps <= 0 || state.history.future.length === 0) return state;
      const actualSteps = Math.min(steps, state.history.future.length);
      const commandsToRedo = state.history.future.slice(0, actualSteps);
      
      // Apply all commands in forward order
      let nextDocument = state.document;
      let lastCommand = null;
      const nextPast = [...state.history.past];
      for (const command of commandsToRedo) {
        lastCommand = command;
        nextDocument = applyEditorCommand(nextDocument, command, "redo");
        nextPast.push(command);
      }

      const nextFuture = state.history.future.slice(actualSteps);

      if (!lastCommand) return state;

      const targetFloor = getTargetFloorForHistoryCommand(lastCommand, nextDocument, "redo");
      const currentFloor = getNormalizedActiveFloorId(state.document);
      const restoredDocument =
        targetFloor !== null && targetFloor !== currentFloor
          ? { ...nextDocument, activeFloorId: targetFloor }
          : nextDocument;

      return {
        document: restoredDocument,
        camera: syncCameraRotationToDocument(state.camera, restoredDocument),
        selectedNorthIndicator: state.selectedNorthIndicator,
        focusedRoomId: getSelectionIfRoomExists(state.focusedRoomId, restoredDocument),
        selectedRoomId: getSelectedRoomIdAfterHistoryCommand(
          state.selectedRoomId,
          restoredDocument,
          lastCommand,
          "redo"
        ),
        selectedWall: getSelectedWallIfRoomExists(state.selectedWall, restoredDocument),
        selectedOpening: getSelectedOpeningIfExists(state.selectedOpening, restoredDocument),
        selectedInteriorAsset: getSelectedInteriorAssetAfterHistoryCommand(
          state.selectedInteriorAsset,
          restoredDocument,
          lastCommand,
          "redo"
        ),
        selectedRulerId: getSelectedRulerIdAfterHistoryCommand(
          state.selectedRulerId,
          restoredDocument,
          lastCommand,
          "redo"
        ),
        shouldFocusSelectedRoomNameInput: false,
        renameSession: null,
        interiorAssetRenameSession: null,
        interiorAssetArrowLabelSession: null,
        history: {
          past: nextPast,
          future: nextFuture,
        },
        canUndo: true,
        canRedo: nextFuture.length > 0,
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

      // Use the same device-aware padding logic as the manual "fit view" button
      // to ensure consistent camera fitting across project open and manual resets
      const isLandscape = state.viewport.width > state.viewport.height;
      const isMobile = state.viewport.height < 600;
      const paddingPx = isLandscape && !isMobile ? 48 : 96;

      const targetCamera = getCameraFitTarget({
        rooms: getRoomsForActiveFloor(state.document),
        viewport: state.viewport,
        emptyLayoutCamera: {
          ...DEFAULT_CAMERA_STATE,
          pixelsPerMm: emptyLayoutPixelsPerMm ?? DEFAULT_CAMERA_STATE.pixelsPerMm,
          rotationDegrees: normalizeCanvasRotationDegrees(state.document.canvasRotationDegrees),
        },
        paddingPx,
      }).camera;

      if (!state.pendingProjectOpenCameraFit && areCamerasEqual(state.camera, targetCamera)) {
        return state;
      }

      return {
        camera: targetCamera,
        pendingProjectOpenCameraFit: false,
        pendingProjectOpenEmptyLayoutPixelsPerMm: null,
      };
    }),
  // Load a project document and reset all transient UI state to safe defaults.
  // IMPORTANT: This resets camera, selections, drafts, sessions, clipboard, and undo/redo history.
  // Only the document geometry is preserved. This is intentional—transient state should not persist across sessions.
  // Recovery automatically positions the camera to fit the project layout.
  loadProjectDocument: (document, options) =>
    set((state) => {
      const nextDocument = cloneDocumentState(document);
      if (areDocumentsEqual(state.document, nextDocument)) {
        return state;
      }

      stopResetCameraAnimation();
      const shouldDeferCameraFit = !isViewportReadyForProjectOpenCameraFit(state.viewport);
      const emptyLayoutPixelsPerMm = options?.emptyLayoutPixelsPerMm;

      let nextCamera = syncCameraRotationToDocument(state.camera, nextDocument);

      if (!shouldDeferCameraFit) {
        // Use the same device-aware padding logic as the manual "fit view" button
        const isLandscape = state.viewport.width > state.viewport.height;
        const isMobile = state.viewport.height < 600;
        const paddingPx = isLandscape && !isMobile ? 48 : 96;

        nextCamera = getCameraFitTarget({
          rooms: getRoomsForActiveFloor(nextDocument),
          viewport: state.viewport,
          emptyLayoutCamera: {
            ...DEFAULT_CAMERA_STATE,
            pixelsPerMm: emptyLayoutPixelsPerMm ?? DEFAULT_CAMERA_STATE.pixelsPerMm,
            rotationDegrees: normalizeCanvasRotationDegrees(nextDocument.canvasRotationDegrees),
          },
          paddingPx,
        }).camera;
      }

      return {
        document: nextDocument,
        camera: nextCamera,
        settings: {
          ...state.settings,
          sidebarDensity: loadGlobalSettings().sidebarDensity,
        },
        keyboardShortcutFeedbackEnabled: loadGlobalSettings().keyboardShortcutFeedbackEnabled,
        pendingProjectOpenCameraFit: shouldDeferCameraFit,
        pendingProjectOpenEmptyLayoutPixelsPerMm: shouldDeferCameraFit
          ? emptyLayoutPixelsPerMm ?? null
          : null,
        roomDraft: EMPTY_ROOM_DRAFT,
        selectedNorthIndicator: false,
        selectedRoomId: null,
        focusedRoomId: null,
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

  const roomId = createRoomId();
  const room: Room = {
    id: roomId,
    unitOrigin: getDocumentUnitOrigin(state.document),
    floorId: getNormalizedActiveFloorId(state.document),
    name: `Room ${getRoomsForActiveFloor(state.document).length + 1}`,
    heightMm: normalizeRoomHeightMm(undefined, getDocumentUnitOrigin(state.document)),
    points: normalizedRoomPoints.map((point) => ({ ...point })),
    wallSegments: createExternalRoomWallSegments(normalizedRoomPoints),
    openings: [],
    interiorAssets: [],
  };
  const adjustedRoomPoints = getRoomPointsWithInternalWallSpacing(
    [...state.document.rooms, room],
    roomId,
    normalizedRoomPoints
  );
  const adjustedRoom: Room = {
    ...room,
    points: adjustedRoomPoints,
    wallSegments: createExternalRoomWallSegments(adjustedRoomPoints),
  };
  const command: EditorCommand = {
    type: "complete-room",
    room: adjustedRoom,
  };
  const nextDocument = applyEditorCommand(state.document, command, "redo");

  return {
    document: nextDocument,
    roomDraft: {
      points: [],
      history: [],
    },
    selectedRoomId: adjustedRoom.id,
    selectedWall: null,
    selectedOpening: null,
    selectedInteriorAsset: null,
    roomPresetPickerRoomId: adjustedRoom.id,
    selection: [{ type: "room" as const, id: adjustedRoom.id }],
    shouldFocusSelectedRoomNameInput: false,
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
  cursorWorld: Point,
  draggedEdge?: "start" | "end",
  isAltHeld?: boolean
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
  
  // Use symmetric (center-anchor) if Alt is held, otherwise use handle-anchor as default
  const shouldUseSymmetric = isAltHeld === true;
  
  if (!shouldUseSymmetric && draggedEdge) {
    return resolveOpeningResizeWidthFromHandle(
      state.document,
      roomId,
      openingId,
      draggedEdge,
      resolvedCursorWorld,
      activeSnapStepMm
    );
  }
  
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

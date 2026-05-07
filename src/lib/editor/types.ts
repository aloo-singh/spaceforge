export type Point = {
  x: number;
  y: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type CameraState = {
  /**
   * World position (in mm) at the center of the viewport.
   */
  xMm: number;
  yMm: number;
  /**
   * Screen scale in pixels per millimetre.
   */
  pixelsPerMm: number;
  /**
   * View rotation in degrees, clockwise on screen.
   */
  rotationDegrees: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export type RectangularRoomWall = "left" | "right" | "top" | "bottom";
export type RoomWall = RectangularRoomWall | number;

export type OpeningType = "door" | "window";
export type DoorOpeningSide = "interior" | "exterior";
export type DoorHingeSide = "start" | "end";

export type RoomOpening = {
  id: string;
  type: OpeningType;
  wall: RoomWall;
  /**
   * Distance in mm from the host segment's start point to the opening center.
   */
  offsetMm: number;
  /**
   * Opening width in plan view, measured along the host wall.
   */
  widthMm: number;
  /**
   * Side of the host wall where the door leaf swings, relative to the host room.
   * Windows currently ignore this field but preserve it for stable editing/history semantics.
   */
  openingSide: DoorOpeningSide;
  /**
   * Hinge anchor along the canonical host segment direction.
   * "start" means the lower-x/lower-y end of the canonical segment, "end" the opposite.
   */
  hingeSide: DoorHingeSide;
};

export type Wall = {
  id: string;
  a: Point;
  b: Point;
};

export type RulerMeasurement = {
  id: string;
  name?: string;
  start: Point;
  end: Point;
  hidden?: boolean;
};

export type RoomWallSelection = {
  roomId: string;
  wall: RoomWall;
};

export type RoomOpeningSelection = {
  roomId: string;
  openingId: string;
};

/**
 * Direction of a stair's directional arrow.
 * Used to indicate flow direction (e.g., "UP" or "DOWN").
 */
export type StairDirection = "forward" | "reverse";

/**
 * Interior asset type discriminant.
 * Extensible enum for all furniture and fixtures.
 *
 * Phases:
 * - Phase 1: stairs (existing) ✓
 * - Phase 2: wardrobe ✓
 * - Phase 3: bed, sofa, dining-table ✓
 * - Future: sink, toilet, range, island, shelving, armchair, etc.
 */
export type InteriorAssetType = "stairs" | "wardrobe" | "bed" | "sofa" | "dining-table";

/**
 * Interior asset: a piece of furniture or fixture placed inside a room.
 *
 * This is a heterogeneous type that represents all interior assets.
 * The `type` field discriminates between stairs, wardrobe, bed, sofa, and dining table.
 *
 * Common properties (all assets):
 * - id, name: identity and display
 * - xMm, yMm: position in room coordinates
 * - widthMm, depthMm: dimensions
 * - rotationDegrees: orientation
 * - unitSystem (optional): metric or imperial for dimension display
 * - sizePreset (optional): preset identifier for localisation
 *
 * Type-specific properties:
 * - Stairs: connectionId, arrowEnabled, arrowDirection, arrowLabel
 * - Wardrobe: doorType, doorConstraint
 * - Bed: no specific properties (extensible for future use)
 * - Sofa: no specific properties (extensible for future use)
 * - Dining Table: shape ("rectangular" | "round")
 *
 * Backward compatibility:
 * - Existing stairs projects load unchanged
 * - Wardrobe assets from Step 2 load unchanged (doorType, doorConstraint optional)
 * - New bed, sofa, dining table assets follow same pattern as wardrobe
 * - Optional fields default to sensible values at runtime
 *
 * Behaviours (common across all assets):
 * - Move: translate to new position (constrained inside room)
 * - Resize: change dimensions (asset-specific constraints apply)
 * - Rotate: change orientation (may auto-constrain if out of bounds)
 * - Copy/Paste: duplicate asset (new ID, unique name)
 * - Cut/Paste: move asset between rooms
 * - Select: highlight and show inspector
 * - Delete: remove from room (undo-tracked)
 *
 * See src/lib/editor/interiorAssetTypes.ts for detailed type definitions,
 * type guards, and behaviour documentation.
 */
export type RoomInteriorAsset = {
  id: string;
  type: InteriorAssetType;
  connectionId?: string | null;
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
  rotationDegrees: number;
  anchor: "floor" | "wall" | "ceiling";
  // Stairs-specific properties (optional for other assets)
  arrowEnabled?: boolean;
  arrowDirection?: StairDirection;
  arrowLabel?: string;
  // Wardrobe-specific properties (optional for other assets)
  doorType?: "swing" | "sliding";
  doorConstraint?: number;
  // Dining Table-specific properties (optional for other assets)
  shape?: "rectangular" | "round";
  // Optional regionalisation (all assets)
  unitSystem?: "metric" | "imperial";
  sizePreset?: string;
};

export type RoomInteriorAssetSelection = {
  roomId: string;
  assetId: string;
};

export type Floor = {
  id: string;
  name: string;
};

/**
 * Parent-child hierarchy:
 * - Floors contain rooms.
 * - Rooms contain wall segments (derived from points), openings, and interior assets (e.g. stairs).
 */
export type Room = {
  id: string;
  floorId: string;
  name: string;
  points: Point[];
  openings: RoomOpening[];
  interiorAssets: RoomInteriorAsset[];
};

/**
 * Shared selection model — single source of truth for all selections.
 * Supports rooms, walls, openings, interior assets (currently stairs), and floors.
 *
 * Each selection item has a type and associated identifiers.
 *
 * Undo semantics rule:
 * - Selection is transient UI state and must not be written to undo history.
 * - Only geometry/structural document changes belong in history.
 *
 * Note on "stair" type:
 * - Currently the only interior asset type
 * - Will be renamed to "interior-asset" once other furniture types are added
 * - For now, "stair" remains for backward compatibility
 *
 * Openings selection structure:
 * - Uses 'openingId' (not 'id') to be explicit and consistent with RoomOpeningSelection
 */
export type SharedSelectionItem =
  | { type: "room"; id: string }
  | { type: "wall"; roomId: string; wall: RoomWall }
  | { type: "opening"; roomId: string; openingId: string }
  | { type: "asset"; roomId: string; id: string }
  | { type: "floor"; id: string };

/**
 * Type guard helpers for SharedSelectionItem narrowing.
 * Enables clean pattern matching in selection handling code.
 */
export function isOpeningSelection(item: SharedSelectionItem): item is Extract<SharedSelectionItem, { type: "opening" }> {
  return item.type === "opening";
}

export function isAssetSelection(item: SharedSelectionItem): item is Extract<SharedSelectionItem, { type: "asset" }> {
  return item.type === "asset";
}

export function isRoomSelection(item: SharedSelectionItem): item is Extract<SharedSelectionItem, { type: "room" }> {
  return item.type === "room";
}

export function isWallSelection(item: SharedSelectionItem): item is Extract<SharedSelectionItem, { type: "wall" }> {
  return item.type === "wall";
}

export function isFloorSelection(item: SharedSelectionItem): item is Extract<SharedSelectionItem, { type: "floor" }> {
  return item.type === "floor";
}

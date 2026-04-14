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

export type RoomWallSelection = {
  roomId: string;
  wall: RoomWall;
};

export type RoomOpeningSelection = {
  roomId: string;
  openingId: string;
};

export type InteriorAssetType = "stairs";
export type StairDirection = "forward" | "reverse";

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
  arrowEnabled: boolean;
  arrowDirection: StairDirection;
  arrowLabel: string;
};

export type RoomInteriorAssetSelection = {
  roomId: string;
  assetId: string;
};

export type Floor = {
  id: string;
  name: string;
};

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
 * Supports rooms, walls, openings, stairs, and floors.
 * Each selection item has a type and associated identifiers.
 */
export type SharedSelectionItem =
  | { type: "room"; id: string }
  | { type: "wall"; roomId: string; wall: RoomWall }
  | { type: "opening"; roomId: string; id: string }
  | { type: "stair"; roomId: string; id: string }
  | { type: "floor"; id: string };

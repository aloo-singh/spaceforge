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
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export type RectangularRoomWall = "left" | "right" | "top" | "bottom";
export type RoomWall = RectangularRoomWall | number;

export type OpeningType = "door" | "window";

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

export type Room = {
  id: string;
  name: string;
  points: Point[];
  openings: RoomOpening[];
};

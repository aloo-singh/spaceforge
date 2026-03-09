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

export type Wall = {
  id: string;
  a: Point;
  b: Point;
};

export type Room = {
  id: string;
  name: string;
  points: Point[];
};

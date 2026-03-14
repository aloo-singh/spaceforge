import type { RectCorner, RectWall } from "@/lib/editor/rectRoomResize";
import type { Point, Room } from "@/lib/editor/types";

const MILLIMETRES_PER_METRE = 1_000;
const SQUARE_MILLIMETRES_PER_SQUARE_METRE = 1_000_000;
const WALL_DIMENSION_DISPLAY_STEP_METRES = 0.1;
const WALL_DIMENSION_DISPLAY_MAX_FRACTION_DIGITS = 1;
const ROOM_AREA_DISPLAY_STEP_SQUARE_METRES = 0.1;
const ROOM_AREA_DISPLAY_MAX_FRACTION_DIGITS = 1;
export const MIN_ROOM_AREA_LABEL_DISPLAY_SQUARE_METRES = 2;

export type RoomEdgeMeasurement = {
  start: Point;
  end: Point;
  lengthMillimetres: number;
};

export type RectResizeMeasurements = {
  widthMillimetres: number;
  heightMillimetres: number;
};

export function getPolygonAreaSquareMillimetres(points: Point[]): number {
  if (points.length < 3) return 0;

  let signedAreaTimesTwo = 0;

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const current = points[i];
    const previous = points[j];

    signedAreaTimesTwo += previous.x * current.y - current.x * previous.y;
  }

  return Math.abs(signedAreaTimesTwo) / 2;
}

export function getRoomAreaSquareMillimetres(room: Room): number {
  return getPolygonAreaSquareMillimetres(room.points);
}

export function getEdgeLengthMillimetres(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

export function getPolygonEdgeMeasurements(points: Point[]): RoomEdgeMeasurement[] {
  if (points.length < 2) return [];

  return points.map((point, index) => {
    const nextPoint = points[(index + 1) % points.length];

    return {
      start: point,
      end: nextPoint,
      lengthMillimetres: getEdgeLengthMillimetres(point, nextPoint),
    };
  });
}

export function getRoomEdgeMeasurements(room: Room): RoomEdgeMeasurement[] {
  return getPolygonEdgeMeasurements(room.points);
}

export function convertMillimetresToMetres(lengthMillimetres: number): number {
  return lengthMillimetres / MILLIMETRES_PER_METRE;
}

export function roundWallDimensionForDisplayMetres(lengthMetres: number): number {
  return (
    Math.round(lengthMetres / WALL_DIMENSION_DISPLAY_STEP_METRES) *
    WALL_DIMENSION_DISPLAY_STEP_METRES
  );
}

export function formatMetricWallDimension(lengthMillimetres: number): string {
  const roundedMetres = roundWallDimensionForDisplayMetres(
    convertMillimetresToMetres(lengthMillimetres)
  );

  return `${roundedMetres
    .toFixed(WALL_DIMENSION_DISPLAY_MAX_FRACTION_DIGITS)
    .replace(/\.0$/, "")} m`;
}

export function getRectResizeMeasurements(room: Room): RectResizeMeasurements | null {
  const edges = getRoomEdgeMeasurements(room);
  if (edges.length !== 4) return null;

  return {
    widthMillimetres: edges[0].lengthMillimetres,
    heightMillimetres: edges[1].lengthMillimetres,
  };
}

export function getWallResizeMeasurementMillimetres(
  room: Room,
  wall: RectWall
): number | null {
  const measurements = getRectResizeMeasurements(room);
  if (!measurements) return null;

  return wall === "left" || wall === "right"
    ? measurements.widthMillimetres
    : measurements.heightMillimetres;
}

export function getCornerResizeMeasurements(
  room: Room,
  corner: RectCorner
): RectResizeMeasurements | null {
  const measurements = getRectResizeMeasurements(room);
  if (!measurements) return null;

  switch (corner) {
    case "top-left":
    case "top-right":
    case "bottom-right":
    case "bottom-left":
      return measurements;
  }
}

export function convertSquareMillimetresToSquareMetres(areaSquareMillimetres: number): number {
  return areaSquareMillimetres / SQUARE_MILLIMETRES_PER_SQUARE_METRE;
}

export function roundRoomAreaForDisplaySquareMetres(areaSquareMetres: number): number {
  return Math.round(areaSquareMetres / ROOM_AREA_DISPLAY_STEP_SQUARE_METRES) *
    ROOM_AREA_DISPLAY_STEP_SQUARE_METRES;
}

export function formatMetricRoomArea(areaSquareMillimetres: number): string {
  const roundedSquareMetres = roundRoomAreaForDisplaySquareMetres(
    convertSquareMillimetresToSquareMetres(areaSquareMillimetres)
  );

  return `${roundedSquareMetres.toFixed(ROOM_AREA_DISPLAY_MAX_FRACTION_DIGITS).replace(/\.0$/, "")} m²`;
}

export function formatMetricRoomAreaForRoom(room: Room): string {
  return formatMetricRoomArea(getRoomAreaSquareMillimetres(room));
}

export function shouldShowRoomArea(room: Room): boolean {
  return (
    convertSquareMillimetresToSquareMetres(getRoomAreaSquareMillimetres(room)) >=
    MIN_ROOM_AREA_LABEL_DISPLAY_SQUARE_METRES
  );
}

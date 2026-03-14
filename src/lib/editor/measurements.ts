import type { Point, Room } from "@/lib/editor/types";

const SQUARE_MILLIMETRES_PER_SQUARE_METRE = 1_000_000;
const ROOM_AREA_DISPLAY_STEP_SQUARE_METRES = 0.1;
const ROOM_AREA_DISPLAY_MAX_FRACTION_DIGITS = 1;
export const MIN_ROOM_AREA_LABEL_DISPLAY_SQUARE_METRES = 2;

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

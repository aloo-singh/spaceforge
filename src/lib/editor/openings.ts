import { worldToScreen } from "@/lib/editor/camera";
import { snapToGrid } from "@/lib/editor/geometry";
import { getAxisAlignedRoomBounds, type RoomRectBounds } from "@/lib/editor/rectRoomResize";
import type {
  CameraState,
  DoorHingeSide,
  DoorOpeningSide,
  OpeningType,
  Point,
  RectangularRoomWall,
  Room,
  RoomOpening,
  RoomOpeningSelection,
  RoomWall,
  ViewportSize,
} from "@/lib/editor/types";

export const DEFAULT_DOOR_WIDTH_MM = 900;
export const DEFAULT_WINDOW_WIDTH_MM = 1200;
export const DEFAULT_DOOR_OPENING_SIDE: DoorOpeningSide = "interior";
export const DEFAULT_DOOR_HINGE_SIDE: DoorHingeSide = "start";
export const MIN_OPENING_WIDTH_MM = 300;
const OPENING_HIT_PADDING_PX = 10;
const OPENING_HIT_DEPTH_PX = 18;

export type RoomWallSegment = {
  wall: RoomWall;
  segmentIndex: number;
  axis: "horizontal" | "vertical";
  start: Point;
  end: Point;
  originalStart: Point;
  originalEnd: Point;
  interiorNormal: Point;
  lengthMm: number;
};

export type ResolvedRoomOpeningLayout = {
  opening: RoomOpening;
  wall: RoomWall;
  segmentIndex: number;
  axis: RoomWallSegment["axis"];
  center: Point;
  start: Point;
  end: Point;
  interiorNormal: Point;
};

export function cloneRoomOpening(opening: RoomOpening): RoomOpening {
  const normalizedOpening = normalizeRoomOpening(opening);

  return {
    id: normalizedOpening.id,
    type: normalizedOpening.type,
    wall: normalizedOpening.wall,
    offsetMm: normalizedOpening.offsetMm,
    widthMm: normalizedOpening.widthMm,
    openingSide: normalizedOpening.openingSide,
    hingeSide: normalizedOpening.hingeSide,
  };
}

export function cloneRoomOpenings(openings: RoomOpening[]): RoomOpening[] {
  return openings.map(cloneRoomOpening);
}

export function areRoomOpeningsEqual(a: RoomOpening[], b: RoomOpening[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].type !== b[i].type ||
      a[i].wall !== b[i].wall ||
      a[i].offsetMm !== b[i].offsetMm ||
      a[i].widthMm !== b[i].widthMm ||
      a[i].openingSide !== b[i].openingSide ||
      a[i].hingeSide !== b[i].hingeSide
    ) {
      return false;
    }
  }

  return true;
}

export function getRoomWallSegment(room: Room, wall: RoomWall): RoomWallSegment | null {
  if (room.points.length < 2) return null;

  const segmentIndex = resolveRoomWallSegmentIndex(room, wall);
  if (segmentIndex === null) return null;

  const originalStart = room.points[segmentIndex];
  const originalEnd = room.points[(segmentIndex + 1) % room.points.length];
  const axis =
    originalStart.x === originalEnd.x
      ? "vertical"
      : originalStart.y === originalEnd.y
        ? "horizontal"
        : null;
  if (!axis) return null;

  const interiorNormal = getOrthogonalSegmentInteriorNormal(room.points, originalStart, originalEnd);
  if (!interiorNormal) return null;
  const { start, end } = getCanonicalSegmentEndpoints(originalStart, originalEnd, axis);

  return {
    wall,
    segmentIndex,
    axis,
    start,
    end,
    originalStart,
    originalEnd,
    interiorNormal,
    lengthMm:
      axis === "horizontal"
        ? Math.abs(originalEnd.x - originalStart.x)
        : Math.abs(originalEnd.y - originalStart.y),
  };
}

export function getResolvedRoomOpeningLayout(
  room: Room,
  opening: RoomOpening
): ResolvedRoomOpeningLayout | null {
  return getResolvedRoomOpeningLayoutFromRoom(room, opening);
}

export function createCenteredRoomOpening(
  room: Room,
  wall: RoomWall,
  type: OpeningType,
  id: string
): RoomOpening | null {
  const segment = getRoomWallSegment(room, wall);
  if (!segment || segment.lengthMm <= 0) return null;

  const widthMm = Math.min(getDefaultOpeningWidth(type), segment.lengthMm);
  if (widthMm <= 0) return null;

  return {
    id,
    type,
    wall,
    offsetMm: segment.lengthMm / 2,
    widthMm,
    openingSide: DEFAULT_DOOR_OPENING_SIDE,
    hingeSide: DEFAULT_DOOR_HINGE_SIDE,
  };
}

export function findOpeningAtScreenPoint(
  rooms: Room[],
  screenPoint: Point,
  camera: CameraState,
  viewport: ViewportSize
): RoomOpeningSelection | null {
  for (let roomIndex = rooms.length - 1; roomIndex >= 0; roomIndex -= 1) {
    const room = rooms[roomIndex];

    for (let openingIndex = room.openings.length - 1; openingIndex >= 0; openingIndex -= 1) {
      const opening = room.openings[openingIndex];
      const layout = getResolvedRoomOpeningLayout(room, opening);
      if (!layout) continue;

      const start = worldToScreen(layout.start, camera, viewport);
      const end = worldToScreen(layout.end, camera, viewport);
      const center = worldToScreen(layout.center, camera, viewport);

      if (
        layout.axis === "horizontal" &&
        screenPoint.x >= Math.min(start.x, end.x) - OPENING_HIT_PADDING_PX &&
        screenPoint.x <= Math.max(start.x, end.x) + OPENING_HIT_PADDING_PX &&
        screenPoint.y >= center.y - OPENING_HIT_DEPTH_PX &&
        screenPoint.y <= center.y + OPENING_HIT_DEPTH_PX
      ) {
        return { roomId: room.id, openingId: opening.id };
      }

      if (
        layout.axis === "vertical" &&
        screenPoint.y >= Math.min(start.y, end.y) - OPENING_HIT_PADDING_PX &&
        screenPoint.y <= Math.max(start.y, end.y) + OPENING_HIT_PADDING_PX &&
        screenPoint.x >= center.x - OPENING_HIT_DEPTH_PX &&
        screenPoint.x <= center.x + OPENING_HIT_DEPTH_PX
      ) {
        return { roomId: room.id, openingId: opening.id };
      }
    }
  }

  return null;
}

export function getOpeningOffsetForWorldPoint(
  room: Room,
  opening: RoomOpening,
  worldPoint: Point,
  options?: { gridSizeMm?: number }
): number | null {
  const segment = getRoomWallSegment(room, opening.wall);
  if (!segment || segment.lengthMm <= 0) return null;

  const rawOffsetMm =
    segment.axis === "horizontal" ? worldPoint.x - segment.start.x : worldPoint.y - segment.start.y;

  return constrainOpeningOffset(opening, rawOffsetMm, segment.lengthMm, options);
}

export function constrainOpeningOffset(
  opening: Pick<RoomOpening, "widthMm">,
  offsetMm: number,
  wallLengthMm: number,
  options?: { gridSizeMm?: number }
) {
  const snappedOffsetMm =
    options?.gridSizeMm && options.gridSizeMm > 0
      ? snapToGrid(offsetMm, options.gridSizeMm)
      : offsetMm;
  const halfWidthMm = opening.widthMm / 2;
  const minOffsetMm = halfWidthMm;
  const maxOffsetMm = Math.max(halfWidthMm, wallLengthMm - halfWidthMm);

  return clamp(snappedOffsetMm, minOffsetMm, maxOffsetMm);
}

export function constrainOpeningWidth(
  widthMm: number,
  wallLengthMm: number,
  options?: { gridSizeMm?: number }
) {
  const snappedWidthMm =
    options?.gridSizeMm && options.gridSizeMm > 0
      ? snapToGrid(widthMm, options.gridSizeMm)
      : widthMm;
  const minWidthMm = Math.min(MIN_OPENING_WIDTH_MM, wallLengthMm);

  return clamp(snappedWidthMm, minWidthMm, wallLengthMm);
}

export function getUpdatedOpeningForWidth(
  room: Room,
  opening: RoomOpening,
  widthMm: number,
  options?: { gridSizeMm?: number }
): RoomOpening | null {
  const segment = getRoomWallSegment(room, opening.wall);
  if (!segment || segment.lengthMm <= 0) return null;

  const nextWidthMm = constrainOpeningWidth(widthMm, segment.lengthMm, options);
  const nextOffsetMm = constrainOpeningOffset(
    { widthMm: nextWidthMm },
    opening.offsetMm,
    segment.lengthMm
  );

  return {
    ...normalizeRoomOpening(opening),
    widthMm: nextWidthMm,
    offsetMm: nextOffsetMm,
  };
}

export function getResolvedRoomOpeningLayoutFromRoom(
  room: Room,
  opening: RoomOpening
): ResolvedRoomOpeningLayout | null {
  const segment = getRoomWallSegment(room, opening.wall);
  if (!segment || segment.lengthMm <= 0 || opening.widthMm <= 0) return null;

  const centerOffsetMm = clamp(opening.offsetMm, 0, segment.lengthMm);
  const halfWidthMm = opening.widthMm / 2;
  const startOffsetMm = Math.max(0, centerOffsetMm - halfWidthMm);
  const endOffsetMm = Math.min(segment.lengthMm, centerOffsetMm + halfWidthMm);

  if (endOffsetMm <= startOffsetMm) return null;

  return {
    opening,
    wall: opening.wall,
    segmentIndex: segment.segmentIndex,
    axis: segment.axis,
    center: getWallPointAtOffset(segment, centerOffsetMm),
    start: getWallPointAtOffset(segment, startOffsetMm),
    end: getWallPointAtOffset(segment, endOffsetMm),
    interiorNormal: segment.interiorNormal,
  };
}

export function findRoomWallAtScreenPoint(
  room: Room,
  screenPoint: Point,
  camera: CameraState,
  viewport: ViewportSize,
  hitPaddingPx = 14
): RoomWall | null {
  let closestWall: { wall: RoomWall; distancePx: number } | null = null;

  for (let segmentIndex = 0; segmentIndex < room.points.length; segmentIndex += 1) {
    const segment = getRoomWallSegment(room, segmentIndex);
    if (!segment) continue;

    const start = worldToScreen(segment.start, camera, viewport);
    const end = worldToScreen(segment.end, camera, viewport);

    const distancePx =
      segment.axis === "horizontal"
        ? getAxisAlignedHorizontalSegmentHitDistancePx(screenPoint, start, end, hitPaddingPx)
        : getAxisAlignedVerticalSegmentHitDistancePx(screenPoint, start, end, hitPaddingPx);
    if (distancePx === null) continue;

    if (!closestWall || distancePx < closestWall.distancePx) {
      closestWall = {
        wall: segmentIndex,
        distancePx,
      };
    }
  }

  return closestWall?.wall ?? null;
}

export function getRoomWallMeasurement(room: Room, wall: RoomWall) {
  const segment = getRoomWallSegment(room, wall);
  if (!segment) return null;

  return {
    start: segment.start,
    end: segment.end,
    lengthMillimetres: segment.lengthMm,
  };
}

export function normalizeRoomOpeningForSegmentAnchoring(
  room: Room,
  opening: RoomOpening
): RoomOpening {
  const normalizedOpening = normalizeRoomOpening(opening);

  if (typeof normalizedOpening.wall !== "number") {
    return normalizedOpening;
  }

  const segment = getRoomWallSegment(room, normalizedOpening.wall);
  if (!segment) {
    return normalizedOpening;
  }

  const usesDescendingOriginalDirection =
    (segment.axis === "horizontal" && segment.originalStart.x > segment.originalEnd.x) ||
    (segment.axis === "vertical" && segment.originalStart.y > segment.originalEnd.y);
  if (!usesDescendingOriginalDirection) {
    return normalizedOpening;
  }

  return {
    ...normalizedOpening,
    offsetMm: clamp(segment.lengthMm - normalizedOpening.offsetMm, 0, segment.lengthMm),
  };
}

export function normalizeRoomOpeningsForSegmentAnchoring(room: Room): Room["openings"] {
  return room.openings.map((opening) => normalizeRoomOpeningForSegmentAnchoring(room, opening));
}

export function normalizeRoomOpening(opening: RoomOpening): RoomOpening {
  return {
    id: opening.id,
    type: opening.type,
    wall: opening.wall,
    offsetMm: opening.offsetMm,
    widthMm: opening.widthMm,
    openingSide:
      opening.openingSide === "exterior" ? "exterior" : DEFAULT_DOOR_OPENING_SIDE,
    hingeSide: opening.hingeSide === "end" ? "end" : DEFAULT_DOOR_HINGE_SIDE,
  };
}

export function resolveRoomWallSegmentIndex(room: Room, wall: RoomWall): number | null {
  if (typeof wall === "number") {
    return Number.isInteger(wall) && wall >= 0 && wall < room.points.length ? wall : null;
  }

  const bounds = getAxisAlignedRoomBounds(room);
  if (!bounds) return null;

  return getRectangularWallSegmentIndex(room.points, bounds, wall);
}

function getRectangularWallSegmentIndex(
  points: Point[],
  bounds: RoomRectBounds,
  wall: RectangularRoomWall
) {
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];

    if (wall === "top" && start.y === bounds.minY && end.y === bounds.minY) return index;
    if (wall === "right" && start.x === bounds.maxX && end.x === bounds.maxX) return index;
    if (wall === "bottom" && start.y === bounds.maxY && end.y === bounds.maxY) return index;
    if (wall === "left" && start.x === bounds.minX && end.x === bounds.minX) return index;
  }

  return null;
}

function getCanonicalSegmentEndpoints(
  start: Point,
  end: Point,
  axis: RoomWallSegment["axis"]
) {
  if (axis === "horizontal") {
    return start.x <= end.x ? { start, end } : { start: end, end: start };
  }

  return start.y <= end.y ? { start, end } : { start: end, end: start };
}

function getOrthogonalSegmentInteriorNormal(
  polygonPoints: Point[],
  start: Point,
  end: Point
): Point | null {
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const candidateNormals =
    start.x === end.x
      ? [
          { x: -1, y: 0 },
          { x: 1, y: 0 },
        ]
      : [
          { x: 0, y: -1 },
          { x: 0, y: 1 },
        ];

  for (const normal of candidateNormals) {
    const probe = {
      x: midpoint.x + normal.x,
      y: midpoint.y + normal.y,
    };
    if (isPointInsideOrOnPolygon(probe, polygonPoints)) {
      return normal;
    }
  }

  return null;
}

function isPointInsideOrOnPolygon(point: Point, polygon: Point[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];

    if (isPointOnSegment(point, a, b)) return true;

    const intersects =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointOnSegment(point: Point, a: Point, b: Point, epsilon = 1e-6) {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > epsilon) return false;

  const minX = Math.min(a.x, b.x) - epsilon;
  const maxX = Math.max(a.x, b.x) + epsilon;
  const minY = Math.min(a.y, b.y) - epsilon;
  const maxY = Math.max(a.y, b.y) + epsilon;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function getAxisAlignedHorizontalSegmentHitDistancePx(
  point: Point,
  start: Point,
  end: Point,
  hitPaddingPx: number
) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  if (point.x < minX - hitPaddingPx || point.x > maxX + hitPaddingPx) return null;

  const distancePx = Math.abs(point.y - start.y);
  return distancePx <= hitPaddingPx ? distancePx : null;
}

function getAxisAlignedVerticalSegmentHitDistancePx(
  point: Point,
  start: Point,
  end: Point,
  hitPaddingPx: number
) {
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  if (point.y < minY - hitPaddingPx || point.y > maxY + hitPaddingPx) return null;

  const distancePx = Math.abs(point.x - start.x);
  return distancePx <= hitPaddingPx ? distancePx : null;
}

function getWallPointAtOffset(segment: RoomWallSegment, offsetMm: number): Point {
  if (segment.axis === "horizontal") {
    return {
      x: segment.start.x + offsetMm,
      y: segment.start.y,
    };
  }

  return {
    x: segment.start.x,
    y: segment.start.y + offsetMm,
  };
}

function getDefaultOpeningWidth(type: OpeningType) {
  return type === "door" ? DEFAULT_DOOR_WIDTH_MM : DEFAULT_WINDOW_WIDTH_MM;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

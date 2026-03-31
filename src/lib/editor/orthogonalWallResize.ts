import { worldToScreen } from "@/lib/editor/camera";
import { getRoomWallSegment } from "@/lib/editor/openings";
import { snapToGrid } from "@/lib/editor/geometry";
import { isOrthogonalPointPath, isSimplePolygon } from "@/lib/editor/roomGeometry";
import type { CameraState, Point, Room, ViewportSize } from "@/lib/editor/types";

export type OrthogonalWallHandleLayout = {
  wallIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

const HANDLE_LENGTH_PX = 40;
const HANDLE_THICKNESS_PX = 8;
const MIN_HANDLE_LENGTH_PX = 14;
const HANDLE_HIT_PADDING_PX = 8;

export function getOrthogonalWallHandleLayouts(
  room: Room,
  camera: CameraState,
  viewport: ViewportSize
): OrthogonalWallHandleLayout[] {
  if (room.points.length < 2) return [];

  const layouts: OrthogonalWallHandleLayout[] = [];

  for (let wallIndex = 0; wallIndex < room.points.length; wallIndex += 1) {
    const segment = getRoomWallSegment(room, wallIndex);
    if (!segment) continue;

    const start = worldToScreen(segment.originalStart, camera, viewport);
    const end = worldToScreen(segment.originalEnd, camera, viewport);
    const lengthPx =
      segment.axis === "horizontal"
        ? Math.abs(end.x - start.x)
        : Math.abs(end.y - start.y);
    const handleLength = clampHandleLength(lengthPx);
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };

    layouts.push(
      segment.axis === "horizontal"
        ? {
            wallIndex,
            left: midpoint.x - handleLength / 2,
            top: midpoint.y - HANDLE_THICKNESS_PX / 2,
            width: handleLength,
            height: HANDLE_THICKNESS_PX,
          }
        : {
            wallIndex,
            left: midpoint.x - HANDLE_THICKNESS_PX / 2,
            top: midpoint.y - handleLength / 2,
            width: HANDLE_THICKNESS_PX,
            height: handleLength,
          }
    );
  }

  return layouts;
}

export function hitTestOrthogonalWallHandle(
  handles: OrthogonalWallHandleLayout[],
  point: Point
): number | null {
  for (const handle of handles) {
    if (
      point.x >= handle.left - HANDLE_HIT_PADDING_PX &&
      point.x <= handle.left + handle.width + HANDLE_HIT_PADDING_PX &&
      point.y >= handle.top - HANDLE_HIT_PADDING_PX &&
      point.y <= handle.top + handle.height + HANDLE_HIT_PADDING_PX
    ) {
      return handle.wallIndex;
    }
  }

  return null;
}

export function getOrthogonalWallAdjustmentResult(
  points: Point[],
  wallIndex: number,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): Point[] | null {
  if (points.length < 4) return null;

  const start = points[wallIndex];
  const end = points[(wallIndex + 1) % points.length];
  const axis =
    start.x === end.x ? "vertical" : start.y === end.y ? "horizontal" : null;
  if (!axis) return null;

  const gridSizeMm = options?.gridSizeMm ?? 1;
  const nextPoints = points.map((point) => ({ ...point }));
  const snappedX = gridSizeMm > 0 ? snapToGrid(cursorWorld.x, gridSizeMm) : cursorWorld.x;
  const snappedY = gridSizeMm > 0 ? snapToGrid(cursorWorld.y, gridSizeMm) : cursorWorld.y;

  if (axis === "horizontal") {
    nextPoints[wallIndex] = { ...start, y: snappedY };
    nextPoints[(wallIndex + 1) % points.length] = { ...end, y: snappedY };
  } else {
    nextPoints[wallIndex] = { ...start, x: snappedX };
    nextPoints[(wallIndex + 1) % points.length] = { ...end, x: snappedX };
  }

  if (!isOrthogonalPointPath(nextPoints, { closed: true })) return null;
  if (!isSimplePolygon(nextPoints)) return null;

  return nextPoints;
}

function clampHandleLength(lengthPx: number) {
  return Math.max(MIN_HANDLE_LENGTH_PX, Math.min(HANDLE_LENGTH_PX, lengthPx));
}

import { GRID_SIZE_MM } from "@/lib/editor/constants";
import { snapToGrid } from "@/lib/editor/geometry";
import { worldToScreen } from "@/lib/editor/camera";
import type { CameraState, Point, Room, ViewportSize } from "@/lib/editor/types";

export type RectWall = "left" | "right" | "top" | "bottom";
export type RectCorner = "top-left" | "top-right" | "bottom-right" | "bottom-left";

export type RoomRectBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type WallHandleLayout = {
  wall: RectWall;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CornerHandleLayout = {
  corner: RectCorner;
  center: Point;
  size: number;
};

const HANDLE_LENGTH_PX = 40;
const HANDLE_THICKNESS_PX = 8;
const MIN_HANDLE_LENGTH_PX = 14;
const HANDLE_EDGE_PADDING_PX = 8;
const HANDLE_HIT_PADDING_PX = 8;
const CORNER_HANDLE_SIZE_PX = 10;
const CORNER_HIT_PADDING_PX = 8;
export const MIN_ROOM_SIZE_MM = GRID_SIZE_MM;

export function getAxisAlignedRoomBounds(room: Room): RoomRectBounds | null {
  if (room.points.length < 4) return null;

  const xs = Array.from(new Set(room.points.map((point) => point.x)));
  const ys = Array.from(new Set(room.points.map((point) => point.y)));
  if (xs.length !== 2 || ys.length !== 2) return null;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (minX === maxX || minY === maxY) return null;

  const corners = new Set(room.points.map((point) => `${point.x}:${point.y}`));
  if (
    !corners.has(`${minX}:${minY}`) ||
    !corners.has(`${maxX}:${minY}`) ||
    !corners.has(`${maxX}:${maxY}`) ||
    !corners.has(`${minX}:${maxY}`)
  ) {
    return null;
  }

  return { minX, maxX, minY, maxY };
}

export function getRoomPointsFromBounds(bounds: RoomRectBounds): Point[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

export function getWallHandleLayouts(
  bounds: RoomRectBounds,
  camera: CameraState,
  viewport: ViewportSize
): WallHandleLayout[] {
  const topLeft = worldToScreen({ x: bounds.minX, y: bounds.minY }, camera, viewport);
  const topRight = worldToScreen({ x: bounds.maxX, y: bounds.minY }, camera, viewport);
  const bottomLeft = worldToScreen({ x: bounds.minX, y: bounds.maxY }, camera, viewport);

  const wallWidth = Math.abs(topRight.x - topLeft.x);
  const wallHeight = Math.abs(bottomLeft.y - topLeft.y);
  const horizontalLength = clampHandleLength(wallWidth);
  const verticalLength = clampHandleLength(wallHeight);
  const midX = (topLeft.x + topRight.x) / 2;
  const midY = (topLeft.y + bottomLeft.y) / 2;

  return [
    {
      wall: "top",
      left: midX - horizontalLength / 2,
      top: topLeft.y - HANDLE_THICKNESS_PX / 2,
      width: horizontalLength,
      height: HANDLE_THICKNESS_PX,
    },
    {
      wall: "bottom",
      left: midX - horizontalLength / 2,
      top: bottomLeft.y - HANDLE_THICKNESS_PX / 2,
      width: horizontalLength,
      height: HANDLE_THICKNESS_PX,
    },
    {
      wall: "left",
      left: topLeft.x - HANDLE_THICKNESS_PX / 2,
      top: midY - verticalLength / 2,
      width: HANDLE_THICKNESS_PX,
      height: verticalLength,
    },
    {
      wall: "right",
      left: topRight.x - HANDLE_THICKNESS_PX / 2,
      top: midY - verticalLength / 2,
      width: HANDLE_THICKNESS_PX,
      height: verticalLength,
    },
  ];
}

export function hitTestWallHandle(
  handles: WallHandleLayout[],
  point: Point
): RectWall | null {
  for (const handle of handles) {
    if (
      point.x >= handle.left - HANDLE_HIT_PADDING_PX &&
      point.x <= handle.left + handle.width + HANDLE_HIT_PADDING_PX &&
      point.y >= handle.top - HANDLE_HIT_PADDING_PX &&
      point.y <= handle.top + handle.height + HANDLE_HIT_PADDING_PX
    ) {
      return handle.wall;
    }
  }

  return null;
}

export function getCornerHandleLayouts(
  bounds: RoomRectBounds,
  camera: CameraState,
  viewport: ViewportSize
): CornerHandleLayout[] {
  const topLeft = worldToScreen({ x: bounds.minX, y: bounds.minY }, camera, viewport);
  const topRight = worldToScreen({ x: bounds.maxX, y: bounds.minY }, camera, viewport);
  const bottomRight = worldToScreen({ x: bounds.maxX, y: bounds.maxY }, camera, viewport);
  const bottomLeft = worldToScreen({ x: bounds.minX, y: bounds.maxY }, camera, viewport);

  return [
    { corner: "top-left", center: topLeft, size: CORNER_HANDLE_SIZE_PX },
    { corner: "top-right", center: topRight, size: CORNER_HANDLE_SIZE_PX },
    { corner: "bottom-right", center: bottomRight, size: CORNER_HANDLE_SIZE_PX },
    { corner: "bottom-left", center: bottomLeft, size: CORNER_HANDLE_SIZE_PX },
  ];
}

export function hitTestCornerHandle(
  handles: CornerHandleLayout[],
  point: Point
): RectCorner | null {
  for (const handle of handles) {
    const half = handle.size / 2;
    if (
      point.x >= handle.center.x - half - CORNER_HIT_PADDING_PX &&
      point.x <= handle.center.x + half + CORNER_HIT_PADDING_PX &&
      point.y >= handle.center.y - half - CORNER_HIT_PADDING_PX &&
      point.y <= handle.center.y + half + CORNER_HIT_PADDING_PX
    ) {
      return handle.corner;
    }
  }

  return null;
}

export function resizeBoundsForWallDrag(
  bounds: RoomRectBounds,
  wall: RectWall,
  cursorWorld: Point,
  options?: {
    gridSizeMm?: number;
    minRoomSizeMm?: number;
  }
): RoomRectBounds {
  const gridSizeMm = options?.gridSizeMm ?? GRID_SIZE_MM;
  const minRoomSizeMm = options?.minRoomSizeMm ?? MIN_ROOM_SIZE_MM;

  if (wall === "left" || wall === "right") {
    const snappedX = snapToGrid(cursorWorld.x, gridSizeMm);

    if (wall === "left") {
      return {
        ...bounds,
        minX: Math.min(snappedX, bounds.maxX - minRoomSizeMm),
      };
    }

    return {
      ...bounds,
      maxX: Math.max(snappedX, bounds.minX + minRoomSizeMm),
    };
  }

  const snappedY = snapToGrid(cursorWorld.y, gridSizeMm);
  if (wall === "top") {
    return {
      ...bounds,
      minY: Math.min(snappedY, bounds.maxY - minRoomSizeMm),
    };
  }

  return {
    ...bounds,
    maxY: Math.max(snappedY, bounds.minY + minRoomSizeMm),
  };
}

export function resizeBoundsForCornerDrag(
  bounds: RoomRectBounds,
  corner: RectCorner,
  cursorWorld: Point,
  options?: {
    gridSizeMm?: number;
    minRoomSizeMm?: number;
  }
): RoomRectBounds {
  const gridSizeMm = options?.gridSizeMm ?? GRID_SIZE_MM;
  const minRoomSizeMm = options?.minRoomSizeMm ?? MIN_ROOM_SIZE_MM;
  const snappedX = snapToGrid(cursorWorld.x, gridSizeMm);
  const snappedY = snapToGrid(cursorWorld.y, gridSizeMm);

  if (corner === "top-left") {
    return {
      ...bounds,
      minX: Math.min(snappedX, bounds.maxX - minRoomSizeMm),
      minY: Math.min(snappedY, bounds.maxY - minRoomSizeMm),
    };
  }

  if (corner === "top-right") {
    return {
      ...bounds,
      maxX: Math.max(snappedX, bounds.minX + minRoomSizeMm),
      minY: Math.min(snappedY, bounds.maxY - minRoomSizeMm),
    };
  }

  if (corner === "bottom-right") {
    return {
      ...bounds,
      maxX: Math.max(snappedX, bounds.minX + minRoomSizeMm),
      maxY: Math.max(snappedY, bounds.minY + minRoomSizeMm),
    };
  }

  return {
    ...bounds,
    minX: Math.min(snappedX, bounds.maxX - minRoomSizeMm),
    maxY: Math.max(snappedY, bounds.minY + minRoomSizeMm),
  };
}

function clampHandleLength(wallLength: number): number {
  return Math.max(
    MIN_HANDLE_LENGTH_PX,
    Math.min(HANDLE_LENGTH_PX, Math.max(wallLength - HANDLE_EDGE_PADDING_PX * 2, 0))
  );
}

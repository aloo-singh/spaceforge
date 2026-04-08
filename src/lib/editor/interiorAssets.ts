import { worldToScreen } from "@/lib/editor/camera";
import { normalizeCanvasRotationDegrees } from "@/lib/editor/canvasRotation";
import { snapToGrid } from "@/lib/editor/geometry";
import { getPolygonBounds, isPointInPolygon } from "@/lib/editor/roomGeometry";
import type { RectCorner, RectWall, RoomRectBounds } from "@/lib/editor/rectRoomResize";
import type {
  CameraState,
  Point,
  Room,
  RoomInteriorAsset,
  RoomInteriorAssetSelection,
  ViewportSize,
} from "@/lib/editor/types";

export const DEFAULT_STAIR_WIDTH_MM = 1200;
export const DEFAULT_STAIR_DEPTH_MM = 2700;
export const DEFAULT_STAIR_TREAD_SPACING_MM = 300;
export const MIN_STAIR_WIDTH_MM = 300;
export const MIN_STAIR_DEPTH_MM = DEFAULT_STAIR_TREAD_SPACING_MM;
export const DEFAULT_STAIR_NAME = "Stairs";
const INTERIOR_ASSET_HIT_PADDING_PX = 10;

export type RoomInteriorAssetBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type InteriorAssetResizeWall = RectWall;
export type InteriorAssetResizeCorner = RectCorner;

export function cloneRoomInteriorAsset(asset: RoomInteriorAsset): RoomInteriorAsset {
  return {
    id: asset.id,
    type: asset.type,
    name: asset.name ?? DEFAULT_STAIR_NAME,
    xMm: asset.xMm,
    yMm: asset.yMm,
    widthMm: asset.widthMm,
    depthMm: asset.depthMm,
    rotationDegrees: normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0),
  };
}

export function cloneRoomInteriorAssets(assets: RoomInteriorAsset[]): RoomInteriorAsset[] {
  return assets.map(cloneRoomInteriorAsset);
}

export function areRoomInteriorAssetsEqual(
  a: RoomInteriorAsset[],
  b: RoomInteriorAsset[]
): boolean {
  if (a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    const assetA = a[index];
    const assetB = b[index];
    if (
      assetA.id !== assetB.id ||
      assetA.type !== assetB.type ||
      assetA.name !== assetB.name ||
      assetA.xMm !== assetB.xMm ||
      assetA.yMm !== assetB.yMm ||
      assetA.widthMm !== assetB.widthMm ||
      assetA.depthMm !== assetB.depthMm ||
      normalizeCanvasRotationDegrees(assetA.rotationDegrees ?? 0) !==
        normalizeCanvasRotationDegrees(assetB.rotationDegrees ?? 0)
    ) {
      return false;
    }
  }

  return true;
}

export function getRoomInteriorAssetBounds(
  asset: Pick<RoomInteriorAsset, "xMm" | "yMm" | "widthMm" | "depthMm">
): RoomInteriorAssetBounds {
  const halfWidth = asset.widthMm / 2;
  const halfDepth = asset.depthMm / 2;

  return {
    left: asset.xMm - halfWidth,
    right: asset.xMm + halfWidth,
    top: asset.yMm - halfDepth,
    bottom: asset.yMm + halfDepth,
  };
}

export function isInteriorAssetWithinRoom(room: Room, asset: RoomInteriorAsset): boolean {
  const bounds = getRoomInteriorAssetBounds(asset);
  return (
    isPointInPolygon({ x: bounds.left, y: bounds.top }, room.points) &&
    isPointInPolygon({ x: bounds.right, y: bounds.top }, room.points) &&
    isPointInPolygon({ x: bounds.right, y: bounds.bottom }, room.points) &&
    isPointInPolygon({ x: bounds.left, y: bounds.bottom }, room.points)
  );
}

export function canPlaceDefaultStairInRoom(room: Room): boolean {
  return findDefaultStairPlacement(room) !== null;
}

export function createCenteredDefaultStair(room: Room, id: string): RoomInteriorAsset | null {
  const center = findDefaultStairPlacement(room);
  if (!center) return null;

  return {
    id,
    type: "stairs",
    name: DEFAULT_STAIR_NAME,
    xMm: center.x,
    yMm: center.y,
    widthMm: DEFAULT_STAIR_WIDTH_MM,
    depthMm: DEFAULT_STAIR_DEPTH_MM,
    rotationDegrees: 0,
  };
}

export function findInteriorAssetAtScreenPoint(
  rooms: Room[],
  screenPoint: Point,
  camera: CameraState,
  viewport: ViewportSize
): RoomInteriorAssetSelection | null {
  for (let roomIndex = rooms.length - 1; roomIndex >= 0; roomIndex -= 1) {
    const room = rooms[roomIndex];

    for (let assetIndex = room.interiorAssets.length - 1; assetIndex >= 0; assetIndex -= 1) {
      const asset = room.interiorAssets[assetIndex];
      const bounds = getRoomInteriorAssetBounds(asset);
      const topLeft = worldToScreen({ x: bounds.left, y: bounds.top }, camera, viewport);
      const bottomRight = worldToScreen({ x: bounds.right, y: bounds.bottom }, camera, viewport);

      if (
        screenPoint.x >= Math.min(topLeft.x, bottomRight.x) - INTERIOR_ASSET_HIT_PADDING_PX &&
        screenPoint.x <= Math.max(topLeft.x, bottomRight.x) + INTERIOR_ASSET_HIT_PADDING_PX &&
        screenPoint.y >= Math.min(topLeft.y, bottomRight.y) - INTERIOR_ASSET_HIT_PADDING_PX &&
        screenPoint.y <= Math.max(topLeft.y, bottomRight.y) + INTERIOR_ASSET_HIT_PADDING_PX
      ) {
        return { roomId: room.id, assetId: asset.id };
      }
    }
  }

  return null;
}

export function constrainInteriorAssetCenter(
  room: Room,
  asset: RoomInteriorAsset,
  targetCenter: Point,
  options?: { gridSizeMm?: number }
): Point | null {
  const nextCenter = {
    x:
      options?.gridSizeMm && options.gridSizeMm > 0
        ? snapToGrid(targetCenter.x, options.gridSizeMm)
        : targetCenter.x,
    y:
      options?.gridSizeMm && options.gridSizeMm > 0
        ? snapToGrid(targetCenter.y, options.gridSizeMm)
        : targetCenter.y,
  };

  return findConstrainedInteriorAssetCenter(room, asset.widthMm, asset.depthMm, nextCenter);
}

export function getInteriorAssetBoundsAsRectBounds(
  asset: Pick<RoomInteriorAsset, "xMm" | "yMm" | "widthMm" | "depthMm">
): RoomRectBounds {
  const bounds = getRoomInteriorAssetBounds(asset);
  return {
    minX: bounds.left,
    maxX: bounds.right,
    minY: bounds.top,
    maxY: bounds.bottom,
  };
}

export function getInteriorAssetFromBounds(
  asset: RoomInteriorAsset,
  bounds: RoomRectBounds
): RoomInteriorAsset {
  return {
    ...cloneRoomInteriorAsset(asset),
    xMm: (bounds.minX + bounds.maxX) / 2,
    yMm: (bounds.minY + bounds.maxY) / 2,
    widthMm: bounds.maxX - bounds.minX,
    depthMm: bounds.maxY - bounds.minY,
  };
}

export function getResizedStairForWallDrag(
  room: Room,
  asset: RoomInteriorAsset,
  wall: InteriorAssetResizeWall,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): RoomInteriorAsset | null {
  const nextBounds = resizeInteriorAssetBoundsForWallDrag(
    getInteriorAssetBoundsAsRectBounds(asset),
    wall,
    cursorWorld,
    options
  );
  return getConstrainedResizedStair(room, asset, nextBounds, options);
}

export function getResizedStairForCornerDrag(
  room: Room,
  asset: RoomInteriorAsset,
  corner: InteriorAssetResizeCorner,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): RoomInteriorAsset | null {
  const nextBounds = resizeInteriorAssetBoundsForCornerDrag(
    getInteriorAssetBoundsAsRectBounds(asset),
    corner,
    cursorWorld,
    options
  );
  return getConstrainedResizedStair(room, asset, nextBounds, options);
}

function findDefaultStairPlacement(room: Room): Point | null {
  const anchor = getRoomInteriorAssetAnchor(room);
  return findConstrainedInteriorAssetCenter(
    room,
    DEFAULT_STAIR_WIDTH_MM,
    DEFAULT_STAIR_DEPTH_MM,
    anchor
  );
}

function getRoomInteriorAssetAnchor(room: Room): Point {
  const bounds = getPolygonBounds(room.points);
  if (!bounds) {
    return { x: 0, y: 0 };
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

function findConstrainedInteriorAssetCenter(
  room: Room,
  widthMm: number,
  depthMm: number,
  preferredCenter: Point
): Point | null {
  const bounds = getPolygonBounds(room.points);
  if (!bounds) return null;

  const halfWidth = widthMm / 2;
  const halfDepth = depthMm / 2;
  const minX = bounds.minX + halfWidth;
  const maxX = bounds.maxX - halfWidth;
  const minY = bounds.minY + halfDepth;
  const maxY = bounds.maxY - halfDepth;

  if (minX > maxX || minY > maxY) return null;

  const clampedPreferred = {
    x: clamp(preferredCenter.x, minX, maxX),
    y: clamp(preferredCenter.y, minY, maxY),
  };

  const directCandidate = {
    id: "__candidate__",
    type: "stairs" as const,
    name: DEFAULT_STAIR_NAME,
    xMm: clampedPreferred.x,
    yMm: clampedPreferred.y,
    widthMm,
    depthMm,
    rotationDegrees: 0,
  };
  if (isInteriorAssetWithinRoom(room, directCandidate)) {
    return clampedPreferred;
  }

  const stepMm = 100;
  let bestCandidate: Point | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let y = minY; y <= maxY; y += stepMm) {
    for (let x = minX; x <= maxX; x += stepMm) {
      const candidate = {
        id: "__candidate__",
        type: "stairs" as const,
        name: DEFAULT_STAIR_NAME,
        xMm: x,
        yMm: y,
        widthMm,
        depthMm,
        rotationDegrees: 0,
      };
      if (!isInteriorAssetWithinRoom(room, candidate)) continue;

      const distanceSquared = (x - preferredCenter.x) ** 2 + (y - preferredCenter.y) ** 2;
      if (distanceSquared < bestDistanceSquared) {
        bestCandidate = { x, y };
        bestDistanceSquared = distanceSquared;
      }
    }
  }

  return bestCandidate;
}

function getConstrainedResizedStair(
  room: Room,
  asset: RoomInteriorAsset,
  resizedBounds: RoomRectBounds,
  options?: { gridSizeMm?: number }
): RoomInteriorAsset | null {
  const normalizedBounds = normalizeInteriorAssetResizeBounds(resizedBounds);
  const snappedBounds = {
    minX: normalizedBounds.minX,
    maxX: normalizedBounds.maxX,
    minY: normalizedBounds.minY,
    maxY:
      normalizedBounds.minY +
      snapStairDepthMm(normalizedBounds.maxY - normalizedBounds.minY, options?.gridSizeMm),
  };

  if (snappedBounds.maxY - snappedBounds.minY < MIN_STAIR_DEPTH_MM) {
    snappedBounds.maxY = snappedBounds.minY + MIN_STAIR_DEPTH_MM;
  }
  if (snappedBounds.maxX - snappedBounds.minX < MIN_STAIR_WIDTH_MM) {
    snappedBounds.maxX = snappedBounds.minX + MIN_STAIR_WIDTH_MM;
  }

  const nextAsset = getInteriorAssetFromBounds(asset, snappedBounds);
  return isInteriorAssetWithinRoom(room, nextAsset) ? nextAsset : null;
}

function resizeInteriorAssetBoundsForWallDrag(
  bounds: RoomRectBounds,
  wall: InteriorAssetResizeWall,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): RoomRectBounds {
  const snappedX =
    options?.gridSizeMm && options.gridSizeMm > 0
      ? snapToGrid(cursorWorld.x, options.gridSizeMm)
      : cursorWorld.x;
  if (wall === "left") {
    return {
      ...bounds,
      minX: Math.min(snappedX, bounds.maxX - MIN_STAIR_WIDTH_MM),
    };
  }

  if (wall === "right") {
    return {
      ...bounds,
      maxX: Math.max(snappedX, bounds.minX + MIN_STAIR_WIDTH_MM),
    };
  }

  const snappedY =
    options?.gridSizeMm && options.gridSizeMm > 0
      ? snapToGrid(cursorWorld.y, options.gridSizeMm)
      : cursorWorld.y;
  if (wall === "top") {
    return {
      ...bounds,
      minY: Math.min(snappedY, bounds.maxY - MIN_STAIR_DEPTH_MM),
    };
  }

  return {
    ...bounds,
    maxY: Math.max(snappedY, bounds.minY + MIN_STAIR_DEPTH_MM),
  };
}

function resizeInteriorAssetBoundsForCornerDrag(
  bounds: RoomRectBounds,
  corner: InteriorAssetResizeCorner,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): RoomRectBounds {
  const snappedX =
    options?.gridSizeMm && options.gridSizeMm > 0
      ? snapToGrid(cursorWorld.x, options.gridSizeMm)
      : cursorWorld.x;
  const snappedY =
    options?.gridSizeMm && options.gridSizeMm > 0
      ? snapToGrid(cursorWorld.y, options.gridSizeMm)
      : cursorWorld.y;

  if (corner === "top-left") {
    return {
      minX: Math.min(snappedX, bounds.maxX - MIN_STAIR_WIDTH_MM),
      maxX: bounds.maxX,
      minY: Math.min(snappedY, bounds.maxY - MIN_STAIR_DEPTH_MM),
      maxY: bounds.maxY,
    };
  }

  if (corner === "top-right") {
    return {
      minX: bounds.minX,
      maxX: Math.max(snappedX, bounds.minX + MIN_STAIR_WIDTH_MM),
      minY: Math.min(snappedY, bounds.maxY - MIN_STAIR_DEPTH_MM),
      maxY: bounds.maxY,
    };
  }

  if (corner === "bottom-right") {
    return {
      minX: bounds.minX,
      maxX: Math.max(snappedX, bounds.minX + MIN_STAIR_WIDTH_MM),
      minY: bounds.minY,
      maxY: Math.max(snappedY, bounds.minY + MIN_STAIR_DEPTH_MM),
    };
  }

  return {
    minX: Math.min(snappedX, bounds.maxX - MIN_STAIR_WIDTH_MM),
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: Math.max(snappedY, bounds.minY + MIN_STAIR_DEPTH_MM),
  };
}

function normalizeInteriorAssetResizeBounds(bounds: RoomRectBounds): RoomRectBounds {
  return {
    minX: Math.min(bounds.minX, bounds.maxX),
    maxX: Math.max(bounds.minX, bounds.maxX),
    minY: Math.min(bounds.minY, bounds.maxY),
    maxY: Math.max(bounds.minY, bounds.maxY),
  };
}

function snapStairDepthMm(depthMm: number, gridSizeMm?: number) {
  return Math.max(
    MIN_STAIR_DEPTH_MM,
    gridSizeMm && gridSizeMm > 0 ? snapToGrid(depthMm, gridSizeMm) : depthMm
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

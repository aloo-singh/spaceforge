import { worldToScreen } from "@/lib/editor/camera";
import { snapToGrid } from "@/lib/editor/geometry";
import { getPolygonBounds, isPointInPolygon } from "@/lib/editor/roomGeometry";
import type {
  CameraState,
  Point,
  Room,
  RoomInteriorAsset,
  RoomInteriorAssetSelection,
  ViewportSize,
} from "@/lib/editor/types";

export const DEFAULT_STAIR_WIDTH_MM = 1200;
export const DEFAULT_STAIR_DEPTH_MM = 2800;
export const DEFAULT_STAIR_TREAD_SPACING_MM = 300;
const INTERIOR_ASSET_HIT_PADDING_PX = 10;

export type RoomInteriorAssetBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function cloneRoomInteriorAsset(asset: RoomInteriorAsset): RoomInteriorAsset {
  return {
    id: asset.id,
    type: asset.type,
    xMm: asset.xMm,
    yMm: asset.yMm,
    widthMm: asset.widthMm,
    depthMm: asset.depthMm,
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
      assetA.xMm !== assetB.xMm ||
      assetA.yMm !== assetB.yMm ||
      assetA.widthMm !== assetB.widthMm ||
      assetA.depthMm !== assetB.depthMm
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
    xMm: center.x,
    yMm: center.y,
    widthMm: DEFAULT_STAIR_WIDTH_MM,
    depthMm: DEFAULT_STAIR_DEPTH_MM,
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
    xMm: clampedPreferred.x,
    yMm: clampedPreferred.y,
    widthMm,
    depthMm,
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
        xMm: x,
        yMm: y,
        widthMm,
        depthMm,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

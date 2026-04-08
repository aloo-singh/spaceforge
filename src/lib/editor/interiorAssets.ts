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
  StairDirection,
  RoomInteriorAssetSelection,
  ViewportSize,
} from "@/lib/editor/types";

export const DEFAULT_STAIR_WIDTH_MM = 1200;
export const DEFAULT_STAIR_DEPTH_MM = 2700;
export const DEFAULT_STAIR_TREAD_SPACING_MM = 300;
export const MIN_STAIR_WIDTH_MM = 300;
export const MIN_STAIR_DEPTH_MM = DEFAULT_STAIR_TREAD_SPACING_MM;
export const DEFAULT_STAIR_NAME = "Stairs";
export const DEFAULT_STAIR_ARROW_ENABLED = true;
export const DEFAULT_STAIR_ARROW_DIRECTION: StairDirection = "forward";
export const DEFAULT_STAIR_ARROW_LABEL = "UP";
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
    arrowEnabled: asset.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED,
    arrowDirection: asset.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION,
    arrowLabel: asset.arrowLabel ?? DEFAULT_STAIR_ARROW_LABEL,
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
        normalizeCanvasRotationDegrees(assetB.rotationDegrees ?? 0) ||
      (assetA.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED) !==
        (assetB.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED) ||
      (assetA.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION) !==
        (assetB.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION) ||
      (assetA.arrowLabel ?? DEFAULT_STAIR_ARROW_LABEL) !==
        (assetB.arrowLabel ?? DEFAULT_STAIR_ARROW_LABEL)
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
    arrowEnabled: DEFAULT_STAIR_ARROW_ENABLED,
    arrowDirection: DEFAULT_STAIR_ARROW_DIRECTION,
    arrowLabel: DEFAULT_STAIR_ARROW_LABEL,
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
  const nextCenter =
    options?.gridSizeMm && options.gridSizeMm > 0
      ? getSnappedInteriorAssetCenter(targetCenter, asset, options.gridSizeMm)
      : targetCenter;

  return findConstrainedInteriorAssetCenter(room, asset.widthMm, asset.depthMm, nextCenter);
}

export function getAdjustedInteriorAssetForRoomResize(
  room: Room,
  asset: RoomInteriorAsset
): RoomInteriorAsset | null {
  const normalizedAsset = cloneRoomInteriorAsset(asset);
  if (isInteriorAssetWithinRoom(room, normalizedAsset)) {
    return normalizedAsset;
  }

  const nudgedCenter = constrainInteriorAssetCenter(room, normalizedAsset, {
    x: normalizedAsset.xMm,
    y: normalizedAsset.yMm,
  });
  if (nudgedCenter) {
    return {
      ...normalizedAsset,
      xMm: nudgedCenter.x,
      yMm: nudgedCenter.y,
    };
  }

  const bounds = getPolygonBounds(room.points);
  if (!bounds) return null;

  const maxWidthMm = bounds.maxX - bounds.minX;
  const maxDepthMm = bounds.maxY - bounds.minY;
  if (maxWidthMm < MIN_STAIR_WIDTH_MM || maxDepthMm < MIN_STAIR_DEPTH_MM) {
    return null;
  }

  const assetBounds = getRoomInteriorAssetBounds(normalizedAsset);
  const isHorizontalRun = isStairRunHorizontal(normalizedAsset);
  const maxRunMm = isHorizontalRun ? maxWidthMm : maxDepthMm;
  const maxCrossMm = isHorizontalRun ? maxDepthMm : maxWidthMm;
  const startingRunMm = Math.min(
    isHorizontalRun ? normalizedAsset.widthMm : normalizedAsset.depthMm,
    maxRunMm
  );
  const startingCrossMm = Math.max(
    MIN_STAIR_WIDTH_MM,
    Math.min(isHorizontalRun ? normalizedAsset.depthMm : normalizedAsset.widthMm, maxCrossMm)
  );
  const startingSnappedRunMm = Math.floor(startingRunMm / DEFAULT_STAIR_TREAD_SPACING_MM) *
    DEFAULT_STAIR_TREAD_SPACING_MM;

  for (
    let runMm = startingSnappedRunMm;
    runMm >= MIN_STAIR_DEPTH_MM;
    runMm -= DEFAULT_STAIR_TREAD_SPACING_MM
  ) {
    for (let crossMm = startingCrossMm; crossMm >= MIN_STAIR_WIDTH_MM; crossMm -= 100) {
      const candidateBounds = getResizeAdjustedBoundsForRoomResize(
        assetBounds,
        bounds,
        {
          widthMm: isHorizontalRun ? runMm : crossMm,
          depthMm: isHorizontalRun ? crossMm : runMm,
        }
      );
      const candidate = getInteriorAssetFromBounds(normalizedAsset, candidateBounds);
      if (!isInteriorAssetWithinRoom(room, candidate)) continue;

      return candidate;
    }
  }

  return null;
}

function getResizeAdjustedBoundsForRoomResize(
  assetBounds: RoomInteriorAssetBounds,
  roomBounds: NonNullable<ReturnType<typeof getPolygonBounds>>,
  size: { widthMm: number; depthMm: number }
): RoomRectBounds {
  const horizontalAnchor = getPreferredResizeAnchor(
    assetBounds.left,
    assetBounds.right,
    roomBounds.minX,
    roomBounds.maxX
  );
  const verticalAnchor = getPreferredResizeAnchor(
    assetBounds.top,
    assetBounds.bottom,
    roomBounds.minY,
    roomBounds.maxY
  );

  const minX =
    horizontalAnchor === "max" ? assetBounds.right - size.widthMm : assetBounds.left;
  const maxX =
    horizontalAnchor === "max" ? assetBounds.right : assetBounds.left + size.widthMm;
  const minY =
    verticalAnchor === "max" ? assetBounds.bottom - size.depthMm : assetBounds.top;
  const maxY =
    verticalAnchor === "max" ? assetBounds.bottom : assetBounds.top + size.depthMm;

  return {
    minX,
    maxX,
    minY,
    maxY,
  };
}

function getPreferredResizeAnchor(
  assetMin: number,
  assetMax: number,
  roomMin: number,
  roomMax: number
) {
  const minOverflow = Math.max(0, roomMin - assetMin);
  const maxOverflow = Math.max(0, assetMax - roomMax);

  if (minOverflow > maxOverflow) return "max" as const;
  if (maxOverflow > minOverflow) return "min" as const;
  return "min" as const;
}

function getSnappedInteriorAssetCenter(
  targetCenter: Point,
  asset: Pick<RoomInteriorAsset, "widthMm" | "depthMm">,
  gridSizeMm: number
): Point {
  const halfWidth = asset.widthMm / 2;
  const halfDepth = asset.depthMm / 2;

  return {
    x: snapToGrid(targetCenter.x - halfWidth, gridSizeMm) + halfWidth,
    y: snapToGrid(targetCenter.y - halfDepth, gridSizeMm) + halfDepth,
  };
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

export function getStairRunLengthMm(
  asset: Pick<RoomInteriorAsset, "widthMm" | "depthMm" | "rotationDegrees">
) {
  return isStairRunHorizontal(asset as RoomInteriorAsset) ? asset.widthMm : asset.depthMm;
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
    asset,
    wall,
    cursorWorld,
    options
  );
  return getConstrainedResizedStair(room, asset, nextBounds);
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
    asset,
    corner,
    cursorWorld,
    options
  );
  return getConstrainedResizedStair(room, asset, nextBounds);
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
    arrowEnabled: DEFAULT_STAIR_ARROW_ENABLED,
    arrowDirection: DEFAULT_STAIR_ARROW_DIRECTION,
    arrowLabel: DEFAULT_STAIR_ARROW_LABEL,
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
        arrowEnabled: DEFAULT_STAIR_ARROW_ENABLED,
        arrowDirection: DEFAULT_STAIR_ARROW_DIRECTION,
        arrowLabel: DEFAULT_STAIR_ARROW_LABEL,
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
  resizedBounds: RoomRectBounds
): RoomInteriorAsset | null {
  const normalizedBounds = normalizeInteriorAssetResizeBounds(resizedBounds);
  const snappedBounds = { ...normalizedBounds };
  if (isStairRunHorizontal(asset)) {
    snappedBounds.maxX =
      snappedBounds.minX + snapStairRunMm(normalizedBounds.maxX - normalizedBounds.minX);
  } else {
    snappedBounds.maxY =
      snappedBounds.minY + snapStairRunMm(normalizedBounds.maxY - normalizedBounds.minY);
  }

  if (snappedBounds.maxY - snappedBounds.minY < MIN_STAIR_WIDTH_MM) {
    snappedBounds.maxY = snappedBounds.minY + MIN_STAIR_WIDTH_MM;
  }
  if (snappedBounds.maxX - snappedBounds.minX < MIN_STAIR_WIDTH_MM) {
    snappedBounds.maxX = snappedBounds.minX + MIN_STAIR_WIDTH_MM;
  }

  const nextAsset = getInteriorAssetFromBounds(asset, snappedBounds);
  return isInteriorAssetWithinRoom(room, nextAsset) ? nextAsset : null;
}

function resizeInteriorAssetBoundsForWallDrag(
  bounds: RoomRectBounds,
  asset: RoomInteriorAsset,
  wall: InteriorAssetResizeWall,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): RoomRectBounds {
  const isSideways = isStairRunHorizontal(asset);
  const snappedX =
    isSideways
      ? snapToGrid(cursorWorld.x, DEFAULT_STAIR_TREAD_SPACING_MM)
      : options?.gridSizeMm && options.gridSizeMm > 0
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
    isSideways
      ? options?.gridSizeMm && options.gridSizeMm > 0
        ? snapToGrid(cursorWorld.y, options.gridSizeMm)
        : cursorWorld.y
      : snapToGrid(cursorWorld.y, DEFAULT_STAIR_TREAD_SPACING_MM);
  if (wall === "top") {
    return {
      ...bounds,
      minY: Math.min(snappedY, bounds.maxY - MIN_STAIR_WIDTH_MM),
    };
  }

  return {
    ...bounds,
    maxY: Math.max(snappedY, bounds.minY + MIN_STAIR_WIDTH_MM),
  };
}

function resizeInteriorAssetBoundsForCornerDrag(
  bounds: RoomRectBounds,
  asset: RoomInteriorAsset,
  corner: InteriorAssetResizeCorner,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): RoomRectBounds {
  const isSideways = isStairRunHorizontal(asset);
  const snappedX =
    isSideways
      ? snapToGrid(cursorWorld.x, DEFAULT_STAIR_TREAD_SPACING_MM)
      : options?.gridSizeMm && options.gridSizeMm > 0
        ? snapToGrid(cursorWorld.x, options.gridSizeMm)
        : cursorWorld.x;
  const snappedY =
    isSideways
      ? options?.gridSizeMm && options.gridSizeMm > 0
        ? snapToGrid(cursorWorld.y, options.gridSizeMm)
        : cursorWorld.y
      : snapToGrid(cursorWorld.y, DEFAULT_STAIR_TREAD_SPACING_MM);

  if (corner === "top-left") {
    return {
      minX: Math.min(snappedX, bounds.maxX - MIN_STAIR_WIDTH_MM),
      maxX: bounds.maxX,
      minY: Math.min(snappedY, bounds.maxY - MIN_STAIR_WIDTH_MM),
      maxY: bounds.maxY,
    };
  }

  if (corner === "top-right") {
    return {
      minX: bounds.minX,
      maxX: Math.max(snappedX, bounds.minX + MIN_STAIR_WIDTH_MM),
      minY: Math.min(snappedY, bounds.maxY - MIN_STAIR_WIDTH_MM),
      maxY: bounds.maxY,
    };
  }

  if (corner === "bottom-right") {
    return {
      minX: bounds.minX,
      maxX: Math.max(snappedX, bounds.minX + MIN_STAIR_WIDTH_MM),
      minY: bounds.minY,
      maxY: Math.max(snappedY, bounds.minY + MIN_STAIR_WIDTH_MM),
    };
  }

  return {
    minX: Math.min(snappedX, bounds.maxX - MIN_STAIR_WIDTH_MM),
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: Math.max(snappedY, bounds.minY + MIN_STAIR_WIDTH_MM),
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

function isStairRunHorizontal(asset: RoomInteriorAsset) {
  return Math.abs(normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0)) === 90;
}

function snapStairRunMm(runMm: number) {
  return Math.max(MIN_STAIR_DEPTH_MM, snapToGrid(runMm, DEFAULT_STAIR_TREAD_SPACING_MM));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

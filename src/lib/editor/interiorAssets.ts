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
export const MIN_WARDROBE_SIZE_MM = 500;
export const MIN_FURNITURE_SIZE_MM = 100;
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
  const base: RoomInteriorAsset = {
    id: asset.id,
    type: asset.type,
    name: asset.name ?? DEFAULT_STAIR_NAME,
    xMm: asset.xMm,
    yMm: asset.yMm,
    widthMm: asset.widthMm,
    depthMm: asset.depthMm,
    rotationDegrees: normalizeCanvasRotationDegrees(asset.rotationDegrees ?? 0),
    anchor: asset.anchor ?? "floor",
  };
  if (asset.type === "stairs") {
    base.connectionId = asset.connectionId ?? null;
    base.arrowEnabled = asset.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED;
    base.arrowDirection = asset.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION;
    base.arrowLabel = asset.arrowLabel ?? DEFAULT_STAIR_ARROW_LABEL;
  }
  if (asset.doorType !== undefined) base.doorType = asset.doorType;
  if (asset.doorConstraint !== undefined) base.doorConstraint = asset.doorConstraint;
  if (asset.shape !== undefined) base.shape = asset.shape;
  if (asset.unitSystem !== undefined) base.unitSystem = asset.unitSystem;
  if (asset.sizePreset !== undefined) base.sizePreset = asset.sizePreset;
  return base;
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
      (assetA.connectionId ?? null) !== (assetB.connectionId ?? null) ||
      assetA.name !== assetB.name ||
      assetA.xMm !== assetB.xMm ||
      assetA.yMm !== assetB.yMm ||
      assetA.widthMm !== assetB.widthMm ||
      assetA.depthMm !== assetB.depthMm ||
      normalizeCanvasRotationDegrees(assetA.rotationDegrees ?? 0) !==
        normalizeCanvasRotationDegrees(assetB.rotationDegrees ?? 0) ||
      (assetA.type === "stairs" && (
        (assetA.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED) !==
          (assetB.arrowEnabled ?? DEFAULT_STAIR_ARROW_ENABLED) ||
        (assetA.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION) !==
          (assetB.arrowDirection ?? DEFAULT_STAIR_ARROW_DIRECTION) ||
        (assetA.arrowLabel ?? DEFAULT_STAIR_ARROW_LABEL) !==
          (assetB.arrowLabel ?? DEFAULT_STAIR_ARROW_LABEL)
      )) ||
      (assetA.doorType ?? null) !== (assetB.doorType ?? null) ||
      (assetA.shape ?? null) !== (assetB.shape ?? null)
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
    connectionId: null,
    name: DEFAULT_STAIR_NAME,
    xMm: center.x,
    yMm: center.y,
    widthMm: DEFAULT_STAIR_WIDTH_MM,
    depthMm: DEFAULT_STAIR_DEPTH_MM,
    rotationDegrees: 0,
    anchor: "floor",
    arrowEnabled: DEFAULT_STAIR_ARROW_ENABLED,
    arrowDirection: DEFAULT_STAIR_ARROW_DIRECTION,
    arrowLabel: DEFAULT_STAIR_ARROW_LABEL,
  };
}

/**
 * Create a centered default bed in the given room.
 * Standard double bed dimensions: 1350mm × 1900mm
 */
export function createCenteredDefaultBed(room: Room, id: string): RoomInteriorAsset | null {
  const roomBounds = getPolygonBounds(room.points);
  if (!roomBounds) return null;

  const center = {
    x: (roomBounds.minX + roomBounds.maxX) / 2,
    y: (roomBounds.minY + roomBounds.maxY) / 2,
  };

  return {
    id,
    type: "bed",
    name: "Bed",
    xMm: center.x,
    yMm: center.y,
    widthMm: 1350, // Double bed width
    depthMm: 1900, // Double bed depth
    rotationDegrees: 0,
    anchor: "floor",
  };
}

/**
 * Create a centered default sofa in the given room.
 * Standard 3-seater sofa dimensions: 2000mm × 900mm
 */
export function createCenteredDefaultSofa(room: Room, id: string): RoomInteriorAsset | null {
  const roomBounds = getPolygonBounds(room.points);
  if (!roomBounds) return null;

  const center = {
    x: (roomBounds.minX + roomBounds.maxX) / 2,
    y: (roomBounds.minY + roomBounds.maxY) / 2,
  };

  return {
    id,
    type: "sofa",
    name: "Sofa",
    xMm: center.x,
    yMm: center.y,
    widthMm: 2000, // 3-seater width
    depthMm: 900, // Standard depth
    rotationDegrees: 0,
    anchor: "floor",
  };
}

/**
 * Create a centered default wardrobe in the given room.
 * Standard wardrobe dimensions: 1600mm × 600mm with swing doors
 */
export function createCenteredDefaultWardrobe(room: Room, id: string): RoomInteriorAsset | null {
  const roomBounds = getPolygonBounds(room.points);
  if (!roomBounds) return null;

  const center = {
    x: (roomBounds.minX + roomBounds.maxX) / 2,
    y: (roomBounds.minY + roomBounds.maxY) / 2,
  };

  return {
    id,
    type: "wardrobe",
    name: "Wardrobe",
    xMm: center.x,
    yMm: center.y,
    widthMm: 1600,
    depthMm: 600,
    rotationDegrees: 0,
    anchor: "floor",
    doorType: "swing",
    doorConstraint: 800,
  };
}

/**
 * Create a centered default dining table in the given room.
 * Standard rectangular dining table: 1600mm × 900mm
 */
export function createCenteredDefaultDiningTable(room: Room, id: string): RoomInteriorAsset | null {
  const roomBounds = getPolygonBounds(room.points);
  if (!roomBounds) return null;

  const center = {
    x: (roomBounds.minX + roomBounds.maxX) / 2,
    y: (roomBounds.minY + roomBounds.maxY) / 2,
  };

  return {
    id,
    type: "dining-table",
    name: "Dining Table",
    xMm: center.x,
    yMm: center.y,
    widthMm: 1600,
    depthMm: 900,
    rotationDegrees: 0,
    anchor: "floor",
    shape: "rectangular",
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
  const runAnchor = getPreferredRunAnchorForRoomResize(room, assetBounds, isHorizontalRun);
  const startingRunMm = Math.min(
    isHorizontalRun ? normalizedAsset.widthMm : normalizedAsset.depthMm,
    maxRunMm
  );
  const startingSnappedRunMm = Math.floor(startingRunMm / DEFAULT_STAIR_TREAD_SPACING_MM) *
    DEFAULT_STAIR_TREAD_SPACING_MM;

  for (let runMm = startingSnappedRunMm; runMm >= MIN_STAIR_DEPTH_MM; runMm -= DEFAULT_STAIR_TREAD_SPACING_MM) {
    const candidateBounds = getRunAnchoredBoundsForRoomResize(assetBounds, normalizedAsset, runMm, runAnchor);
    const candidate = getConstrainedResizedStair(room, normalizedAsset, candidateBounds);
    if (candidate) return candidate;
  }

  return null;
}

export function getRotatedInteriorAssetForRoom(
  room: Room,
  asset: RoomInteriorAsset,
  deltaDegrees: number
): RoomInteriorAsset | null {
  if (!Number.isFinite(deltaDegrees) || deltaDegrees === 0) return null;

  const nextRotationDegrees = normalizeCanvasRotationDegrees(asset.rotationDegrees + deltaDegrees);
  const isQuarterTurn = Math.abs(deltaDegrees) % 180 === 90;

  if (asset.rotationDegrees === nextRotationDegrees && !isQuarterTurn) return null;

  const rotatedAsset = {
    ...cloneRoomInteriorAsset(asset),
    widthMm: isQuarterTurn ? asset.depthMm : asset.widthMm,
    depthMm: isQuarterTurn ? asset.widthMm : asset.depthMm,
    rotationDegrees: nextRotationDegrees,
  };

  if (isInteriorAssetWithinRoom(room, rotatedAsset)) {
    return rotatedAsset;
  }

  const nudgedCenter = constrainInteriorAssetCenter(room, rotatedAsset, {
    x: asset.xMm,
    y: asset.yMm,
  });
  if (!nudgedCenter) return null;

  return {
    ...rotatedAsset,
    xMm: nudgedCenter.x,
    yMm: nudgedCenter.y,
  };
}

function getRunAnchoredBoundsForRoomResize(
  assetBounds: RoomInteriorAssetBounds,
  asset: RoomInteriorAsset,
  runMm: number,
  runAnchor: "min" | "max"
): RoomRectBounds {
  if (isStairRunHorizontal(asset)) {
    return runAnchor === "max"
      ? {
          minX: assetBounds.right - runMm,
          maxX: assetBounds.right,
          minY: assetBounds.top,
          maxY: assetBounds.bottom,
        }
      : {
          minX: assetBounds.left,
          maxX: assetBounds.left + runMm,
          minY: assetBounds.top,
          maxY: assetBounds.bottom,
        };
  }

  return runAnchor === "max"
    ? {
        minX: assetBounds.left,
        maxX: assetBounds.right,
        minY: assetBounds.bottom - runMm,
        maxY: assetBounds.bottom,
      }
    : {
        minX: assetBounds.left,
        maxX: assetBounds.right,
        minY: assetBounds.top,
        maxY: assetBounds.top + runMm,
      };
}

function getPreferredRunAnchorForRoomResize(
  room: Room,
  assetBounds: RoomInteriorAssetBounds,
  isHorizontalRun: boolean
) {
  const topLeftInside = isPointInPolygon({ x: assetBounds.left, y: assetBounds.top }, room.points);
  const topRightInside = isPointInPolygon({ x: assetBounds.right, y: assetBounds.top }, room.points);
  const bottomRightInside = isPointInPolygon(
    { x: assetBounds.right, y: assetBounds.bottom },
    room.points
  );
  const bottomLeftInside = isPointInPolygon({ x: assetBounds.left, y: assetBounds.bottom }, room.points);

  if (isHorizontalRun) {
    const leftOutside = !topLeftInside || !bottomLeftInside;
    const rightOutside = !topRightInside || !bottomRightInside;
    if (leftOutside && !rightOutside) return "max" as const;
    if (rightOutside && !leftOutside) return "min" as const;
    return "min" as const;
  }

  const topOutside = !topLeftInside || !topRightInside;
  const bottomOutside = !bottomLeftInside || !bottomRightInside;
  if (topOutside && !bottomOutside) return "max" as const;
  if (bottomOutside && !topOutside) return "min" as const;
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
    connectionId: null,
    name: DEFAULT_STAIR_NAME,
    xMm: clampedPreferred.x,
    yMm: clampedPreferred.y,
    widthMm,
    depthMm,
    rotationDegrees: 0,
    anchor: "floor" as const,
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
        connectionId: null,
        name: DEFAULT_STAIR_NAME,
        xMm: x,
        yMm: y,
        widthMm,
        depthMm,
        rotationDegrees: 0,
        anchor: "floor" as const,
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

  if (asset.type === "stairs") {
    // Stairs snap the run length to tread-depth multiples.
    if (isStairRunHorizontal(asset)) {
      snappedBounds.maxX =
        snappedBounds.minX + snapStairRunMm(normalizedBounds.maxX - normalizedBounds.minX);
    } else {
      snappedBounds.maxY =
        snappedBounds.minY + snapStairRunMm(normalizedBounds.maxY - normalizedBounds.minY);
    }
    const minW = MIN_STAIR_WIDTH_MM;
    const minD = MIN_STAIR_DEPTH_MM;
    if (snappedBounds.maxY - snappedBounds.minY < minD) {
      snappedBounds.maxY = snappedBounds.minY + minD;
    }
    if (snappedBounds.maxX - snappedBounds.minX < minW) {
      snappedBounds.maxX = snappedBounds.minX + minW;
    }
  } else {
    // Furniture: free resize with a small practical minimum.
    const minDimension = asset.type === "wardrobe" ? MIN_WARDROBE_SIZE_MM : MIN_FURNITURE_SIZE_MM;
    if (snappedBounds.maxY - snappedBounds.minY < minDimension) {
      snappedBounds.maxY = snappedBounds.minY + minDimension;
    }
    if (snappedBounds.maxX - snappedBounds.minX < minDimension) {
      snappedBounds.maxX = snappedBounds.minX + minDimension;
    }
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
  const isStairs = asset.type === "stairs";
  const isSideways = isStairs && isStairRunHorizontal(asset);
  const minDimension = isStairs
    ? MIN_STAIR_WIDTH_MM
    : asset.type === "wardrobe"
      ? MIN_WARDROBE_SIZE_MM
      : MIN_FURNITURE_SIZE_MM;
  // Stairs snap the cursor to the tread-depth grid on the run axis.
  // Furniture uses the general grid (or raw cursor position).
  const snappedX =
    isSideways
      ? snapToGrid(cursorWorld.x, DEFAULT_STAIR_TREAD_SPACING_MM)
      : options?.gridSizeMm && options.gridSizeMm > 0
        ? snapToGrid(cursorWorld.x, options.gridSizeMm)
        : cursorWorld.x;
  if (wall === "left") {
    return {
      ...bounds,
      minX: Math.min(snappedX, bounds.maxX - minDimension),
    };
  }

  if (wall === "right") {
    return {
      ...bounds,
      maxX: Math.max(snappedX, bounds.minX + minDimension),
    };
  }

  const snappedY =
    (isStairs && !isSideways)
      ? snapToGrid(cursorWorld.y, DEFAULT_STAIR_TREAD_SPACING_MM)
      : options?.gridSizeMm && options.gridSizeMm > 0
        ? snapToGrid(cursorWorld.y, options.gridSizeMm)
        : cursorWorld.y;
  if (wall === "top") {
    return {
      ...bounds,
      minY: Math.min(snappedY, bounds.maxY - minDimension),
    };
  }

  return {
    ...bounds,
    maxY: Math.max(snappedY, bounds.minY + minDimension),
  };
}

function resizeInteriorAssetBoundsForCornerDrag(
  bounds: RoomRectBounds,
  asset: RoomInteriorAsset,
  corner: InteriorAssetResizeCorner,
  cursorWorld: Point,
  options?: { gridSizeMm?: number }
): RoomRectBounds {
  const isStairs = asset.type === "stairs";
  const isSideways = isStairs && isStairRunHorizontal(asset);
  const minDimension = isStairs
    ? MIN_STAIR_WIDTH_MM
    : asset.type === "wardrobe"
      ? MIN_WARDROBE_SIZE_MM
      : MIN_FURNITURE_SIZE_MM;
  const snappedX =
    isSideways
      ? snapToGrid(cursorWorld.x, DEFAULT_STAIR_TREAD_SPACING_MM)
      : options?.gridSizeMm && options.gridSizeMm > 0
        ? snapToGrid(cursorWorld.x, options.gridSizeMm)
        : cursorWorld.x;
  const snappedY =
    (isStairs && !isSideways)
      ? snapToGrid(cursorWorld.y, DEFAULT_STAIR_TREAD_SPACING_MM)
      : options?.gridSizeMm && options.gridSizeMm > 0
        ? snapToGrid(cursorWorld.y, options.gridSizeMm)
        : cursorWorld.y;

  if (corner === "top-left") {
    return {
      minX: Math.min(snappedX, bounds.maxX - minDimension),
      maxX: bounds.maxX,
      minY: Math.min(snappedY, bounds.maxY - minDimension),
      maxY: bounds.maxY,
    };
  }

  if (corner === "top-right") {
    return {
      minX: bounds.minX,
      maxX: Math.max(snappedX, bounds.minX + minDimension),
      minY: Math.min(snappedY, bounds.maxY - minDimension),
      maxY: bounds.maxY,
    };
  }

  if (corner === "bottom-right") {
    return {
      minX: bounds.minX,
      maxX: Math.max(snappedX, bounds.minX + minDimension),
      minY: bounds.minY,
      maxY: Math.max(snappedY, bounds.minY + minDimension),
    };
  }

  return {
    minX: Math.min(snappedX, bounds.maxX - minDimension),
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: Math.max(snappedY, bounds.minY + minDimension),
  };
}

function normalizeInteriorAssetResizeBounds(bounds: RoomRectBounds): RoomRectBounds {
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minY = Math.min(bounds.minY, bounds.maxY);
  const maxY = Math.max(bounds.minY, bounds.maxY);
  return { minX, maxX, minY, maxY };
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

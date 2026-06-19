import { isPointInPolygon } from "@/lib/editor/roomGeometry";
import type { Point, Room, RoomWallMetadata } from "@/lib/editor/types";

export const DEFAULT_EXTERNAL_WALL_THICKNESS_MM = 300;
export const DEFAULT_INTERNAL_WALL_THICKNESS_MM = 150;
const WALL_THICKNESS_MIGRATION_PENDING_KEY = "spaceforge.wallThicknessMigration.pending.v1";
const WALL_THICKNESS_MIGRATION_SHOWN_KEY = "spaceforge.wallThicknessMigration.shown.v1";
const WALL_THICKNESS_MIGRATION_DISMISSED_PROJECTS_KEY =
  "spaceforge.wallThicknessMigration.dismissedProjects.v1";
const INTERNAL_WALL_SPACING_SNAP_TOLERANCE_MM = 80;
const INTERNAL_WALL_SPACING_MATCH_TOLERANCE_MM = 2;
const MIN_INTERNAL_WALL_OVERLAP_MM = 50;
const GEOMETRY_EPSILON = 0.001;

export function createExternalRoomWallSegments(points: Point[]): RoomWallMetadata[] {
  return points.map(() => ({
    thicknessMm: DEFAULT_EXTERNAL_WALL_THICKNESS_MM,
    isExternal: true,
  }));
}

export function cloneRoomWallSegments(wallSegments?: RoomWallMetadata[]): RoomWallMetadata[] | undefined {
  return wallSegments?.map((segment) => ({
    ...(segment.thicknessMm !== undefined ? { thicknessMm: segment.thicknessMm } : {}),
    ...(segment.isExternal !== undefined ? { isExternal: segment.isExternal } : {}),
  }));
}

export function areRoomWallSegmentsEqual(
  a?: RoomWallMetadata[],
  b?: RoomWallMetadata[]
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    if (a[index].thicknessMm !== b[index].thicknessMm) return false;
    if (a[index].isExternal !== b[index].isExternal) return false;
  }

  return true;
}

export function getRoomWallMetadata(room: Room, segmentIndex: number): RoomWallMetadata | null {
  if (!room.wallSegments) return null;

  return room.wallSegments[segmentIndex] ?? {
    thicknessMm: DEFAULT_EXTERNAL_WALL_THICKNESS_MM,
    isExternal: true,
  };
}

type WallSegmentGeometry = {
  roomId: string;
  floorId: string | null | undefined;
  segmentIndex: number;
  start: Point;
  end: Point;
  tangent: Point;
  outwardNormal: Point;
  lengthMm: number;
};

type InternalWallSpacingCandidate = {
  normal: Point;
  adjustmentMm: number;
  overlapMm: number;
};

export function reconcileSharedRoomWallSegments(rooms: Room[]): Room[] {
  const segmentGeometries = getWallSegmentGeometries(rooms);
  const internalSegmentKeys = new Set<string>();

  for (let index = 0; index < segmentGeometries.length; index += 1) {
    const segment = segmentGeometries[index];

    for (let otherIndex = index + 1; otherIndex < segmentGeometries.length; otherIndex += 1) {
      const otherSegment = segmentGeometries[otherIndex];
      const connection =
        getFacingWallConnection(segment, otherSegment) ??
        getFacingWallConnection(otherSegment, segment);
      if (!connection) continue;
      if (Math.abs(connection.gapMm - DEFAULT_INTERNAL_WALL_THICKNESS_MM) > INTERNAL_WALL_SPACING_MATCH_TOLERANCE_MM) {
        continue;
      }

      internalSegmentKeys.add(getWallSegmentMetadataKey(segment));
      internalSegmentKeys.add(getWallSegmentMetadataKey(otherSegment));
    }
  }

  return rooms.map((room) => {
    const nextWallSegments = room.points.map((_, segmentIndex) => {
      const isInternal = internalSegmentKeys.has(`${room.id}:${segmentIndex}`);

      return {
        thicknessMm: isInternal
          ? DEFAULT_INTERNAL_WALL_THICKNESS_MM
          : DEFAULT_EXTERNAL_WALL_THICKNESS_MM,
        isExternal: !isInternal,
      };
    });

    if (areRoomWallSegmentsEqual(room.wallSegments, nextWallSegments)) {
      return room;
    }

    return {
      ...room,
      wallSegments: nextWallSegments,
    };
  });
}

export function getRoomPointsWithInternalWallSpacing(
  rooms: Room[],
  roomId: string,
  nextPoints: Point[],
  previousPoints?: Point[]
): Point[] {
  const room = rooms.find((candidate) => candidate.id === roomId);
  if (!room || nextPoints.length !== room.points.length || nextPoints.length < 2) {
    return nextPoints.map((point) => ({ ...point }));
  }

  const movablePointIndices = getMovablePointIndices(nextPoints, previousPoints);
  if (movablePointIndices.size === 0) {
    return nextPoints.map((point) => ({ ...point }));
  }

  const nextRoom = {
    ...room,
    points: nextPoints.map((point) => ({ ...point })),
  };
  const candidateRooms = rooms.map((candidate) => (candidate.id === roomId ? nextRoom : candidate));
  const segmentGeometries = getWallSegmentGeometries(candidateRooms);
  const roomSegments = segmentGeometries.filter((segment) => segment.roomId === roomId);
  const otherSegments = segmentGeometries.filter((segment) => segment.roomId !== roomId);
  const spacingCandidates: InternalWallSpacingCandidate[] = [];

  for (const segment of roomSegments) {
    const nextSegmentIndex = (segment.segmentIndex + 1) % nextPoints.length;
    if (!movablePointIndices.has(segment.segmentIndex) || !movablePointIndices.has(nextSegmentIndex)) {
      continue;
    }

    for (const otherSegment of otherSegments) {
      const connection = getFacingWallConnection(segment, otherSegment);
      if (!connection) continue;

      const isNearAttachedWall = connection.gapMm <= INTERNAL_WALL_SPACING_SNAP_TOLERANCE_MM;
      const isNearInternalSpacing =
        Math.abs(connection.gapMm - DEFAULT_INTERNAL_WALL_THICKNESS_MM) <=
        INTERNAL_WALL_SPACING_SNAP_TOLERANCE_MM;
      if (!isNearAttachedWall && !isNearInternalSpacing) continue;

      spacingCandidates.push({
        normal: segment.outwardNormal,
        adjustmentMm: connection.gapMm - DEFAULT_INTERNAL_WALL_THICKNESS_MM,
        overlapMm: connection.overlapMm,
      });
    }
  }

  const correction = solveInternalWallSpacingCorrection(spacingCandidates);
  if (!correction || Math.hypot(correction.x, correction.y) < GEOMETRY_EPSILON) {
    return nextPoints.map((point) => ({ ...point }));
  }

  return nextPoints.map((point, index) =>
    movablePointIndices.has(index)
      ? {
          x: point.x + correction.x,
          y: point.y + correction.y,
        }
      : { ...point }
  );
}

function getWallSegmentGeometries(rooms: Room[]): WallSegmentGeometry[] {
  const segments: WallSegmentGeometry[] = [];

  for (const room of rooms) {
    for (let segmentIndex = 0; segmentIndex < room.points.length; segmentIndex += 1) {
      const segment = getWallSegmentGeometry(room, segmentIndex);
      if (segment) segments.push(segment);
    }
  }

  return segments;
}

function getWallSegmentGeometry(room: Room, segmentIndex: number): WallSegmentGeometry | null {
  const start = room.points[segmentIndex];
  const end = room.points[(segmentIndex + 1) % room.points.length];
  if (!start || !end) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthMm = Math.hypot(dx, dy);
  if (lengthMm < GEOMETRY_EPSILON) return null;

  const outwardNormal = getSegmentOutwardNormal(room.points, start, end);
  if (!outwardNormal) return null;

  return {
    roomId: room.id,
    floorId: room.floorId,
    segmentIndex,
    start,
    end,
    tangent: {
      x: dx / lengthMm,
      y: dy / lengthMm,
    },
    outwardNormal,
    lengthMm,
  };
}

function getSegmentOutwardNormal(points: Point[], start: Point, end: Point): Point | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthMm = Math.hypot(dx, dy);
  if (lengthMm < GEOMETRY_EPSILON) return null;

  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const candidateNormals = [
    { x: -dy / lengthMm, y: dx / lengthMm },
    { x: dy / lengthMm, y: -dx / lengthMm },
  ];

  for (const normal of candidateNormals) {
    const inwardProbe = {
      x: midpoint.x - normal.x,
      y: midpoint.y - normal.y,
    };
    const outwardProbe = {
      x: midpoint.x + normal.x,
      y: midpoint.y + normal.y,
    };

    if (isPointInPolygon(inwardProbe, points) && !isPointInPolygon(outwardProbe, points)) {
      return normal;
    }
  }

  return null;
}

function getFacingWallConnection(
  segment: WallSegmentGeometry,
  otherSegment: WallSegmentGeometry
): { gapMm: number; overlapMm: number } | null {
  if (segment.floorId !== otherSegment.floorId) return null;
  if (segment.roomId === otherSegment.roomId) return null;
  if (Math.abs(crossProduct(segment.tangent, otherSegment.tangent)) > GEOMETRY_EPSILON) return null;
  if (dotProduct(segment.outwardNormal, otherSegment.outwardNormal) > -0.98) return null;

  const gapMm = dotProduct(
    {
      x: otherSegment.start.x - segment.start.x,
      y: otherSegment.start.y - segment.start.y,
    },
    segment.outwardNormal
  );
  if (gapMm < -GEOMETRY_EPSILON) return null;

  const projectedOtherStart = dotProduct(
    {
      x: otherSegment.start.x - segment.start.x,
      y: otherSegment.start.y - segment.start.y,
    },
    segment.tangent
  );
  const projectedOtherEnd = dotProduct(
    {
      x: otherSegment.end.x - segment.start.x,
      y: otherSegment.end.y - segment.start.y,
    },
    segment.tangent
  );
  const otherMin = Math.min(projectedOtherStart, projectedOtherEnd);
  const otherMax = Math.max(projectedOtherStart, projectedOtherEnd);
  const overlapMm = Math.min(segment.lengthMm, otherMax) - Math.max(0, otherMin);
  if (overlapMm < MIN_INTERNAL_WALL_OVERLAP_MM) return null;

  return { gapMm, overlapMm };
}

function getMovablePointIndices(nextPoints: Point[], previousPoints?: Point[]): Set<number> {
  if (!previousPoints || previousPoints.length !== nextPoints.length) {
    return new Set(nextPoints.map((_, index) => index));
  }

  const movedIndices = new Set<number>();
  nextPoints.forEach((point, index) => {
    const previousPoint = previousPoints[index];
    if (!previousPoint) return;
    if (Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) > GEOMETRY_EPSILON) {
      movedIndices.add(index);
    }
  });
  return movedIndices;
}

function solveInternalWallSpacingCorrection(candidates: InternalWallSpacingCandidate[]): Point | null {
  if (candidates.length === 0) return null;

  let a = 0;
  let b = 0;
  let d = 0;
  let rightX = 0;
  let rightY = 0;
  let totalWeight = 0;

  for (const candidate of candidates) {
    const weight = Math.max(candidate.overlapMm, MIN_INTERNAL_WALL_OVERLAP_MM);
    const { normal, adjustmentMm } = candidate;
    a += weight * normal.x * normal.x;
    b += weight * normal.x * normal.y;
    d += weight * normal.y * normal.y;
    rightX += weight * normal.x * adjustmentMm;
    rightY += weight * normal.y * adjustmentMm;
    totalWeight += weight;
  }

  const determinant = a * d - b * b;
  if (Math.abs(determinant) > GEOMETRY_EPSILON) {
    return {
      x: (rightX * d - b * rightY) / determinant,
      y: (a * rightY - b * rightX) / determinant,
    };
  }

  if (totalWeight <= 0) return null;

  return {
    x: candidates.reduce((sum, candidate) => sum + candidate.normal.x * candidate.adjustmentMm, 0) / candidates.length,
    y: candidates.reduce((sum, candidate) => sum + candidate.normal.y * candidate.adjustmentMm, 0) / candidates.length,
  };
}

function getWallSegmentMetadataKey(segment: Pick<WallSegmentGeometry, "roomId" | "segmentIndex">): string {
  return `${segment.roomId}:${segment.segmentIndex}`;
}

function dotProduct(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function crossProduct(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readDismissedWallThicknessMigrationProjectIds(
  storage: Storage | null = getBrowserStorage()
): Set<string> {
  if (!storage) return new Set();

  try {
    const rawValue = storage.getItem(WALL_THICKNESS_MIGRATION_DISMISSED_PROJECTS_KEY);
    if (!rawValue) return new Set();

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      storage.removeItem(WALL_THICKNESS_MIGRATION_DISMISSED_PROJECTS_KEY);
      return new Set();
    }

    return new Set(parsedValue.filter((projectId): projectId is string => typeof projectId === "string"));
  } catch {
    storage.removeItem(WALL_THICKNESS_MIGRATION_DISMISSED_PROJECTS_KEY);
    return new Set();
  }
}

function saveDismissedWallThicknessMigrationProjectIds(
  projectIds: Set<string>,
  storage: Storage | null = getBrowserStorage()
) {
  if (!storage) return;
  storage.setItem(
    WALL_THICKNESS_MIGRATION_DISMISSED_PROJECTS_KEY,
    JSON.stringify(Array.from(projectIds))
  );
}

export function hasDismissedWallThicknessMigrationAnnouncement(
  projectId: string,
  storage: Storage | null = getBrowserStorage()
): boolean {
  return readDismissedWallThicknessMigrationProjectIds(storage).has(projectId);
}

export function dismissWallThicknessMigrationAnnouncement(
  projectId: string,
  storage: Storage | null = getBrowserStorage()
) {
  const dismissedProjectIds = readDismissedWallThicknessMigrationProjectIds(storage);
  dismissedProjectIds.add(projectId);
  saveDismissedWallThicknessMigrationProjectIds(dismissedProjectIds, storage);
}

function normalizeRoomWallSegmentMetadata(segment: RoomWallMetadata | undefined): RoomWallMetadata {
  return {
    thicknessMm:
      segment?.thicknessMm !== undefined && segment.thicknessMm > 0
        ? segment.thicknessMm
        : DEFAULT_EXTERNAL_WALL_THICKNESS_MM,
    isExternal: segment?.isExternal ?? true,
  };
}

export function migrateRoomWallThickness(room: Room): { room: Room; didMigrate: boolean } {
  const nextWallSegments = room.points.map((_, index) =>
    normalizeRoomWallSegmentMetadata(room.wallSegments?.[index])
  );
  const didMigrate = !areRoomWallSegmentsEqual(room.wallSegments, nextWallSegments);

  if (!didMigrate) {
    return { room, didMigrate: false };
  }

  return {
    room: {
      ...room,
      wallSegments: nextWallSegments,
    },
    didMigrate: true,
  };
}

export function migrateDocumentWallThickness<TDocument extends { rooms: Room[] }>(
  document: TDocument
): { document: TDocument; didMigrate: boolean } {
  let didMigrate = false;
  const rooms = document.rooms.map((room) => {
    const result = migrateRoomWallThickness(room);
    if (result.didMigrate) didMigrate = true;
    return result.room;
  });

  if (!didMigrate) {
    return { document, didMigrate: false };
  }

  return {
    document: {
      ...document,
      rooms,
    },
    didMigrate: true,
  };
}

export function markWallThicknessMigrationAnnouncementPending(
  storage: Storage | null = getBrowserStorage()
) {
  if (!storage) return;
  if (storage.getItem(WALL_THICKNESS_MIGRATION_SHOWN_KEY) === "true") return;
  storage.setItem(WALL_THICKNESS_MIGRATION_PENDING_KEY, "true");
}

export function consumeWallThicknessMigrationAnnouncement(
  storage: Storage | null = getBrowserStorage()
): boolean {
  if (!storage) return false;
  if (storage.getItem(WALL_THICKNESS_MIGRATION_SHOWN_KEY) === "true") {
    storage.removeItem(WALL_THICKNESS_MIGRATION_PENDING_KEY);
    return false;
  }
  if (storage.getItem(WALL_THICKNESS_MIGRATION_PENDING_KEY) !== "true") return false;

  storage.setItem(WALL_THICKNESS_MIGRATION_SHOWN_KEY, "true");
  storage.removeItem(WALL_THICKNESS_MIGRATION_PENDING_KEY);
  return true;
}

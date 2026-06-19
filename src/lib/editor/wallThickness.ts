import type { Point, Room, RoomWallMetadata } from "@/lib/editor/types";

export const DEFAULT_EXTERNAL_WALL_THICKNESS_MM = 300;
export const DEFAULT_INTERNAL_WALL_THICKNESS_MM = 150;
const WALL_THICKNESS_MIGRATION_PENDING_KEY = "spaceforge.wallThicknessMigration.pending.v1";
const WALL_THICKNESS_MIGRATION_SHOWN_KEY = "spaceforge.wallThicknessMigration.shown.v1";

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

function getPointKey(point: Point): string {
  return `${point.x}:${point.y}`;
}

function getSegmentKey(room: Room, segmentIndex: number): string | null {
  const start = room.points[segmentIndex];
  const end = room.points[(segmentIndex + 1) % room.points.length];
  if (!start || !end) return null;
  if (start.x === end.x && start.y === end.y) return null;

  const startKey = getPointKey(start);
  const endKey = getPointKey(end);
  const [firstKey, secondKey] =
    startKey < endKey ? [startKey, endKey] : [endKey, startKey];
  return `${room.floorId ?? ""}|${firstKey}|${secondKey}`;
}

export function reconcileSharedRoomWallSegments(rooms: Room[]): Room[] {
  const segmentRoomIds = new Map<string, Set<string>>();

  for (const room of rooms) {
    room.points.forEach((_, segmentIndex) => {
      const segmentKey = getSegmentKey(room, segmentIndex);
      if (!segmentKey) return;

      const roomIds = segmentRoomIds.get(segmentKey) ?? new Set<string>();
      roomIds.add(room.id);
      segmentRoomIds.set(segmentKey, roomIds);
    });
  }

  return rooms.map((room) => {
    const nextWallSegments = room.points.map((_, segmentIndex) => {
      const segmentKey = getSegmentKey(room, segmentIndex);
      const isShared = segmentKey
        ? (segmentRoomIds.get(segmentKey)?.size ?? 0) > 1
        : false;

      return {
        thicknessMm: isShared
          ? DEFAULT_INTERNAL_WALL_THICKNESS_MM
          : DEFAULT_EXTERNAL_WALL_THICKNESS_MM,
        isExternal: !isShared,
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

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
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

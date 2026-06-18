import type { Point, Room, RoomWallMetadata } from "@/lib/editor/types";

export const DEFAULT_EXTERNAL_WALL_THICKNESS_MM = 300;
export const DEFAULT_INTERNAL_WALL_THICKNESS_MM = 150;

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

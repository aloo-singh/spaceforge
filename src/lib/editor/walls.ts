import type { EditorDocumentState } from "@/lib/editor/history";
import type { Point, Room, Wall, WallSide, WallType } from "@/lib/editor/types";
import { normalizeUnitOrigin, type UnitOrigin } from "@/lib/projects/region";

export const DEFAULT_ROOM_BOUNDARY_WALL_THICKNESS_MM = 300;
export const DEFAULT_ROOM_BOUNDARY_WALL_TYPE: WallType = "external";
export const DEFAULT_WALL_FLOOR_HEIGHT_MM = 0;
export const DEFAULT_WALL_CEILING_HEIGHT_MM = 2400;
export const DEFAULT_WALL_SIDES: readonly [WallSide, WallSide] = ["side-a", "side-b"];

type CreateRoomBoundaryWallsOptions = {
  unitOrigin?: UnitOrigin;
  createWallId: (edgeIndex: number) => string;
};

export function createRoomBoundaryWalls(
  points: Point[],
  options: CreateRoomBoundaryWallsOptions
): Wall[] {
  return points.flatMap((point, index) => {
    const nextPoint = points[(index + 1) % points.length];
    if (!nextPoint || (point.x === nextPoint.x && point.y === nextPoint.y)) return [];

    return [
      {
        id: options.createWallId(index),
        unitOrigin: normalizeUnitOrigin(options.unitOrigin),
        a: { ...point },
        b: { ...nextPoint },
        thicknessMm: DEFAULT_ROOM_BOUNDARY_WALL_THICKNESS_MM,
        type: DEFAULT_ROOM_BOUNDARY_WALL_TYPE,
        floorHeightMm: DEFAULT_WALL_FLOOR_HEIGHT_MM,
        ceilingHeightMm: DEFAULT_WALL_CEILING_HEIGHT_MM,
        sides: DEFAULT_WALL_SIDES,
      },
    ];
  });
}

export function cloneWall(wall: Wall): Wall {
  return {
    id: wall.id,
    unitOrigin: normalizeUnitOrigin(wall.unitOrigin),
    a: { ...wall.a },
    b: { ...wall.b },
    thicknessMm: wall.thicknessMm,
    type: wall.type,
    floorHeightMm: wall.floorHeightMm,
    ceilingHeightMm: wall.ceilingHeightMm,
    sides: [...wall.sides],
  };
}

export function cloneWalls(walls: Wall[] | undefined): Wall[] {
  return (walls ?? []).map((wall) => cloneWall(wall));
}

export function areWallsEqual(a: Wall[] | undefined, b: Wall[] | undefined): boolean {
  const wallsA = a ?? [];
  const wallsB = b ?? [];
  if (wallsA.length !== wallsB.length) return false;

  for (let i = 0; i < wallsA.length; i += 1) {
    const wallA = wallsA[i];
    const wallB = wallsB[i];
    if (
      wallA.id !== wallB.id ||
      normalizeUnitOrigin(wallA.unitOrigin) !== normalizeUnitOrigin(wallB.unitOrigin) ||
      wallA.a.x !== wallB.a.x ||
      wallA.a.y !== wallB.a.y ||
      wallA.b.x !== wallB.b.x ||
      wallA.b.y !== wallB.b.y ||
      wallA.thicknessMm !== wallB.thicknessMm ||
      wallA.type !== wallB.type ||
      wallA.floorHeightMm !== wallB.floorHeightMm ||
      wallA.ceilingHeightMm !== wallB.ceilingHeightMm ||
      wallA.sides[0] !== wallB.sides[0] ||
      wallA.sides[1] !== wallB.sides[1]
    ) {
      return false;
    }
  }

  return true;
}

export function hasRoomBoundaryWalls(room: Pick<Room, "walls">): boolean {
  return Array.isArray(room.walls) && room.walls.length > 0;
}

export function createMigratedRoomBoundaryWalls(room: Pick<Room, "id" | "unitOrigin" | "points">): Wall[] {
  return createRoomBoundaryWalls(room.points, {
    unitOrigin: room.unitOrigin,
    createWallId: (edgeIndex) => `${room.id}-wall-${edgeIndex + 1}`,
  });
}

export function migrateRoomBoundaryWalls(room: Room): Room {
  if (hasRoomBoundaryWalls(room)) {
    return {
      ...room,
      walls: cloneWalls(room.walls),
    };
  }

  return {
    ...room,
    walls: createMigratedRoomBoundaryWalls(room),
  };
}

export function migrateDocumentRoomsToWalls(document: EditorDocumentState): {
  document: EditorDocumentState;
  didMigrate: boolean;
} {
  let didMigrate = false;
  const rooms = document.rooms.map((room) => {
    if (hasRoomBoundaryWalls(room)) return room;
    didMigrate = true;
    return migrateRoomBoundaryWalls(room);
  });

  if (!didMigrate) {
    return {
      document,
      didMigrate: false,
    };
  }

  return {
    document: {
      ...document,
      rooms,
    },
    didMigrate: true,
  };
}

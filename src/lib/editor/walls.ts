import type { Point, Wall, WallSide, WallType } from "@/lib/editor/types";
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

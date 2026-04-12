import {
  cloneRoomInteriorAsset,
  cloneRoomInteriorAssets,
} from "@/lib/editor/interiorAssets";
import { cloneRoomOpening, cloneRoomOpenings } from "@/lib/editor/openings";
import {
  DEFAULT_CANVAS_ROTATION_DEGREES,
  normalizeCanvasRotationDegrees,
} from "@/lib/editor/canvasRotation";
import { DEFAULT_NORTH_BEARING_DEGREES, normalizeNorthBearingDegrees } from "@/lib/editor/north";
import type { Floor, Room, RoomInteriorAsset, RoomOpening } from "@/lib/editor/types";
import {
  cloneProjectExportConfig,
  DEFAULT_PROJECT_EXPORT_CONFIG,
  type ProjectExportConfig,
} from "@/lib/projects/exportConfig";

export type EditorDocumentState = {
  floors: Floor[];
  activeFloorId: string | null;
  rooms: Room[];
  exportConfig: ProjectExportConfig;
  northBearingDegrees: number;
  canvasRotationDegrees: number;
};

export type EditorCommand =
  | {
      type: "update-canvas-rotation";
      previousRotationDegrees: number;
      nextRotationDegrees: number;
    }
  | {
      type: "update-north-bearing";
      previousBearingDegrees: number;
      nextBearingDegrees: number;
    }
  | {
      type: "add-floor";
      floor: Floor;
      previousActiveFloorId: string | null;
    }
  | {
      type: "complete-room";
      room: Room;
    }
  | {
      type: "delete-room";
      room: Room;
      previousIndex: number;
    }
  | {
      type: "rename-room";
      roomId: string;
      previousName: string;
      nextName: string;
    }
  | {
      type: "resize-room";
      roomId: string;
      previousPoints: Room["points"];
      nextPoints: Room["points"];
      previousInteriorAssets?: RoomInteriorAsset[];
      nextInteriorAssets?: RoomInteriorAsset[];
    }
  | {
      type: "move-room";
      roomId: string;
      previousPoints: Room["points"];
      nextPoints: Room["points"];
    }
  | {
      type: "add-opening";
      roomId: string;
      opening: RoomOpening;
    }
  | {
      type: "add-interior-asset";
      roomId: string;
      asset: RoomInteriorAsset;
    }
  | {
      type: "delete-opening";
      roomId: string;
      opening: RoomOpening;
    }
  | {
      type: "delete-interior-asset";
      roomId: string;
      asset: RoomInteriorAsset;
    }
  | {
      type: "move-opening";
      roomId: string;
      openingId: string;
      previousOffsetMm: number;
      nextOffsetMm: number;
    }
  | {
      type: "move-interior-asset";
      roomId: string;
      assetId: string;
      previousXmm: number;
      previousYmm: number;
      nextXmm: number;
      nextYmm: number;
    }
  | {
      type: "update-interior-asset";
      roomId: string;
      previousAsset: RoomInteriorAsset;
      nextAsset: RoomInteriorAsset;
    }
  | {
      type: "update-opening";
      roomId: string;
      previousOpening: RoomOpening;
      nextOpening: RoomOpening;
    };

export function applyEditorCommand(
  document: EditorDocumentState,
  command: EditorCommand,
  direction: "undo" | "redo"
): EditorDocumentState {
  if (command.type === "update-canvas-rotation") {
    return {
      ...document,
      canvasRotationDegrees: normalizeCanvasRotationDegrees(
        direction === "undo" ? command.previousRotationDegrees : command.nextRotationDegrees
      ),
    };
  }

  if (command.type === "update-north-bearing") {
    return {
      ...document,
      northBearingDegrees: normalizeNorthBearingDegrees(
        direction === "undo" ? command.previousBearingDegrees : command.nextBearingDegrees
      ),
    };
  }

  if (command.type === "complete-room") {
    if (direction === "undo") {
      return {
        ...document,
        rooms: document.rooms.filter((room) => room.id !== command.room.id),
      };
    }

    return {
      ...document,
      rooms: [...document.rooms.filter((room) => room.id !== command.room.id), command.room],
    };
  }

  if (command.type === "add-floor") {
    if (direction === "undo") {
      return {
        ...document,
        floors: document.floors.filter((floor) => floor.id !== command.floor.id),
        activeFloorId: command.previousActiveFloorId,
      };
    }

    return {
      ...document,
      floors: [...document.floors.filter((floor) => floor.id !== command.floor.id), command.floor],
      activeFloorId: command.floor.id,
    };
  }

  if (command.type === "delete-room") {
    if (direction === "undo") {
      const roomsWithoutDeletedRoom = document.rooms.filter((room) => room.id !== command.room.id);
      const nextRooms = [...roomsWithoutDeletedRoom];
      nextRooms.splice(command.previousIndex, 0, {
        id: command.room.id,
        name: command.room.name,
        points: command.room.points.map((point) => ({ ...point })),
        openings: cloneRoomOpenings(command.room.openings),
        interiorAssets: cloneRoomInteriorAssets(command.room.interiorAssets),
      });

      return {
        ...document,
        rooms: nextRooms,
      };
    }

    return {
      ...document,
      rooms: document.rooms.filter((room) => room.id !== command.room.id),
    };
  }

  if (command.type === "resize-room") {
    const nextPoints = direction === "undo" ? command.previousPoints : command.nextPoints;
    const nextInteriorAssets =
      direction === "undo"
        ? command.previousInteriorAssets
        : command.nextInteriorAssets;
    return {
      ...document,
      rooms: document.rooms.map((room) =>
        room.id === command.roomId
          ? {
              ...room,
              points: nextPoints.map((point) => ({ ...point })),
              interiorAssets: nextInteriorAssets
                ? cloneRoomInteriorAssets(nextInteriorAssets)
                : room.interiorAssets,
            }
          : room
      ),
    };
  }

  if (command.type === "move-room") {
    const nextPoints = direction === "undo" ? command.previousPoints : command.nextPoints;
    const previousPoints = direction === "undo" ? command.nextPoints : command.previousPoints;
    const delta = getTranslationDelta(previousPoints, nextPoints);
    return {
      ...document,
      rooms: document.rooms.map((room) =>
        room.id === command.roomId
          ? {
              ...room,
              points: nextPoints.map((point) => ({ ...point })),
              interiorAssets: room.interiorAssets.map((asset) => ({
                ...cloneRoomInteriorAsset(asset),
                xMm: asset.xMm + delta.x,
                yMm: asset.yMm + delta.y,
              })),
            }
          : room
      ),
    };
  }

  if (command.type === "add-opening") {
    return {
      ...document,
      rooms: document.rooms.map((room) => {
        if (room.id !== command.roomId) return room;

        return {
          ...room,
          openings:
            direction === "undo"
              ? room.openings.filter((opening) => opening.id !== command.opening.id)
              : [
                  ...room.openings.filter((opening) => opening.id !== command.opening.id),
                  cloneRoomOpening(command.opening),
                ],
        };
      }),
    };
  }

  if (command.type === "add-interior-asset") {
    return {
      ...document,
      rooms: document.rooms.map((room) => {
        if (room.id !== command.roomId) return room;

        return {
          ...room,
          interiorAssets:
            direction === "undo"
              ? room.interiorAssets.filter((asset) => asset.id !== command.asset.id)
              : [
                  ...room.interiorAssets.filter((asset) => asset.id !== command.asset.id),
                  cloneRoomInteriorAsset(command.asset),
                ],
        };
      }),
    };
  }

  if (command.type === "delete-opening") {
    return {
      ...document,
      rooms: document.rooms.map((room) => {
        if (room.id !== command.roomId) return room;

        return {
          ...room,
          openings:
            direction === "undo"
              ? [
                  ...room.openings.filter((opening) => opening.id !== command.opening.id),
                  cloneRoomOpening(command.opening),
                ]
              : room.openings.filter((opening) => opening.id !== command.opening.id),
        };
      }),
    };
  }

  if (command.type === "delete-interior-asset") {
    return {
      ...document,
      rooms: document.rooms.map((room) => {
        if (room.id !== command.roomId) return room;

        return {
          ...room,
          interiorAssets:
            direction === "undo"
              ? [
                  ...room.interiorAssets.filter((asset) => asset.id !== command.asset.id),
                  cloneRoomInteriorAsset(command.asset),
                ]
              : room.interiorAssets.filter((asset) => asset.id !== command.asset.id),
        };
      }),
    };
  }

  if (command.type === "move-opening") {
    const nextOffsetMm =
      direction === "undo" ? command.previousOffsetMm : command.nextOffsetMm;

    return {
      ...document,
      rooms: document.rooms.map((room) => {
        if (room.id !== command.roomId) return room;

        return {
          ...room,
          openings: room.openings.map((opening) =>
            opening.id === command.openingId
              ? {
                  ...opening,
                  offsetMm: nextOffsetMm,
                }
              : opening
          ),
        };
      }),
    };
  }

  if (command.type === "move-interior-asset") {
    const nextXmm = direction === "undo" ? command.previousXmm : command.nextXmm;
    const nextYmm = direction === "undo" ? command.previousYmm : command.nextYmm;

    return {
      ...document,
      rooms: document.rooms.map((room) => {
        if (room.id !== command.roomId) return room;

        return {
          ...room,
          interiorAssets: room.interiorAssets.map((asset) =>
            asset.id === command.assetId
              ? {
                  ...asset,
                  xMm: nextXmm,
                  yMm: nextYmm,
                }
              : asset
          ),
        };
      }),
    };
  }

  if (command.type === "update-interior-asset") {
    const nextAsset = direction === "undo" ? command.previousAsset : command.nextAsset;

    return {
      ...document,
      rooms: document.rooms.map((room) => {
        if (room.id !== command.roomId) return room;

        return {
          ...room,
          interiorAssets: room.interiorAssets.map((asset) =>
            asset.id === nextAsset.id ? cloneRoomInteriorAsset(nextAsset) : asset
          ),
        };
      }),
    };
  }

  if (command.type === "update-opening") {
    const nextOpening =
      direction === "undo" ? command.previousOpening : command.nextOpening;

    return {
      ...document,
      rooms: document.rooms.map((room) => {
        if (room.id !== command.roomId) return room;

        return {
          ...room,
          openings: room.openings.map((opening) =>
            opening.id === nextOpening.id ? cloneRoomOpening(nextOpening) : opening
          ),
        };
      }),
    };
  }

  const nextName = direction === "undo" ? command.previousName : command.nextName;
  return {
    ...document,
      rooms: document.rooms.map((room) =>
        room.id === command.roomId
          ? {
              ...room,
              name: nextName,
          }
        : room
    ),
  };
}

export function createEmptyEditorDocumentState(): EditorDocumentState {
  return {
    floors: [],
    activeFloorId: null,
    rooms: [],
    exportConfig: cloneProjectExportConfig(DEFAULT_PROJECT_EXPORT_CONFIG),
    northBearingDegrees: DEFAULT_NORTH_BEARING_DEGREES,
    canvasRotationDegrees: DEFAULT_CANVAS_ROTATION_DEGREES,
  };
}

function getTranslationDelta(previousPoints: Room["points"], nextPoints: Room["points"]) {
  if (previousPoints.length === 0 || nextPoints.length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: nextPoints[0].x - previousPoints[0].x,
    y: nextPoints[0].y - previousPoints[0].y,
  };
}

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

export const DEFAULT_FLOOR_ID = "floor-1";
export const DEFAULT_FLOOR_NAME = "Floor 1";

export function createDefaultFloor(): Floor {
  return {
    id: DEFAULT_FLOOR_ID,
    name: DEFAULT_FLOOR_NAME,
  };
}

export function getNormalizedFloors(document: Pick<EditorDocumentState, "floors">): Floor[] {
  const floors = document.floors ?? [];
  if (floors.length > 0) {
    return floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
    }));
  }

  return [createDefaultFloor()];
}

export function getNormalizedActiveFloorId(
  document: Pick<EditorDocumentState, "floors" | "activeFloorId">
): string {
  const floors = getNormalizedFloors(document);
  if (!document.activeFloorId) {
    return floors[0].id;
  }

  return floors.some((floor) => floor.id === document.activeFloorId)
    ? document.activeFloorId
    : floors[0].id;
}

export function getRoomFloorId(
  room: { floorId?: string | null },
  document: Pick<EditorDocumentState, "floors" | "activeFloorId">
): string {
  return room.floorId ?? getNormalizedActiveFloorId(document);
}

export function getRoomsForFloor(document: EditorDocumentState, floorId: string): Room[] {
  return document.rooms.filter((room) => getRoomFloorId(room, document) === floorId);
}

export function getRoomsForActiveFloor(document: EditorDocumentState): Room[] {
  return getRoomsForFloor(document, getNormalizedActiveFloorId(document));
}

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
      type: "switch-floor";
      previousActiveFloorId: string;
      nextActiveFloorId: string;
    }
  | {
      type: "create-connected-floor";
      previousDocument: EditorDocumentState;
      nextDocument: EditorDocumentState;
      createdFloorId: string;
      createdRoomId: string;
      createdAssetId: string;
    }
  | {
      type: "sync-connected-stairs";
      previousDocument: EditorDocumentState;
      nextDocument: EditorDocumentState;
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
      type: "rename-floor";
      floorId: string;
      previousName: string;
      nextName: string;
    }
  | {
      type: "delete-floor";
      floor: Floor;
      previousFloorIndex: number;
      roomsToDelete: Array<{
        room: Room;
        previousIndex: number;
      }>;
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
    }
  | {
      type: "copy-rooms";
      rooms: Room[];
    }
  | {
      type: "paste-rooms";
      pastedRooms: Room[];
      floorId: string;
    }
  | {
      type: "copy-interior-asset";
      asset: RoomInteriorAsset;
      sourceRoomId: string;
    }
  | {
      type: "paste-interior-asset";
      pastedAsset: RoomInteriorAsset;
      targetRoomId: string;
      sourceRoomId: string;
    }
  | {
      type: "cut-rooms";
      cutRooms: Room[];
      previousIndex: number;
    }
  | {
      type: "cut-interior-asset";
      cutAsset: RoomInteriorAsset;
      roomId: string;
    }
  | {
      type: "move-interior-asset-to-room";
      assetId: string;
      fromRoomId: string;
      toRoomId: string;
      asset: RoomInteriorAsset;
    }
  | {
      type: "bulk-delete";
      deleteCommands: (
        | {
            type: "delete-room";
            room: Room;
            previousIndex: number;
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
      )[];
    };

export function applyEditorCommand(
  document: EditorDocumentState,
  command: EditorCommand,
  direction: "undo" | "redo"
): EditorDocumentState {
  if (command.type === "create-connected-floor") {
    return cloneEditorDocumentState(
      direction === "undo" ? command.previousDocument : command.nextDocument
    );
  }

  if (command.type === "sync-connected-stairs") {
    return cloneEditorDocumentState(
      direction === "undo" ? command.previousDocument : command.nextDocument
    );
  }

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

  if (command.type === "switch-floor") {
    return {
      ...document,
      activeFloorId: direction === "undo" ? command.previousActiveFloorId : command.nextActiveFloorId,
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
        floorId: command.room.floorId,
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

  if (command.type === "copy-rooms") {
    // Copy is informational only - just return the document unchanged
    return cloneEditorDocumentState(document);
  }

  if (command.type === "paste-rooms") {
    if (direction === "undo") {
      // Remove pasted rooms
      const pastedIds = new Set(command.pastedRooms.map((r) => r.id));
      return {
        ...document,
        rooms: document.rooms.filter((room) => !pastedIds.has(room.id)),
      };
    } else {
      // Add pasted rooms
      return {
        ...document,
        rooms: [
          ...document.rooms,
          ...command.pastedRooms.map((r) => ({
            ...r,
            floorId: command.floorId,
          })),
        ],
      };
    }
  }

  if (command.type === "copy-interior-asset") {
    // Copy is informational only - just return the document unchanged
    return cloneEditorDocumentState(document);
  }

  if (command.type === "paste-interior-asset") {
    if (direction === "undo") {
      // Remove pasted asset
      return {
        ...document,
        rooms: document.rooms.map((room) => {
          if (room.id !== command.targetRoomId) return room;
          return {
            ...room,
            interiorAssets: room.interiorAssets.filter(
              (asset) => asset.id !== command.pastedAsset.id
            ),
          };
        }),
      };
    } else {
      // Add pasted asset
      return {
        ...document,
        rooms: document.rooms.map((room) => {
          if (room.id !== command.targetRoomId) return room;
          return {
            ...room,
            interiorAssets: [...room.interiorAssets, cloneRoomInteriorAsset(command.pastedAsset)],
          };
        }),
      };
    }
  }

  if (command.type === "cut-rooms") {
    if (direction === "undo") {
      // Restore cut rooms to their previous position
      return {
        ...document,
        rooms: [
          ...document.rooms.slice(0, command.previousIndex),
          ...command.cutRooms.map((r) => ({
            id: r.id,
            floorId: r.floorId,
            name: r.name,
            points: r.points.map((point) => ({ ...point })),
            openings: cloneRoomOpenings(r.openings),
            interiorAssets: cloneRoomInteriorAssets(r.interiorAssets),
          })),
          ...document.rooms.slice(command.previousIndex),
        ],
      };
    } else {
      // Remove cut rooms
      const cutIds = new Set(command.cutRooms.map((r) => r.id));
      return {
        ...document,
        rooms: document.rooms.filter((room) => !cutIds.has(room.id)),
      };
    }
  }

  if (command.type === "cut-interior-asset") {
    if (direction === "undo") {
      // Restore cut asset
      return {
        ...document,
        rooms: document.rooms.map((room) => {
          if (room.id !== command.roomId) return room;
          return {
            ...room,
            interiorAssets: [...room.interiorAssets, cloneRoomInteriorAsset(command.cutAsset)],
          };
        }),
      };
    } else {
      // Remove cut asset
      return {
        ...document,
        rooms: document.rooms.map((room) => {
          if (room.id !== command.roomId) return room;
          return {
            ...room,
            interiorAssets: room.interiorAssets.filter(
              (asset) => asset.id !== command.cutAsset.id
            ),
          };
        }),
      };
    }
  }

  if (command.type === "move-interior-asset-to-room") {
    if (direction === "undo") {
      // Move asset back to original room
      return {
        ...document,
        rooms: document.rooms.map((room) => {
          if (room.id === command.fromRoomId) {
            // Add asset back to original room
            return {
              ...room,
              interiorAssets: [...room.interiorAssets, cloneRoomInteriorAsset(command.asset)],
            };
          }
          if (room.id === command.toRoomId) {
            // Remove asset from target room
            return {
              ...room,
              interiorAssets: room.interiorAssets.filter((a) => a.id !== command.assetId),
            };
          }
          return room;
        }),
      };
    } else {
      // Move asset to target room
      return {
        ...document,
        rooms: document.rooms.map((room) => {
          if (room.id === command.fromRoomId) {
            // Remove asset from original room
            return {
              ...room,
              interiorAssets: room.interiorAssets.filter((a) => a.id !== command.assetId),
            };
          }
          if (room.id === command.toRoomId) {
            // Add asset to target room
            return {
              ...room,
              interiorAssets: [...room.interiorAssets, cloneRoomInteriorAsset(command.asset)],
            };
          }
          return room;
        }),
      };
    }
  }

  if (command.type === "rename-room") {
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

  if (command.type === "rename-floor") {
    const nextName = direction === "undo" ? command.previousName : command.nextName;
    return {
      ...document,
      floors: document.floors.map((floor) =>
        floor.id === command.floorId
          ? {
              ...floor,
              name: nextName,
            }
          : floor
      ),
    };
  }

  if (command.type === "delete-floor") {
    if (direction === "undo") {
      const floorsWithoutDeletedFloor = document.floors.filter((f) => f.id !== command.floor.id);
      const nextFloors = [...floorsWithoutDeletedFloor];
      nextFloors.splice(command.previousFloorIndex, 0, {
        id: command.floor.id,
        name: command.floor.name,
      });

      const roomsWithoutDeletedRooms = document.rooms.filter(
        (room) => !command.roomsToDelete.some((rt) => rt.room.id === room.id)
      );
      const nextRooms = [...roomsWithoutDeletedRooms];

      for (const { room, previousIndex } of command.roomsToDelete) {
        nextRooms.splice(previousIndex, 0, {
          id: room.id,
          floorId: room.floorId,
          name: room.name,
          points: room.points.map((point) => ({ ...point })),
          openings: cloneRoomOpenings(room.openings),
          interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
        });
      }

      return {
        ...document,
        floors: nextFloors,
        rooms: nextRooms,
      };
    }

    return {
      ...document,
      floors: document.floors.filter((f) => f.id !== command.floor.id),
      rooms: document.rooms.filter(
        (room) => !command.roomsToDelete.some((rt) => rt.room.id === room.id)
      ),
    };
  }

  if (command.type === "bulk-delete") {
    // Apply all delete commands in sequence
    let nextDocument = document;
    for (const deleteCmd of command.deleteCommands) {
      nextDocument = applyEditorCommand(nextDocument, deleteCmd, direction);
    }
    return nextDocument;
  }

  return document;
}

export function createEmptyEditorDocumentState(): EditorDocumentState {
  return {
    floors: [createDefaultFloor()],
    activeFloorId: DEFAULT_FLOOR_ID,
    rooms: [],
    exportConfig: cloneProjectExportConfig(DEFAULT_PROJECT_EXPORT_CONFIG),
    northBearingDegrees: DEFAULT_NORTH_BEARING_DEGREES,
    canvasRotationDegrees: DEFAULT_CANVAS_ROTATION_DEGREES,
  };
}

function cloneEditorDocumentState(document: EditorDocumentState): EditorDocumentState {
  return {
    floors: getNormalizedFloors(document),
    activeFloorId: getNormalizedActiveFloorId(document),
    rooms: document.rooms.map((room) => ({
      id: room.id,
      floorId: getRoomFloorId(room, document),
      name: room.name,
      points: room.points.map((point) => ({ ...point })),
      openings: cloneRoomOpenings(room.openings),
      interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
    })),
    exportConfig: cloneProjectExportConfig(document.exportConfig),
    northBearingDegrees: normalizeNorthBearingDegrees(document.northBearingDegrees),
    canvasRotationDegrees: normalizeCanvasRotationDegrees(document.canvasRotationDegrees),
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

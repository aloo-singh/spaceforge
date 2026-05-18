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
import type { Floor, Room, RoomInteriorAsset, RoomOpening, InteriorAssetType, RulerMeasurement } from "@/lib/editor/types";
import {
  cloneProjectExportConfig,
  DEFAULT_PROJECT_EXPORT_CONFIG,
  type ProjectExportConfig,
} from "@/lib/projects/exportConfig";
import {
  DEFAULT_PROJECT_REGION,
  normalizeProjectRegion,
  normalizeUnitOrigin,
  type ProjectRegion,
  type UnitOrigin,
} from "@/lib/projects/region";

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
  region: ProjectRegion;
  floors: Floor[];
  activeFloorId: string | null;
  rooms: Room[];
  rulerMeasurements: RulerMeasurement[];
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
      insertIndex: number;
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
      type: "update-room-preset";
      roomId: string;
      previousRoom: Pick<Room, "name" | "roomType" | "roomColor">;
      nextRoom: Pick<Room, "name" | "roomType" | "roomColor">;
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
      editKind?: "wall-split" | "vertex-delete";
      roomName?: string;
      previousUnitOrigin?: UnitOrigin;
      nextUnitOrigin?: UnitOrigin;
      previousInteriorAssets?: RoomInteriorAsset[];
      nextInteriorAssets?: RoomInteriorAsset[];
    }
  | {
      type: "move-room";
      roomId: string;
      previousPoints: Room["points"];
      nextPoints: Room["points"];
      previousUnitOrigin?: UnitOrigin;
      nextUnitOrigin?: UnitOrigin;
    }
  | {
      type: "bulk-move-rooms";
      previousDocument: EditorDocumentState;
      nextDocument: EditorDocumentState;
      movedRooms: Array<{
        roomId: string;
        previousPoints: Room["points"];
        nextPoints: Room["points"];
      }>;
    }
  | {
      type: "add-opening";
      roomId: string;
      opening: RoomOpening;
      source?: "direct" | "paste";
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
      openingType: "door" | "window";
      previousOffsetMm: number;
      nextOffsetMm: number;
      previousUnitOrigin?: UnitOrigin;
      nextUnitOrigin?: UnitOrigin;
    }
  | {
      type: "bulk-move-openings";
      previousDocument: EditorDocumentState;
      nextDocument: EditorDocumentState;
      movedOpenings: Array<{
        roomId: string;
        openingId: string;
        openingType: "door" | "window";
        previousOffsetMm: number;
        nextOffsetMm: number;
      }>;
    }
  | {
      type: "move-interior-asset";
      roomId: string;
      assetId: string;
      assetType: InteriorAssetType;
      previousXmm: number;
      previousYmm: number;
      nextXmm: number;
      nextYmm: number;
      previousUnitOrigin?: UnitOrigin;
      nextUnitOrigin?: UnitOrigin;
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
      type: "paste-interior-assets";
      pastedAssets: Array<{
        asset: RoomInteriorAsset;
        sourceRoomId: string;
      }>;
      targetRoomId: string;
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
      previousDocument?: EditorDocumentState;
      nextDocument?: EditorDocumentState;
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
        | {
            type: "delete-ruler";
            ruler: RulerMeasurement;
            previousIndex: number;
          }
      )[];
    }
  | {
      type: "bulk-duplicate";
      duplicatedRooms: Room[];
      duplicatedAssets: Array<{
        roomId: string;
        asset: RoomInteriorAsset;
      }>;
      duplicatedOpenings?: Array<{
        roomId: string;
        opening: RoomOpening;
      }>;
      isMirror?: boolean;
    }
  | {
      type: "bulk-move-interior-assets";
      movedAssets: Array<{
        roomId: string;
        assetId: string;
        assetType: InteriorAssetType;
        previousXmm: number;
        previousYmm: number;
        nextXmm: number;
        nextYmm: number;
        previousUnitOrigin?: UnitOrigin;
        nextUnitOrigin?: UnitOrigin;
      }>;
    }
  | {
      type: "move-selection-to-floor";
      targetFloorId: string;
      targetRoomId: string | null;
      movedRooms: Array<{
        room: Room;
        previousFloorId: string;
      }>;
      movedAssets: Array<{
        roomId: string;
        asset: RoomInteriorAsset;
        previousRoomId: string;
      }>;
    }
  | {
      type: "reorder-rooms-in-floor";
      floorId: string;
      roomId: string;
      fromIndex: number;
      toIndex: number;
    }
  | {
      type: "add-ruler";
      ruler: RulerMeasurement;
      rulerIndex: number;
    }
  | {
      type: "update-ruler";
      previousRuler: RulerMeasurement;
      nextRuler: RulerMeasurement;
    }
  | {
      type: "delete-ruler";
      ruler: RulerMeasurement;
      previousIndex: number;
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

  if (command.type === "bulk-move-rooms" || command.type === "bulk-move-openings") {
    return cloneEditorDocumentState(
      direction === "undo" ? command.previousDocument : command.nextDocument
    );
  }

  if (
    command.type === "move-interior-asset-to-room" &&
    command.previousDocument &&
    command.nextDocument
  ) {
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

  if (command.type === "add-ruler") {
    return {
      ...document,
      rulerMeasurements:
        direction === "undo"
          ? document.rulerMeasurements.filter((ruler) => ruler.id !== command.ruler.id)
          : [
              ...document.rulerMeasurements.filter((ruler) => ruler.id !== command.ruler.id),
              cloneRulerMeasurement(command.ruler),
            ],
    };
  }

  if (command.type === "update-ruler") {
    const nextRuler = direction === "undo" ? command.previousRuler : command.nextRuler;
    return {
      ...document,
      rulerMeasurements: document.rulerMeasurements.map((ruler) =>
        ruler.id === nextRuler.id ? cloneRulerMeasurement(nextRuler) : ruler
      ),
    };
  }

  if (command.type === "delete-ruler") {
    if (direction === "undo") {
      const rulersWithoutDeleted = document.rulerMeasurements.filter(
        (ruler) => ruler.id !== command.ruler.id
      );
      const nextRulers = [...rulersWithoutDeleted];
      nextRulers.splice(command.previousIndex, 0, cloneRulerMeasurement(command.ruler));

      return {
        ...document,
        rulerMeasurements: nextRulers,
      };
    }

    return {
      ...document,
      rulerMeasurements: document.rulerMeasurements.filter((ruler) => ruler.id !== command.ruler.id),
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
      rooms: [
        ...document.rooms.filter((room) => room.id !== command.room.id),
        {
          ...command.room,
          unitOrigin: normalizeUnitOrigin(command.room.unitOrigin),
          roomType: command.room.roomType,
          roomColor: command.room.roomColor,
          points: command.room.points.map((point) => ({ ...point })),
          openings: cloneRoomOpenings(command.room.openings),
          interiorAssets: cloneRoomInteriorAssets(command.room.interiorAssets),
        },
      ],
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

    const floorsWithoutAddedFloor = document.floors.filter((floor) => floor.id !== command.floor.id);
    const boundedInsertIndex = Math.max(0, Math.min(command.insertIndex, floorsWithoutAddedFloor.length));
    const nextFloors = [...floorsWithoutAddedFloor];
    nextFloors.splice(boundedInsertIndex, 0, command.floor);

    return {
      ...document,
      floors: nextFloors,
      activeFloorId: command.floor.id,
    };
  }

  if (command.type === "delete-room") {
    if (direction === "undo") {
      const roomsWithoutDeletedRoom = document.rooms.filter((room) => room.id !== command.room.id);
      const nextRooms = [...roomsWithoutDeletedRoom];
      nextRooms.splice(command.previousIndex, 0, {
        id: command.room.id,
        unitOrigin: normalizeUnitOrigin(command.room.unitOrigin),
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
    const commandUnitOrigin =
      direction === "undo" ? command.previousUnitOrigin : command.nextUnitOrigin;
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
              unitOrigin: normalizeUnitOrigin(commandUnitOrigin ?? room.unitOrigin),
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
    const commandUnitOrigin =
      direction === "undo" ? command.previousUnitOrigin : command.nextUnitOrigin;
    const delta = getTranslationDelta(previousPoints, nextPoints);
    return {
      ...document,
      rooms: document.rooms.map((room) =>
        room.id === command.roomId
          ? {
              ...room,
              unitOrigin: normalizeUnitOrigin(commandUnitOrigin ?? room.unitOrigin),
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
    const commandUnitOrigin =
      direction === "undo" ? command.previousUnitOrigin : command.nextUnitOrigin;

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
                  unitOrigin: normalizeUnitOrigin(commandUnitOrigin ?? opening.unitOrigin),
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
    const commandUnitOrigin =
      direction === "undo" ? command.previousUnitOrigin : command.nextUnitOrigin;

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
                  unitOrigin: normalizeUnitOrigin(commandUnitOrigin ?? asset.unitOrigin),
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

  if (command.type === "paste-interior-assets") {
    if (direction === "undo") {
      const pastedIds = new Set(command.pastedAssets.map((item) => item.asset.id));
      return {
        ...document,
        rooms: document.rooms.map((room) => {
          if (room.id !== command.targetRoomId) return room;
          return {
            ...room,
            interiorAssets: room.interiorAssets.filter((asset) => !pastedIds.has(asset.id)),
          };
        }),
      };
    }

    return {
      ...document,
      rooms: document.rooms.map((room) => {
        if (room.id !== command.targetRoomId) return room;
        return {
          ...room,
          interiorAssets: [
            ...room.interiorAssets,
            ...command.pastedAssets.map((item) => cloneRoomInteriorAsset(item.asset)),
          ],
        };
      }),
    };
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

  if (command.type === "update-room-preset") {
    const nextRoom = direction === "undo" ? command.previousRoom : command.nextRoom;
    return {
      ...document,
      rooms: document.rooms.map((room) =>
        room.id === command.roomId
          ? {
              ...room,
              name: nextRoom.name,
              roomType: nextRoom.roomType,
              roomColor: nextRoom.roomColor,
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

  if (command.type === "bulk-duplicate") {
    if (direction === "undo") {
      // Remove duplicated rooms, assets, and openings
      const duplicatedRoomIds = new Set(command.duplicatedRooms.map((r) => r.id));
      const duplicatedAssetIds = new Set(command.duplicatedAssets.map((da) => da.asset.id));
      const duplicatedOpeningIds = new Set(
        (command.duplicatedOpenings ?? []).map((do_) => do_.opening.id)
      );

      return {
        ...document,
        rooms: document.rooms.filter((room) => {
          if (duplicatedRoomIds.has(room.id)) return false;
          // Keep the room but filter out duplicated assets and openings
          return true;
        }).map((room) => {
          const duplicatedAssetsInRoom = command.duplicatedAssets.filter(
            (da) => da.roomId === room.id
          );
          const duplicatedOpeningsInRoom = (command.duplicatedOpenings ?? []).filter(
            (do_) => do_.roomId === room.id
          );
          if (duplicatedAssetsInRoom.length === 0 && duplicatedOpeningsInRoom.length === 0) {
            return room;
          }

          return {
            ...room,
            interiorAssets: room.interiorAssets.filter(
              (asset) => !duplicatedAssetIds.has(asset.id)
            ),
            openings: room.openings.filter(
              (opening) => !duplicatedOpeningIds.has(opening.id)
            ),
          };
        }),
      };
    } else {
      // Add duplicated rooms, assets, and openings
      return {
        ...document,
        rooms: document.rooms
          .map((room) => {
            const assetsToAdd = command.duplicatedAssets.filter((da) => da.roomId === room.id);
            const openingsToAdd = (command.duplicatedOpenings ?? []).filter(
              (do_) => do_.roomId === room.id
            );
            if (assetsToAdd.length === 0 && openingsToAdd.length === 0) return room;

            return {
              ...room,
              interiorAssets: [
                ...room.interiorAssets,
                ...assetsToAdd.map((da) => cloneRoomInteriorAsset(da.asset)),
              ],
              openings: [
                ...room.openings,
                ...openingsToAdd.map((do_) => cloneRoomOpening(do_.opening)),
              ],
            };
          })
          .concat(command.duplicatedRooms),
      };
    }
  }

  if (command.type === "bulk-move-interior-assets") {
    return {
      ...document,
      rooms: document.rooms.map((room) => ({
        ...room,
        interiorAssets: room.interiorAssets.map((asset) => {
          const moveCmd = command.movedAssets.find(
            (cmd) => cmd.roomId === room.id && cmd.assetId === asset.id
          );
          if (!moveCmd) return asset;

          const nextXmm = direction === "undo" ? moveCmd.previousXmm : moveCmd.nextXmm;
          const nextYmm = direction === "undo" ? moveCmd.previousYmm : moveCmd.nextYmm;
          const commandUnitOrigin =
            direction === "undo" ? moveCmd.previousUnitOrigin : moveCmd.nextUnitOrigin;

          return {
            ...asset,
            unitOrigin: normalizeUnitOrigin(commandUnitOrigin ?? asset.unitOrigin),
            xMm: nextXmm,
            yMm: nextYmm,
          };
        }),
      })),
    };
  }

  if (command.type === "move-selection-to-floor") {
    if (direction === "undo") {
      // Restore rooms to previous floors and move stairs back to previous rooms.
      return {
        ...document,
        rooms: document.rooms.map((room) => {
          const movedRoomInfo = command.movedRooms.find((mr) => mr.room.id === room.id);
          let nextRoom = movedRoomInfo
            ? {
                ...room,
                floorId: movedRoomInfo.previousFloorId,
              }
            : room;

          // Remove moved stairs from target room.
          if (command.targetRoomId && room.id === command.targetRoomId) {
            const movedAssetIds = new Set(command.movedAssets.map((moved) => moved.asset.id));
            nextRoom = {
              ...nextRoom,
              interiorAssets: nextRoom.interiorAssets.filter(
                (asset) => !movedAssetIds.has(asset.id)
              ),
            };
          }

          // Restore moved stairs to their previous rooms.
          const assetsReturningToRoom = command.movedAssets.filter(
            (moved) => moved.previousRoomId === room.id
          );
          if (assetsReturningToRoom.length > 0) {
            const existingIds = new Set(nextRoom.interiorAssets.map((asset) => asset.id));
            nextRoom = {
              ...nextRoom,
              interiorAssets: [
                ...nextRoom.interiorAssets,
                ...assetsReturningToRoom
                  .filter((moved) => !existingIds.has(moved.asset.id))
                  .map((moved) => cloneRoomInteriorAsset(moved.asset)),
              ],
            };
          }

          return nextRoom;
        }),
      };
    } else {
      // Move rooms to target floor and move selected stairs into target room.
      return {
        ...document,
        rooms: document.rooms.map((room) => {
          const movedRoomInfo = command.movedRooms.find((mr) => mr.room.id === room.id);
          let nextRoom = movedRoomInfo
            ? {
                ...room,
                floorId: command.targetFloorId,
              }
            : room;

          const movedAssetIds = new Set(command.movedAssets.map((moved) => moved.asset.id));
          if (movedAssetIds.size > 0) {
            // Remove moved stairs from source rooms.
            if (command.movedAssets.some((moved) => moved.previousRoomId === room.id)) {
              nextRoom = {
                ...nextRoom,
                interiorAssets: nextRoom.interiorAssets.filter(
                  (asset) => !movedAssetIds.has(asset.id)
                ),
              };
            }

            // Add moved stairs to target room.
            if (command.targetRoomId && room.id === command.targetRoomId) {
              const existingIds = new Set(nextRoom.interiorAssets.map((asset) => asset.id));
              nextRoom = {
                ...nextRoom,
                interiorAssets: [
                  ...nextRoom.interiorAssets,
                  ...command.movedAssets
                    .filter((moved) => !existingIds.has(moved.asset.id))
                    .map((moved) => cloneRoomInteriorAsset(moved.asset)),
                ],
              };
            }
          }

          return nextRoom;
        }),
      };
    }
  }

  if (command.type === "reorder-rooms-in-floor") {
    // Get rooms for this floor (preserves relative order)
    const floorRooms = document.rooms.filter((room) => room.floorId === command.floorId);

    // Determine source and target indices based on direction
    const sourceIndex = direction === "undo" ? command.toIndex : command.fromIndex;
    const targetIndex = direction === "undo" ? command.fromIndex : command.toIndex;

    // Reorder the floor rooms
    const reorderedFloorRooms = [...floorRooms];
    const [movedRoom] = reorderedFloorRooms.splice(sourceIndex, 1);
    reorderedFloorRooms.splice(targetIndex, 0, movedRoom);

    // Walk the full rooms array, replacing each floor room with the next
    // reordered room in sequence. Non-floor rooms stay in place.
    // This avoids duplicates regardless of whether floor rooms are contiguous.
    let floorRoomIndex = 0;
    const reorderedRooms = document.rooms.map((room) => {
      if (room.floorId !== command.floorId) return room;
      return reorderedFloorRooms[floorRoomIndex++];
    });

    return {
      ...document,
      rooms: reorderedRooms,
    };
  }

  return document;
}

export function createEmptyEditorDocumentState(): EditorDocumentState {
  return {
    region: DEFAULT_PROJECT_REGION,
    floors: [createDefaultFloor()],
    activeFloorId: DEFAULT_FLOOR_ID,
    rooms: [],
    rulerMeasurements: [],
    exportConfig: cloneProjectExportConfig(DEFAULT_PROJECT_EXPORT_CONFIG),
    northBearingDegrees: DEFAULT_NORTH_BEARING_DEGREES,
    canvasRotationDegrees: DEFAULT_CANVAS_ROTATION_DEGREES,
  };
}

function cloneEditorDocumentState(document: EditorDocumentState): EditorDocumentState {
  return {
    region: normalizeProjectRegion(document.region),
    floors: getNormalizedFloors(document),
    activeFloorId: getNormalizedActiveFloorId(document),
    rooms: document.rooms.map((room) => ({
      id: room.id,
      unitOrigin: normalizeUnitOrigin(room.unitOrigin),
      floorId: getRoomFloorId(room, document),
      name: room.name,
      points: room.points.map((point) => ({ ...point })),
      openings: cloneRoomOpenings(room.openings),
      interiorAssets: cloneRoomInteriorAssets(room.interiorAssets),
    })),
    rulerMeasurements: cloneRulerMeasurements(document.rulerMeasurements ?? []),
    exportConfig: cloneProjectExportConfig(document.exportConfig),
    northBearingDegrees: normalizeNorthBearingDegrees(document.northBearingDegrees),
    canvasRotationDegrees: normalizeCanvasRotationDegrees(document.canvasRotationDegrees),
  };
}

export function cloneRulerMeasurement(ruler: RulerMeasurement): RulerMeasurement {
  return {
    id: ruler.id,
    unitOrigin: normalizeUnitOrigin(ruler.unitOrigin),
    ...(ruler.name !== undefined ? { name: ruler.name } : {}),
    start: { ...ruler.start },
    end: { ...ruler.end },
    ...(ruler.hidden ? { hidden: true } : {}),
  };
}

export function cloneRulerMeasurements(rulers: RulerMeasurement[]): RulerMeasurement[] {
  return rulers.map((ruler) => cloneRulerMeasurement(ruler));
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

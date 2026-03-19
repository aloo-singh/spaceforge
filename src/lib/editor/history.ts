import { cloneRoomOpening, cloneRoomOpenings } from "@/lib/editor/openings";
import type { Room, RoomOpening } from "@/lib/editor/types";

export type EditorDocumentState = {
  rooms: Room[];
};

export type EditorCommand =
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
      type: "delete-opening";
      roomId: string;
      opening: RoomOpening;
    }
  | {
      type: "move-opening";
      roomId: string;
      openingId: string;
      previousOffsetMm: number;
      nextOffsetMm: number;
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
  if (command.type === "complete-room") {
    if (direction === "undo") {
      return {
        rooms: document.rooms.filter((room) => room.id !== command.room.id),
      };
    }

    return {
      rooms: [...document.rooms.filter((room) => room.id !== command.room.id), command.room],
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
      });

      return {
        rooms: nextRooms,
      };
    }

    return {
      rooms: document.rooms.filter((room) => room.id !== command.room.id),
    };
  }

  if (command.type === "resize-room") {
    const nextPoints = direction === "undo" ? command.previousPoints : command.nextPoints;
    return {
      rooms: document.rooms.map((room) =>
        room.id === command.roomId
          ? {
              ...room,
              points: nextPoints.map((point) => ({ ...point })),
            }
          : room
      ),
    };
  }

  if (command.type === "move-room") {
    const nextPoints = direction === "undo" ? command.previousPoints : command.nextPoints;
    return {
      rooms: document.rooms.map((room) =>
        room.id === command.roomId
          ? {
              ...room,
              points: nextPoints.map((point) => ({ ...point })),
            }
          : room
      ),
    };
  }

  if (command.type === "add-opening") {
    return {
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

  if (command.type === "delete-opening") {
    return {
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

  if (command.type === "move-opening") {
    const nextOffsetMm =
      direction === "undo" ? command.previousOffsetMm : command.nextOffsetMm;

    return {
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

  if (command.type === "update-opening") {
    const nextOpening =
      direction === "undo" ? command.previousOpening : command.nextOpening;

    return {
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

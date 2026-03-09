import type { Room } from "@/lib/editor/types";

export type EditorDocumentState = {
  rooms: Room[];
};

export type EditorCommand =
  | {
      type: "complete-room";
      room: Room;
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

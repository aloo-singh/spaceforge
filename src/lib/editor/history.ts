import type { Room } from "@/lib/editor/types";

export type EditorDocumentState = {
  rooms: Room[];
};

export type EditorCommandContext = {
  document: EditorDocumentState;
  selectedRoomId: string | null;
};

export type EditorCommand =
  | {
      type: "complete-room";
      room: Room;
      previousSelectedRoomId: string | null;
    }
  | {
      type: "rename-room";
      roomId: string;
      previousName: string;
      nextName: string;
    }
  | {
      type: "set-selection";
      previousSelectedRoomId: string | null;
      nextSelectedRoomId: string | null;
    };

export function applyEditorCommand(
  state: EditorCommandContext,
  command: EditorCommand,
  direction: "undo" | "redo"
): EditorCommandContext {
  if (command.type === "complete-room") {
    if (direction === "undo") {
      return {
        document: {
          rooms: state.document.rooms.filter((room) => room.id !== command.room.id),
        },
        selectedRoomId: command.previousSelectedRoomId,
      };
    }

    return {
      document: {
        rooms: [...state.document.rooms.filter((room) => room.id !== command.room.id), command.room],
      },
      selectedRoomId: null,
    };
  }

  if (command.type === "rename-room") {
    const nextName = direction === "undo" ? command.previousName : command.nextName;
    return {
      ...state,
      document: {
        rooms: state.document.rooms.map((room) =>
          room.id === command.roomId
            ? {
                ...room,
                name: nextName,
              }
            : room
        ),
      },
    };
  }

  return {
    ...state,
    selectedRoomId:
      direction === "undo" ? command.previousSelectedRoomId : command.nextSelectedRoomId,
  };
}

export function isMergeableRenameCommand(command: EditorCommand, roomId: string): boolean {
  return command.type === "rename-room" && command.roomId === roomId;
}

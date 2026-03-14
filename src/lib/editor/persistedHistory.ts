import { applyEditorCommand, type EditorCommand, type EditorDocumentState } from "@/lib/editor/history";
import type { Room } from "@/lib/editor/types";

export type PersistedHistorySnapshot = {
  historyStack: EditorDocumentState[];
  historyIndex: number;
};

export type HydratedCommandHistory = {
  past: EditorCommand[];
  future: EditorCommand[];
};

export function areDocumentsEqual(a: EditorDocumentState, b: EditorDocumentState): boolean {
  if (a.rooms.length !== b.rooms.length) return false;

  for (let i = 0; i < a.rooms.length; i += 1) {
    const roomA = a.rooms[i];
    const roomB = b.rooms[i];
    if (roomA.id !== roomB.id || roomA.name !== roomB.name) return false;
    if (!arePointListsEqual(roomA.points, roomB.points)) return false;
  }

  return true;
}

export function cloneDocumentState(document: EditorDocumentState): EditorDocumentState {
  return {
    rooms: document.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      points: room.points.map((point) => ({ ...point })),
    })),
  };
}

function arePointListsEqual(a: Room["points"], b: Room["points"]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }

  return true;
}

function inferEditorCommand(previous: EditorDocumentState, next: EditorDocumentState): EditorCommand | null {
  const previousById = new Map(previous.rooms.map((room) => [room.id, room]));
  const nextById = new Map(next.rooms.map((room) => [room.id, room]));
  const removedRooms = previous.rooms.filter((room) => !nextById.has(room.id));
  if (removedRooms.length > 0) return null;

  const addedRooms = next.rooms.filter((room) => !previousById.has(room.id));
  const changedRooms: Array<{
    previous: Room;
    next: Room;
  }> = [];

  for (const room of next.rooms) {
    const previousRoom = previousById.get(room.id);
    if (!previousRoom) continue;

    const didNameChange = previousRoom.name !== room.name;
    const didPointsChange = !arePointListsEqual(previousRoom.points, room.points);
    if (!didNameChange && !didPointsChange) continue;

    changedRooms.push({
      previous: previousRoom,
      next: room,
    });
  }

  if (addedRooms.length === 1 && changedRooms.length === 0 && previous.rooms.length + 1 === next.rooms.length) {
    return {
      type: "complete-room",
      room: {
        id: addedRooms[0].id,
        name: addedRooms[0].name,
        points: addedRooms[0].points.map((point) => ({ ...point })),
      },
    };
  }

  if (addedRooms.length > 0 || changedRooms.length !== 1) return null;

  const changedRoom = changedRooms[0];
  const didNameChange = changedRoom.previous.name !== changedRoom.next.name;
  const didPointsChange = !arePointListsEqual(changedRoom.previous.points, changedRoom.next.points);

  if (didNameChange && !didPointsChange) {
    return {
      type: "rename-room",
      roomId: changedRoom.next.id,
      previousName: changedRoom.previous.name,
      nextName: changedRoom.next.name,
    };
  }

  if (!didNameChange && didPointsChange) {
    // Snapshot-based history only needs a deterministic point transition command.
    return {
      type: "move-room",
      roomId: changedRoom.next.id,
      previousPoints: changedRoom.previous.points.map((point) => ({ ...point })),
      nextPoints: changedRoom.next.points.map((point) => ({ ...point })),
    };
  }

  return null;
}

function findDocumentIndex(historyStack: EditorDocumentState[], document: EditorDocumentState): number | null {
  let matchedIndex: number | null = null;

  for (let i = 0; i < historyStack.length; i += 1) {
    if (!areDocumentsEqual(historyStack[i], document)) continue;
    if (matchedIndex !== null) return null;
    matchedIndex = i;
  }

  return matchedIndex;
}

export function normalizePersistedHistorySnapshot(
  snapshot: PersistedHistorySnapshot,
  limit: number,
  currentDocument?: EditorDocumentState
): PersistedHistorySnapshot | null {
  // Normalization keeps the current document anchored to a single valid index.
  // If the stored index is stale but the current document still appears uniquely in the
  // snapshot stack, recover to that index. Otherwise reject the history entirely.
  const historyStack = snapshot.historyStack.map(cloneDocumentState);
  const resolvedIndex =
    snapshot.historyIndex >= 0 &&
    snapshot.historyIndex < historyStack.length &&
    (!currentDocument || areDocumentsEqual(historyStack[snapshot.historyIndex], currentDocument))
      ? snapshot.historyIndex
      : currentDocument
        ? findDocumentIndex(historyStack, currentDocument)
        : null;

  if (!Number.isInteger(snapshot.historyIndex) || historyStack.length === 0 || limit < 1 || resolvedIndex === null) {
    return null;
  }

  if (historyStack.length <= limit) {
    return {
      historyStack,
      historyIndex: resolvedIndex,
    };
  }

  const overflow = historyStack.length - limit;
  const dropFromStart = Math.min(overflow, resolvedIndex);
  const dropFromEnd = overflow - dropFromStart;

  return {
    historyStack: historyStack.slice(dropFromStart, historyStack.length - dropFromEnd),
    historyIndex: resolvedIndex - dropFromStart,
  };
}

export function buildPersistedHistorySnapshot(
  document: EditorDocumentState,
  history: HydratedCommandHistory,
  limit: number
): PersistedHistorySnapshot {
  const rootDocument = history.past
    .slice()
    .reverse()
    .reduce<EditorDocumentState>(
      (currentDocument, command) => applyEditorCommand(currentDocument, command, "undo"),
      cloneDocumentState(document)
    );
  const commands = [...history.past, ...history.future];
  const historyStack = [rootDocument];
  let cursor = rootDocument;

  for (const command of commands) {
    cursor = applyEditorCommand(cursor, command, "redo");
    historyStack.push(cursor);
  }

  return normalizePersistedHistorySnapshot(
    {
      historyStack,
      historyIndex: history.past.length,
    },
    limit,
    document
  )!;
}

export function hydrateCommandHistoryFromSnapshots(
  snapshot: PersistedHistorySnapshot,
  currentDocument: EditorDocumentState,
  limit: number
): HydratedCommandHistory | null {
  // Hydration is intentionally strict: if snapshots cannot be normalized or reconstructed
  // into a single linear history, callers should keep the current layout and drop history.
  const normalizedSnapshot = normalizePersistedHistorySnapshot(snapshot, limit, currentDocument);
  if (!normalizedSnapshot) return null;

  const commands: EditorCommand[] = [];
  for (let i = 0; i < normalizedSnapshot.historyStack.length - 1; i += 1) {
    const command = inferEditorCommand(
      normalizedSnapshot.historyStack[i],
      normalizedSnapshot.historyStack[i + 1]
    );
    if (!command) return null;
    commands.push(command);
  }

  return {
    past: commands.slice(0, normalizedSnapshot.historyIndex),
    future: commands.slice(normalizedSnapshot.historyIndex),
  };
}

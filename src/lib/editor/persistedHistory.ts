import { applyEditorCommand, type EditorCommand, type EditorDocumentState } from "@/lib/editor/history";
import {
  areRoomInteriorAssetsEqual,
  cloneRoomInteriorAsset,
  cloneRoomInteriorAssets,
} from "@/lib/editor/interiorAssets";
import { areRoomOpeningsEqual, cloneRoomOpening, cloneRoomOpenings } from "@/lib/editor/openings";
import { normalizeProjectExportConfig } from "@/lib/projects/exportConfig";
import type { Room, RoomInteriorAsset, RoomOpening } from "@/lib/editor/types";

export type PersistedHistorySnapshot = {
  historyStack: EditorDocumentState[];
  historyIndex: number;
};

export type HydratedCommandHistory = {
  past: EditorCommand[];
  future: EditorCommand[];
};

export function areDocumentsEqual(a: EditorDocumentState, b: EditorDocumentState): boolean {
  const exportConfigA = normalizeProjectExportConfig(a.exportConfig);
  const exportConfigB = normalizeProjectExportConfig(b.exportConfig);

  if (
    exportConfigA.title !== exportConfigB.title ||
    exportConfigA.description !== exportConfigB.description ||
    exportConfigA.titlePosition !== exportConfigB.titlePosition ||
    exportConfigA.descriptionPosition !== exportConfigB.descriptionPosition
  ) {
    return false;
  }

  if (a.rooms.length !== b.rooms.length) return false;

  for (let i = 0; i < a.rooms.length; i += 1) {
    const roomA = a.rooms[i];
    const roomB = b.rooms[i];
    if (roomA.id !== roomB.id || roomA.name !== roomB.name) return false;
    if (!arePointListsEqual(roomA.points, roomB.points)) return false;
    if (!areRoomOpeningsEqual(roomA.openings ?? [], roomB.openings ?? [])) return false;
    if (!areRoomInteriorAssetsEqual(roomA.interiorAssets ?? [], roomB.interiorAssets ?? [])) return false;
  }

  return true;
}

export function cloneDocumentState(document: EditorDocumentState): EditorDocumentState {
  const exportConfig = normalizeProjectExportConfig(document.exportConfig);

  return {
    exportConfig: {
      title: exportConfig.title,
      description: exportConfig.description,
      titlePosition: exportConfig.titlePosition,
      descriptionPosition: exportConfig.descriptionPosition,
    },
    rooms: document.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      points: room.points.map((point) => ({ ...point })),
      openings: cloneRoomOpenings(room.openings ?? []),
      interiorAssets: cloneRoomInteriorAssets(room.interiorAssets ?? []),
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
    const didOpeningsChange = !areRoomOpeningsEqual(previousRoom.openings ?? [], room.openings ?? []);
    const didInteriorAssetsChange = !areRoomInteriorAssetsEqual(
      previousRoom.interiorAssets ?? [],
      room.interiorAssets ?? []
    );
    if (!didNameChange && !didPointsChange && !didOpeningsChange && !didInteriorAssetsChange) continue;

    changedRooms.push({
      previous: previousRoom,
      next: room,
    });
  }

  if (
    removedRooms.length === 1 &&
    addedRooms.length === 0 &&
    changedRooms.length === 0 &&
    previous.rooms.length - 1 === next.rooms.length
  ) {
    const deletedRoom = removedRooms[0];
    const previousIndex = previous.rooms.findIndex((room) => room.id === deletedRoom.id);
    if (previousIndex < 0) return null;

    return {
      type: "delete-room",
      room: {
        id: deletedRoom.id,
        name: deletedRoom.name,
        points: deletedRoom.points.map((point) => ({ ...point })),
        openings: cloneRoomOpenings(deletedRoom.openings ?? []),
        interiorAssets: cloneRoomInteriorAssets(deletedRoom.interiorAssets ?? []),
      },
      previousIndex,
    };
  }

  if (removedRooms.length > 0) return null;

  if (addedRooms.length === 1 && changedRooms.length === 0 && previous.rooms.length + 1 === next.rooms.length) {
    return {
      type: "complete-room",
      room: {
        id: addedRooms[0].id,
        name: addedRooms[0].name,
        points: addedRooms[0].points.map((point) => ({ ...point })),
        openings: cloneRoomOpenings(addedRooms[0].openings ?? []),
        interiorAssets: cloneRoomInteriorAssets(addedRooms[0].interiorAssets ?? []),
      },
    };
  }

  if (addedRooms.length > 0 || changedRooms.length !== 1) return null;

  const changedRoom = changedRooms[0];
  const didNameChange = changedRoom.previous.name !== changedRoom.next.name;
  const didPointsChange = !arePointListsEqual(changedRoom.previous.points, changedRoom.next.points);
  const didOpeningsChange = !areRoomOpeningsEqual(
    changedRoom.previous.openings ?? [],
    changedRoom.next.openings ?? []
  );
  const didInteriorAssetsChange = !areRoomInteriorAssetsEqual(
    changedRoom.previous.interiorAssets ?? [],
    changedRoom.next.interiorAssets ?? []
  );

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

  if (!didNameChange && !didPointsChange && didOpeningsChange) {
    const addedOpening = inferAddedOpening(
      changedRoom.previous.openings ?? [],
      changedRoom.next.openings ?? []
    );
    if (addedOpening) {
      return {
        type: "add-opening",
        roomId: changedRoom.next.id,
        opening: addedOpening,
      };
    }

    const deletedOpening = inferDeletedOpening(
      changedRoom.previous.openings ?? [],
      changedRoom.next.openings ?? []
    );
    if (deletedOpening) {
      return {
        type: "delete-opening",
        roomId: changedRoom.next.id,
        opening: deletedOpening,
      };
    }

    const movedOpening = inferMovedOpening(
      changedRoom.previous.openings ?? [],
      changedRoom.next.openings ?? []
    );
    if (movedOpening) {
      return {
        type: "move-opening",
        roomId: changedRoom.next.id,
        openingId: movedOpening.openingId,
        previousOffsetMm: movedOpening.previousOffsetMm,
        nextOffsetMm: movedOpening.nextOffsetMm,
      };
    }

    const updatedOpening = inferUpdatedOpening(
      changedRoom.previous.openings ?? [],
      changedRoom.next.openings ?? []
    );
    if (!updatedOpening) return null;

    return {
      type: "update-opening",
      roomId: changedRoom.next.id,
      previousOpening: updatedOpening.previousOpening,
      nextOpening: updatedOpening.nextOpening,
    };
  }

  if (!didNameChange && !didPointsChange && !didOpeningsChange && didInteriorAssetsChange) {
    const addedAsset = inferAddedInteriorAsset(
      changedRoom.previous.interiorAssets ?? [],
      changedRoom.next.interiorAssets ?? []
    );
    if (addedAsset) {
      return {
        type: "add-interior-asset",
        roomId: changedRoom.next.id,
        asset: addedAsset,
      };
    }

    const deletedAsset = inferDeletedInteriorAsset(
      changedRoom.previous.interiorAssets ?? [],
      changedRoom.next.interiorAssets ?? []
    );
    if (deletedAsset) {
      return {
        type: "delete-interior-asset",
        roomId: changedRoom.next.id,
        asset: deletedAsset,
      };
    }

    const movedAsset = inferMovedInteriorAsset(
      changedRoom.previous.interiorAssets ?? [],
      changedRoom.next.interiorAssets ?? []
    );
    if (!movedAsset) return null;

    return {
      type: "move-interior-asset",
      roomId: changedRoom.next.id,
      assetId: movedAsset.assetId,
      previousXmm: movedAsset.previousXmm,
      previousYmm: movedAsset.previousYmm,
      nextXmm: movedAsset.nextXmm,
      nextYmm: movedAsset.nextYmm,
    };
  }

  return null;
}

function inferAddedOpening(
  previousOpenings: RoomOpening[],
  nextOpenings: RoomOpening[]
): RoomOpening | null {
  if (nextOpenings.length !== previousOpenings.length + 1) return null;

  const previousById = new Map(previousOpenings.map((opening) => [opening.id, opening]));
  const addedOpenings = nextOpenings.filter((opening) => !previousById.has(opening.id));
  if (addedOpenings.length !== 1) return null;

  for (const opening of previousOpenings) {
    const candidate = nextOpenings.find((nextOpening) => nextOpening.id === opening.id);
    if (!candidate) return null;
  }

  return {
    ...addedOpenings[0],
  };
}

function inferDeletedOpening(
  previousOpenings: RoomOpening[],
  nextOpenings: RoomOpening[]
): RoomOpening | null {
  if (previousOpenings.length !== nextOpenings.length + 1) return null;

  const nextById = new Map(nextOpenings.map((opening) => [opening.id, opening]));
  const deletedOpenings = previousOpenings.filter((opening) => !nextById.has(opening.id));
  if (deletedOpenings.length !== 1) return null;

  for (const opening of nextOpenings) {
    const candidate = previousOpenings.find((previousOpening) => previousOpening.id === opening.id);
    if (!candidate) return null;
  }

  return {
    ...deletedOpenings[0],
  };
}

function inferMovedOpening(
  previousOpenings: RoomOpening[],
  nextOpenings: RoomOpening[]
): { openingId: string; previousOffsetMm: number; nextOffsetMm: number } | null {
  if (previousOpenings.length !== nextOpenings.length) return null;

  const nextById = new Map(nextOpenings.map((opening) => [opening.id, opening]));
  let movedOpening: { openingId: string; previousOffsetMm: number; nextOffsetMm: number } | null = null;

  for (const previousOpening of previousOpenings) {
    const nextOpening = nextById.get(previousOpening.id);
    if (!nextOpening) return null;

    const didNonOffsetFieldsChange =
      previousOpening.type !== nextOpening.type ||
      previousOpening.wall !== nextOpening.wall ||
      previousOpening.widthMm !== nextOpening.widthMm ||
      previousOpening.openingSide !== nextOpening.openingSide ||
      previousOpening.hingeSide !== nextOpening.hingeSide;
    if (didNonOffsetFieldsChange) return null;

    if (previousOpening.offsetMm === nextOpening.offsetMm) continue;
    if (movedOpening) return null;

    movedOpening = {
      openingId: previousOpening.id,
      previousOffsetMm: previousOpening.offsetMm,
      nextOffsetMm: nextOpening.offsetMm,
    };
  }

  return movedOpening;
}

function inferAddedInteriorAsset(
  previousAssets: RoomInteriorAsset[],
  nextAssets: RoomInteriorAsset[]
): RoomInteriorAsset | null {
  if (nextAssets.length !== previousAssets.length + 1) return null;

  const previousById = new Map(previousAssets.map((asset) => [asset.id, asset]));
  const addedAssets = nextAssets.filter((asset) => !previousById.has(asset.id));
  if (addedAssets.length !== 1) return null;

  return cloneRoomInteriorAsset(addedAssets[0]);
}

function inferDeletedInteriorAsset(
  previousAssets: RoomInteriorAsset[],
  nextAssets: RoomInteriorAsset[]
): RoomInteriorAsset | null {
  if (previousAssets.length !== nextAssets.length + 1) return null;

  const nextById = new Map(nextAssets.map((asset) => [asset.id, asset]));
  const deletedAssets = previousAssets.filter((asset) => !nextById.has(asset.id));
  if (deletedAssets.length !== 1) return null;

  return cloneRoomInteriorAsset(deletedAssets[0]);
}

function inferMovedInteriorAsset(
  previousAssets: RoomInteriorAsset[],
  nextAssets: RoomInteriorAsset[]
):
  | {
      assetId: string;
      previousXmm: number;
      previousYmm: number;
      nextXmm: number;
      nextYmm: number;
    }
  | null {
  if (previousAssets.length !== nextAssets.length) return null;

  const nextById = new Map(nextAssets.map((asset) => [asset.id, asset]));
  let movedAsset:
    | {
        assetId: string;
        previousXmm: number;
        previousYmm: number;
        nextXmm: number;
        nextYmm: number;
      }
    | null = null;

  for (const previousAsset of previousAssets) {
    const nextAsset = nextById.get(previousAsset.id);
    if (!nextAsset) return null;

    const didMove = previousAsset.xMm !== nextAsset.xMm || previousAsset.yMm !== nextAsset.yMm;
    const didOtherFieldsChange =
      previousAsset.type !== nextAsset.type ||
      previousAsset.widthMm !== nextAsset.widthMm ||
      previousAsset.depthMm !== nextAsset.depthMm;
    if (didOtherFieldsChange) return null;
    if (!didMove) continue;
    if (movedAsset) return null;

    movedAsset = {
      assetId: previousAsset.id,
      previousXmm: previousAsset.xMm,
      previousYmm: previousAsset.yMm,
      nextXmm: nextAsset.xMm,
      nextYmm: nextAsset.yMm,
    };
  }

  return movedAsset;
}

function inferUpdatedOpening(
  previousOpenings: RoomOpening[],
  nextOpenings: RoomOpening[]
): { previousOpening: RoomOpening; nextOpening: RoomOpening } | null {
  if (previousOpenings.length !== nextOpenings.length) return null;

  const nextById = new Map(nextOpenings.map((opening) => [opening.id, opening]));
  let updatedOpening: { previousOpening: RoomOpening; nextOpening: RoomOpening } | null = null;

  for (const previousOpening of previousOpenings) {
    const nextOpening = nextById.get(previousOpening.id);
    if (!nextOpening) return null;
    if (areOpeningsEqual(previousOpening, nextOpening)) continue;
    if (updatedOpening) return null;

    updatedOpening = {
      previousOpening: cloneRoomOpening(previousOpening),
      nextOpening: cloneRoomOpening(nextOpening),
    };
  }

  return updatedOpening;
}

function areOpeningsEqual(a: RoomOpening, b: RoomOpening) {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.wall === b.wall &&
    a.offsetMm === b.offsetMm &&
    a.widthMm === b.widthMm &&
    a.openingSide === b.openingSide &&
    a.hingeSide === b.hingeSide
  );
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
): PersistedHistorySnapshot | null {
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
  );
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

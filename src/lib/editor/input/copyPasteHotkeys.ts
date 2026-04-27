import { matchEditorKeyboardShortcut, showKeyboardShortcutFeedback } from "@/lib/editor/keyboardMap";
import { isEditableTarget } from "@/lib/editor/input/editableTarget";
import type { SharedSelectionItem, Room, RoomInteriorAsset } from "@/lib/editor/types";

export type CopyPasteStore = {
  getState: () => {
    document: { rooms: Room[] };
    history: { past: unknown[] };
    selection: SharedSelectionItem[];
    clipboard: unknown;
    copySelection: () => void;
    cutSelection: () => void;
    pasteSelection: () => void;
    duplicateSelection: () => void;
    keyboardShortcutFeedbackEnabled: boolean;
  };
};

function getAssetTypeLabel(type: RoomInteriorAsset["type"]): string {
  switch (type) {
    case "stairs": return "stair";
    case "bed": return "bed";
    case "sofa": return "sofa";
    case "wardrobe": return "wardrobe";
    case "dining-table": return "dining table";
  }
}

function getDuplicateShortcutActionLabel(state: ReturnType<CopyPasteStore["getState"]>): string {
  const roomSelections = state.selection.filter(
    (item): item is Extract<SharedSelectionItem, { type: "room" }> => item.type === "room"
  );
  const assetSelections = state.selection.filter(
    (item): item is Extract<SharedSelectionItem, { type: "stair" }> => item.type === "stair"
  );

  if (roomSelections.length === 1 && assetSelections.length === 0) {
    const room = state.document.rooms.find((candidate) => candidate.id === roomSelections[0].id);
    return room ? `${room.name} duplicated` : "Room duplicated";
  }

  if (roomSelections.length > 1 && assetSelections.length === 0) return "Rooms duplicated";

  if (assetSelections.length > 0 && roomSelections.length === 0) {
    // Get the actual asset type from the first selected asset
    const firstSelection = assetSelections[0];
    if (firstSelection) {
      const room = state.document.rooms.find((r) => r.id === firstSelection.roomId);
      const asset = room?.interiorAssets.find((a) => a.id === firstSelection.id);
      if (asset) {
        const typeLabel = getAssetTypeLabel(asset.type);
        if (assetSelections.length === 1) return `${typeLabel} duplicated`;
        // For multiple assets, use the type of the first one (or could say "assets duplicated")
        return `${typeLabel}s duplicated`;
      }
    }
  }

  if (roomSelections.length > 0 && assetSelections.length > 0) return "Rooms and assets duplicated";

  return "Selection duplicated";
}

export function attachCopyPasteHotkeys(store: CopyPasteStore) {
  const handleDuplicateShortcut = (event: KeyboardEvent): boolean => {
    const isPrimaryModifier = event.metaKey || event.ctrlKey;
    const eventKey = event.key.toLowerCase();
    const isDuplicateCombo =
      isPrimaryModifier &&
      (event.code === "KeyD" || eventKey === "d") &&
      !event.altKey &&
      !event.shiftKey;
    if (!isDuplicateCombo) return false;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    // Extra cancellation flags help with browser-reserved shortcuts in some engines.
    event.returnValue = false;
    event.cancelBubble = true;

    const state = store.getState();
    if (state.selection.length === 0) return true;

    const actionLabel = getDuplicateShortcutActionLabel(state);
    state.duplicateSelection();

    showKeyboardShortcutFeedback("duplicate-selection", {
      feedbackEnabled: state.keyboardShortcutFeedbackEnabled,
      context: { actionLabel },
    });

    return true;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;

    if (handleDuplicateShortcut(event)) return;

    if (event.defaultPrevented) return;

    const shortcut = matchEditorKeyboardShortcut(event, ["copy", "cut", "paste"]);
    if (!shortcut) return;

    const state = store.getState();

    if (shortcut.id === "copy") {
      if (state.selection.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      state.copySelection();

      showKeyboardShortcutFeedback(shortcut.id, {
        feedbackEnabled: state.keyboardShortcutFeedbackEnabled,
      });
      return;
    }

    if (shortcut.id === "cut") {
      if (state.selection.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      state.cutSelection();

      showKeyboardShortcutFeedback(shortcut.id, {
        feedbackEnabled: state.keyboardShortcutFeedbackEnabled,
      });
      return;
    }

    if (shortcut.id === "paste") {
      if (!state.clipboard) return;

      event.preventDefault();
      event.stopPropagation();

      const previousHistoryLength = state.history.past.length;
      state.pasteSelection();
      const didPasteSucceed = store.getState().history.past.length > previousHistoryLength;
      if (!didPasteSucceed) return;

      showKeyboardShortcutFeedback(shortcut.id, {
        feedbackEnabled: state.keyboardShortcutFeedbackEnabled,
      });
      return;
    }

  };

  const listenerOptions: AddEventListenerOptions = { capture: true };
  document.addEventListener("keydown", onKeyDown, listenerOptions);
  window.addEventListener("keydown", onKeyDown, listenerOptions);

  return () => {
    document.removeEventListener("keydown", onKeyDown, listenerOptions);
    window.removeEventListener("keydown", onKeyDown, listenerOptions);
  };
}

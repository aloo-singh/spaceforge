import { matchEditorKeyboardShortcut, showKeyboardShortcutFeedback } from "@/lib/editor/keyboardMap";
import { isEditableTarget } from "@/lib/editor/input/editableTarget";
import type { SharedSelectionItem } from "@/lib/editor/types";

export type CopyPasteStore = {
  getState: () => {
    document: { rooms: Array<{ id: string; name: string }> };
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

function getDuplicateShortcutActionLabel(state: ReturnType<CopyPasteStore["getState"]>): string {
  const roomSelections = state.selection.filter(
    (item): item is Extract<SharedSelectionItem, { type: "room" }> => item.type === "room"
  );
  const stairSelections = state.selection.filter(
    (item): item is Extract<SharedSelectionItem, { type: "stair" }> => item.type === "stair"
  );

  if (roomSelections.length === 1 && stairSelections.length === 0) {
    const room = state.document.rooms.find((candidate) => candidate.id === roomSelections[0].id);
    return room ? `${room.name} duplicated` : "Room duplicated";
  }

  if (roomSelections.length > 1 && stairSelections.length === 0) return "Rooms duplicated";
  if (stairSelections.length === 1 && roomSelections.length === 0) return "Stair duplicated";
  if (stairSelections.length > 1 && roomSelections.length === 0) return "Stairs duplicated";
  if (roomSelections.length > 0 && stairSelections.length > 0) return "Rooms and stairs duplicated";

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

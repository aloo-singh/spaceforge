import { matchEditorKeyboardShortcut } from "@/lib/editor/keyboardMap";
import { isEditableTarget } from "@/lib/editor/input/editableTarget";
import type { SharedSelectionItem, Room } from "@/lib/editor/types";

export type CopyPasteStore = {
  getState: () => {
    document: { rooms: Room[] };
    history: { past: unknown[] };
    selection: SharedSelectionItem[];
    clipboard: unknown;
    copySelection: () => void;
    cutSelection: () => void;
    pasteSelection: () => void;
    duplicateSelection: (options?: { isMirror?: boolean }) => void;
    keyboardShortcutFeedbackEnabled: boolean;
  };
};

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

    state.duplicateSelection();
    // Sonner feedback is handled by duplicateSelection() directly with type-specific messages

    return true;
  };

  const handleMirrorDuplicateShortcut = (event: KeyboardEvent): boolean => {
    const isPrimaryModifier = event.metaKey || event.ctrlKey;
    const eventKey = event.key.toLowerCase();
    const isMirrorDuplicateCombo =
      isPrimaryModifier &&
      event.altKey &&
      (event.code === "KeyD" || eventKey === "d") &&
      !event.shiftKey;
    if (!isMirrorDuplicateCombo) return false;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    // Extra cancellation flags help with browser-reserved shortcuts in some engines.
    event.returnValue = false;
    event.cancelBubble = true;

    const state = store.getState();
    if (state.selection.length === 0) return true;

    state.duplicateSelection({ isMirror: true });
    // Sonner feedback is handled by duplicateSelection() directly with type-specific messages

    return true;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;

    if (handleMirrorDuplicateShortcut(event)) return;

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
      // Sonner feedback is handled by copySelection() directly with type-specific messages
      return;
    }

    if (shortcut.id === "cut") {
      if (state.selection.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      state.cutSelection();
      // Sonner feedback is handled by cutSelection() directly with type-specific messages
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

      // Sonner feedback is handled by pasteSelection() directly with type-specific messages
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

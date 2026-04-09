import { isEditableTarget } from "@/lib/editor/input/editableTarget";
import {
  getKeyboardShortcutFeedbackMessage,
  matchEditorKeyboardShortcut,
  showKeyboardShortcutFeedbackToast,
} from "@/lib/editor/keyboardMap";

type HistoryStoreState = {
  canUndo: boolean;
  canRedo: boolean;
  keyboardShortcutFeedbackEnabled: boolean;
  undo: () => void;
  redo: () => void;
};

type HistoryStore = {
  getState: () => HistoryStoreState;
};

export function attachHistoryHotkeys(store: HistoryStore) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;
    if (event.defaultPrevented) return;

    const shortcut = matchEditorKeyboardShortcut(event, ["undo", "redo"]);
    if (!shortcut) return;

    const state = store.getState();
    if (shortcut.id === "undo") {
      if (!state.canUndo) return;
    } else if (!state.canRedo) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (shortcut.id === "undo") {
      state.undo();
    } else {
      state.redo();
    }
    if (state.keyboardShortcutFeedbackEnabled) {
      const message = getKeyboardShortcutFeedbackMessage(shortcut.id);
      if (message) {
        showKeyboardShortcutFeedbackToast(message);
      }
    }
  };

  // Capture-phase interception keeps browser/app chrome shortcuts from winning
  // before the editor can claim its own global undo/redo bindings.
  const listenerOptions: AddEventListenerOptions = { capture: true };
  window.addEventListener("keydown", onKeyDown, listenerOptions);

  return () => {
    window.removeEventListener("keydown", onKeyDown, listenerOptions);
  };
}

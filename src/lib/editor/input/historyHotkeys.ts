import { isEditableTarget } from "@/lib/editor/input/editableTarget";
import {
  getHistoryCommandActionLabel,
  matchEditorKeyboardShortcut,
  showKeyboardShortcutFeedback,
} from "@/lib/editor/keyboardMap";
import type { EditorCommand } from "@/lib/editor/history";

type HistoryStoreState = {
  canUndo: boolean;
  canRedo: boolean;
  keyboardShortcutFeedbackEnabled: boolean;
  history: {
    past: EditorCommand[];
    future: EditorCommand[];
  };
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
    const command =
      shortcut.id === "undo"
        ? state.history.past[state.history.past.length - 1]
        : state.history.future[0];
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
    showKeyboardShortcutFeedback(shortcut.id, {
      feedbackEnabled: state.keyboardShortcutFeedbackEnabled,
      context: {
        actionLabel: getHistoryCommandActionLabel(command),
      },
    });
  };

  // Capture-phase interception keeps browser/app chrome shortcuts from winning
  // before the editor can claim its own global undo/redo bindings.
  const listenerOptions: AddEventListenerOptions = { capture: true };
  window.addEventListener("keydown", onKeyDown, listenerOptions);

  return () => {
    window.removeEventListener("keydown", onKeyDown, listenerOptions);
  };
}

import { matchEditorKeyboardShortcut, showKeyboardShortcutFeedback } from "@/lib/editor/keyboardMap";
import { isEditableTarget } from "@/lib/editor/input/editableTarget";
import type { SharedSelectionItem } from "@/lib/editor/types";

export type CopyPasteStore = {
  getState: () => {
    selection: SharedSelectionItem[];
    clipboard: unknown;
    copySelection: () => void;
    pasteSelection: () => void;
    keyboardShortcutFeedbackEnabled: boolean;
  };
};

export function attachCopyPasteHotkeys(store: CopyPasteStore) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;
    if (event.defaultPrevented) return;

    const shortcut = matchEditorKeyboardShortcut(event, ["copy", "paste"]);
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

    if (shortcut.id === "paste") {
      if (!state.clipboard) return;

      event.preventDefault();
      event.stopPropagation();

      state.pasteSelection();

      showKeyboardShortcutFeedback(shortcut.id, {
        feedbackEnabled: state.keyboardShortcutFeedbackEnabled,
      });
      return;
    }
  };

  const listenerOptions: AddEventListenerOptions = { capture: true };
  window.addEventListener("keydown", onKeyDown, listenerOptions);

  return () => {
    window.removeEventListener("keydown", onKeyDown, listenerOptions);
  };
}

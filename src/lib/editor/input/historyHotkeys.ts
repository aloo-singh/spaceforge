import { isEditableTarget } from "@/lib/editor/input/editableTarget";

type HistoryStoreState = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

type HistoryStore = {
  getState: () => HistoryStoreState;
};

export function attachHistoryHotkeys(store: HistoryStore) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;
    if (event.altKey) return;

    const key = event.key.toLowerCase();
    const isPrimaryModifier = event.metaKey || event.ctrlKey;
    if (!isPrimaryModifier) return;

    const isUndoShortcut = key === "z" && !event.shiftKey;
    const isRedoShortcut =
      (event.metaKey && key === "z" && event.shiftKey) ||
      (event.ctrlKey && key === "z" && event.shiftKey) ||
      (event.ctrlKey && key === "y" && !event.metaKey);

    if (!isUndoShortcut && !isRedoShortcut) return;

    const state = store.getState();
    if (isUndoShortcut) {
      if (!state.canUndo) return;
      event.stopImmediatePropagation();
      event.stopPropagation();
      event.preventDefault();
      state.undo();
      return;
    }

    if (!state.canRedo) return;
    event.stopImmediatePropagation();
    event.stopPropagation();
    event.preventDefault();
    state.redo();
  };

  // Capture-phase interception keeps browser/app chrome shortcuts from winning
  // before the editor can claim its own global undo/redo bindings.
  const listenerOptions: AddEventListenerOptions = {
    capture: true,
  };
  document.addEventListener("keydown", onKeyDown, listenerOptions);
  window.addEventListener("keydown", onKeyDown, listenerOptions);

  return () => {
    document.removeEventListener("keydown", onKeyDown, listenerOptions);
    window.removeEventListener("keydown", onKeyDown, listenerOptions);
  };
}

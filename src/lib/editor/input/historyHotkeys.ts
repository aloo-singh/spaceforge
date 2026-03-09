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
    if (isTypingTarget(event.target)) return;
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
      event.preventDefault();
      state.undo();
      return;
    }

    if (!state.canRedo) return;
    event.preventDefault();
    state.redo();
  };

  window.addEventListener("keydown", onKeyDown);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

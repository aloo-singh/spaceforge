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
  const isHistoryShortcutEvent = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const code = event.code;
    const isPrimaryModifier = event.metaKey || event.ctrlKey;
    if (!isPrimaryModifier || event.altKey) {
      return null;
    }

    const isZKey = key === "z" || code === "KeyZ";
    const isYKey = key === "y" || code === "KeyY";
    if (isZKey && !event.shiftKey) return "undo" as const;
    if (isZKey && event.shiftKey) return "redo" as const;
    if (event.ctrlKey && isYKey && !event.metaKey) return "redo" as const;

    return null;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;
    if (event.defaultPrevented) return;

    const shortcut = isHistoryShortcutEvent(event);
    if (!shortcut) return;

    const state = store.getState();
    if (shortcut === "undo") {
      if (!state.canUndo) return;
    } else if (!state.canRedo) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    state[shortcut]();
  };

  // Capture-phase interception keeps browser/app chrome shortcuts from winning
  // before the editor can claim its own global undo/redo bindings.
  const listenerOptions: AddEventListenerOptions = { capture: true };
  window.addEventListener("keydown", onKeyDown, listenerOptions);

  return () => {
    window.removeEventListener("keydown", onKeyDown, listenerOptions);
  };
}

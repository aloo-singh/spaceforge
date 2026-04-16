import { isEditableTarget } from "@/lib/editor/input/editableTarget";
import {
  matchEditorKeyboardShortcut,
  showKeyboardShortcutFeedback,
} from "@/lib/editor/keyboardMap";
import type { SharedSelectionItem } from "@/lib/editor/types";

type DeleteRoomStoreState = {
  selectedRoomId: string | null;
  selectedOpening: { roomId: string; openingId: string } | null;
  selectedInteriorAsset: { roomId: string; assetId: string } | null;
  selection: SharedSelectionItem[];
  keyboardShortcutFeedbackEnabled: boolean;
  deleteSelectedOpening: () => void;
  deleteSelectedInteriorAsset: () => void;
  deleteSelectedRoom: () => void;
  bulkDeleteSelection: () => void;
};

type DeleteRoomStore = {
  getState: () => DeleteRoomStoreState;
};

export function attachDeleteRoomHotkeys(store: DeleteRoomStore) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;
    const shortcut = matchEditorKeyboardShortcut(event, ["delete-selection"]);
    if (!shortcut) return;

    const state = store.getState();
    
    // Check if multiple items are selected
    if (state.selection?.length > 1) {
      state.bulkDeleteSelection();
      showKeyboardShortcutFeedback(shortcut.id, {
        feedbackEnabled: state.keyboardShortcutFeedbackEnabled,
      });
      event.stopImmediatePropagation();
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    
    if (!state.selectedOpening && !state.selectedInteriorAsset && !state.selectedRoomId) return;

    event.stopImmediatePropagation();
    event.stopPropagation();
    event.preventDefault();
    if (state.selectedOpening) {
      state.deleteSelectedOpening();
    } else if (state.selectedInteriorAsset) {
      state.deleteSelectedInteriorAsset();
    } else {
      state.deleteSelectedRoom();
    }

    showKeyboardShortcutFeedback(shortcut.id, {
      feedbackEnabled: state.keyboardShortcutFeedbackEnabled,
    });
  };

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

import { isEditableTarget } from "@/lib/editor/input/editableTarget";

type DeleteRoomStoreState = {
  selectedRoomId: string | null;
  deleteSelectedRoom: () => void;
};

type DeleteRoomStore = {
  getState: () => DeleteRoomStoreState;
};

export function attachDeleteRoomHotkeys(store: DeleteRoomStore) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "Delete" && event.key !== "Backspace") return;

    const state = store.getState();
    if (!state.selectedRoomId) return;

    event.stopImmediatePropagation();
    event.stopPropagation();
    event.preventDefault();
    state.deleteSelectedRoom();
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

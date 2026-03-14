import { isEditableTarget } from "@/lib/editor/input/editableTarget";

const ROOM_DELETE_SHORTCUT_KEYS = ["Delete", "Backspace"] as const;

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
    if (!isRoomDeleteShortcutKey(event.key)) return;

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

function isRoomDeleteShortcutKey(key: string): key is (typeof ROOM_DELETE_SHORTCUT_KEYS)[number] {
  return ROOM_DELETE_SHORTCUT_KEYS.includes(key as (typeof ROOM_DELETE_SHORTCUT_KEYS)[number]);
}

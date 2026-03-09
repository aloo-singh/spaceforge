"use client";

import { Keycap } from "@/components/ui/keycap";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/stores/editorStore";

export function SelectedRoomNamePanel() {
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const rooms = useEditorStore((state) => state.document.rooms);
  const startRoomRenameSession = useEditorStore((state) => state.startRoomRenameSession);
  const updateRoomRenameDraft = useEditorStore((state) => state.updateRoomRenameDraft);
  const commitRoomRenameSession = useEditorStore((state) => state.commitRoomRenameSession);
  const cancelRoomRenameSession = useEditorStore((state) => state.cancelRoomRenameSession);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  if (!selectedRoom) return null;

  return (
    <aside className="pointer-events-auto absolute right-4 bottom-4 left-4 z-20 rounded-lg border border-border/70 bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur-sm sm:right-auto sm:w-72">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Selected room</p>
      <label htmlFor="room-name-input" className="mt-2 mb-1 block text-sm font-medium">
        Name
      </label>
      <Input
        id="room-name-input"
        value={selectedRoom.name}
        onFocus={() => startRoomRenameSession(selectedRoom.id)}
        onChange={(event) => updateRoomRenameDraft(selectedRoom.id, event.target.value)}
        onBlur={() => commitRoomRenameSession({ deselectIfUnchanged: false })}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;

          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            commitRoomRenameSession();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelRoomRenameSession();
          }
        }}
        placeholder="Untitled room"
        autoComplete="off"
        aria-describedby="room-name-input-hint"
      />
      <p
        id="room-name-input-hint"
        className="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground/80"
      >
        <Keycap aria-hidden="true" className="h-4 min-w-0 rounded-sm border-border/70 bg-transparent px-1 text-[9px] shadow-none">
          Enter
        </Keycap>
        <span>save</span>
        <span aria-hidden="true">·</span>
        <Keycap aria-hidden="true" className="h-4 min-w-0 rounded-sm border-border/70 bg-transparent px-1 text-[9px] shadow-none">
          Esc
        </Keycap>
        <span>cancel</span>
      </p>
    </aside>
  );
}

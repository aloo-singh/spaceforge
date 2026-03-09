"use client";

import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/stores/editorStore";

export function SelectedRoomNamePanel() {
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const rooms = useEditorStore((state) => state.document.rooms);
  const updateRoomName = useEditorStore((state) => state.updateRoomName);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;

  if (!selectedRoom) return null;

  return (
    <aside className="pointer-events-auto absolute right-4 bottom-4 z-20 w-72 rounded-lg border border-border/70 bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Selected room</p>
      <label htmlFor="room-name-input" className="mt-2 mb-1 block text-sm font-medium">
        Name
      </label>
      <Input
        id="room-name-input"
        value={selectedRoom.name}
        onChange={(event) => updateRoomName(selectedRoom.id, event.target.value)}
        placeholder="Untitled room"
        autoComplete="off"
      />
    </aside>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Keycap } from "@/components/ui/keycap";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";

type SelectedRoomNamePanelProps = {
  className?: string;
};

export function SelectedRoomNamePanel({ className }: SelectedRoomNamePanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const shouldFocusSelectedRoomNameInput = useEditorStore(
    (state) => state.shouldFocusSelectedRoomNameInput
  );
  const rooms = useEditorStore((state) => state.document.rooms);
  const startRoomRenameSession = useEditorStore((state) => state.startRoomRenameSession);
  const updateRoomRenameDraft = useEditorStore((state) => state.updateRoomRenameDraft);
  const commitRoomRenameSession = useEditorStore((state) => state.commitRoomRenameSession);
  const cancelRoomRenameSession = useEditorStore((state) => state.cancelRoomRenameSession);
  const deleteSelectedRoom = useEditorStore((state) => state.deleteSelectedRoom);
  const consumeSelectedRoomNameInputFocusRequest = useEditorStore(
    (state) => state.consumeSelectedRoomNameInputFocusRequest
  );
  const focusFrameRef = useRef<number | null>(null);
  const focusTimeoutRef = useRef<number | null>(null);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const canDeleteSelectedRoom = selectedRoom !== null;

  useEffect(() => {
    if (!shouldFocusSelectedRoomNameInput || !selectedRoom) return;

    let attempts = 0;
    let isCancelled = false;

    const tryFocusInput = () => {
      if (isCancelled) return;
      const inputElement = document.getElementById("room-name-input");
      if (inputElement instanceof HTMLInputElement) {
        inputElement.focus({ preventScroll: true });
        inputElement.select();
        consumeSelectedRoomNameInputFocusRequest();
        if (focusTimeoutRef.current !== null) {
          window.clearTimeout(focusTimeoutRef.current);
          focusTimeoutRef.current = null;
        }
        focusFrameRef.current = null;
        return;
      }

      if (attempts >= 3) {
        consumeSelectedRoomNameInputFocusRequest();
        if (focusTimeoutRef.current !== null) {
          window.clearTimeout(focusTimeoutRef.current);
          focusTimeoutRef.current = null;
        }
        focusFrameRef.current = null;
        return;
      }

      attempts += 1;
      focusFrameRef.current = requestAnimationFrame(tryFocusInput);
    };

    const runFocusAfterPointerCycle = () => {
      focusFrameRef.current = requestAnimationFrame(() => {
        focusFrameRef.current = requestAnimationFrame(tryFocusInput);
      });
    };

    const onPointerUp = () => {
      runFocusAfterPointerCycle();
    };

    window.addEventListener("pointerup", onPointerUp, { capture: true, once: true });
    focusTimeoutRef.current = window.setTimeout(runFocusAfterPointerCycle, 0);

    return () => {
      isCancelled = true;
      window.removeEventListener("pointerup", onPointerUp, { capture: true });
      if (focusTimeoutRef.current !== null) {
        window.clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
      if (focusFrameRef.current !== null) {
        cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
    };
  }, [consumeSelectedRoomNameInputFocusRequest, selectedRoom, shouldFocusSelectedRoomNameInput]);

  useEffect(() => {
    const panelElement = panelRef.current;

    return () => {
      if (!panelElement) return;
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) return;
      if (!panelElement.contains(activeElement)) return;
      activeElement.blur();
    };
  }, []);

  if (!selectedRoom) return null;

  return (
    <aside
      ref={panelRef}
      className={cn(
        "pointer-events-auto rounded-xl border border-border/70 bg-card/95 p-3 text-card-foreground shadow-sm backdrop-blur-sm",
        className
      )}
    >
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
      <div className="mt-3 rounded-md border border-destructive/25 bg-destructive/5 p-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Delete selected room</p>
            <p
              id="delete-room-hint"
              className="mt-1 text-[11px] leading-relaxed text-muted-foreground"
            >
              Removes this room from the layout. Undo restores it immediately.
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
            <Keycap aria-hidden="true" className="h-4 min-w-0 rounded-sm border-border/70 bg-transparent px-1 text-[9px] shadow-none">
              Del
            </Keycap>
            <span aria-hidden="true">/</span>
            <Keycap aria-hidden="true" className="h-4 min-w-0 rounded-sm border-border/70 bg-transparent px-1 text-[9px] shadow-none">
              ⌫
            </Keycap>
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={deleteSelectedRoom}
            disabled={!canDeleteSelectedRoom}
            className="gap-2"
            aria-label={`Delete ${selectedRoom.name}`}
            aria-describedby="delete-room-hint"
          >
            <Trash2 />
            Delete room
          </Button>
        </div>
      </div>
    </aside>
  );
}

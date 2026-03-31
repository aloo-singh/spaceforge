"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatMetricRoomAreaForRoom } from "@/lib/editor/measurements";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editorStore";

export function EditorSidebarRoomsList() {
  const rooms = useEditorStore((state) => state.document.rooms);
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const renameSession = useEditorStore((state) => state.renameSession);
  const isCanvasInteractionActive = useEditorStore((state) => state.isCanvasInteractionActive);
  const isDraftActive = useEditorStore((state) => state.roomDraft.points.length > 0);
  const selectRoomById = useEditorStore((state) => state.selectRoomById);
  const startRoomRenameSession = useEditorStore((state) => state.startRoomRenameSession);
  const updateRoomRenameDraft = useEditorStore((state) => state.updateRoomRenameDraft);
  const commitRoomRenameSession = useEditorStore((state) => state.commitRoomRenameSession);
  const cancelRoomRenameSession = useEditorStore((state) => state.cancelRoomRenameSession);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shouldAutoFocusRenameInputRef = useRef(false);
  const [sidebarRenameRoomId, setSidebarRenameRoomId] = useState<string | null>(null);
  const activeRenameRoomId = renameSession?.roomId ?? null;
  const isRenameBlocked = isCanvasInteractionActive || isDraftActive;

  useEffect(() => {
    if (!activeRenameRoomId || isRenameBlocked || !shouldAutoFocusRenameInputRef.current) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    shouldAutoFocusRenameInputRef.current = false;
  }, [activeRenameRoomId, isRenameBlocked]);

  if (rooms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300/80 bg-zinc-50/60 p-3 text-sm text-zinc-600 dark:border-border/70 dark:bg-transparent dark:text-muted-foreground">
        Rooms will appear here as you draw them.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
      {rooms.map((room) => {
        const isSelected = selectedRoomId === room.id;
        const isRenaming = activeRenameRoomId === room.id && sidebarRenameRoomId === room.id;
        const areaLabel = formatMetricRoomAreaForRoom(room);

        return (
          <div
            key={room.id}
            className={cn(
              "rounded-lg border transition-colors",
              isSelected
                ? "border-zinc-400/80 bg-zinc-200/95 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                : "border-transparent text-zinc-700 hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
            )}
          >
            {isRenaming ? (
              <div className="flex items-center gap-2 px-3 py-2">
                  <Input
                    ref={inputRef}
                    value={room.name}
                    onChange={(event) => updateRoomRenameDraft(room.id, event.target.value)}
                    onBlur={() => {
                      commitRoomRenameSession({ deselectIfUnchanged: false });
                      setSidebarRenameRoomId(null);
                      selectRoomById(room.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) return;

                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRoomRenameSession({ deselectIfUnchanged: false });
                        setSidebarRenameRoomId(null);
                        selectRoomById(room.id);
                        return;
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRoomRenameSession();
                        setSidebarRenameRoomId(null);
                        selectRoomById(room.id);
                      }
                    }}
                    aria-label={`Rename ${room.name}`}
                    className="h-5 min-w-0 flex-1 border-zinc-300/80 bg-white/90 py-0 leading-none dark:border-input dark:bg-background"
                    disabled={isRenameBlocked}
                  />
                  <span aria-hidden="true" className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">-</span>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{areaLabel}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => selectRoomById(room.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                  <span
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setSidebarRenameRoomId(room.id);
                      shouldAutoFocusRenameInputRef.current = true;
                      selectRoomById(room.id);
                      startRoomRenameSession(room.id);
                    }}
                    className="truncate text-sm font-medium text-inherit"
                  >
                    {room.name}
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">-</span>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{areaLabel}</span>
                </div>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

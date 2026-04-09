"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronRight } from "lucide-react";
import { EditorSidebarRenameInput } from "@/components/editor/EditorSidebarRenameInput";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMetricRoomAreaForRoom } from "@/lib/editor/measurements";
import type { Room, RoomInteriorAsset, RoomOpening, RoomWall } from "@/lib/editor/types";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editorStore";

const DEFAULT_WALLS: RoomWall[] = ["top", "right", "bottom", "left"];
const SIDEBAR_CHEVRON_BUTTON_CLASS =
  "flex size-6 shrink-0 items-center justify-center rounded-md text-inherit/70 transition-colors hover:bg-black/5 hover:text-inherit dark:hover:bg-white/5";

function getWallLabel(wall: RoomWall): string {
  switch (wall) {
    case "top":
      return "North wall";
    case "right":
      return "East wall";
    case "bottom":
      return "South wall";
    case "left":
      return "West wall";
    default:
      return `Wall ${wall + 1}`;
  }
}

function getOpeningLabel(opening: RoomOpening): string {
  return opening.type === "door" ? "Door" : "Window";
}

function getRoomWalls(room: Room): RoomWall[] {
  if (room.points.length === 4) return DEFAULT_WALLS;
  return room.points.map((_, index) => index);
}

function getInteriorAssetLabel(asset: RoomInteriorAsset): string {
  return asset.name || "Stairs";
}

function SidebarIconTooltip({
  content,
  children,
}: {
  content: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="right" align="center">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function EditorSidebarRoomsList() {
  const hasHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const rooms = useEditorStore((state) => state.document.rooms);
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const selectedWall = useEditorStore((state) => state.selectedWall);
  const selectedOpening = useEditorStore((state) => state.selectedOpening);
  const selectedInteriorAsset = useEditorStore((state) => state.selectedInteriorAsset);
  const renameSession = useEditorStore((state) => state.renameSession);
  const interiorAssetRenameSession = useEditorStore((state) => state.interiorAssetRenameSession);
  const isCanvasInteractionActive = useEditorStore((state) => state.isCanvasInteractionActive);
  const isDraftActive = useEditorStore((state) => state.roomDraft.points.length > 0);
  const selectRoomById = useEditorStore((state) => state.selectRoomById);
  const selectWallByRoomId = useEditorStore((state) => state.selectWallByRoomId);
  const selectOpeningById = useEditorStore((state) => state.selectOpeningById);
  const selectInteriorAssetById = useEditorStore((state) => state.selectInteriorAssetById);
  const startInteriorAssetRenameSession = useEditorStore(
    (state) => state.startInteriorAssetRenameSession
  );
  const updateInteriorAssetRenameDraft = useEditorStore(
    (state) => state.updateInteriorAssetRenameDraft
  );
  const commitInteriorAssetRenameSession = useEditorStore(
    (state) => state.commitInteriorAssetRenameSession
  );
  const cancelInteriorAssetRenameSession = useEditorStore(
    (state) => state.cancelInteriorAssetRenameSession
  );
  const startRoomRenameSession = useEditorStore((state) => state.startRoomRenameSession);
  const updateRoomRenameDraft = useEditorStore((state) => state.updateRoomRenameDraft);
  const commitRoomRenameSession = useEditorStore((state) => state.commitRoomRenameSession);
  const cancelRoomRenameSession = useEditorStore((state) => state.cancelRoomRenameSession);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const interiorAssetInputRef = useRef<HTMLInputElement | null>(null);
  const shouldAutoFocusRenameInputRef = useRef(false);
  const shouldAutoFocusInteriorAssetRenameInputRef = useRef(false);
  const [sidebarRenameRoomId, setSidebarRenameRoomId] = useState<string | null>(null);
  const [sidebarRenameInteriorAssetId, setSidebarRenameInteriorAssetId] = useState<string | null>(null);
  const [expandedRoomIds, setExpandedRoomIds] = useState<string[]>([]);
  const [expandedWallKeys, setExpandedWallKeys] = useState<string[]>([]);
  const [expandedAssetRoomIds, setExpandedAssetRoomIds] = useState<string[]>([]);
  const activeRenameRoomId = renameSession?.roomId ?? null;
  const isRenameBlocked = isCanvasInteractionActive || isDraftActive;

  useEffect(() => {
    if (!activeRenameRoomId || isRenameBlocked || !shouldAutoFocusRenameInputRef.current) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    shouldAutoFocusRenameInputRef.current = false;
  }, [activeRenameRoomId, isRenameBlocked]);

  useEffect(() => {
    if (
      !interiorAssetRenameSession ||
      isRenameBlocked ||
      !shouldAutoFocusInteriorAssetRenameInputRef.current
    ) {
      return;
    }
    interiorAssetInputRef.current?.focus();
    interiorAssetInputRef.current?.select();
    shouldAutoFocusInteriorAssetRenameInputRef.current = false;
  }, [interiorAssetRenameSession, isRenameBlocked]);

  if (!hasHydrated || rooms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300/80 bg-zinc-50/60 p-3 text-sm text-zinc-600 dark:border-border/70 dark:bg-transparent dark:text-muted-foreground">
        Rooms will appear here as you draw them.
      </div>
    );
  }

  return (
    <ImmediateTooltipProvider>
      <div className="flex flex-col gap-1">
      {rooms.map((room) => {
        const isSelected = selectedRoomId === room.id;
        const isRenaming = activeRenameRoomId === room.id && sidebarRenameRoomId === room.id;
        const areaLabel = formatMetricRoomAreaForRoom(room);
        const roomWalls = getRoomWalls(room);
        const isRoomExpanded = expandedRoomIds.includes(room.id);
        const hasInteriorAssets = room.interiorAssets.length > 0;
        const isAssetSectionExpanded = expandedAssetRoomIds.includes(room.id);

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
              <div className="flex min-h-10 items-center gap-2 px-3 py-2">
                  <EditorSidebarRenameInput
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
                    className="flex-1"
                    disabled={isRenameBlocked}
                  />
                  <span aria-hidden="true" className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">-</span>
                  <span className="shrink-0 text-xs leading-none text-zinc-500 dark:text-zinc-400">{areaLabel}</span>
              </div>
            ) : (
              <div
                className="flex min-h-10 items-center gap-2 px-3 py-2"
                onClick={() => selectRoomById(room.id)}
              >
                <SidebarIconTooltip
                  content={isRoomExpanded ? `Collapse ${room.name}` : `Expand ${room.name}`}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedRoomIds((current) =>
                        current.includes(room.id)
                          ? current.filter((roomId) => roomId !== room.id)
                          : [...current, room.id]
                      );
                    }}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
                    aria-label={isRoomExpanded ? `Collapse ${room.name}` : `Expand ${room.name}`}
                  >
                    <ChevronRight
                      className={cn("size-3.5 transition-transform", isRoomExpanded && "rotate-90")}
                    />
                  </button>
                </SidebarIconTooltip>
                <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setSidebarRenameRoomId(room.id);
                      shouldAutoFocusRenameInputRef.current = true;
                      selectRoomById(room.id);
                      startRoomRenameSession(room.id);
                    }}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-inherit"
                  >
                    {room.name}
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs leading-none text-zinc-500 dark:text-zinc-400">{areaLabel}</span>
                </div>
              </div>
            )}
            {isRoomExpanded ? (
              <div className="px-3 pb-2">
                <div className="mt-1 flex flex-col gap-1">
                  {roomWalls.map((wall) => {
                    const wallKey = `${room.id}:${wall}`;
                    const isWallExpanded = expandedWallKeys.includes(wallKey);
                    const wallOpenings = room.openings.filter((opening) => opening.wall === wall);
                    const isWallSelected =
                      selectedWall?.roomId === room.id && selectedWall.wall === wall;

                    return (
                      <div key={wallKey} className="flex flex-col gap-1">
                        <div
                          className={cn(
                            "ml-2 flex min-h-9 items-center gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors",
                            isWallSelected
                              ? "bg-zinc-300/80 text-zinc-950 dark:bg-zinc-700/80 dark:text-zinc-50"
                              : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                          )}
                          onClick={() => selectWallByRoomId(room.id, wall)}
                        >
                          {wallOpenings.length > 0 ? (
                            <SidebarIconTooltip
                              content={
                                isWallExpanded
                                  ? `Collapse ${getWallLabel(wall)}`
                                  : `Expand ${getWallLabel(wall)}`
                              }
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedWallKeys((current) =>
                                    current.includes(wallKey)
                                      ? current.filter((key) => key !== wallKey)
                                      : [...current, wallKey]
                                  );
                                }}
                                className={SIDEBAR_CHEVRON_BUTTON_CLASS}
                                aria-label={
                                  isWallExpanded
                                    ? `Collapse ${getWallLabel(wall)}`
                                    : `Expand ${getWallLabel(wall)}`
                                }
                              >
                                <ChevronRight
                                  className={cn("size-3.5 transition-transform", isWallExpanded && "rotate-90")}
                                />
                              </button>
                            </SidebarIconTooltip>
                          ) : (
                            <span className="size-6 shrink-0" aria-hidden="true" />
                          )}
                          <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                            <span className="truncate">{getWallLabel(wall)}</span>
                            {wallOpenings.length > 0 ? (
                              <span className="ml-auto text-[11px] text-inherit/70">
                                {wallOpenings.length}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {wallOpenings.length > 0 ? (
                          <div className="ml-8">
                            {isWallExpanded ? (
                              <div className="mt-1 flex flex-col gap-1">
                                {wallOpenings.map((opening) => {
                                  const isOpeningSelected =
                                    selectedOpening?.roomId === room.id &&
                                    selectedOpening.openingId === opening.id;

                                  return (
                                    <button
                                      key={opening.id}
                                      type="button"
                                      onClick={() => selectOpeningById(room.id, opening.id)}
                                      className={cn(
                                        "flex min-h-9 w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                        isOpeningSelected
                                          ? "bg-zinc-300/80 text-zinc-950 dark:bg-zinc-700/80 dark:text-zinc-50"
                                          : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                                      )}
                                    >
                                      {getOpeningLabel(opening)}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {hasInteriorAssets ? (
                    <div className="flex flex-col gap-1">
                      <div className="ml-2 flex min-h-9 items-center gap-2 rounded-md py-1.5 pr-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100">
                        <SidebarIconTooltip
                          content={
                            isAssetSectionExpanded
                              ? `Collapse interior assets for ${room.name}`
                              : `Expand interior assets for ${room.name}`
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAssetRoomIds((current) =>
                                current.includes(room.id)
                                  ? current.filter((roomId) => roomId !== room.id)
                                  : [...current, room.id]
                              )
                            }
                            className={SIDEBAR_CHEVRON_BUTTON_CLASS}
                            aria-label={
                              isAssetSectionExpanded
                                ? `Collapse interior assets for ${room.name}`
                                : `Expand interior assets for ${room.name}`
                            }
                          >
                            <ChevronRight
                              className={cn("size-3.5 transition-transform", isAssetSectionExpanded && "rotate-90")}
                            />
                          </button>
                        </SidebarIconTooltip>
                        <span className="flex-1 text-left">Interior Assets</span>
                        <span className="ml-auto text-[11px] text-inherit/70">
                          {room.interiorAssets.length}
                        </span>
                      </div>
                      {isAssetSectionExpanded ? (
                        <div className="ml-8 mt-1 flex flex-col gap-1">
                          {room.interiorAssets.map((asset) => {
                            const isAssetSelected =
                              selectedInteriorAsset?.roomId === room.id &&
                              selectedInteriorAsset.assetId === asset.id;
                            const isAssetRenaming =
                              interiorAssetRenameSession?.roomId === room.id &&
                              interiorAssetRenameSession.assetId === asset.id &&
                              sidebarRenameInteriorAssetId === asset.id;

                            return (
                              <div key={asset.id}>
                                {isAssetRenaming ? (
                                  <div className="rounded-md px-2 py-1.5">
                                    <EditorSidebarRenameInput
                                      ref={interiorAssetInputRef}
                                      value={asset.name}
                                      onChange={(event) =>
                                        updateInteriorAssetRenameDraft(
                                          room.id,
                                          asset.id,
                                          event.target.value
                                        )
                                      }
                                      onBlur={() => {
                                        commitInteriorAssetRenameSession();
                                        setSidebarRenameInteriorAssetId(null);
                                        selectInteriorAssetById(room.id, asset.id);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.nativeEvent.isComposing) return;

                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          commitInteriorAssetRenameSession();
                                          setSidebarRenameInteriorAssetId(null);
                                          selectInteriorAssetById(room.id, asset.id);
                                          return;
                                        }

                                        if (event.key === "Escape") {
                                          event.preventDefault();
                                          cancelInteriorAssetRenameSession();
                                          setSidebarRenameInteriorAssetId(null);
                                          selectInteriorAssetById(room.id, asset.id);
                                        }
                                      }}
                                      aria-label={`Rename ${asset.name}`}
                                      disabled={isRenameBlocked}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => selectInteriorAssetById(room.id, asset.id)}
                                    className={cn(
                                      "flex min-h-9 w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                      isAssetSelected
                                        ? "bg-zinc-300/80 text-zinc-950 dark:bg-zinc-700/80 dark:text-zinc-50"
                                        : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                                    )}
                                  >
                                    <span
                                      onDoubleClick={(event) => {
                                        event.stopPropagation();
                                        setSidebarRenameInteriorAssetId(asset.id);
                                        shouldAutoFocusInteriorAssetRenameInputRef.current = true;
                                        selectInteriorAssetById(room.id, asset.id);
                                        startInteriorAssetRenameSession(room.id, asset.id);
                                      }}
                                      className="block truncate"
                                    >
                                      {getInteriorAssetLabel(asset)}
                                    </span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      </div>
    </ImmediateTooltipProvider>
  );
}

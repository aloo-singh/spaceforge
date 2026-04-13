"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { EditorSidebarRenameInput } from "@/components/editor/EditorSidebarRenameInput";
import { ChevronRight, Plus, Trash2 } from "@/components/ui/icons";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMetricRoomAreaForRoom } from "@/lib/editor/measurements";
import { resolveRoomWallSegmentIndex } from "@/lib/editor/openings";
import { getRoomsForActiveFloor } from "@/lib/editor/history";
import type { Room, RoomInteriorAsset, RoomOpening, RoomWall } from "@/lib/editor/types";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editorStore";

type SidebarWallEntry = {
  wall: RoomWall;
  segmentIndex: number;
};

const RECTANGULAR_WALLS: RoomWall[] = ["top", "right", "bottom", "left"];
const SIDEBAR_CHEVRON_BUTTON_CLASS =
  "flex size-6 shrink-0 items-center justify-center rounded-md text-inherit/70 transition-colors hover:bg-black/5 hover:text-inherit dark:hover:bg-white/5";
const SECTION_HEADER_CLASS =
  "flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-200/70 dark:text-zinc-100 dark:hover:bg-zinc-800/60";
const SECTION_COUNT_CLASS = "ml-auto text-[11px] font-normal text-inherit/70";

function getWallLabel(segmentIndex: number): string {
  return `Wall ${segmentIndex + 1}`;
}

function getOpeningLabel(opening: RoomOpening): string {
  return opening.type === "door" ? "Door" : "Window";
}

function getRoomWalls(room: Room): SidebarWallEntry[] {
  if (room.points.length === 4) {
    return RECTANGULAR_WALLS
      .map((wall) => {
        const segmentIndex = resolveRoomWallSegmentIndex(room, wall);
        return segmentIndex === null ? null : { wall, segmentIndex };
      })
      .filter((entry): entry is SidebarWallEntry => entry !== null)
      .sort((a, b) => a.segmentIndex - b.segmentIndex);
  }

  return room.points.map((_, segmentIndex) => ({ wall: segmentIndex, segmentIndex }));
}

function getSelectedOpeningHostWall(room: Room, openingId: string | null): RoomWall | null {
  if (!openingId) return null;
  return room.openings.find((opening) => opening.id === openingId)?.wall ?? null;
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

function SidebarSection({
  title,
  count,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className={SECTION_HEADER_CLASS}>
        <SidebarIconTooltip content={isExpanded ? `Collapse ${title}` : `Expand ${title}`}>
          <button
            type="button"
            onClick={onToggle}
            className={SIDEBAR_CHEVRON_BUTTON_CLASS}
            aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
          </button>
        </SidebarIconTooltip>
        <span>{title}</span>
        <span className={SECTION_COUNT_CLASS}>{count}</span>
      </div>
      {isExpanded ? children : null}
    </div>
  );
}

export function EditorSidebarRoomsList() {
  const hasHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const document = useEditorStore((state) => state.document);
  const floors = document.floors;
  const displayedFloors = [...floors].reverse();
  const activeFloorId = document.activeFloorId;
  const rooms = getRoomsForActiveFloor(document);
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const selectedWall = useEditorStore((state) => state.selectedWall);
  const selectedOpening = useEditorStore((state) => state.selectedOpening);
  const selectedInteriorAsset = useEditorStore((state) => state.selectedInteriorAsset);
  const renameSession = useEditorStore((state) => state.renameSession);
  const interiorAssetRenameSession = useEditorStore((state) => state.interiorAssetRenameSession);
  const isCanvasInteractionActive = useEditorStore((state) => state.isCanvasInteractionActive);
  const isDraftActive = useEditorStore((state) => state.roomDraft.points.length > 0);
  const addFloor = useEditorStore((state) => state.addFloor);
  const selectFloorById = useEditorStore((state) => state.selectFloorById);
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
  const startFloorRename = useEditorStore((state) => state.startFloorRename);
  const updateFloorRenameDraft = useEditorStore((state) => state.updateFloorRenameDraft);
  const commitFloorRenameSession = useEditorStore((state) => state.commitFloorRenameSession);
  const cancelFloorRename = useEditorStore((state) => state.cancelFloorRename);
  const deleteFloor = useEditorStore((state) => state.deleteFloor);
  const floorRenameSession = useEditorStore((state) => state.floorRenameSession);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const interiorAssetInputRef = useRef<HTMLInputElement | null>(null);
  const floorRenameInputRef = useRef<HTMLInputElement | null>(null);
  const shouldAutoFocusRenameInputRef = useRef(false);
  const shouldAutoFocusInteriorAssetRenameInputRef = useRef(false);
  const shouldAutoFocusFloorRenameInputRef = useRef(false);
  const [sidebarRenameRoomId, setSidebarRenameRoomId] = useState<string | null>(null);
  const [sidebarRenameInteriorAssetId, setSidebarRenameInteriorAssetId] = useState<string | null>(null);
  const [sidebarRenameFloorId, setSidebarRenameFloorId] = useState<string | null>(null);
  const [floorToDelete, setFloorToDelete] = useState<string | null>(null);
  const [expandedRoomIds, setExpandedRoomIds] = useState<string[]>([]);
  const [expandedWallKeys, setExpandedWallKeys] = useState<string[]>([]);
  const [expandedAssetRoomIds, setExpandedAssetRoomIds] = useState<string[]>([]);
  const [isFloorsSectionExpanded, setIsFloorsSectionExpanded] = useState(true);
  const [isRoomsSectionExpanded, setIsRoomsSectionExpanded] = useState(true);
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

  useEffect(() => {
    if (!floorRenameSession || isRenameBlocked || !shouldAutoFocusFloorRenameInputRef.current) return;
    floorRenameInputRef.current?.focus();
    floorRenameInputRef.current?.select();
    shouldAutoFocusFloorRenameInputRef.current = false;
  }, [floorRenameSession, isRenameBlocked]);

  useEffect(() => {
    const activeFloorRenamingId = floorRenameSession?.floorId;
    if (!activeFloorRenamingId || !sidebarRenameFloorId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (floorRenameInputRef.current && !floorRenameInputRef.current.contains(target)) {
        useEditorStore.getState().commitFloorRenameSession();
        setSidebarRenameFloorId(null);
      }
    };

    globalThis.document.addEventListener("mousedown", handleClickOutside);
    return () => globalThis.document.removeEventListener("mousedown", handleClickOutside);
  }, [floorRenameSession, sidebarRenameFloorId]);

  useEffect(() => {
    if (!floorToDelete) return;

    const floor = document.floors.find((f) => f.id === floorToDelete);
    if (!floor) return;

    toast.custom(
      (id) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Delete {floor.name} and all its rooms?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                deleteFloor(floorToDelete);
                setFloorToDelete(null);
                toast.dismiss(id);
              }}
              className="rounded px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => {
                setFloorToDelete(null);
                toast.dismiss(id);
              }}
              className="rounded px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      {
        duration: Infinity,
      }
    );
  }, [floorToDelete, document.floors, deleteFloor]);

  if (!hasHydrated) {
    return null;
  }

  return (
    <ImmediateTooltipProvider>
      <div className="flex flex-col gap-3">
        <SidebarSection
          title="Floors"
          count={floors.length}
          isExpanded={isFloorsSectionExpanded}
          onToggle={() => setIsFloorsSectionExpanded((current) => !current)}
        >
          <div className="flex flex-col gap-1">
            {floors.length > 0 ? (
              displayedFloors.map((floor) => {
                const isRenaming = floorRenameSession?.floorId === floor.id && sidebarRenameFloorId === floor.id;
                return (
                  <div key={floor.id}>
                    {isRenaming ? (
                      <div className="flex min-h-10 items-center gap-2 px-3 py-2">
                        <EditorSidebarRenameInput
                          ref={floorRenameInputRef}
                          value={floor.name}
                          onChange={(event) => updateFloorRenameDraft(floor.id, event.target.value)}
                          onBlur={() => {
                            commitFloorRenameSession();
                            setSidebarRenameFloorId(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.nativeEvent.isComposing) return;

                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitFloorRenameSession();
                              setSidebarRenameFloorId(null);
                              return;
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelFloorRename();
                              setSidebarRenameFloorId(null);
                            }
                          }}
                          aria-label={`Rename ${floor.name}`}
                          className="flex-1"
                          disabled={isRenameBlocked}
                        />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-sm transition-colors group",
                          activeFloorId === floor.id
                            ? "bg-zinc-200/95 text-zinc-950 dark:bg-zinc-800/80 dark:text-zinc-50"
                            : "text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => selectFloorById(floor.id)}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            setSidebarRenameFloorId(floor.id);
                            shouldAutoFocusFloorRenameInputRef.current = true;
                            selectFloorById(floor.id);
                            startFloorRename(floor.id);
                          }}
                          className="flex flex-1 min-w-0 items-center gap-2 text-left"
                        >
                          <span className="truncate">{floor.name}</span>
                          {activeFloorId === floor.id ? <span className={SECTION_COUNT_CLASS}>Active</span> : null}
                        </button>
                        <SidebarIconTooltip content="Delete floor">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFloorToDelete(floor.id);
                            }}
                            className="flex size-6 shrink-0 items-center justify-center rounded-md text-inherit/70 transition-colors hover:bg-black/5 hover:text-inherit dark:hover:bg-white/5 opacity-0 group-hover:opacity-100"
                            aria-label={`Delete ${floor.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </SidebarIconTooltip>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300/80 bg-zinc-50/60 px-3 py-2 text-sm text-zinc-600 dark:border-border/70 dark:bg-transparent dark:text-muted-foreground">
                No floors yet.
              </div>
            )}
            <button
              type="button"
              onClick={addFloor}
              className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-zinc-300/80 bg-zinc-50/80 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border/70 dark:bg-zinc-900/40 dark:text-zinc-100 dark:hover:bg-zinc-900/70"
              disabled={isRenameBlocked}
            >
              <Plus className="size-4" />
              <span>Add Floor</span>
            </button>
          </div>
        </SidebarSection>

        <SidebarSection
          title="Rooms"
          count={rooms.length}
          isExpanded={isRoomsSectionExpanded}
          onToggle={() => setIsRoomsSectionExpanded((current) => !current)}
        >
          {rooms.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300/80 bg-zinc-50/60 p-3 text-sm text-zinc-600 dark:border-border/70 dark:bg-transparent dark:text-muted-foreground">
              Rooms will appear here as you draw them.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {rooms.map((room) => {
                const selectedOpeningHostWall =
                  selectedOpening?.roomId === room.id
                    ? getSelectedOpeningHostWall(room, selectedOpening.openingId)
                    : null;
                const isSelected = selectedRoomId === room.id;
                const isRenaming = activeRenameRoomId === room.id && sidebarRenameRoomId === room.id;
                const areaLabel = formatMetricRoomAreaForRoom(room);
                const roomWalls = getRoomWalls(room);
                const isRoomExpanded = isSelected || expandedRoomIds.includes(room.id);
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
                        <span aria-hidden="true" className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                          -
                        </span>
                        <span className="shrink-0 text-xs leading-none text-zinc-500 dark:text-zinc-400">
                          {areaLabel}
                        </span>
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
                          <span className="w-14 shrink-0 text-right text-xs leading-none text-zinc-500 dark:text-zinc-400">
                            {areaLabel}
                          </span>
                        </div>
                      </div>
                    )}
                    {isRoomExpanded ? (
                      <div className="px-3 pb-2">
                        <div className="mt-1 flex flex-col gap-1">
                          {roomWalls.map(({ wall, segmentIndex }) => {
                            const wallKey = `${room.id}:${wall}`;
                            const isWallExpanded =
                              expandedWallKeys.includes(wallKey) ||
                              (selectedWall?.roomId === room.id && selectedWall.wall === wall) ||
                              selectedOpeningHostWall === wall;
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
                                          ? `Collapse ${getWallLabel(segmentIndex)}`
                                          : `Expand ${getWallLabel(segmentIndex)}`
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
                                            ? `Collapse ${getWallLabel(segmentIndex)}`
                                            : `Expand ${getWallLabel(segmentIndex)}`
                                        }
                                      >
                                        <ChevronRight
                                          className={cn(
                                            "size-3.5 transition-transform",
                                            isWallExpanded && "rotate-90"
                                          )}
                                        />
                                      </button>
                                    </SidebarIconTooltip>
                                  ) : (
                                    <span className="size-6 shrink-0" aria-hidden="true" />
                                  )}
                                  <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                    <span className="truncate">{getWallLabel(segmentIndex)}</span>
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
                                      className={cn(
                                        "size-3.5 transition-transform",
                                        isAssetSectionExpanded && "rotate-90"
                                      )}
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
          )}
        </SidebarSection>
      </div>
    </ImmediateTooltipProvider>
  );
}

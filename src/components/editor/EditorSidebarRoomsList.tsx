"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EditorSidebarRenameInput } from "@/components/editor/EditorSidebarRenameInput";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ChevronRight,
  IconCaretDownFilled,
  IconCaretUpFilled,
  Plus,
  Trash2,
} from "@/components/ui/icons";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatMetricRoomArea,
  formatMetricRoomAreaForRoom,
  getRoomAreaSquareMillimetres,
} from "@/lib/editor/measurements";
import { resolveRoomWallSegmentIndex } from "@/lib/editor/openings";
import { getRoomsForFloor } from "@/lib/editor/history";
import type { Room, RoomInteriorAsset, RoomOpening, RoomWall } from "@/lib/editor/types";
import type { SharedSelectionItem } from "@/lib/editor/types";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editorStore";

type SidebarWallEntry = {
  wall: RoomWall;
  segmentIndex: number;
};

const RECTANGULAR_WALLS: RoomWall[] = ["top", "right", "bottom", "left"];
const SIDEBAR_CHEVRON_BUTTON_CLASS =
  "flex size-6 shrink-0 items-center justify-center rounded-md text-inherit/70 transition-colors hover:bg-black/5 hover:text-inherit dark:hover:bg-white/5";

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

/** Check if an item is in the selection array */
function isItemInSelection(item: SharedSelectionItem, selection: SharedSelectionItem[]): boolean {
  return selection.some((selected) => {
    if (item.type !== selected.type) return false;
    
    if (item.type === "room" && selected.type === "room") {
      return item.id === selected.id;
    } else if (item.type === "floor" && selected.type === "floor") {
      return item.id === selected.id;
    } else if (item.type === "wall" && selected.type === "wall") {
      return item.roomId === selected.roomId && item.wall === selected.wall;
    } else if (item.type === "opening" && selected.type === "opening") {
      return item.roomId === selected.roomId && item.id === selected.id;
    } else if (item.type === "stair" && selected.type === "stair") {
      return item.roomId === selected.roomId && item.id === selected.id;
    }
    return false;
  });
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
  const document = useEditorStore((state) => state.document);
  const maxFloors = useEditorStore((state) => state.maxFloors);
  const floors = document.floors;
  const canAddFloor = floors.length < maxFloors;
  const displayedFloors = [...floors].reverse();
  const activeFloorId = document.activeFloorId;
  const rooms = document.rooms;
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const selectedWall = useEditorStore((state) => state.selectedWall);
  const selectedOpening = useEditorStore((state) => state.selectedOpening);
  const selectedInteriorAsset = useEditorStore((state) => state.selectedInteriorAsset);
  const selection = useEditorStore((state) => state.selection);
  const renameSession = useEditorStore((state) => state.renameSession);
  const interiorAssetRenameSession = useEditorStore((state) => state.interiorAssetRenameSession);
  const isCanvasInteractionActive = useEditorStore((state) => state.isCanvasInteractionActive);
  const isDraftActive = useEditorStore((state) => state.roomDraft.points.length > 0);
  const isCompactDensity = useEditorStore((state) => state.settings.sidebarDensity === "compact");
  const addFloor = useEditorStore((state) => state.addFloor);
  const selectFloorById = useEditorStore((state) => state.selectFloorById);
  const selectRoomById = useEditorStore((state) => state.selectRoomById);
  const selectWallByRoomId = useEditorStore((state) => state.selectWallByRoomId);
  const selectOpeningById = useEditorStore((state) => state.selectOpeningById);
  const selectInteriorAssetById = useEditorStore((state) => state.selectInteriorAssetById);
  const addToSelection = useEditorStore((state) => state.addToSelection);
  const removeFromSelection = useEditorStore((state) => state.removeFromSelection);
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
  const moveSelectionToFloor = useEditorStore((state) => state.moveSelectionToFloor);
  const reorderRoomInFloor = useEditorStore((state) => state.reorderRoomInFloor);
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
  const [dragOverFloorId, setDragOverFloorId] = useState<string | null>(null);
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);
  const [expandedRoomIds, setExpandedRoomIds] = useState<string[]>([]);
  const [expandedWallKeys, setExpandedWallKeys] = useState<string[]>([]);
  const [expandedAssetRoomIds, setExpandedAssetRoomIds] = useState<string[]>([]);
  const [collapsedFloorIds, setCollapsedFloorIds] = useState<string[]>([]);
  const activeRenameRoomId = renameSession?.roomId ?? null;
  const isRenameBlocked = isCanvasInteractionActive || isDraftActive;
  const selectedRoomFromMultiSelection = selection.find(
    (item): item is Extract<SharedSelectionItem, { type: "room" }> => item.type === "room"
  );
  const selectedRoomForStructureId = selectedRoomId ?? selectedRoomFromMultiSelection?.id ?? null;
  const selectedRoomFloorId = selectedRoomForStructureId
    ? rooms.find((room) => room.id === selectedRoomForStructureId)?.floorId ?? null
    : null;
  const effectiveCollapsedFloorIds = selectedRoomFloorId
    ? collapsedFloorIds.filter((floorId) => floorId !== selectedRoomFloorId)
    : collapsedFloorIds;
  const floorRowClass = cn(
    "group flex w-full items-center rounded-lg border font-semibold tracking-[0.02em] transition-colors",
    isCompactDensity ? "min-h-8 px-2.5 py-1.5 text-xs" : "min-h-10 px-3 py-2 text-sm"
  );
  const floorBadgeClass = cn(
    "inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-300/50 font-semibold text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300",
    isCompactDensity ? "h-4 w-4 text-[9px]" : "w-5 h-5 text-[10px]"
  );
  const roomCardClass = cn("rounded-lg border transition-colors", isCompactDensity ? "text-xs" : "text-sm");
  const roomHeaderClass = cn(
    "flex items-center gap-2",
    isCompactDensity ? "min-h-8 px-2.5 py-1.5" : "min-h-10 px-3 py-2"
  );
  const roomNameClass = cn("min-w-0 flex-1 truncate font-medium text-inherit", isCompactDensity ? "text-xs" : "text-sm");
  const areaLabelClass = cn(
    "shrink-0 text-right leading-none text-zinc-500 dark:text-zinc-400",
    isCompactDensity ? "w-12 text-[10px]" : "w-14 text-xs"
  );
  const floorAreaLabelClass = cn("ml-auto", areaLabelClass);
  const roomDetailsContainerClass = cn(isCompactDensity ? "px-2.5 pb-1.5" : "px-3 pb-2");
  const nestedRoomListClass = cn("flex flex-col", isCompactDensity ? "ml-5 mt-1 gap-0.5" : "ml-6 mt-1 gap-1");
  const wallRowClass = cn(
    "ml-2 flex items-center gap-2 rounded-md pr-2 transition-colors",
    isCompactDensity ? "min-h-8 py-1 text-xs" : "min-h-9 py-1.5 text-sm"
  );
  const openingRowClass = cn(
    "flex w-full items-center rounded-md text-left transition-colors",
    isCompactDensity ? "min-h-8 px-2 py-1 text-xs" : "min-h-9 px-2 py-1.5 text-sm"
  );
  const assetHeaderRowClass = cn(
    "ml-2 flex items-center gap-2 rounded-md pr-2 transition-colors",
    isCompactDensity ? "min-h-8 py-1 text-xs" : "min-h-9 py-1.5 text-sm"
  );
  const assetRowClass = cn(
    "flex w-full items-center rounded-md text-left transition-colors",
    isCompactDensity ? "min-h-8 px-2 py-1 text-xs" : "min-h-9 px-2 py-1.5 text-sm"
  );
  const floorLabelClass = cn(
    "truncate font-semibold text-inherit",
    isCompactDensity ? "text-[11px]" : "text-sm"
  );
  const floorContentClass = cn(
    "flex flex-1 min-w-0 items-center gap-2 text-left",
    isCompactDensity ? "-my-1 py-1" : "-my-2 py-2"
  );

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



  if (!hasHydrated) {
    return null;
  }

  return (
    <ImmediateTooltipProvider>
      <div className={cn("flex flex-col", isCompactDensity ? "gap-2" : "gap-3")}>
        {floors.length === 0 ? (
          <div className={cn(
            "rounded-lg border border-dashed border-zinc-300/80 bg-zinc-50/60 text-zinc-600 dark:border-border/70 dark:bg-transparent dark:text-muted-foreground",
            isCompactDensity ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
          )}>
            No floors yet.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {displayedFloors.map((floor, floorIndex) => {
                const floorNumber = displayedFloors.length - 1 - floorIndex;
                const isRenaming = floorRenameSession?.floorId === floor.id && sidebarRenameFloorId === floor.id;
                const floorRooms = getRoomsForFloor(document, floor.id);
                const floorAreaSquareMillimetres = floorRooms.reduce(
                  (totalArea, room) => totalArea + getRoomAreaSquareMillimetres(room),
                  0
                );
                const floorAreaLabel = formatMetricRoomArea(floorAreaSquareMillimetres);
                const isFloorExpanded = !effectiveCollapsedFloorIds.includes(floor.id);
                return (
                  <div key={floor.id} className="rounded-lg border border-transparent">
                    <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            className={cn(
                              floorRowClass,
                              "pointer-events-auto",
                              dragOverFloorId === floor.id
                                ? "bg-brand/10 text-foreground ring-1 ring-brand/50 dark:bg-brand/15 dark:ring-brand/40"
                                : activeFloorId === floor.id
                                ? "border-zinc-400/80 bg-zinc-200/95 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                                : "border-zinc-300/70 bg-zinc-100/60 text-zinc-700 hover:bg-zinc-200/75 dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                            )}
                            onMouseDown={(event) => {
                              event.stopPropagation();
                            }}
                            onDragOver={(e) => {
                              if (selection.length > 0 && floor.id !== activeFloorId) {
                                e.preventDefault();
                                e.dataTransfer!.dropEffect = "move";
                                setDragOverFloorId(floor.id);
                              }
                            }}
                            onDragLeave={() => {
                              setDragOverFloorId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverFloorId(null);
                              if (selection.length > 0 && floor.id !== activeFloorId) {
                                moveSelectionToFloor(floor.id);
                              }
                            }}
                          >
                            <SidebarIconTooltip
                              content={isFloorExpanded ? `Collapse ${floor.name}` : `Expand ${floor.name}`}
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setCollapsedFloorIds((current) =>
                                    current.includes(floor.id)
                                      ? current.filter((id) => id !== floor.id)
                                      : [...current, floor.id]
                                  );
                                }}
                                className={cn(SIDEBAR_CHEVRON_BUTTON_CLASS, "pointer-events-auto")}
                                aria-label={isFloorExpanded ? `Collapse ${floor.name}` : `Expand ${floor.name}`}
                              >
                                <ChevronRight className={cn("size-3.5 transition-transform", isFloorExpanded && "rotate-90")} />
                              </button>
                            </SidebarIconTooltip>
                            {isRenaming ? (
                              <div className={floorContentClass}>
                                <span className={floorBadgeClass}>{floorNumber}</span>
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
                                  className={cn(
                                    "flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0",
                                    isCompactDensity && "pt-px",
                                    floorLabelClass
                                  )}
                                  disabled={isRenameBlocked}
                                />
                                <span className={floorAreaLabelClass}>{floorAreaLabel}</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  selectFloorById(floor.id);
                                }}
                                onDoubleClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setSidebarRenameFloorId(floor.id);
                                  shouldAutoFocusFloorRenameInputRef.current = true;
                                  selectFloorById(floor.id);
                                  startFloorRename(floor.id);
                                }}
                                className={cn(floorContentClass, "pointer-events-auto")}
                              >
                                <span className={floorBadgeClass}>
                                  {floorNumber}
                                </span>
                                <span className={floorLabelClass}>{floor.name}</span>
                                <span className={floorAreaLabelClass}>{floorAreaLabel}</span>
                              </button>
                            )}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem
                            disabled={!canAddFloor}
                            onSelect={() => addFloor({ targetFloorId: floor.id, position: "below" })}
                          >
                            <IconCaretUpFilled className="size-4" />
                            Add floor above
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={!canAddFloor}
                            onSelect={() => addFloor({ targetFloorId: floor.id, position: "above" })}
                          >
                            <IconCaretDownFilled className="size-4" />
                            Add floor below
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            variant="destructive"
                            onSelect={() => deleteFloor(floor.id)}
                          >
                            <Trash2 className="size-4" />
                            Delete floor
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                    {isFloorExpanded ? (
                      <div className={nestedRoomListClass}>
                        {floorRooms.length === 0 ? (
                          <div className={cn(
                            "rounded-md border border-dashed border-zinc-300/70 bg-zinc-50/50 text-zinc-500 dark:border-border/60 dark:bg-transparent dark:text-muted-foreground",
                            isCompactDensity ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"
                          )}>
                            Rooms will appear here as you draw them.
                          </div>
                        ) : (
                          floorRooms.map((room) => {
                const selectedOpeningHostWall =
                  selectedOpening?.roomId === room.id
                    ? getSelectedOpeningHostWall(room, selectedOpening.openingId)
                    : null;
                const isSelected = selectedRoomId === room.id;
                const roomItem: SharedSelectionItem = { type: "room", id: room.id };
                const isInMultiSelection = isItemInSelection(roomItem, selection) && !isSelected;
                const isRenaming = activeRenameRoomId === room.id && sidebarRenameRoomId === room.id;
                const areaLabel = formatMetricRoomAreaForRoom(room);
                const roomWalls = getRoomWalls(room);
                const isRoomExpanded = isSelected || expandedRoomIds.includes(room.id);
                const hasInteriorAssets = room.interiorAssets.length > 0;
                const isAssetSectionExpanded = expandedAssetRoomIds.includes(room.id);
                const isDraggingThisRoom = draggedRoomId === room.id;
                const isDragOverThisRoom = dragOverRoomId === room.id && draggedRoomId !== null && draggedRoomId !== room.id;

                return (
                  <div
                    key={room.id}
                    draggable
                    onDragStart={() => setDraggedRoomId(room.id)}
                    onDragEnd={() => {
                      setDraggedRoomId(null);
                      setDragOverRoomId(null);
                    }}
                    onDragOver={(e) => {
                      if (draggedRoomId && draggedRoomId !== room.id) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverRoomId(room.id);
                      }
                    }}
                    onDragLeave={() => {
                      setDragOverRoomId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverRoomId(null);
                      if (draggedRoomId && draggedRoomId !== room.id) {
                        const draggedRoom = document.rooms.find((r) => r.id === draggedRoomId);
                        const targetIndex = floorRooms.findIndex((r) => r.id === room.id);
                        if (draggedRoom && draggedRoom.floorId === room.floorId && targetIndex !== -1) {
                          reorderRoomInFloor(draggedRoomId, targetIndex);
                        }
                      }
                      setDraggedRoomId(null);
                    }}
                    className={cn(
                      roomCardClass,
                      isDraggingThisRoom
                        ? "border-zinc-300 bg-zinc-100 text-zinc-600 opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                        : isDragOverThisRoom
                        ? "border-brand/60 bg-brand/10 dark:border-brand/50 dark:bg-brand/15"
                        : isSelected
                        ? "border-zinc-400/80 bg-zinc-200/95 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                        : isInMultiSelection
                        ? "border-zinc-400/50 bg-zinc-200/60 text-zinc-900 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-100"
                        : "border-transparent text-zinc-700 hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                    )}
                  >
                    <div
                      className={roomHeaderClass}
                      onClick={
                        isRenaming
                          ? undefined
                          : (e) => {
                              if ((e.ctrlKey || e.metaKey) && e.button === 0) {
                                const roomItem: SharedSelectionItem = { type: "room", id: room.id };
                                if (isItemInSelection(roomItem, selection)) {
                                  removeFromSelection(roomItem);
                                } else {
                                  addToSelection(roomItem);
                                }
                              } else {
                                selectRoomById(room.id);
                              }
                            }
                      }
                      onMouseDown={
                        isRenaming
                          ? undefined
                          : (e) => {
                              if ((e.ctrlKey || e.metaKey) && e.button === 0) {
                                e.preventDefault();
                              }
                            }
                      }
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
                          {isRenaming ? (
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
                              className={cn(
                                "flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0",
                                isCompactDensity && "pt-px",
                                roomNameClass
                              )}
                              disabled={isRenameBlocked}
                            />
                          ) : (
                            <span
                              onDoubleClick={(event) => {
                                event.stopPropagation();
                                setSidebarRenameRoomId(room.id);
                                shouldAutoFocusRenameInputRef.current = true;
                                selectRoomById(room.id);
                                startRoomRenameSession(room.id);
                              }}
                              className={roomNameClass}
                            >
                              {room.name}
                            </span>
                          )}
                          <span className={areaLabelClass}>
                            {areaLabel}
                          </span>
                        </div>
                      </div>
                    {isRoomExpanded ? (
                      <div className={roomDetailsContainerClass}>
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
                                    wallRowClass,
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
                                          const openingItem: SharedSelectionItem = { type: "opening", roomId: room.id, id: opening.id };
                                          const isInMultiSelection = isItemInSelection(openingItem, selection) && !isOpeningSelected;

                                          return (
                                            <button
                                              key={opening.id}
                                              type="button"
                                              onClick={(e) => {
                                                if ((e.ctrlKey || e.metaKey) && e.button === 0) {
                                                  if (isItemInSelection(openingItem, selection)) {
                                                    removeFromSelection(openingItem);
                                                  } else {
                                                    addToSelection(openingItem);
                                                  }
                                                } else {
                                                  selectOpeningById(room.id, opening.id);
                                                }
                                              }}
                                              onMouseDown={(e) => {
                                                if ((e.ctrlKey || e.metaKey) && e.button === 0) {
                                                  e.preventDefault();
                                                }
                                              }}
                                              className={cn(
                                                openingRowClass,
                                                isOpeningSelected
                                                  ? "bg-zinc-300/80 text-zinc-950 dark:bg-zinc-700/80 dark:text-zinc-50"
                                                  : isInMultiSelection
                                                  ? "bg-zinc-300/50 text-zinc-900 dark:bg-zinc-700/50 dark:text-zinc-100"
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
                              <div className={cn(
                                assetHeaderRowClass,
                                "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                              )}>
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
                                    const assetItem: SharedSelectionItem = { type: "stair", roomId: room.id, id: asset.id };
                                    const isInMultiSelection = isItemInSelection(assetItem, selection) && !isAssetSelected;
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
                                              className={isCompactDensity ? "!h-8" : "!h-10"}
                                              disabled={isRenameBlocked}
                                            />
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              if ((e.ctrlKey || e.metaKey) && e.button === 0) {
                                                if (isItemInSelection(assetItem, selection)) {
                                                  removeFromSelection(assetItem);
                                                } else {
                                                  addToSelection(assetItem);
                                                }
                                              } else {
                                                selectInteriorAssetById(room.id, asset.id);
                                              }
                                            }}
                                            onMouseDown={(e) => {
                                              if ((e.ctrlKey || e.metaKey) && e.button === 0) {
                                                e.preventDefault();
                                              }
                                            }}
                                            className={cn(
                                              assetRowClass,
                                              isAssetSelected
                                                ? "bg-zinc-300/80 text-zinc-950 dark:bg-zinc-700/80 dark:text-zinc-50"
                                                : isInMultiSelection
                                                ? "bg-zinc-300/50 text-zinc-900 dark:bg-zinc-700/50 dark:text-zinc-100"
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
                          })
                        )}
                      </div>
                    ) : null}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => addFloor()}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border border-zinc-300/80 bg-zinc-50/80 font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border/70 dark:bg-zinc-900/40 dark:text-zinc-100 dark:hover:bg-zinc-900/70",
                isCompactDensity ? "min-h-8 px-2.5 py-1.5 text-xs" : "min-h-10 px-3 py-2 text-sm"
              )}
              disabled={isRenameBlocked || floors.length >= maxFloors}
              title={floors.length >= maxFloors ? `Maximum ${maxFloors} floors reached` : undefined}
            >
              <Plus className="size-4" />
              <span>Add Floor</span>
            </button>
          </div>
        )}

        {selection.length > 0 && (
          <div className="rounded-lg border border-blue-300/50 bg-blue-50/50 px-3 py-2 dark:border-blue-700/50 dark:bg-blue-900/20">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-blue-900 dark:text-blue-100">Multi-select</span>
              <span className="text-blue-800 dark:text-blue-200">{selection.length} item{selection.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
      </div>
    </ImmediateTooltipProvider>
  );
}

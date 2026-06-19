"use client";

import { useEffect, useRef, useState } from "react";
import { IconEye, Trash2, Ruler2, RulerMeasure2, RulerMeasure } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { SelectedInteriorAssetInspector } from "@/components/editor/SelectedInteriorAssetInspector";
import { SelectedOpeningInspector } from "@/components/editor/SelectedOpeningInspector";
import { UnitOriginTag } from "@/components/editor/UnitOriginTag";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatWallDimension } from "@/lib/editor/measurements";
import { getPolygonBounds } from "@/lib/editor/roomGeometry";
import {
  ROOM_PRESET_OTHER_COLOR,
  getRegionalRoomPresetLabel,
  getRoomPresetById,
} from "@/lib/editor/roomPresets";
import {
  DEFAULT_EXTERNAL_WALL_THICKNESS_MM,
  DEFAULT_INTERNAL_WALL_THICKNESS_MM,
} from "@/lib/editor/wallThickness";
import type { Room } from "@/lib/editor/types";
import { useMobile } from "@/lib/use-mobile";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";
import type { UnitOrigin } from "@/lib/projects/region";

type SelectedRoomNamePanelProps = {
  className?: string;
};

function InspectorIconTooltip({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

function RoomDimensionsDisplay({
  room,
  displayUnitOrigin,
}: {
  room: Room;
  displayUnitOrigin?: UnitOrigin;
}) {
  const bounds = getPolygonBounds(room.points);
  if (!bounds) return null;

  const width = bounds.maxX - bounds.minX;
  const length = bounds.maxY - bounds.minY;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Dimensions</p>
        <UnitOriginTag unitOrigin={room.unitOrigin} />
      </div>
      <div className="space-y-2">
        <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground flex items-center gap-2">
          <RulerMeasure2 className="size-4 shrink-0" />
          <span>{formatWallDimension(length, displayUnitOrigin)}</span>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground flex items-center gap-2">
          <RulerMeasure className="size-4 shrink-0" />
          <span>{formatWallDimension(width, displayUnitOrigin)}</span>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground flex items-center gap-2">
          <Ruler2 className="size-4 shrink-0" />
          <span>{formatWallDimension(room.heightMm, displayUnitOrigin)} height</span>
        </div>
      </div>
    </div>
  );
}

function RoomWallThicknessPlaceholder({
  room,
  displayUnitOrigin,
}: {
  room: Room;
  displayUnitOrigin?: UnitOrigin;
}) {
  const internalWallCount =
    room.wallSegments?.filter((segment) => segment.isExternal === false).length ?? 0;
  const externalWallCount = Math.max(room.points.length - internalWallCount, 0);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Wall thickness</p>
      <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span>
            External {formatWallDimension(DEFAULT_EXTERNAL_WALL_THICKNESS_MM, displayUnitOrigin)}
          </span>
          <span>
            Internal {formatWallDimension(DEFAULT_INTERNAL_WALL_THICKNESS_MM, displayUnitOrigin)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {externalWallCount} external, {internalWallCount} internal. Per-wall overrides coming later.
        </p>
      </div>
    </div>
  );
}

export function SelectedRoomNamePanel({ className }: SelectedRoomNamePanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const { isMobile } = useMobile();
  const [isCompactLandscapeViewport, setIsCompactLandscapeViewport] = useState(false);
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const focusedRoomId = useEditorStore((state) => state.focusedRoomId);
  const shouldFocusSelectedRoomNameInput = useEditorStore(
    (state) => state.shouldFocusSelectedRoomNameInput
  );
  const rooms = useEditorStore((state) => state.document.rooms);
  const displayUnitOrigin = useEditorStore((state) => state.document.region);
  const selectedOpening = useEditorStore((state) => state.selectedOpening);
  const selectedInteriorAsset = useEditorStore((state) => state.selectedInteriorAsset);
  const isCanvasInteractionActive = useEditorStore((state) => state.isCanvasInteractionActive);
  const isDraftActive = useEditorStore((state) => state.roomDraft.points.length > 0);
  const startRoomRenameSession = useEditorStore((state) => state.startRoomRenameSession);
  const updateRoomRenameDraft = useEditorStore((state) => state.updateRoomRenameDraft);
  const commitRoomRenameSession = useEditorStore((state) => state.commitRoomRenameSession);
  const cancelRoomRenameSession = useEditorStore((state) => state.cancelRoomRenameSession);
  const selectRoomById = useEditorStore((state) => state.selectRoomById);
  const roomPresetPickerRoomId = useEditorStore((state) => state.roomPresetPickerRoomId);
  const requestRoomPresetPicker = useEditorStore((state) => state.requestRoomPresetPicker);
  const clearRoomPresetPicker = useEditorStore((state) => state.clearRoomPresetPicker);
  const setFocusedRoomId = useEditorStore((state) => state.setFocusedRoomId);
  const deleteSelectedRoom = useEditorStore((state) => state.deleteSelectedRoom);
  const consumeSelectedRoomNameInputFocusRequest = useEditorStore(
    (state) => state.consumeSelectedRoomNameInputFocusRequest
  );
  const focusFrameRef = useRef<number | null>(null);
  const focusTimeoutRef = useRef<number | null>(null);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedOpeningId = selectedOpening?.openingId ?? null;
  const resolvedSelectedOpening =
    selectedOpening?.roomId === selectedRoom?.id
      ? selectedRoom?.openings.find((opening) => opening.id === selectedOpeningId) ?? null
      : null;
  const selectedInteriorAssetId = selectedInteriorAsset?.assetId ?? null;
  const resolvedSelectedInteriorAsset =
    selectedInteriorAsset?.roomId === selectedRoom?.id
      ? selectedRoom?.interiorAssets.find((asset) => asset.id === selectedInteriorAssetId) ?? null
      : null;
  const canDeleteSelectedRoom = selectedRoom !== null;
  const isFocusModeActive = focusedRoomId === selectedRoom?.id;
  const isRenameBlocked = isCanvasInteractionActive || isDraftActive;
  const shouldHideKeyboardHints = isMobile || isCompactLandscapeViewport;
  const selectedRoomPreset = selectedRoom?.roomType ? getRoomPresetById(selectedRoom.roomType) : null;
  const selectedRoomTypeLabel =
    selectedRoom && selectedRoomPreset
      ? getRegionalRoomPresetLabel(selectedRoomPreset, displayUnitOrigin)
      : "Other";
  const selectedRoomTypeColor =
    selectedRoom?.roomColor ?? selectedRoomPreset?.color ?? ROOM_PRESET_OTHER_COLOR;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactLandscapeMediaQuery = window.matchMedia(
      "(max-height: 540px) and (orientation: landscape)"
    );
    const updateIsCompactLandscapeViewport = () => {
      setIsCompactLandscapeViewport(compactLandscapeMediaQuery.matches);
    };

    updateIsCompactLandscapeViewport();
    compactLandscapeMediaQuery.addEventListener("change", updateIsCompactLandscapeViewport);

    return () => {
      compactLandscapeMediaQuery.removeEventListener("change", updateIsCompactLandscapeViewport);
    };
  }, []);

  useEffect(() => {
    if (!shouldFocusSelectedRoomNameInput || !selectedRoom || isRenameBlocked) return;

    let attempts = 0;
    let isCancelled = false;

    const tryFocusInput = () => {
      if (isCancelled) return;
      const inputElement = document.getElementById("room-name-input");
      if (inputElement instanceof HTMLInputElement) {
        startRoomRenameSession(selectedRoom.id);
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
  }, [
    consumeSelectedRoomNameInputFocusRequest,
    isRenameBlocked,
    selectedRoom,
    startRoomRenameSession,
    shouldFocusSelectedRoomNameInput,
  ]);

  useEffect(() => {
    if (!isRenameBlocked) return;
    const inputElement = document.getElementById("room-name-input");
    if (inputElement instanceof HTMLInputElement && document.activeElement === inputElement) {
      inputElement.blur();
    }
  }, [isRenameBlocked]);

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
    <div className={cn("flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1", className)}>
      <EditorInspectorSection
        title="Selected room"
        description="Review the current room name and quick actions."
      >
        <aside ref={panelRef}>
          <label htmlFor="room-name-input" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <Input
            id="room-name-input"
            value={selectedRoom.name}
            onFocus={(event) => {
              if (isRenameBlocked) {
                event.currentTarget.blur();
                return;
              }
              startRoomRenameSession(selectedRoom.id);
            }}
            onChange={(event) => updateRoomRenameDraft(selectedRoom.id, event.target.value)}
            onBlur={() => {
              commitRoomRenameSession({ deselectIfUnchanged: false });
              selectRoomById(selectedRoom.id);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;

              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.blur();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelRoomRenameSession();
                selectRoomById(selectedRoom.id);
                event.currentTarget.blur();
              }
            }}
            placeholder="Untitled room"
            autoComplete="off"
            disabled={isRenameBlocked}
            aria-describedby={shouldHideKeyboardHints ? undefined : "room-name-input-hint"}
          />
          {!shouldHideKeyboardHints ? (
            <p
              id="room-name-input-hint"
              className="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground/80 [@media(max-height:540px)_and_(orientation:landscape)]:mt-1"
            >
              <Kbd aria-hidden="true">
                Enter
              </Kbd>
              <span>save</span>
              <span aria-hidden="true">·</span>
              <Kbd aria-hidden="true">
                Esc
              </Kbd>
              <span>cancel</span>
            </p>
          ) : null}
          <div className="mt-4">
            <label htmlFor="room-type-picker-button" className="mb-1 block text-sm font-medium">
              Type
            </label>
            <button
              id="room-type-picker-button"
              type="button"
              data-room-preset-picker-control="true"
              onClick={() => {
                if (roomPresetPickerRoomId === selectedRoom.id) {
                  clearRoomPresetPicker();
                  return;
                }
                selectRoomById(selectedRoom.id);
                requestRoomPresetPicker(selectedRoom.id);
              }}
              disabled={isRenameBlocked}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedRoomTypeColor }}
                />
                <span className="truncate">{selectedRoomTypeLabel}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">Change</span>
            </button>
          </div>
          <div className="mt-4">
            <RoomDimensionsDisplay room={selectedRoom} displayUnitOrigin={displayUnitOrigin} />
          </div>
          <div className="mt-4">
            <RoomWallThicknessPlaceholder room={selectedRoom} displayUnitOrigin={displayUnitOrigin} />
          </div>
          <div className="mt-4 flex justify-between gap-2">
            <ImmediateTooltipProvider>
              <InspectorIconTooltip
                content={isFocusModeActive ? "Show all rooms" : "Focus on this room"}
              >
                <Toggle
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  pressed={isFocusModeActive}
                  onPressedChange={(pressed) => {
                    setFocusedRoomId(pressed ? selectedRoom.id : null);
                  }}
                  aria-label={
                    isFocusModeActive
                      ? "Show all rooms"
                      : "Focus on this room"
                  }
                  className="border-border/70 data-[state=on]:border-brand/70 data-[state=on]:bg-brand data-[state=on]:text-white data-[state=on]:shadow-sm data-[state=on]:hover:bg-brand/90"
                >
                  <IconEye />
                </Toggle>
              </InspectorIconTooltip>
              <InspectorIconTooltip
                content={shouldHideKeyboardHints ? "Delete room" : (
                  <span className="inline-flex items-center gap-2">
                    <span>Delete room</span>
                    <span className="inline-flex items-center gap-1">
                      <Kbd aria-hidden="true" className="shadow-none">Del</Kbd>
                      <span aria-hidden="true" className="text-muted-foreground/70">/</span>
                      <Kbd aria-hidden="true" className="shadow-none">⌫</Kbd>
                    </span>
                  </span>
                )}
              >
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  onClick={deleteSelectedRoom}
                  disabled={!canDeleteSelectedRoom}
                  aria-label={`Delete ${selectedRoom.name}`}
                >
                  <Trash2 />
                </Button>
              </InspectorIconTooltip>
            </ImmediateTooltipProvider>
          </div>
        </aside>
      </EditorInspectorSection>
      {resolvedSelectedOpening ? <SelectedOpeningInspector opening={resolvedSelectedOpening} /> : null}
      {resolvedSelectedInteriorAsset ? (
        <SelectedInteriorAssetInspector asset={resolvedSelectedInteriorAsset} />
      ) : null}
    </div>
  );
}

"use client";

import { IconTriangle, IconTriangleInverted, RotateCcw, RotateCw, Transfer } from "@/components/ui/icons";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { getRotatedInteriorAssetForRoom } from "@/lib/editor/interiorAssets";
import { formatMetricWallDimension } from "@/lib/editor/measurements";
import type { RoomInteriorAsset } from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";

type SelectedInteriorAssetInspectorProps = {
  asset: RoomInteriorAsset;
  className?: string;
};

function InspectorIconTooltip({
  content,
  children,
  groupItem = false,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  groupItem?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span data-slot={groupItem ? "button-group-item" : undefined} className="inline-flex">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function SelectedInteriorAssetInspector({
  asset,
  className,
}: SelectedInteriorAssetInspectorProps) {
  const selectedInteriorAsset = useEditorStore((state) => state.selectedInteriorAsset);
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
  const startInteriorAssetArrowLabelSession = useEditorStore(
    (state) => state.startInteriorAssetArrowLabelSession
  );
  const updateInteriorAssetArrowLabelDraft = useEditorStore(
    (state) => state.updateInteriorAssetArrowLabelDraft
  );
  const commitInteriorAssetArrowLabelSession = useEditorStore(
    (state) => state.commitInteriorAssetArrowLabelSession
  );
  const cancelInteriorAssetArrowLabelSession = useEditorStore(
    (state) => state.cancelInteriorAssetArrowLabelSession
  );
  const rotateSelectedInteriorAsset = useEditorStore((state) => state.rotateSelectedInteriorAsset);
  const setSelectedInteriorAssetArrowEnabled = useEditorStore(
    (state) => state.setSelectedInteriorAssetArrowEnabled
  );
  const swapSelectedInteriorAssetArrowDirection = useEditorStore(
    (state) => state.swapSelectedInteriorAssetArrowDirection
  );
  const selectInteriorAssetById = useEditorStore((state) => state.selectInteriorAssetById);
  const promptConnectedFloorForSelectedStair = useEditorStore(
    (state) => state.promptConnectedFloorForSelectedStair
  );
  const addConnectedFloorAboveFromSelectedStair = useEditorStore(
    (state) => state.addConnectedFloorAboveFromSelectedStair
  );
  const addConnectedFloorBelowFromSelectedStair = useEditorStore(
    (state) => state.addConnectedFloorBelowFromSelectedStair
  );
  const canAddFloorAbove = useEditorStore((state) => {
    const roomId = state.selectedInteriorAsset?.roomId;
    if (!roomId) return false;
    const room = state.document.rooms.find((candidate) => candidate.id === roomId);
    if (!room) return false;
    const activeFloorId = state.document.activeFloorId;
    if ((room.floorId ?? activeFloorId) !== activeFloorId) return false;
    const activeFloorIndex = state.document.floors.findIndex((floor) => floor.id === activeFloorId);
    return activeFloorIndex === state.document.floors.length - 1;
  });
  const canAddFloorBelow = useEditorStore((state) => {
    const roomId = state.selectedInteriorAsset?.roomId;
    if (!roomId) return false;
    const room = state.document.rooms.find((candidate) => candidate.id === roomId);
    if (!room) return false;
    const activeFloorId = state.document.activeFloorId;
    if ((room.floorId ?? activeFloorId) !== activeFloorId) return false;
    const activeFloorIndex = state.document.floors.findIndex((floor) => floor.id === activeFloorId);
    return activeFloorIndex === 0;
  });
  const canRotateSelectedInteriorAsset = useEditorStore((state) => {
    const roomId = state.selectedInteriorAsset?.roomId;
    const assetId = state.selectedInteriorAsset?.assetId;
    if (!roomId || !assetId) return false;

    const room = state.document.rooms.find((candidate) => candidate.id === roomId);
    const selectedAsset = room?.interiorAssets.find((candidate) => candidate.id === assetId);
    if (!room || !selectedAsset) return false;

    return getRotatedInteriorAssetForRoom(room, selectedAsset, 90) !== null;
  });
  const selectedAssetRoomId = selectedInteriorAsset?.roomId ?? null;
  const selectedAssetId = selectedInteriorAsset?.assetId ?? null;

  return (
    <EditorInspectorSection
      title="Selected stair"
      description="Review the current stair block and adjust its orientation."
      className={className}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="stair-name-input" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="stair-name-input"
            value={asset.name}
            onFocus={() => {
              if (!selectedAssetRoomId || !selectedAssetId) return;
              startInteriorAssetRenameSession(selectedAssetRoomId, selectedAssetId);
            }}
            onChange={(event) => {
              if (!selectedAssetRoomId || !selectedAssetId) return;
              updateInteriorAssetRenameDraft(selectedAssetRoomId, selectedAssetId, event.target.value);
            }}
            onBlur={() => {
              if (!selectedAssetRoomId || !selectedAssetId) return;
              commitInteriorAssetRenameSession();
              selectInteriorAssetById(selectedAssetRoomId, selectedAssetId);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;

              if (event.key === "Enter") {
                event.preventDefault();
                if (!selectedAssetRoomId || !selectedAssetId) return;
                commitInteriorAssetRenameSession();
                selectInteriorAssetById(selectedAssetRoomId, selectedAssetId);
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                if (!selectedAssetRoomId || !selectedAssetId) return;
                cancelInteriorAssetRenameSession();
                selectInteriorAssetById(selectedAssetRoomId, selectedAssetId);
              }
            }}
            aria-describedby="stair-name-hint"
          />
          <p id="stair-name-hint" className="text-[11px] leading-relaxed text-muted-foreground">
            Labels this stair for future room and hierarchy context.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Dimensions</p>
          <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">
            {formatMetricWallDimension(asset.widthMm)} × {formatMetricWallDimension(asset.depthMm)}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Rotate</p>
          <ImmediateTooltipProvider>
            <ButtonGroup>
              <InspectorIconTooltip
                groupItem
                content={
                  canRotateSelectedInteriorAsset
                    ? "Rotate left 90°"
                    : "Rotate left 90° · Stairs won't fit after rotation"
                }
              >
                <span tabIndex={canRotateSelectedInteriorAsset ? -1 : 0}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => rotateSelectedInteriorAsset(-90)}
                    aria-label="Rotate stair left 90 degrees"
                    disabled={!canRotateSelectedInteriorAsset}
                  >
                    <RotateCcw />
                  </Button>
                </span>
              </InspectorIconTooltip>
              <InspectorIconTooltip
                groupItem
                content={
                  canRotateSelectedInteriorAsset
                    ? "Rotate right 90°"
                    : "Rotate right 90° · Stairs won't fit after rotation"
                }
              >
                <span tabIndex={canRotateSelectedInteriorAsset ? -1 : 0}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => rotateSelectedInteriorAsset(90)}
                    aria-label="Rotate stair right 90 degrees"
                    disabled={!canRotateSelectedInteriorAsset}
                  >
                    <RotateCw />
                  </Button>
                </span>
              </InspectorIconTooltip>
            </ButtonGroup>
          </ImmediateTooltipProvider>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Connected floor</p>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <ImmediateTooltipProvider>
              <div className="flex items-center gap-2">
                <ButtonGroup>
                  <InspectorIconTooltip
                    groupItem
                    content={
                      canAddFloorAbove
                        ? "Add floor above"
                        : "A higher floor already exists"
                    }
                  >
                    <span tabIndex={canAddFloorAbove ? -1 : 0}>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={addConnectedFloorAboveFromSelectedStair}
                        aria-label="Add floor above"
                        disabled={!canAddFloorAbove}
                      >
                        <IconTriangle />
                      </Button>
                    </span>
                  </InspectorIconTooltip>
                  <InspectorIconTooltip
                    groupItem
                    content={
                      canAddFloorBelow
                        ? "Add floor below"
                        : "A lower floor already exists"
                    }
                  >
                    <span tabIndex={canAddFloorBelow ? -1 : 0}>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={addConnectedFloorBelowFromSelectedStair}
                        aria-label="Add floor below"
                        disabled={!canAddFloorBelow}
                      >
                        <IconTriangleInverted />
                      </Button>
                    </span>
                  </InspectorIconTooltip>
                </ButtonGroup>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={promptConnectedFloorForSelectedStair}
                  className="rounded-full"
                >
                  More options
                </Button>
              </div>
            </ImmediateTooltipProvider>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Direction</p>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
            <label htmlFor="stair-direction-arrow-switch" className="text-sm font-medium">
              Show arrow
            </label>
            <Switch
              id="stair-direction-arrow-switch"
              checked={asset.arrowEnabled}
              onCheckedChange={setSelectedInteriorAssetArrowEnabled}
              aria-label="Toggle stair direction arrow"
            />
          </div>
          <ImmediateTooltipProvider>
            <div className="flex flex-wrap gap-2">
              <InspectorIconTooltip content="Swap direction">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => swapSelectedInteriorAssetArrowDirection()}
                  aria-label="Swap stair arrow direction"
                >
                  <Transfer />
                </Button>
              </InspectorIconTooltip>
            </div>
          </ImmediateTooltipProvider>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="stair-arrow-label-input" className="text-sm font-medium">
            Arrow label
          </label>
          <Input
            id="stair-arrow-label-input"
            value={asset.arrowLabel}
            onFocus={() => {
              if (!selectedAssetRoomId || !selectedAssetId) return;
              startInteriorAssetArrowLabelSession(selectedAssetRoomId, selectedAssetId);
            }}
            onChange={(event) => {
              if (!selectedAssetRoomId || !selectedAssetId) return;
              updateInteriorAssetArrowLabelDraft(
                selectedAssetRoomId,
                selectedAssetId,
                event.target.value.toUpperCase()
              );
            }}
            onBlur={() => {
              if (!selectedAssetRoomId || !selectedAssetId) return;
              commitInteriorAssetArrowLabelSession();
              selectInteriorAssetById(selectedAssetRoomId, selectedAssetId);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;

              if (event.key === "Enter") {
                event.preventDefault();
                if (!selectedAssetRoomId || !selectedAssetId) return;
                commitInteriorAssetArrowLabelSession();
                selectInteriorAssetById(selectedAssetRoomId, selectedAssetId);
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                if (!selectedAssetRoomId || !selectedAssetId) return;
                cancelInteriorAssetArrowLabelSession();
                selectInteriorAssetById(selectedAssetRoomId, selectedAssetId);
              }
            }}
            aria-describedby="stair-arrow-label-hint"
          />
          <p id="stair-arrow-label-hint" className="text-[11px] leading-relaxed text-muted-foreground">
            Tail label shown beside the stair direction arrow on canvas.
          </p>
        </div>
      </div>
    </EditorInspectorSection>
  );
}

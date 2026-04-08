"use client";

import { RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { formatMetricWallDimension } from "@/lib/editor/measurements";
import type { RoomInteriorAsset } from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";

type SelectedInteriorAssetInspectorProps = {
  asset: RoomInteriorAsset;
  className?: string;
};

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
  const rotateSelectedInteriorAsset = useEditorStore((state) => state.rotateSelectedInteriorAsset);
  const selectInteriorAssetById = useEditorStore((state) => state.selectInteriorAssetById);
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
          <p className="text-sm font-medium">Stair options</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => rotateSelectedInteriorAsset(-90)}
              aria-label="Rotate stair left 90 degrees"
              title="Rotate Left 90°"
            >
              <RotateCcw />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => rotateSelectedInteriorAsset(90)}
              aria-label="Rotate stair right 90 degrees"
              title="Rotate Right 90°"
            >
              <RotateCw />
            </Button>
          </div>
        </div>
      </div>
    </EditorInspectorSection>
  );
}

"use client";

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
  const updateSelectedInteriorAssetName = useEditorStore(
    (state) => state.updateSelectedInteriorAssetName
  );

  const commitNameDraft = (nameValue: string) => {
    updateSelectedInteriorAssetName(nameValue);
  };

  return (
    <EditorInspectorSection
      title="Selected stair"
      description="Review the current stair block and reserve space for future stair-specific controls."
      className={className}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="stair-name-input" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="stair-name-input"
            key={`${asset.id}-${asset.name}`}
            defaultValue={asset.name}
            onBlur={(event) => commitNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;

              if (event.key === "Enter") {
                event.preventDefault();
                commitNameDraft(event.currentTarget.value);
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                event.currentTarget.value = asset.name;
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
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            Rotation, arrow style, and related stair settings will land here in a later step.
          </div>
        </div>
      </div>
    </EditorInspectorSection>
  );
}

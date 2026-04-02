"use client";

import { Input } from "@/components/ui/input";
import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { formatNorthBearingDegrees, normalizeNorthBearingDegrees } from "@/lib/editor/north";
import { useEditorStore } from "@/stores/editorStore";

type SelectedNorthInspectorProps = {
  className?: string;
};

export function SelectedNorthInspector({ className }: SelectedNorthInspectorProps) {
  const northBearingDegrees = useEditorStore((state) => state.document.northBearingDegrees);
  const updateNorthBearingDegrees = useEditorStore((state) => state.updateNorthBearingDegrees);
  const selectNorthIndicator = useEditorStore((state) => state.selectNorthIndicator);

  const commitBearingDraft = (value: string) => {
    const parsedBearing = Number(value);
    if (!Number.isFinite(parsedBearing)) return;
    updateNorthBearingDegrees(parsedBearing);
  };

  return (
    <EditorInspectorSection
      title="North indicator"
      description="Adjust project orientation using a direct bearing value."
      className={className}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="north-bearing-input" className="text-sm font-medium">
            Bearing (degrees)
          </label>
          <Input
            id="north-bearing-input"
            key={northBearingDegrees}
            inputMode="numeric"
            defaultValue={String(normalizeNorthBearingDegrees(northBearingDegrees))}
            onFocus={() => selectNorthIndicator()}
            onBlur={(event) => {
              commitBearingDraft(event.target.value);
              selectNorthIndicator();
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;

              if (event.key === "Enter") {
                event.preventDefault();
                commitBearingDraft(event.currentTarget.value);
                selectNorthIndicator();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                event.currentTarget.value = String(
                  normalizeNorthBearingDegrees(northBearingDegrees)
                );
              }
            }}
            aria-describedby="north-bearing-hint"
          />
          <p id="north-bearing-hint" className="text-[11px] leading-relaxed text-muted-foreground">
            Drag the HUD north marker on canvas or enter a manual bearing here.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Current orientation</p>
          <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">
            {formatNorthBearingDegrees(northBearingDegrees)}
          </div>
        </div>
      </div>
    </EditorInspectorSection>
  );
}

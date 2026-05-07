"use client";

import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { formatMetricWallDimension, getEdgeLengthMillimetres } from "@/lib/editor/measurements";
import { useEditorStore } from "@/stores/editorStore";

type RulerInspectorProps = {
  className?: string;
};

export function RulerInspector({ className }: RulerInspectorProps) {
  const rulerDraft = useEditorStore((state) => state.rulerDraft);
  const resetRulerDraft = useEditorStore((state) => state.resetRulerDraft);
  const liveDistance =
    rulerDraft.start && rulerDraft.end
      ? formatMetricWallDimension(getEdgeLengthMillimetres(rulerDraft.start, rulerDraft.end))
      : null;
  const isDrawingRuler = rulerDraft.start !== null;

  return (
    <EditorInspectorSection
      title="Ruler Tool"
      className={className}
      bodyClassName="flex flex-col gap-4"
    >
      <div className="rounded-md border border-lime-500/25 bg-lime-500/10 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Live distance
        </p>
        <p className="mt-1 font-mono text-lg font-semibold text-lime-700 dark:text-lime-300">
          {liveDistance ?? "Place start point"}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
          <span className="text-sm text-foreground/80">45° line</span>
          <KbdGroup>
            <Kbd>Shift</Kbd>
          </KbdGroup>
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
          <span className="text-sm text-foreground/80">Cancel current ruler</span>
          <KbdGroup>
            <Kbd>Esc</Kbd>
          </KbdGroup>
        </div>
      </div>

      {isDrawingRuler ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetRulerDraft}
          className="border-lime-500/40 text-lime-700 hover:bg-lime-500/10 dark:text-lime-300"
        >
          Cancel current ruler
        </Button>
      ) : null}
    </EditorInspectorSection>
  );
}

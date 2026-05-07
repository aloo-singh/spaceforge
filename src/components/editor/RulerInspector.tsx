"use client";

import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { Button, ButtonGroup } from "@/components/ui/button";
import { IconEye, Trash2 } from "@/components/ui/icons";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { formatMetricWallDimension, getEdgeLengthMillimetres } from "@/lib/editor/measurements";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";

type RulerInspectorProps = {
  className?: string;
};

export function RulerInspector({ className }: RulerInspectorProps) {
  const rulerDraft = useEditorStore((state) => state.rulerDraft);
  const rulers = useEditorStore((state) => state.document.rulerMeasurements);
  const selectedRulerId = useEditorStore((state) => state.selectedRulerId);
  const resetRulerDraft = useEditorStore((state) => state.resetRulerDraft);
  const selectRulerById = useEditorStore((state) => state.selectRulerById);
  const toggleRulerHidden = useEditorStore((state) => state.toggleRulerHidden);
  const deleteRulerMeasurement = useEditorStore((state) => state.deleteRulerMeasurement);
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

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rulers
          </h4>
          <span className="font-mono text-xs text-muted-foreground">{rulers.length}</span>
        </div>

        {rulers.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
            Click two points on the canvas to add a ruler.
          </p>
        ) : (
          <div className="space-y-2">
            {rulers.map((ruler, index) => {
              const distance = formatMetricWallDimension(
                getEdgeLengthMillimetres(ruler.start, ruler.end)
              );
              const isSelected = selectedRulerId === ruler.id;

              return (
                <div
                  key={ruler.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => selectRulerById(ruler.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    selectRulerById(ruler.id);
                  }}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                    isSelected
                      ? "border-lime-500/45 bg-lime-500/10"
                      : "border-border/70 bg-muted/35 hover:bg-muted/55",
                    ruler.hidden && "opacity-60"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground/86">
                      Ruler {index + 1}
                    </p>
                    <p className="font-mono text-sm text-lime-700 dark:text-lime-300">
                      {distance}
                    </p>
                  </div>

                  <ButtonGroup className="shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={ruler.hidden ? "Show ruler" : "Hide ruler"}
                      aria-pressed={!ruler.hidden}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleRulerHidden(ruler.id);
                      }}
                      className={cn(!ruler.hidden && "text-lime-700 dark:text-lime-300")}
                    >
                      <IconEye className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete ruler"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteRulerMeasurement(ruler.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </ButtonGroup>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </EditorInspectorSection>
  );
}

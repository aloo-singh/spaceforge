"use client";

import { useRef } from "react";
import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { EditorSidebarRenameInput } from "@/components/editor/EditorSidebarRenameInput";
import { Button, ButtonGroup } from "@/components/ui/button";
import { IconEye, RulerMeasure2, Trash2 } from "@/components/ui/icons";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { formatMetricWallDimension, getEdgeLengthMillimetres } from "@/lib/editor/measurements";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";

type RulerInspectorProps = {
  className?: string;
};

export function RulerInspector({ className }: RulerInspectorProps) {
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const rulerDraft = useEditorStore((state) => state.rulerDraft);
  const rulers = useEditorStore((state) => state.document.rulerMeasurements);
  const selectedRulerId = useEditorStore((state) => state.selectedRulerId);
  const rulerRenameSession = useEditorStore((state) => state.rulerRenameSession);
  const resetRulerDraft = useEditorStore((state) => state.resetRulerDraft);
  const selectRulerById = useEditorStore((state) => state.selectRulerById);
  const toggleRulerHidden = useEditorStore((state) => state.toggleRulerHidden);
  const deleteRulerMeasurement = useEditorStore((state) => state.deleteRulerMeasurement);
  const clearRulerMeasurements = useEditorStore((state) => state.clearRulerMeasurements);
  const startRulerRenameSession = useEditorStore((state) => state.startRulerRenameSession);
  const updateRulerRenameDraft = useEditorStore((state) => state.updateRulerRenameDraft);
  const commitRulerRenameSession = useEditorStore((state) => state.commitRulerRenameSession);
  const cancelRulerRenameSession = useEditorStore((state) => state.cancelRulerRenameSession);
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
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Live distance</p>
        <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground flex items-center gap-2">
          <RulerMeasure2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-mono">
            {liveDistance ?? <span className="text-muted-foreground italic">Place start point</span>}
          </span>
        </div>
      </div>

      {isDrawingRuler ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetRulerDraft}
        >
          Cancel current ruler
        </Button>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rulers
          </h4>
          <div className="flex items-center gap-2">
            {rulers.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={clearRulerMeasurements}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Clear all
              </Button>
            ) : null}
            <span className="font-mono text-xs text-muted-foreground">{rulers.length}</span>
          </div>
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
                      ? "border-primary/40 bg-primary/8"
                      : "border-border/70 bg-muted/35 hover:bg-muted/55",
                    ruler.hidden && "opacity-60"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isSelected && rulerRenameSession?.rulerId === ruler.id ? (
                        <EditorSidebarRenameInput
                          ref={(el) => {
                            if (el) inputRefs.current.set(ruler.id, el);
                            else inputRefs.current.delete(ruler.id);
                          }}
                          value={ruler.name ?? `Ruler ${index + 1}`}
                          onChange={(event) => updateRulerRenameDraft(ruler.id, event.target.value)}
                          onBlur={() => {
                            commitRulerRenameSession();
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
                              cancelRulerRenameSession();
                              event.currentTarget.blur();
                            }
                          }}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Rename ruler ${index + 1}`}
                          className="flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 text-sm font-medium"
                        />
                      ) : (
                        <p
                          className="text-sm font-medium text-foreground/86 min-w-0 truncate"
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            selectRulerById(ruler.id);
                            startRulerRenameSession(ruler.id);
                            requestAnimationFrame(() => {
                              inputRefs.current.get(ruler.id)?.focus();
                            });
                          }}
                        >
                          {ruler.name || `Ruler ${index + 1}`}
                        </p>
                      )}
                      {ruler.hidden ? (
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground shrink-0">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    <p className="font-mono text-sm text-lime-500 dark:text-lime-400">
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
                      className={cn(!ruler.hidden ? "text-foreground" : "text-muted-foreground")}
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

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Keyboard shortcuts
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
            <span className="text-sm text-foreground/80">45° angles</span>
            <KbdGroup>
              <Kbd>Shift</Kbd>
            </KbdGroup>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
            <span className="text-sm text-foreground/80">Toggle snapping</span>
            <KbdGroup>
              <Kbd>S</Kbd>
            </KbdGroup>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
            <span className="text-sm text-foreground/80">Toggle guides</span>
            <KbdGroup>
              <Kbd>G</Kbd>
            </KbdGroup>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
            <span className="text-sm text-foreground/80">Pan canvas</span>
            <KbdGroup>
              <Kbd>Space</Kbd>
            </KbdGroup>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
            <span className="text-sm text-foreground/80">Cancel ruler</span>
            <KbdGroup>
              <Kbd>Esc</Kbd>
            </KbdGroup>
          </div>
        </div>
      </div>
    </EditorInspectorSection>
  );
}

"use client";

import {
  AlignEndHorizontal,
  AlignStartHorizontal,
  ArrowDownToLine,
  ArrowUpToLine,
} from "@/components/ui/icons";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RoomOpening } from "@/lib/editor/types";
import { useEditorStore } from "@/stores/editorStore";

type SelectedOpeningInspectorProps = {
  opening: RoomOpening;
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

function formatOpeningType(type: RoomOpening["type"]) {
  return type === "door" ? "Door" : "Window";
}

export function SelectedOpeningInspector({
  opening,
  className,
}: SelectedOpeningInspectorProps) {
  const updateSelectedOpeningWidth = useEditorStore((state) => state.updateSelectedOpeningWidth);
  const updateSelectedDoorOpeningSide = useEditorStore(
    (state) => state.updateSelectedDoorOpeningSide
  );
  const updateSelectedDoorHingeSide = useEditorStore((state) => state.updateSelectedDoorHingeSide);

  const commitWidthDraft = (widthValue: string) => {
    const parsedWidth = Number(widthValue);
    if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) return;
    updateSelectedOpeningWidth(parsedWidth);
  };

  return (
    <EditorInspectorSection
      title="Selected opening"
      description="Adjust the current opening using canonical wall-relative controls."
      className={className}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Type</p>
          <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">
            {formatOpeningType(opening.type)}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="opening-width-input" className="text-sm font-medium">
            Width (mm)
          </label>
          <Input
            id="opening-width-input"
            key={`${opening.id}-${opening.widthMm}`}
            inputMode="numeric"
            defaultValue={String(opening.widthMm)}
            onBlur={(event) => commitWidthDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;

              if (event.key === "Enter") {
                event.preventDefault();
                commitWidthDraft(event.currentTarget.value);
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                event.currentTarget.value = String(opening.widthMm);
              }
            }}
            aria-describedby="opening-width-hint"
          />
          <p id="opening-width-hint" className="text-[11px] leading-relaxed text-muted-foreground">
            Width is constrained to the current host segment when saved.
          </p>
        </div>

        {opening.type === "door" ? (
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Opening side</p>
              <ImmediateTooltipProvider>
                <ButtonGroup>
                  {(["interior", "exterior"] as const).map((openingSide) => (
                    <InspectorIconTooltip
                      key={openingSide}
                      groupItem
                      content={openingSide === "interior" ? "Interior" : "Exterior"}
                    >
                      <Button
                        type="button"
                        variant={opening.openingSide === openingSide ? "secondary" : "outline"}
                        size="icon-sm"
                        onClick={() => updateSelectedDoorOpeningSide(openingSide)}
                        aria-label={openingSide === "interior" ? "Interior opening side" : "Exterior opening side"}
                      >
                        {openingSide === "interior" ? <ArrowDownToLine /> : <ArrowUpToLine />}
                      </Button>
                    </InspectorIconTooltip>
                  ))}
                </ButtonGroup>
              </ImmediateTooltipProvider>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Controls which side of the host wall the leaf swings toward.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Hinge side</p>
              <ImmediateTooltipProvider>
                <ButtonGroup>
                  {(["start", "end"] as const).map((hingeSide) => (
                    <InspectorIconTooltip
                      key={hingeSide}
                      groupItem
                      content={hingeSide === "start" ? "Start" : "End"}
                    >
                      <Button
                        type="button"
                        variant={opening.hingeSide === hingeSide ? "secondary" : "outline"}
                        size="icon-sm"
                        onClick={() => updateSelectedDoorHingeSide(hingeSide)}
                        aria-label={hingeSide === "start" ? "Start hinge side" : "End hinge side"}
                      >
                        {hingeSide === "start" ? <AlignStartHorizontal /> : <AlignEndHorizontal />}
                      </Button>
                    </InspectorIconTooltip>
                  ))}
                </ButtonGroup>
              </ImmediateTooltipProvider>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Hinge anchors to the canonical segment start or end.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </EditorInspectorSection>
  );
}

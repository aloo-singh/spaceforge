"use client";

import {
  ArrowsLeftRight,
  CaretLeftRightFilled,
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

  const toggleOpeningSide = () => {
    updateSelectedDoorOpeningSide(opening.openingSide === "interior" ? "exterior" : "interior");
  };

  const toggleHingeSide = () => {
    updateSelectedDoorHingeSide(opening.hingeSide === "start" ? "end" : "start");
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
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Orientation</p>
            <ImmediateTooltipProvider>
              <ButtonGroup>
                <InspectorIconTooltip
                  groupItem
                  content={`Opening side: ${
                    opening.openingSide === "interior" ? "Interior" : "Exterior"
                  }`}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={toggleOpeningSide}
                    aria-label={`Toggle opening side, currently ${
                      opening.openingSide === "interior" ? "interior" : "exterior"
                    }`}
                    aria-pressed={opening.openingSide === "exterior"}
                  >
                    <ArrowsLeftRight />
                  </Button>
                </InspectorIconTooltip>
                <InspectorIconTooltip
                  groupItem
                  content={`Hinge side: ${opening.hingeSide === "start" ? "Start" : "End"}`}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={toggleHingeSide}
                    aria-label={`Toggle hinge side, currently ${
                      opening.hingeSide === "start" ? "start" : "end"
                    }`}
                    aria-pressed={opening.hingeSide === "end"}
                  >
                    <CaretLeftRightFilled />
                  </Button>
                </InspectorIconTooltip>
              </ButtonGroup>
            </ImmediateTooltipProvider>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Toggle which side the door opens toward and which end of the host segment carries the hinge.
            </p>
          </div>
        ) : null}
      </div>
    </EditorInspectorSection>
  );
}

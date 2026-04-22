"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Keycap } from "@/components/ui/keycap";
import { Input } from "@/components/ui/input";
import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMobile } from "@/lib/use-mobile";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";
import type { SharedSelectionItem } from "@/lib/editor/types";

type SelectedFloorInspectorProps = {
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

export function SelectedFloorInspector({ className }: SelectedFloorInspectorProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const { isMobile } = useMobile();
  const [isCompactLandscapeViewport, setIsCompactLandscapeViewport] = useState(false);
  const floors = useEditorStore((state) => state.document.floors);
  const selectedFloorId = useEditorStore((state) => {
    const floorSelection = state.selection.find(
      (item): item is Extract<SharedSelectionItem, { type: "floor" }> => item.type === "floor"
    );
    return floorSelection?.id ?? null;
  });
  const isCanvasInteractionActive = useEditorStore((state) => state.isCanvasInteractionActive);
  const isDraftActive = useEditorStore((state) => state.roomDraft.points.length > 0);
  const startFloorRename = useEditorStore((state) => state.startFloorRename);
  const updateFloorRenameDraft = useEditorStore((state) => state.updateFloorRenameDraft);
  const commitFloorRenameSession = useEditorStore((state) => state.commitFloorRenameSession);
  const cancelFloorRename = useEditorStore((state) => state.cancelFloorRename);
  const selectFloorById = useEditorStore((state) => state.selectFloorById);
  const deleteFloor = useEditorStore((state) => state.deleteFloor);

  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId) ?? null;
  const canDeleteSelectedFloor = selectedFloor !== null;
  const isRenameBlocked = isCanvasInteractionActive || isDraftActive;
  const shouldHideKeyboardHints = isMobile || isCompactLandscapeViewport;

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
    if (!isRenameBlocked) return;
    const inputElement = document.getElementById("floor-name-input");
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

  if (!selectedFloor) return null;

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1", className)}>
      <EditorInspectorSection
        title="Selected floor"
        description="Review the current floor name and quick actions."
      >
        <aside ref={panelRef}>
          <label htmlFor="floor-name-input" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <Input
            id="floor-name-input"
            value={selectedFloor.name}
            onFocus={(event) => {
              if (isRenameBlocked) {
                event.currentTarget.blur();
                return;
              }
              startFloorRename(selectedFloor.id);
            }}
            onChange={(event) => updateFloorRenameDraft(selectedFloor.id, event.target.value)}
            onBlur={() => {
              commitFloorRenameSession();
              selectFloorById(selectedFloor.id);
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
                cancelFloorRename();
                selectFloorById(selectedFloor.id);
                event.currentTarget.blur();
              }
            }}
            placeholder="Untitled floor"
            autoComplete="off"
            disabled={isRenameBlocked}
            aria-describedby={shouldHideKeyboardHints ? undefined : "floor-name-input-hint"}
          />
          {!shouldHideKeyboardHints ? (
            <p
              id="floor-name-input-hint"
              className="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground/80 [@media(max-height:540px)_and_(orientation:landscape)]:mt-1"
            >
              <Keycap aria-hidden="true" className="h-4 min-w-0 rounded-sm border-border/70 bg-transparent px-1 text-[9px] shadow-none">
                Enter
              </Keycap>
              <span>save</span>
              <span aria-hidden="true">·</span>
              <Keycap aria-hidden="true" className="h-4 min-w-0 rounded-sm border-border/70 bg-transparent px-1 text-[9px] shadow-none">
                Esc
              </Keycap>
              <span>cancel</span>
            </p>
          ) : null}
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 [@media(max-height:540px)_and_(orientation:landscape)]:mt-3 [@media(max-height:540px)_and_(orientation:landscape)]:p-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Delete selected floor</p>
                <p
                  id="delete-floor-hint"
                  className="mt-1 text-[11px] leading-relaxed text-muted-foreground [@media(max-height:540px)_and_(orientation:landscape)]:text-[10px]"
                >
                  Removes this floor and all of its rooms. Undo restores it immediately.
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <ImmediateTooltipProvider>
                <InspectorIconTooltip
                  content={
                    shouldHideKeyboardHints ? (
                      "Delete floor"
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span>Delete floor</span>
                        <span className="inline-flex items-center gap-1">
                          <Keycap aria-hidden="true" className="shadow-none">
                            Del
                          </Keycap>
                          <span aria-hidden="true" className="text-muted-foreground/70">
                            /
                          </span>
                          <Keycap aria-hidden="true" className="shadow-none">
                            ⌫
                          </Keycap>
                        </span>
                      </span>
                    )
                  }
                >
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => deleteFloor(selectedFloor.id)}
                    disabled={!canDeleteSelectedFloor}
                    aria-label={`Delete ${selectedFloor.name}`}
                    aria-describedby="delete-floor-hint"
                  >
                    <Trash2 />
                  </Button>
                </InspectorIconTooltip>
              </ImmediateTooltipProvider>
            </div>
          </div>
        </aside>
      </EditorInspectorSection>
    </div>
  );
}
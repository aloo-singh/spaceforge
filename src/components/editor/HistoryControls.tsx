"use client";

import { useState } from "react";
import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Keycap } from "@/components/ui/keycap";
import { clearEditorSnapshot } from "@/lib/editor/editorPersistence";
import { useEditorStore } from "@/stores/editorStore";

export function HistoryControls() {
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const resetCanvas = useEditorStore((state) => state.resetCanvas);

  const confirmResetCanvas = () => {
    clearEditorSnapshot();
    resetCanvas();
    setIsResetDialogOpen(false);
  };

  return (
    <>
      <aside className="pointer-events-auto absolute top-4 right-4 z-20 rounded-lg border border-border/70 bg-card/90 p-2 text-card-foreground shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsResetDialogOpen(true)}
            aria-label="Reset canvas"
            className="text-destructive hover:text-destructive"
          >
            Reset canvas
          </Button>
          <div className="h-5 w-px bg-border/70" aria-hidden="true" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo last edit, shortcut Command or Control plus Z"
            className="gap-2"
          >
            <Undo2 />
            Undo
            <Keycap aria-hidden="true" className="h-5 min-w-0 rounded-sm px-1.5 text-[10px]">
              ⌘Z
            </Keycap>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo last undone edit, shortcut Shift+Command+Z, Control+Shift+Z, or Control+Y"
            className="gap-2"
          >
            <Redo2 />
            Redo
            <Keycap aria-hidden="true" className="h-5 min-w-0 rounded-sm px-1.5 text-[10px]">
              ⇧⌘Z
            </Keycap>
          </Button>
        </div>
      </aside>

      {isResetDialogOpen ? (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-canvas-title"
            aria-describedby="reset-canvas-description"
            className="w-full max-w-md rounded-xl border border-border/70 bg-card p-5 text-card-foreground shadow-xl"
          >
            <h2 id="reset-canvas-title" className="text-base font-semibold">
              Reset canvas?
            </h2>
            <p id="reset-canvas-description" className="mt-2 text-sm text-muted-foreground">
              This will remove your current layout from the canvas and clear saved local editor data for this device.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsResetDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={confirmResetCanvas}>
                Reset canvas
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

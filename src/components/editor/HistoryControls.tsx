"use client";

import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/stores/editorStore";

export function HistoryControls() {
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  return (
    <aside className="pointer-events-auto absolute top-4 right-4 z-20 rounded-lg border border-border/70 bg-card/90 p-2 text-card-foreground shadow-md backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo last edit"
        >
          <Undo2 />
          Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo last undone edit"
        >
          <Redo2 />
          Redo
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Undo: Cmd/Ctrl+Z. Redo: Shift+Cmd+Z or Ctrl+Y.
      </p>
    </aside>
  );
}

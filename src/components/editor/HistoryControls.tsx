"use client";

import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Keycap } from "@/components/ui/keycap";
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
  );
}

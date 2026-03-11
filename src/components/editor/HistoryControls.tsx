"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Keycap } from "@/components/ui/keycap";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { clearEditorSnapshot } from "@/lib/editor/editorPersistence";
import { useEditorStore } from "@/stores/editorStore";

type HistoryControlsProps = {
  onExportPng?: (signatureText?: string) => void | Promise<void>;
  isExportingPng?: boolean;
  exportDisabled?: boolean;
};

export function HistoryControls({
  onExportPng,
  isExportingPng = false,
  exportDisabled = false,
}: HistoryControlsProps) {
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [exportSignatureText, setExportSignatureText] = useState("");
  const hasHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const isCanvasEmpty = useEditorStore(
    (state) => state.document.rooms.length === 0 && state.roomDraft.points.length === 0
  );
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const resetCanvas = useEditorStore((state) => state.resetCanvas);
  const isResetDisabled = !hasHydrated || isCanvasEmpty;
  const normalizedSignature = normalizeExportSignature(exportSignatureText);

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
            size="icon-sm"
            onClick={() => setIsResetDialogOpen(true)}
            disabled={isResetDisabled}
            aria-label="Reset canvas"
            title="Reset canvas"
          >
            <RotateCcw />
          </Button>
          <div className="h-5 w-px bg-border/70" aria-hidden="true" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onExportPng?.(normalizedSignature || undefined)}
            disabled={!onExportPng || exportDisabled || isExportingPng}
            aria-label="Export current canvas as PNG"
            className="gap-2"
          >
            <Download />
            {isExportingPng ? "Exporting..." : "Export PNG"}
          </Button>
          <Input
            type="text"
            value={exportSignatureText}
            onChange={(event) => setExportSignatureText(event.target.value)}
            maxLength={40}
            placeholder="Designed by..."
            aria-label="Optional export signature text"
            className="h-8 w-40 text-xs"
            disabled={isExportingPng}
          />
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

      <ResponsiveDialog
        open={isResetDialogOpen}
        onOpenChange={setIsResetDialogOpen}
        title="Reset canvas?"
        description="This will remove your current layout from the canvas and clear saved local editor data for this device."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmResetCanvas}>
              Reset canvas
            </Button>
          </>
        }
      />
    </>
  );
}

function normalizeExportSignature(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

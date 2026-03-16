"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, LocateFixed, Redo2, RotateCcw, Settings2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Keycap } from "@/components/ui/keycap";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { EditorSettingsDialog } from "@/components/editor/EditorSettingsDialog";
import { clearEditorSnapshot } from "@/lib/editor/editorPersistence";
import { normalizeEditorExportSignature } from "@/lib/editor/settings";
import { useEditorStore } from "@/stores/editorStore";

type HistoryControlsProps = {
  onExportPng?: (signatureText?: string) => void | Promise<void>;
  isExportingPng?: boolean;
  exportDisabled?: boolean;
  exportDisabledReason?: string;
};

export function HistoryControls({
  onExportPng,
  isExportingPng = false,
  exportDisabled = false,
  exportDisabledReason,
}: HistoryControlsProps) {
  const settingsDialogId = "editor-settings-surface";
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const hasHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const exportSignatureText = useEditorStore((state) => state.settings.exportSignatureText);
  const hasRooms = useEditorStore((state) => state.document.rooms.length > 0);
  const isCanvasEmpty = useEditorStore(
    (state) => state.document.rooms.length === 0 && state.roomDraft.points.length === 0
  );
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const resetCamera = useEditorStore((state) => state.resetCamera);
  const resetCanvas = useEditorStore((state) => state.resetCanvas);
  const isResetCameraDisabled = !hasHydrated || !hasRooms;
  const isResetDisabled = !hasHydrated || isCanvasEmpty;
  const isUndoDisabled = !hasHydrated || !canUndo;
  const isRedoDisabled = !hasHydrated || !canRedo;
  const normalizedSignature = normalizeEditorExportSignature(exportSignatureText);
  const isExportButtonDisabled = !onExportPng || exportDisabled || isExportingPng;
  const exportButtonTitle = isExportButtonDisabled ? exportDisabledReason : undefined;
  const resetCameraTitle = !hasHydrated
    ? "Fit view is unavailable until the editor finishes loading"
    : hasRooms
      ? "Fit all rooms into view"
      : "Add a room to enable fit view";
  const resetCameraAriaLabel = !hasHydrated
    ? "Fit view unavailable"
    : hasRooms
      ? "Fit all rooms into view"
      : "Fit view unavailable";

  const confirmResetCanvas = () => {
    clearEditorSnapshot();
    resetCanvas();
    setIsResetDialogOpen(false);
  };

  return (
    <>
      <aside className="pointer-events-auto absolute top-4 right-4 z-20 flex max-w-[calc(100vw-2rem)] flex-wrap items-start justify-end gap-1.5 rounded-lg border border-border/70 bg-card/90 p-2 text-card-foreground shadow-md backdrop-blur-sm sm:flex-nowrap sm:items-center sm:gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/80 p-1 sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsSettingsDialogOpen(true)}
            aria-label="Open editor settings"
            aria-haspopup="dialog"
            aria-expanded={isSettingsDialogOpen}
            aria-controls={settingsDialogId}
            title="Editor settings"
            className="sm:size-8"
          >
            <Settings2 />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={resetCamera}
            disabled={isResetCameraDisabled}
            aria-label={resetCameraAriaLabel}
            title={resetCameraTitle}
            className="min-h-9 min-w-9 gap-2 px-2.5 sm:h-8 sm:min-h-8 sm:min-w-8 sm:px-2.5"
          >
            <LocateFixed />
            <span className="hidden sm:inline">Fit View</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => onExportPng?.(normalizedSignature || undefined)}
            disabled={isExportButtonDisabled}
            aria-label="Export current canvas as PNG"
            title={exportButtonTitle}
            className="min-h-9 min-w-9 gap-2 px-2.5 sm:h-8 sm:min-h-8 sm:min-w-8 sm:px-2.5"
          >
            <Download />
            <span className="hidden sm:inline">{isExportingPng ? "Exporting..." : "Export PNG"}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsResetDialogOpen(true)}
            disabled={isResetDisabled}
            aria-label="Reset canvas"
            title="Reset canvas"
            className="sm:size-8"
          >
            <RotateCcw />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/80 p-1 sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={undo}
            disabled={isUndoDisabled}
            aria-label="Undo last edit, shortcut Command or Control plus Z"
            className="min-h-9 min-w-9 gap-2 px-2.5 sm:h-8 sm:min-h-8 sm:min-w-8 sm:px-2.5"
          >
            <Undo2 />
            <span className="hidden sm:inline">Undo</span>
            <Keycap
              aria-hidden="true"
              className="hidden h-5 min-w-0 rounded-sm px-1.5 text-[10px] sm:inline-flex"
            >
              ⌘Z
            </Keycap>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={redo}
            disabled={isRedoDisabled}
            aria-label="Redo last undone edit, shortcut Shift+Command+Z, Control+Shift+Z, or Control+Y"
            className="min-h-9 min-w-9 gap-2 px-2.5 sm:h-8 sm:min-h-8 sm:min-w-8 sm:px-2.5"
          >
            <Redo2 />
            <span className="hidden sm:inline">Redo</span>
            <Keycap
              aria-hidden="true"
              className="hidden h-5 min-w-0 rounded-sm px-1.5 text-[10px] sm:inline-flex"
            >
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmResetCanvas}
              className="w-full sm:w-auto"
            >
              Reset canvas
            </Button>
          </>
        }
      />

      <EditorSettingsDialog
        contentId={settingsDialogId}
        open={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
      />
    </>
  );
}

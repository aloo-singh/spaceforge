"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useTheme } from "next-themes";
import {
  ChevronDown,
  Construction,
  DoorOpen,
  Download,
  LocateFixed,
  Redo2,
  Restore,
  Settings2,
  Undo2,
  WindowIcon,
} from "@/components/ui/icons";
import {
  ExportPngDialog,
  type ExportPngRequest,
} from "@/components/editor/ExportPngDialog";
import { EarlyExplorerBadge } from "@/components/ui/EarlyExplorerBadge";
import { Button, ButtonGroup } from "@/components/ui/button";
import { KeycapCombo } from "@/components/ui/keycap";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditorSettingsDialog } from "@/components/editor/EditorSettingsDialog";
import { track } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { clearEditorSnapshot } from "@/lib/editor/editorPersistence";
import { canPlaceDefaultStairInRoom } from "@/lib/editor/interiorAssets";
import { detectMacPlatform } from "@/lib/platform";
import { resolveEditorThemeMode } from "@/lib/editor/theme";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";

type HistoryControlsProps = {
  onExportPng?: (request: ExportPngRequest) => void | Promise<void>;
  onPreviewExportPng?: (request: ExportPngRequest) => Promise<string | null>;
  isExportingPng?: boolean;
  exportDisabled?: boolean;
  exportDisabledReason?: string;
  className?: string;
  leadingContent?: React.ReactNode;
};

type EditorChromeTooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  groupItem?: boolean;
};

function EditorChromeTooltip({
  content,
  children,
  side = "bottom",
  groupItem = false,
}: EditorChromeTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-slot={groupItem ? "button-group-item" : undefined}
          className="inline-flex"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} align="center">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function HistoryControls({
  onExportPng,
  onPreviewExportPng,
  isExportingPng = false,
  exportDisabled = false,
  exportDisabledReason,
  className,
  leadingContent,
}: HistoryControlsProps) {
  const settingsDialogId = "editor-settings-surface";
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const hasHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const isMacPlatform = useSyncExternalStore(
    () => () => undefined,
    detectMacPlatform,
    () => false
  );
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const hasRooms = useEditorStore((state) => state.document.rooms.length > 0);
  const selectedRoomId = useEditorStore((state) => state.selectedRoomId);
  const selectedRoom = useEditorStore((state) =>
    state.selectedRoomId
      ? state.document.rooms.find((room) => room.id === state.selectedRoomId) ?? null
      : null
  );
  const selectedWall = useEditorStore((state) => state.selectedWall);
  const isCanvasEmpty = useEditorStore(
    (state) => state.document.rooms.length === 0 && state.roomDraft.points.length === 0
  );
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const resetCamera = useEditorStore((state) => state.resetCamera);
  const resetCanvas = useEditorStore((state) => state.resetCanvas);
  const insertDefaultDoorOnSelectedWall = useEditorStore(
    (state) => state.insertDefaultDoorOnSelectedWall
  );
  const insertDefaultWindowOnSelectedWall = useEditorStore(
    (state) => state.insertDefaultWindowOnSelectedWall
  );
  const insertDefaultStairInSelectedRoom = useEditorStore(
    (state) => state.insertDefaultStairInSelectedRoom
  );
  const isResetCameraDisabled = !hasHydrated || !hasRooms;
  const isResetDisabled = !hasHydrated || isCanvasEmpty;
  const isUndoDisabled = !hasHydrated || !canUndo;
  const isRedoDisabled = !hasHydrated || !canRedo;
  const canInsertOpening = hasHydrated && selectedWall !== null;
  const canInsertStair = hasHydrated && selectedRoom !== null && canPlaceDefaultStairInRoom(selectedRoom);
  const isExportButtonDisabled = !onExportPng || exportDisabled || isExportingPng;
  const exportButtonTitle = isExportButtonDisabled ? exportDisabledReason : undefined;
  const currentThemeLabel = resolveEditorThemeMode(resolvedTheme) === "light" ? "Light" : "Dark";
  const defaultDesignedBy = useEditorStore((state) => state.settings.exportSignatureText);
  const exportTitle = useEditorStore((state) => state.document.exportConfig.title);
  const exportDescription = useEditorStore((state) => state.document.exportConfig.description);
  const exportTitlePosition = useEditorStore((state) => state.document.exportConfig.titlePosition);
  const exportDescriptionPosition = useEditorStore(
    (state) => state.document.exportConfig.descriptionPosition
  );
  const includeNorthIndicator = useEditorStore(
    (state) => state.document.exportConfig.includeNorthIndicator
  );
  const exportPreferences = useEditorStore((state) => state.exportPreferences);
  const updateExportPreferences = useEditorStore((state) => state.updateExportPreferences);
  const updateProjectExportConfig = useEditorStore((state) => state.updateProjectExportConfig);
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
  const undoShortcut = isMacPlatform ? ["⌘", "Z"] : ["Ctrl", "Z"];
  const redoShortcut = isMacPlatform ? ["⇧", "⌘", "Z"] : ["Ctrl", "Y"];

  const confirmResetCanvas = () => {
    clearEditorSnapshot();
    resetCanvas();
    setIsResetDialogOpen(false);
  };

  const openSettingsDialog = () => {
    if (isSettingsDialogOpen) return;
    track(ANALYTICS_EVENTS.settingsOpened);
    setIsSettingsDialogOpen(true);
  };

  return (
    <>
      <aside
        className={cn(
          "pointer-events-auto flex w-full flex-wrap items-start justify-between gap-2 text-card-foreground sm:flex-nowrap sm:items-center [@media(max-height:540px)_and_(orientation:landscape)]:gap-1.5",
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-2 sm:flex-1">
          {leadingContent ? <div className="shrink-0">{leadingContent}</div> : null}
          <ImmediateTooltipProvider>
            <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-background/80 p-1 sm:border-0 sm:bg-transparent sm:p-0 [@media(max-height:540px)_and_(orientation:landscape)]:gap-1 [@media(max-height:540px)_and_(orientation:landscape)]:p-0.5">
              <ButtonGroup>
                <EditorChromeTooltip
                  groupItem
                  content={canInsertOpening ? "Add door" : "Select a wall to add a door"}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={insertDefaultDoorOnSelectedWall}
                    disabled={!canInsertOpening}
                    aria-label="Add centered door to selected wall"
                    className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                  >
                    <DoorOpen />
                  </Button>
                </EditorChromeTooltip>
                <EditorChromeTooltip
                  groupItem
                  content={canInsertOpening ? "Add window" : "Select a wall to add a window"}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={insertDefaultWindowOnSelectedWall}
                    disabled={!canInsertOpening}
                    aria-label="Add centered window to selected wall"
                    className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                  >
                    <WindowIcon className="size-4" />
                  </Button>
                </EditorChromeTooltip>
                <EditorChromeTooltip
                  groupItem
                  content={
                    canInsertStair
                      ? "Add stairs"
                      : selectedRoomId
                        ? "Selected room is too small for stairs"
                        : "Select a room to add stairs"
                  }
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={insertDefaultStairInSelectedRoom}
                    disabled={!canInsertStair}
                    aria-label="Add stairs to selected room"
                    className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                  >
                    <Construction />
                  </Button>
                </EditorChromeTooltip>
              </ButtonGroup>
              <EditorChromeTooltip content="Editor settings">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={openSettingsDialog}
                  aria-label="Open editor settings"
                  aria-haspopup="dialog"
                  aria-expanded={isSettingsDialogOpen}
                  aria-controls={settingsDialogId}
                  className="sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                >
                  <Settings2 />
                </Button>
              </EditorChromeTooltip>
              <EditorChromeTooltip content={resetCameraTitle}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={resetCamera}
                  disabled={isResetCameraDisabled}
                  aria-label={resetCameraAriaLabel}
                  className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                >
                  <LocateFixed />
                </Button>
              </EditorChromeTooltip>
              <EditorChromeTooltip
                content={isExportButtonDisabled ? exportButtonTitle ?? "Export PNG unavailable" : "Export PNG"}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsExportDialogOpen(true)}
                  disabled={isExportButtonDisabled}
                  aria-label="Open PNG export options"
                  aria-haspopup="dialog"
                  aria-expanded={isExportDialogOpen}
                  className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                >
                  <Download />
                </Button>
              </EditorChromeTooltip>
              <EditorChromeTooltip
                content={
                  isResetDisabled ? "Nothing to reset yet" : "Reset canvas"
                }
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsResetDialogOpen(true)}
                  disabled={isResetDisabled}
                  aria-label="Reset canvas"
                  className="sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                >
                  <Restore />
                </Button>
              </EditorChromeTooltip>
            </div>
          </ImmediateTooltipProvider>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 [@media(max-height:540px)_and_(orientation:landscape)]:gap-1.5">
          <EarlyExplorerBadge />
          <ImmediateTooltipProvider>
            <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/80 p-1 sm:border-0 sm:bg-transparent sm:p-0 [@media(max-height:540px)_and_(orientation:landscape)]:gap-1 [@media(max-height:540px)_and_(orientation:landscape)]:p-0.5">
              <ButtonGroup>
                <EditorChromeTooltip
                  groupItem
                  content={
                    isUndoDisabled ? (
                      "Nothing to undo"
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span>Undo</span>
                        <KeycapCombo keys={undoShortcut} />
                      </span>
                    )
                  }
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={undo}
                    disabled={isUndoDisabled}
                    aria-label="Undo last edit, shortcut Command or Control plus Z"
                    className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                  >
                    <Undo2 />
                  </Button>
                </EditorChromeTooltip>
                <EditorChromeTooltip
                  groupItem
                  content="Undo history"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isUndoDisabled}
                    aria-label="Undo history dropdown"
                    className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </EditorChromeTooltip>
              </ButtonGroup>
              <ButtonGroup>
                <EditorChromeTooltip
                  groupItem
                  content={
                    isRedoDisabled ? (
                      "Nothing to redo"
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span>Redo</span>
                        <KeycapCombo keys={redoShortcut} />
                      </span>
                    )
                  }
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={redo}
                    disabled={isRedoDisabled}
                    aria-label="Redo last undone edit, shortcut Shift+Command+Z, Control+Shift+Z, or Control+Y"
                    className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                  >
                    <Redo2 />
                  </Button>
                </EditorChromeTooltip>
                <EditorChromeTooltip
                  groupItem
                  content="Redo history"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isRedoDisabled}
                    aria-label="Redo history dropdown"
                    className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </EditorChromeTooltip>
              </ButtonGroup>
            </div>
          </ImmediateTooltipProvider>
        </div>
      </aside>

      <ResponsiveAlertDialog
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

      <ExportPngDialog
        key={`${defaultDesignedBy}-${isExportDialogOpen ? "open" : "closed"}`}
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        onExport={(request) => onExportPng?.(request)}
        onPreviewRequest={onPreviewExportPng}
        isExporting={isExportingPng}
        exportDisabled={isExportButtonDisabled}
        exportDisabledReason={exportDisabledReason}
        title={exportTitle}
        description={exportDescription}
        titlePosition={exportTitlePosition}
        descriptionPosition={exportDescriptionPosition}
        includeNorthIndicator={includeNorthIndicator}
        showLegend={exportPreferences.showLegend}
        showScaleBar={exportPreferences.showScaleBar}
        showGrid={exportPreferences.showGrid}
        showDimensions={exportPreferences.showDimensions}
        theme={exportPreferences.theme}
        legendPosition={exportPreferences.legendPosition}
        scaleBarPosition={exportPreferences.scaleBarPosition}
        onTitleChange={(value) => updateProjectExportConfig({ title: value })}
        onDescriptionChange={(value) => updateProjectExportConfig({ description: value })}
        onTitlePositionChange={(value) => updateProjectExportConfig({ titlePosition: value })}
        onDescriptionPositionChange={(value) =>
          updateProjectExportConfig({ descriptionPosition: value })
        }
        onIncludeNorthIndicatorChange={(value) =>
          updateProjectExportConfig({ includeNorthIndicator: value })
        }
        onShowLegendChange={(value) => updateExportPreferences({ showLegend: value })}
        onShowScaleBarChange={(value) => updateExportPreferences({ showScaleBar: value })}
        onShowGridChange={(value) => updateExportPreferences({ showGrid: value })}
        onShowDimensionsChange={(value) => updateExportPreferences({ showDimensions: value })}
        onThemeChange={(value) => updateExportPreferences({ theme: value })}
        onLegendPositionChange={(value) => updateExportPreferences({ legendPosition: value })}
        onScaleBarPositionChange={(value) => updateExportPreferences({ scaleBarPosition: value })}
        currentThemeLabel={currentThemeLabel}
        defaultDesignedBy={defaultDesignedBy}
      />
    </>
  );
}
